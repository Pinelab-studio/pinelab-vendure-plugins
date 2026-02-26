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
import {
  QlsServicePoint,
  QlsServicePointSearchInput,
} from '../api/generated/graphql';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  FulfillmentOrderInput,
  FulfillmentOrderLineInput,
  IncomingOrderWebhook,
} from '../lib/client-types';
import { getQlsClient } from '../lib/qls-client';
import { QlsOrderFailedEvent } from './qls-order-failed-event';
import { QlsOrderJobData, QlsPluginOptions } from '../types';
import { QlsOrderEntity } from '../entities/qls-order-entity.entity';

@Injectable()
export class QlsOrderService implements OnModuleInit, OnApplicationBootstrap {
  private orderJobQueue!: JobQueue<QlsOrderJobData>;

  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions,
    private jobQueueService: JobQueueService,
    private eventBus: EventBus,
    private orderService: OrderService,
    private moduleRef: ModuleRef,
    private readonly connection: TransactionalConnection
  ) {}

  onApplicationBootstrap(): void {
    // Listen for OrderPlacedEvent and add a job to the queue
    this.eventBus.ofType(OrderPlacedEvent).subscribe((event) => {
      if (!this.options.autoPushOrders) {
        Logger.info(
          `Auto push orders disabled, not triggering push order job for order ${event.order.code}`,
          loggerCtx
        );
        return;
      }
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

  /**
   * Push an order to QLS by id.
   * Returns a human-readable message describing the result of the operation (Used as job result).
   *
   * `force` can be used to force the push of an order even if one already exists in QLS.
   */
  async pushOrderToQls(
    ctx: RequestContext,
    orderId: ID,
    force: boolean = false
  ): Promise<string> {
    const client = await getQlsClient(ctx, this.options);
    if (!client) {
      // Jobs are only added when QLS is enabled for the channel, so if we cant get a client here, something is wrong
      throw new Error(`QLS not enabled for channel ${ctx.channel.token}`);
    }
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new Error(`No order with id ${orderId} not found`);
    }
    if (!force) {
      const existingQlsOrder = await this.connection
        .getRepository(ctx, QlsOrderEntity)
        .findOne({
          where: {
            vendureOrderId: orderId,
          },
        });
      if (existingQlsOrder) {
        throw new UserInputError(
          `Order '${order.code}' has already been synced to QLS`
        );
      }
    }
    try {
      // Map order variants to QLS products
      const qlsProducts: FulfillmentOrderLineInput[] = [];
      await Promise.all(
        order.lines.map(async (line) => {
          // Check if product variant should be excluded from sync
          if (
            await this.options.excludeVariantFromSync?.(
              ctx,
              new Injector(this.moduleRef),
              line.productVariant
            )
          ) {
            Logger.info(
              `Product variant '${line.productVariant.sku}' not sent to QLS in order '${order.code}' because it is excluded from sync.`,
              loggerCtx
            );
            return;
          }
          // Check if product is available in QLS
          if (!line.productVariant.customFields.qlsProductId) {
            throw new Error(
              `Product variant '${line.productVariant.sku}' does not have a QLS product ID set. Unable to push order '${order.code}' to QLS.`
            );
          }
          qlsProducts.push({
            amount_ordered: line.quantity,
            product_id: line.productVariant.customFields.qlsProductId,
            name: line.productVariant.name,
          });
        })
      );
      // Add additional order items, if any
      try {
        const additionalOrderItems =
          await this.options.addAdditionalOrderItems?.(
            ctx,
            new Injector(this.moduleRef),
            order
          );
        if (additionalOrderItems) {
          qlsProducts.push(...additionalOrderItems);
        }
      } catch (e) {
        const error = asError(e);
        Logger.error(
          `Error getting additional order items for order '${order.code}': ${error.message}`,
          loggerCtx,
          error.stack
        );
        throw new Error(
          `Error adding additional order items for order '${order.code}': ${error.message}`
        );
      }
      if (qlsProducts.length === 0) {
        const message = `No products to push to QLS for order '${order.code}'. Ignoring order.`;
        Logger.info(message, loggerCtx);
        return message;
      }
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
      const processable =
        (await this.options.processOrderFrom?.(ctx, order)) ?? new Date();
      const receiverContact = this.options.getReceiverContact?.(ctx, order);
      const qlsOrder: Omit<FulfillmentOrderInput, 'brand_id'> = {
        customer_reference: order.code,
        processable: processable.toISOString(),
        servicepoint_code: order.customFields?.qlsServicePointId,
        delivery_options: additionalOrderFields?.delivery_options ?? [],
        total_price: order.totalWithTax,
        receiver_contact: receiverContact ?? {
          name: order.shippingAddress.fullName || customerName,
          companyname: order.shippingAddress.company ?? '',
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
      // Add note but catch any errors, because we don't want the job to fail and retry when adding a note fails
      await this.orderService
        .addNoteToOrder(ctx, {
          id: orderId,
          isPublic: false,
          note: `Created order '${result.id}' in QLS`,
        })
        .catch((e) => {
          const error = asError(e);
          Logger.error(
            `Error adding note to order '${order.code}': ${error.message}`,
            loggerCtx,
            error.stack
          );
        });
      await this.connection
        .getRepository(ctx, QlsOrderEntity)
        .save({
          qlsOrderId: result.id,
          vendureOrderId: orderId,
        })
        .catch((e) => {
          // Catch any errors, because we don't want the job to fail and retry when custom field update fails
          const error = asError(e);
          Logger.error(
            `Error saving QLS order entity for order '${order.code}': ${error.message}`,
            loggerCtx,
            error.stack
          );
        });
      return `Order '${order.code}' created in QLS with id '${result.id}'`;
    } catch (e) {
      const error = asError(e);
      await this.orderService
        .addNoteToOrder(ctx, {
          id: orderId,
          isPublic: false,
          note: `Failed to create order '${order.code}' in QLS: ${error.message}`,
        })
        .catch((e) => {
          const error = asError(e);
          Logger.error(
            `Error adding note to order '${order.code}': ${error.message}`,
            loggerCtx,
            error.stack
          );
        });
      await this.eventBus
        .publish(new QlsOrderFailedEvent(ctx, order, new Date(), error.message))
        .catch((e) => {
          // Don't swallow original error, so catch and log this one
          const error = asError(e);
          Logger.error(
            `Error publishing QlsOrderFailedEvent for order '${order.code}': ${error.message}`,
            loggerCtx,
            error.stack
          );
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
    Logger.info(
      `Handling QLS order status update for order '${body.customer_reference}' with status '${body.status} and amount_delivered '${body.amount_delivered}' and amount_total '${body.amount_total}'`,
      loggerCtx
    );
    const orderCode = body.customer_reference;
    const order = await this.orderService.findOneByCode(ctx, orderCode, []);
    if (!order) {
      return Logger.warn(
        `Order with code '${orderCode}' not found, ignoring order status update`,
        loggerCtx
      );
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
      { retries: 3 }
    );
  }

  /**
   * Get QLS order id(s) for a Vendure order (for Order.qlsOrderIds field).
   */
  async getQlsOrderIdsForOrder(
    ctx: RequestContext,
    orderId: ID
  ): Promise<string[]> {
    const entities = await this.connection
      .getRepository(ctx, QlsOrderEntity)
      .find({
        where: { vendureOrderId: orderId },
      });
    return entities.map((e) => String(e.qlsOrderId));
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
    if (body.status === 'sent') {
      return 'Delivered';
    }
    if (body.status === 'partically_sent') {
      return 'PartiallyDelivered';
    }
  }
}
