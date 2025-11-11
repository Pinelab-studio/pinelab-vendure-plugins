import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  ID,
  Job,
  JobQueue,
  JobQueueService,
  Logger,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { getQlsClient } from '../lib/qls-client';
import { QlsOrderJobData, QlsPluginOptions } from '../types';
import { QlsProductService } from './qls-product.service';

@Injectable()
export class QlsOrderService implements OnModuleInit, OnApplicationBootstrap {
  private orderJobQueue!: JobQueue<QlsOrderJobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions,
    private jobQueueService: JobQueueService,
    private qlsProductService: QlsProductService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // TODO listen for OrderPlacedEvent and add a job to the queue

    // FIXME just testing
    await this.orderJobQueue.add({
      action: 'push-order',
      ctx: {} as any,
      orderId: '123',
    });
  }

  public async onModuleInit(): Promise<void> {
    this.orderJobQueue = await this.jobQueueService.createQueue({
      name: 'qls-order-jobs',
      process: (job) => {
        return this.handleOrderJob(job);
      },
    });
  }

  /**
   * Decide what kind of job it is and handle accordingly.
   * Returns the result of the job, which will be stored in the job record.
   */
  async handleOrderJob(job: Job<QlsOrderJobData>): Promise<unknown> {
    try {
      const ctx = RequestContext.deserialize(job.data.ctx);
      if (job.data.action === 'push-order') {
        return await this.pushOrder(ctx, job.data.orderId);
      }
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- According to TS this cant happen, in reality an old job with different action could be in the queue
      throw new Error(`Unknown job action: ${job.data.action}`);
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
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
    }
    const product = await client.getProductBySku('123'); // fixme
    console.log('QLS product=======', product);

    // Log error and throw

    // Create order in QLS

    // If not, throw an error

    const createdOrder = 1234; // FIXME

    return `Created order ${createdOrder} in QLS`;
  }
}
