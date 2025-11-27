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
  OrderState,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import util from 'util';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  FulfillmentOrderInput,
  FulfillmentOrderLineInput,
  IncomingOrderWebhook,
} from '../lib/client-types';
import { getQlsClient } from '../lib/qls-client';
import { QlsOrderJobData, QlsPluginOptions } from '../types';
import {
  QlsServicePoint,
  QlsServicePointSearchInput,
} from '../api/generated/graphql';

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
    try {
      // Check if all products are available in QLS
      const qlsProducts: FulfillmentOrderLineInput[] = order.lines.map(
        (line) => {
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
        }
      );
      const additionalOrderFields =
        await this.options.getAdditionalOrderFields?.(
          ctx,
          new Injector(this.moduleRef),
          order
        );
      const customerName = [order.customer?.firstName, order.customer?.lastName]
        .filter(Boolean)
        .join(' ');
      // Validate customer and shipping address
      if (!order.customer) {
        throw new Error(
          `Order '${order.code}' has no customer! Can not push order to QLS.`
        );
      }
      if (!order.shippingAddress) {
        throw new Error(
          `Order '${order.code}' has no shipping address! Can not push order to QLS.`
        );
      }
      if (
        !order.shippingAddress.streetLine1 ||
        !order.shippingAddress.postalCode ||
        !order.shippingAddress.city ||
        !order.shippingAddress.streetLine2 ||
        !order.shippingAddress.countryCode
      ) {
        throw new Error(
          `Shipping address for order '${order.code}' is missing one of required fields: streetLine1, postalCode, city, streetLine2, countryCode. Can not push order to QLS.`
        );
      }
      const qlsOrder: Omit<FulfillmentOrderInput, 'brand_id'> = {
        customer_reference: order.code,
        processable: new Date().toISOString(), // Processable starting now
        servicepoint_code: order.customFields?.qlsServicePointId,
        delivery_options: additionalOrderFields?.delivery_options ?? [],
        total_price: order.totalWithTax,
        receiver_contact: {
          name: order.shippingAddress.fullName || customerName,
          companyname: order.shippingAddress.company ?? customerName,
          street: order.shippingAddress.streetLine1,
          housenumber: order.shippingAddress.streetLine2,
          postalcode: order.shippingAddress.postalCode,
          locality: order.shippingAddress.city,
          country: order.shippingAddress.countryCode.toUpperCase(),
          email: order.customer.emailAddress,
          phone: order.customer.phoneNumber,
        },
        products: qlsProducts,
        ...(additionalOrderFields ?? {}),
      };
      const result = await client.createFulfillmentOrder(qlsOrder);
      Logger.info(
        `Successfully created order '${order.code}' in QLS with id '${result.id}'`,
        loggerCtx
      );
      await this.orderService.addNoteToOrder(ctx, {
        id: orderId,
        isPublic: false,
        note: `Created order '${result.id}' in QLS`,
      });
      return `Order '${order.code}' created in QLS with id '${result.id}'`;
    } catch (e) {
      const error = asError(e);
      await this.orderService.addNoteToOrder(ctx, {
        id: orderId,
        isPublic: false,
        note: `Failed to create order '${order.code}' in QLS: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Update the status of an order in QLS based on the given order code and status
   */
  async handleOrderStatusUpdate(
    ctx: RequestContext,
    body: IncomingOrderWebhook
  ): Promise<void> {
    const orderCode = body.customer_reference;
    const order = await this.orderService.findOneByCode(ctx, orderCode, []);
    if (!order) {
      throw new Error(`Order with code '${orderCode}' not found`);
    }
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
    }
    const vendureOrderState = this.getVendureOrderState(body);
    if (!vendureOrderState) {
      Logger.info(
        `Not handling QLS order status '${body.status}' for order '${orderCode}', because no Vendure order state found for this status`,
        loggerCtx
      );
      return;
    }
    await this.orderService.transitionToState(ctx, order.id, vendureOrderState);
    Logger.info(
      `Successfully updated order '${orderCode}' to '${vendureOrderState}'`,
      loggerCtx
    );
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

  async getServicePoints(
    ctx: RequestContext,
    input: QlsServicePointSearchInput
  ): Promise<QlsServicePoint[]> {
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      throw new UserInputError(
        `QLS not enabled for channel ${ctx.channel.token}`
      );
    }
    return await client.getServicePoints(input.countryCode, input.postalCode);
  }

  private getVendureOrderState(
    body: IncomingOrderWebhook
  ): OrderState | undefined {
    if (body.cancelled) {
      return 'Cancelled';
    }
    if (body.amount_delivered === body.amount_total) {
      return 'Delivered';
    }
    switch (body.status) {
      case 'sent':
        return 'Shipped';
      case 'partically_sent':
        return 'PartiallyShipped';
    }
  }
}
