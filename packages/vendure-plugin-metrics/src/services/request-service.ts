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
import DeviceDetector from 'device-detector-js';
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
      entity.deviceType = device || 'Unknown';
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
      .where('createdAt < :timestamp', { timestamp: pastDate.toISOString() })
      .execute()
      .catch((error) => {
        Logger.error(
          `Error removing old request logs: ${asError(error).message}`,
          loggerCtx
        );
      })
      .then((result) => {
        Logger.info(
          `Removed '${result}' old request logs older than ${
            this.options.displayPastMonths * 2
          } months`,
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
  private extractDeviceInfo(userAgent: string): string {
    const deviceDetector = new DeviceDetector();
    const parsed = deviceDetector.parse(userAgent);
    return parsed.device?.type || 'Unknown';
  }
}
