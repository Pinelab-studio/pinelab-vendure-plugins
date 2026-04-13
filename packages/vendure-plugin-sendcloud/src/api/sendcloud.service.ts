import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ChannelService,
  EntityHydrator,
  ErrorResult,
  EventBus,
  FulfillmentStateTransitionError,
  HistoryService,
  ID,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  AddFulfillmentToOrderResult,
  ItemsAlreadyFulfilledError,
} from '@vendure/common/lib/generated-types';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';
import { toParcelInput } from './sendcloud.adapter';
import { loggerCtx, PLUGIN_OPTIONS } from './constants';
import { SendcloudConfigEntity } from './sendcloud-config.entity';
import { SendcloudClient } from './sendcloud.client';
import { sendcloudHandler } from './sendcloud.handler';
import { Parcel, ParcelInputItem } from './types/sendcloud-api.types';
import { SendcloudPluginOptions } from './types/sendcloud.types';

interface SendcloudJobData {
  orderCode: string;
  ctx: SerializedRequestContext;
}

@Injectable()
export class SendcloudService implements OnApplicationBootstrap {
  // @ts-ignore
  private jobQueue!: JobQueue<SendcloudJobData>;

  constructor(
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    // private rawConnection: Connection,
    private orderService: OrderService,
    private channelService: ChannelService,
    private jobQueueService: JobQueueService,
    private moduleRef: ModuleRef,
    @Inject(PLUGIN_OPTIONS) private options: SendcloudPluginOptions,
    private entityHydrator: EntityHydrator,
    private historyService: HistoryService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Listen for Settled orders to sync to sendcloud
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.jobQueue.add(
        {
          orderCode: event.order.code,
          ctx: event.ctx.serialize(),
        },
        { retries: 20 }
      );
    });
    // Handle jobs
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'sendcloud',
      process: async ({ data }) => {
        const ctx = RequestContext.deserialize(data.ctx);
        try {
          await this.syncOrder(ctx, data.orderCode);
        } catch (error) {
          Logger.warn(
            `Failed to sync order ${data.orderCode} for channel ${ctx.channel.token}: ${error}`,
            loggerCtx
          );
          throw error;
        }
      },
    });
  }

  async createOrderInSendcloud(
    userCtx: RequestContext,
    order: Order
  ): Promise<Parcel | undefined> {
    if (this.options.disabled) {
      Logger.info(
        `Plugin is disabled, not syncing order ${order.code}`,
        loggerCtx
      );
      return;
    }
    const ctx = await this.createContext(userCtx.channel.token); // Recreate a ctx with the channel's default language
    try {
      await this.entityHydrator.hydrate(ctx, order, {
        relations: [
          'customer',
          'lines.productVariant.product',
          'shippingLines.shippingMethod',
        ],
      });
      const additionalParcelItems: ParcelInputItem[] = [];
      if (this.options.additionalParcelItemsFn) {
        additionalParcelItems.push(
          ...(await this.options.additionalParcelItemsFn(
            ctx,
            new Injector(this.moduleRef),
            order
          ))
        );
      }
      const { client, defaultPhoneNr } = await this.getClient(ctx);
      const parcelInput = toParcelInput(order, this.options, defaultPhoneNr);
      parcelInput.parcel_items.unshift(...additionalParcelItems);
      const parcel = await client.createParcel(parcelInput);
      await this.logHistoryEntry(ctx, order.id);
      return parcel;
    } catch (err: unknown) {
      await this.logHistoryEntry(ctx, order.id, err);
      throw err;
    }
  }

  async upsertConfig(
    ctx: RequestContext,
    config: {
      secret: string;
      publicKey: string;
      defaultPhoneNr: string;
    }
  ): Promise<SendcloudConfigEntity> {
    const repo = this.connection.getRepository(ctx, SendcloudConfigEntity);
    const existing = await repo.findOne({
      where: { channelId: String(ctx.channelId) },
    });
    if (existing) {
      await repo.update(existing.id, {
        secret: config.secret,
        publicKey: config.publicKey,
        defaultPhoneNr: config.defaultPhoneNr,
      });
    } else {
      await repo.insert({
        channelId: String(ctx.channelId),
        secret: config.secret,
        publicKey: config.publicKey,
        defaultPhoneNr: config.defaultPhoneNr,
      });
    }
    return repo.findOneOrFail({ where: { channelId: String(ctx.channelId) } });
  }

  async getConfig(ctx: RequestContext): Promise<SendcloudConfigEntity | null> {
    return this.connection
      .getRepository(ctx, SendcloudConfigEntity)
      .findOne({ where: { channelId: String(ctx.channelId) } });
  }

  async getClient(
    ctx: RequestContext
  ): Promise<{ client: SendcloudClient; defaultPhoneNr?: string }> {
    const config = await this.getConfig(ctx);
    if (!config || !config?.secret || !config.publicKey) {
      throw Error(`Incomplete config found for channel ${ctx.channel.token}`);
    }
    return {
      client: new SendcloudClient(config.publicKey, config.secret),
      defaultPhoneNr: config.defaultPhoneNr,
    };
  }

  async createContext(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      languageCode: channel.defaultLanguageCode,
      channel,
    });
  }

  /**
   * Sync order to Sendcloud platform
   */
  private async syncOrder(
    ctx: RequestContext,
    orderCode: string
  ): Promise<void> {
    const config = await this.getConfig(ctx);
    if (!config?.secret || !config?.publicKey) {
      return;
    }
    let order = await this.orderService.findOneByCode(ctx, orderCode, [
      'shippingLines',
      'shippingLines.shippingMethod',
      'lines',
    ]);
    if (!order) {
      return Logger.error(
        `No order found with code ${orderCode}. Can not sync this order.`,
        loggerCtx
      );
    }
    const hasSendcloudHandler = order.shippingLines.find(
      (line) =>
        line.shippingMethod?.fulfillmentHandlerCode === sendcloudHandler.code
    );
    if (!hasSendcloudHandler) {
      return Logger.info(
        `Order ${order.code} does not have SendCloud set as handler. Not syncing this order.`,
        loggerCtx
      );
    }
    Logger.info(
      `Syncing order ${orderCode} for channel ${ctx.channel.token}`,
      loggerCtx
    );
    const result = await this.createOrderInSendcloud(ctx, order);
    if (result) {
      Logger.info(
        `Order ${order.code} synced to SendCloud: ${result.id}`,
        loggerCtx
      );
    }
  }

  async logHistoryEntry(
    ctx: RequestContext,
    orderId: ID,
    error?: unknown
  ): Promise<void> {
    let prettifiedError = error
      ? JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
      : undefined; // Make sure its serializable
    await this.historyService.createHistoryEntryForOrder(
      {
        ctx,
        orderId,
        type: 'SENDCLOUD_NOTIFICATION' as any,
        data: {
          name: 'SendCloud',
          valid: !error,
          error: prettifiedError,
        },
      },
      false
    );
  }

  /**
   * Find orders placed within the last N days that use the SendCloud fulfillment handler
   * and process them based on their current state:
   * - PaymentAuthorized: create fulfillment only (no shipping transitions)
   * - PaymentSettled: fulfill + transition to Shipped + transition to Delivered
   * - Shipped: transition existing fulfillment(s) to Delivered
   *
   * Intended to be called by the `fulfillSettledOrdersTask` scheduled task.
   */
  async fulfillPlacedOrders(
    settledSinceDays: number
  ): Promise<{ fulfilled: number; skipped: number; failed: number }> {
    const ctx = await this.createContext(
      (
        await this.channelService.getDefaultChannel()
      ).token
    );
    const channels = await this.channelService.findAll(ctx);
    const summary = { fulfilled: 0, skipped: 0, failed: 0 };
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - settledSinceDays);
    for (const channel of channels.items) {
      const channelCtx = new RequestContext({
        apiType: 'admin',
        channel,
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
      });
      let skip = 0;
      const take = 100;
      while (true) {
        const orderList = await this.orderService.findAll(
          channelCtx,
          {
            filter: {
              state: {
                in: [
                  'PaymentAuthorized',
                  'PaymentSettled',
                  'Fulfilled',
                  'Shipped',
                ],
              },
              orderPlacedAt: { after: sinceDate.toISOString() },
            },
            skip,
            take,
          },
          ['lines', 'shippingLines', 'shippingLines.shippingMethod']
        );
        for (const order of orderList.items) {
          const hasSendcloudHandler = order.shippingLines?.find(
            (line) =>
              line.shippingMethod?.fulfillmentHandlerCode ===
              sendcloudHandler.code
          );
          if (!hasSendcloudHandler) {
            summary.skipped++;
            continue;
          }
          try {
            if (order.state === 'PaymentAuthorized') {
              await this.createFulfillmentOnly(channelCtx, order);
              Logger.info(
                `Created fulfillment for authorized order ${order.code}`,
                loggerCtx
              );
              summary.fulfilled++;
            } else if (
              order.state === 'PaymentSettled' ||
              order.state === 'Delivered' ||
              order.state === 'Shipped'
            ) {
              await this.fulfillOrderToDelivered(channelCtx, order);
              Logger.info(
                `Fulfilled order ${order.code} (state: ${order.state}) to Delivered`,
                loggerCtx
              );
              summary.fulfilled++;
            }
          } catch (e: any) {
            summary.failed++;
            Logger.error(
              `Failed to process order ${order.code} (${order.state}): ${e?.message}`,
              loggerCtx
            );
          }
        }
        if (orderList.items.length < take) {
          break;
        }
        skip += take;
      }
    }
    Logger.info(
      `Finished: ${summary.fulfilled} fulfilled, ${summary.skipped} skipped, ${summary.failed} failed`,
      loggerCtx
    );
    return summary;
  }

  /**
   * Create a fulfillment for all order lines without any state transitions.
   * Used for PaymentAuthorized orders where we only want to register the fulfillment.
   */
  private async createFulfillmentOnly(
    ctx: RequestContext,
    order: Order
  ): Promise<void> {
    if (!order.lines?.length) {
      const fullOrder = await this.orderService.findOne(ctx, order.id, [
        'lines',
      ]);
      if (!fullOrder) {
        throw new Error(`Order ${order.code} not found`);
      }
      order = fullOrder;
    }
    const lines = order.lines.map((line) => ({
      orderLineId: line.id,
      quantity: line.quantity,
    }));
    const fulfillmentResult = await this.orderService.createFulfillment(ctx, {
      handler: { code: sendcloudHandler.code, arguments: [] },
      lines,
    });
    if (
      (fulfillmentResult as ItemsAlreadyFulfilledError).errorCode ===
      'ITEMS_ALREADY_FULFILLED_ERROR'
    ) {
      return; // Already fulfilled, nothing to do
    }
    const error = fulfillmentResult as ErrorResult;
    if (error.errorCode) {
      throw new Error(`${error.errorCode}: ${error.message}`);
    }
  }

  /**
   * Fulfill all order lines and transition the fulfillment to Shipped then Delivered.
   * Also works for orders that already have a fulfillment and/or are already Shipped
   */
  private async fulfillOrderToDelivered(
    ctx: RequestContext,
    order: Order
  ): Promise<void> {
    if (!order.lines?.length) {
      const fullOrder = await this.orderService.findOne(ctx, order.id, [
        'lines',
      ]);
      if (!fullOrder) {
        throw new Error(`Order ${order.code} not found`);
      }
      order = fullOrder;
    }
    const lines = order.lines.map((line) => ({
      orderLineId: line.id,
      quantity: line.quantity,
    }));
    const fulfillmentResult = await this.orderService.createFulfillment(ctx, {
      handler: { code: sendcloudHandler.code, arguments: [] },
      lines,
    });
    let fulfillment: Fulfillment;
    if (
      (fulfillmentResult as ItemsAlreadyFulfilledError).errorCode ===
      'ITEMS_ALREADY_FULFILLED_ERROR'
    ) {
      const fulfillments = await this.orderService.getOrderFulfillments(
        ctx,
        order
      );
      fulfillment = fulfillments[0];
    } else {
      const error = fulfillmentResult as ErrorResult;
      if (error.errorCode) {
        throw new Error(`${error.errorCode}: ${error.message}`);
      }
      fulfillment = fulfillmentResult as Fulfillment;
    }
    const shippedResult = await this.orderService.transitionFulfillmentToState(
      ctx,
      fulfillment.id,
      'Shipped'
    );
    this.throwIfTransitionError(shippedResult);
    const deliveredResult =
      await this.orderService.transitionFulfillmentToState(
        ctx,
        fulfillment.id,
        'Delivered'
      );
    this.throwIfTransitionError(deliveredResult);
  }

  /**
   * Throws if a fulfillment state transition failed.
   * Ignores errors where fromState === toState (already in the desired state).
   */
  private throwIfTransitionError(
    result: Fulfillment | FulfillmentStateTransitionError
  ): void {
    const stateError = result as FulfillmentStateTransitionError;
    if (stateError.transitionError) {
      if (stateError.fromState === stateError.toState) {
        return;
      }
      throw new Error(
        `Transition error: ${stateError.fromState} -> ${stateError.toState}: ${stateError.transitionError}`
      );
    }
  }
}
