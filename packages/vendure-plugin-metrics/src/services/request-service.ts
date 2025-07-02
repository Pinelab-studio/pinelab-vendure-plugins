import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  RequestContext,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import crypto, { createHash } from 'crypto';
import { addMonths, differenceInHours } from 'date-fns';
import { DataSource } from 'typeorm';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { MetricRequestSalt } from '../entities/metric-request-salt';
import { MetricRequest } from '../entities/metric-request.entity';
import { MetricsPluginOptions } from '../metrics.plugin';
import { getSessions } from './metric-util';
import { PageVisitInput } from '../ui/generated/graphql';

export interface Session {
  identifier: string;
  deviceType: string;
  start: Date;
  end: Date;
}

type RequestData = {
  ipAddress: string;
  userAgent: string;
  channelId: string | number;
  path?: string;
  productId?: ID;
  productVariantId?: ID;
};

@Injectable()
export class RequestService implements OnModuleInit, OnApplicationBootstrap {
  /**
   * This queue is used to temporarily batch requests before they are persisted
   */
  private requestBatch: RequestData[] = [];

  private requestQueue!: JobQueue<RequestData[]>;

  private dailySalt?: MetricRequestSalt | null;

  constructor(
    private jobQueueService: JobQueueService,
    private dataSource: DataSource,
    @Inject(PLUGIN_INIT_OPTIONS) private options: MetricsPluginOptions
  ) {}

  async onModuleInit() {
    // Create and register the job queue
    this.requestQueue = await this.jobQueueService.createQueue({
      name: 'persist-metric-requests',
      process: async (job) =>
        this.handleLogRequestJobs(job.data).catch((err) => {
          Logger.warn(
            `Error processing request log job: ${err.message}`,
            loggerCtx
          );
          throw err;
        }),
    });
  }

  onApplicationBootstrap() {
    this.removeOldRequests();
  }

  /**
   * Adds a request to the batch, and pushes the batch to the queue once it reaches a certain size
   */
  logRequest(ctx: RequestContext, input?: PageVisitInput): void {
    if (this.options.shouldLogRequest && !this.options.shouldLogRequest(ctx)) {
      return;
    }
    const ipAddress =
      (ctx.req?.headers['x-forwarded-for'] as string) ||
      ctx.req?.socket.remoteAddress ||
      ctx.req?.ip;
    if (!ipAddress) {
      return;
    }
    const requestData: RequestData = {
      ipAddress,
      userAgent: ctx.req?.headers['user-agent'] || 'unknown',
      channelId: ctx.channelId,
      path: input?.path || undefined,
      productId: input?.productId || undefined,
      productVariantId: input?.productVariantId || undefined,
    };
    this.requestBatch.push(requestData);
    // Process queue if we've reached X items
    if (this.requestBatch.length >= 10) {
      this.createLogRequestJobs();
    }
  }

  /**
   * Processes the current request log queue, creates a job and clears the queue
   */
  private createLogRequestJobs(): void {
    if (this.requestBatch.length === 0) return;
    // Create a job with a copy of the current queue
    const requestBatch = [...this.requestBatch];
    // Clear the queue
    this.requestBatch = [];
    this.requestQueue
      .add(requestBatch, { retries: 2 }) // Not too many, because we will have a lot of requests
      .catch((err) =>
        Logger.error(`Error adding request log job: ${err.message}`, loggerCtx)
      );
  }

  /**
   * Handles the job data and stores it in the database
   */
  async handleLogRequestJobs(requests: RequestData[]): Promise<void> {
    const dailySalt = await this.getSalt();
    const entities = requests.map((request) => {
      // Create a hash of IP + user agent for privacy
      const hash = createHash('sha256')
        .update(`${request.ipAddress}:${request.userAgent}:${dailySalt}`)
        .digest('base64');
      const device = this.extractDeviceInfo(request.userAgent);
      const entity = new MetricRequest();
      entity.identifier = hash;
      entity.deviceType = device;
      entity.channelId = request.channelId;
      entity.path = request.path;
      entity.productId = request.productId;
      entity.productVariantId = request.productVariantId;
      return entity;
    });
    await this.dataSource.getRepository(MetricRequest).save(entities);
    Logger.debug(`Stored ${entities.length} request logs`, 'RequestService');
  }

