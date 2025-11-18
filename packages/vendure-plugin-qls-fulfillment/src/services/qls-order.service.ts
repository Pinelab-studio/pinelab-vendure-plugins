import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EventBus,
  ID,
  Injector,
  Job,
  JobQueue,
  JobQueueService,
  Logger,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  FulfillmentOrderInput,
  FulfillmentOrderLineInput,
} from '../lib/client-types';
import { getQlsClient } from '../lib/qls-client';
import { QlsOrderJobData, QlsPluginOptions } from '../types';

@Injectable()
export class QlsOrderService implements OnModuleInit, OnApplicationBootstrap {
  private orderJobQueue!: JobQueue<QlsOrderJobData>;

  constructor(
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions,
    private jobQueueService: JobQueueService,
    private eventBus: EventBus,
    private orderService: OrderService,
    private moduleRef: ModuleRef
  ) {}

  onApplicationBootstrap(): void {
    // Listen for OrderPlacedEvent and add a job to the queue
    this.eventBus.ofType(OrderPlacedEvent).subscribe((event) => {
      this.triggerPushOrder(event.ctx, event.order.id, event.order.code).catch(
        (e) => {
          const error = asError(e);
          Logger.error(
            `Failed to trigger push order job for order ${event.order.code}: ${error.message}`,
            loggerCtx,
            error.stack
          );
        }
      );
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
        return await this.pushOrderToQls(ctx, job.data.orderId);
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

  async pushOrderToQls(ctx: RequestContext, orderId: ID): Promise<string> {
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      // Jobs are only added when QLS is enabled for the channel, so if we cant get a client here, something is wrong
      throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
    }
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new Error(`No order with id ${orderId} not found`);
    }
    // Check if all products are available in QLS
    const qlsProducts: FulfillmentOrderLineInput[] = order.lines.map((line) => {
      if (!line.productVariant.customFields.qlsProductId) {
        throw new Error(
          `Product variant '${line.productVariant.sku}' does not have a QLS product ID set. Unable to push order '${order.code}' to QLS.`
        );
      }
      return {
        amount_ordered: line.quantity,
        product_id: line.productVariant.customFields.qlsProductId,
        name: line.productVariant.name,
      };
    });
    const additionalOrderFields = await this.options.getAdditionalOrderFields?.(
      ctx,
      new Injector(this.moduleRef),
      order
    );
    const customerName = [order.customer?.firstName, order.customer?.lastName]
      .filter(Boolean)
      .join(' ');
    const name = order.shippingAddress.fullName || customerName;
    const qlsOrder: Omit<FulfillmentOrderInput, 'brand_id'> = {
      customer_reference: order.code,
      processable: new Date().toISOString(), // Processable starting now
      servicepoint_code: additionalOrderFields?.servicepoint_code,
      delivery_options: additionalOrderFields?.delivery_options ?? [],
      total_price: order.totalWithTax,
      receiver_contact: {
        name: name,
        companyname: order.shippingAddress.company ?? '',
        street: order.shippingAddress.streetLine1 ?? '',
        housenumber: order.shippingAddress.streetLine2 ?? '',
        postalcode: order.shippingAddress.postalCode ?? '',
        locality: order.shippingAddress.city ?? '',
        country: order.shippingAddress.countryCode?.toUpperCase() ?? '',
        email: order.customer?.emailAddress ?? '',
        phone: order.customer?.phoneNumber ?? '',
      },
      products: qlsProducts,
      ...(additionalOrderFields ?? {}),
    };
    const result = await client.createFulfillmentOrder(qlsOrder);
    return `Order '${order.code}' created in QLS with id '${result.id}'`;
  }

  async triggerPushOrder(
    ctx: RequestContext,
    orderId: ID,
    orderCode?: string
  ): Promise<Job<QlsOrderJobData> | undefined> {
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      // QLS not enabled for channel, so don't add a job to the queue
      Logger.info(
        `QLS not enabled for channel ${ctx.channel.token}, not adding order '${
          orderCode ?? orderId
        }' job to queue`,
        loggerCtx
      );
      return;
    }
    return await this.orderJobQueue.add(
      {
        action: 'push-order',
        ctx: ctx.serialize(),
        orderId,
      },
      { retries: 5 }
    );
  }
}
