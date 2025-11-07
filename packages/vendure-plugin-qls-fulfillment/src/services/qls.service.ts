import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { JobState } from '@vendure/common/lib/generated-types';
import {
  ID,
  Job,
  JobQueue,
  JobQueueService,
  Logger,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { QlsJobData, QlsPluginOptions } from '../types';
import util from 'util';
import { asError } from 'catch-unknown';
import { QlsClient } from './qls-client';

@Injectable()
export class QlsService implements OnModuleInit, OnApplicationBootstrap {
  private qlsJobsQueue!: JobQueue<QlsJobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions,
    private jobQueueService: JobQueueService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // TODO listen for OrderPlacedEvent and add a job to the queue
    // TODO listen for ProductVariantEvent and add a job to the queue

    // FIXME just testing
    await this.qlsJobsQueue.add({
      action: 'push-order',
      ctx: {} as any,
      orderId: '123',
    });
  }

  public async onModuleInit(): Promise<void> {
    this.qlsJobsQueue = await this.jobQueueService.createQueue({
      name: 'qls-jobs',
      process: (job) => {
        return this.handleJob(job);
      },
    });
  }

  /**
   * Decide what kind of job it is and handle accordingly.
   * Returns the result of the job, which will be stored in the job record.
   */
  async handleJob(job: Job<QlsJobData>): Promise<string> {
    try {
      const ctx = RequestContext.deserialize(job.data.ctx);
      if (job.data.action === 'push-order') {
        return await this.pushOrder(ctx, job.data.orderId);
      } else if (job.data.action === 'push-products') {
        return await this.pushProducts(ctx, job.data.variantIds);
      }
      throw new Error(`Unknown job action: ${(job.data as QlsJobData).action}`);
    } catch (e) {
      const error = asError(e);
      const dataWithoutCtx = {
        ...job.data,
        ctx: undefined,
      };
      Logger.error(
        `Error handling job ${job.data.action}: ${error}`,
        loggerCtx,
        util.inspect(dataWithoutCtx, false, 5)
      );
      throw error;
    }
  }

  async pushOrder(ctx: RequestContext, orderId: ID): Promise<string> {
    // Check if all products are available in QLS
    const client = await this.getClient(ctx);
    if (!client) {
      throw new Error('QLS client not found');
    }
    const product = await client.getProductBySku('123'); // fixme
    console.log('QLS product=======', product);

    // Log error and throw

    // Create order in QLS

    // If not, throw an error

    const createdOrder = 1234; // FIXME

    return `Created order ${createdOrder} in QLS`;
  }

  async pushProducts(ctx: RequestContext, variantIds: ID[]): Promise<string> {
    // TODO @Alex
    return 'success';
  }

  async getClient(ctx: RequestContext): Promise<QlsClient | undefined> {
    const config = await this.options.getConfig(ctx);
    if (!config) {
      return undefined;
    }
    return new QlsClient(config);
  }
}