  /**
   * Get the number of visits since a certain date.
   * Multiple requests from the same user within the same session are counted as one visit.
   */
  async getSessions(
    ctx: RequestContext,
    since: Date,
    sessionLengthInMinutes: number
  ): Promise<Session[]> {
    const requests = await this.getRequests(ctx, since);
    return getSessions(requests, sessionLengthInMinutes);
  }

  async getRequests(
    ctx: RequestContext,
    since: Date
  ): Promise<MetricRequest[]> {
    let hasMore = true;
    let skip = 0;
    const requests: MetricRequest[] = [];
    while (hasMore) {
      const result = await this.dataSource
        .getRepository(MetricRequest)
        .createQueryBuilder('metricRequest')
        .where('metricRequest.channelId = :channelId', {
          channelId: ctx.channelId,
        })
        .andWhere('metricRequest.createdAt >= :since', { since })
        .orderBy('metricRequest.createdAt', 'ASC')
        .skip(skip)
        .take(1000) // Fetch in batches of 1000
        .getMany();
      skip += 1000;
      requests.push(...result);
      if (result.length < 1000) {
        hasMore = false; // No more results to fetch
      }
    }
    return requests;
  }

  /**
   * Removes old requests from the database.
   * Removes requests older than 2 x displayPastMonths
   */
  removeOldRequests(): void {
    const today = new Date();
    const pastDate = addMonths(today, -this.options.displayPastMonths * 2);
    this.dataSource
      .createQueryBuilder()
      .delete()
      .from(MetricRequest)
      .where('createdAt < :timestamp', {
        timestamp: pastDate.toISOString().split('T')[0],
      })
      .execute()
      .catch((error) => {
        Logger.error(
          `Error removing old request logs: ${asError(error).message}`,
          loggerCtx
        );
      })
      .then((result) => {
        Logger.info(
          `Removed '${result?.affected}' old request logs older than ${this.options.removeRequestLogsOlderThanMonths} months`,
          loggerCtx
        );
      });
  }

  /**
   * Get or create a salt for the current day
   *
   * Checks if current salt exists in memory or in DB, and if it is still valid (24 hours).
   * If not, generates a new salt and persists it in DB.
   */
  private async getSalt(): Promise<string> {
    if (!this.dailySalt) {
      this.dailySalt = await this.dataSource
        .getRepository(MetricRequestSalt)
        .findOne({ where: { id: 1 } });
    }
    if (this.dailySalt) {
      const now = new Date();
      if (differenceInHours(now, this.dailySalt.updatedAt) < 24) {
        // Still valid
        return this.dailySalt.salt;
      }
    }
    // Else, generate new salt
    const salt = crypto.randomBytes(16).toString('hex');
    await this.dataSource.getRepository(MetricRequestSalt).save({
      id: 1,
      salt,
    });
    // Refetch, in case concurrent request of another instance created a new salt
    this.dailySalt = await this.dataSource
      .getRepository(MetricRequestSalt)
      .findOne({ where: { id: 1 } });
    Logger.info(
      `Generated new salt: ${this.dailySalt!.salt.slice(0, 3)}xxxxx`,
      loggerCtx
    );
    return this.dailySalt!.salt;
  }

  /**
   * Extracts basic device information from user agent string
   */
  extractDeviceInfo(userAgent: string): 'mobile' | 'other' {
    const ua = userAgent.toLowerCase();
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
        ua
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
        ua.substring(0, 4)
      )
    ) {
      return 'mobile';
    }
    return 'other';
  }
}
