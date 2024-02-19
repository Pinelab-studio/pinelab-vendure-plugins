import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ChannelService,
  EntityHydrator,
  EventBus,
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
import { toParcelInput } from './sendcloud.adapter';
import { Connection } from 'typeorm';
import { loggerCtx, PLUGIN_OPTIONS } from './constants';
import { SendcloudConfigEntity } from './sendcloud-config.entity';
import { SendcloudClient } from './sendcloud.client';
import { sendcloudHandler } from './sendcloud.handler';
import {
  fulfillAll,
  transitionToDelivered,
  transitionToShipped,
} from '../../../util/src';
import { Parcel, ParcelInputItem } from './types/sendcloud-api.types';
import util from 'util';
import {
  SendcloudParcelStatus,
  SendcloudPluginOptions,
} from './types/sendcloud.types';

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
    private historyService: HistoryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Listen for Settled orders to sync to sendcloud
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.jobQueue.add(
        {
          orderCode: event.order.code,
          ctx: event.ctx.serialize(),
        },
        { retries: 20 },
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
            loggerCtx,
          );
          throw error;
        }
      },
    });
  }

  async createOrderInSendcloud(
    userCtx: RequestContext,
    order: Order,
  ): Promise<Parcel | undefined> {
    if (this.options.disabled) {
      Logger.info(
        `Plugin is disabled, not syncing order ${order.code}`,
        loggerCtx,
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
            order,
          )),
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

  /**
   * Update order by given orderCode, returns undefined if no action was taken
   * Returns order if transition was successful
   */
  async updateOrderStatus(
    ctx: RequestContext,
    sendcloudStatus: SendcloudParcelStatus,
    orderCode: string,
  ): Promise<void> {
    let order = await this.connection
      .getRepository(ctx, Order)
      .findOne({ where: { code: orderCode }, relations: ['lines'] });
    if (!order) {
      Logger.warn(
        `Cannot update status from SendCloud: No order with code ${orderCode} found`,
        loggerCtx,
      );
      throw Error(
        `Cannot update status from SendCloud: No order with code ${orderCode} found`,
      );
    }
    if (order.state === sendcloudStatus.orderState) {
      return Logger.info(
        `Not updating order with code ${orderCode}: Order already has state ${order.state}`,
        loggerCtx,
      );
    }
    if (sendcloudStatus.orderState === 'Shipped') {
      await this.shipAll(ctx, order);
      return Logger.info(
        `Successfully updated order ${orderCode} to Shipped`,
        loggerCtx,
      );
    }
    order = await this.connection
      .getRepository(ctx, Order)
      .findOneOrFail({ where: { code: orderCode }, relations: ['lines'] }); // Refetch in case state was updated
    if (sendcloudStatus.orderState === 'Delivered') {
      await transitionToDelivered(this.orderService, ctx, order, {
        code: sendcloudHandler.code,
        arguments: [],
      });
      return Logger.info(
        `Successfully updated order ${orderCode} to Delivered`,
        loggerCtx,
      );
    }
    // Fall through, means unhandled state
    Logger.info(`Not handling state ${sendcloudStatus.orderState}`, loggerCtx);
  }

  /**
   * Ship all items
   */
  async shipAll(ctx: RequestContext, order: Order): Promise<void> {
    await transitionToShipped(
      this.orderService as any,
      ctx as any,
      order as any,
      {
        code: sendcloudHandler.code,
        arguments: [],
      },
    );
  }

  /**
   * Fulfill without throwing errors. Logs an error if fulfilment fails
   */
  private async safeFulfill(ctx: RequestContext, order: Order): Promise<void> {
    try {
      const fulfillment = await fulfillAll(ctx, this.orderService, order, {
        code: sendcloudHandler.code,
        arguments: [],
      });
      Logger.info(
        `Created fulfillment (${fulfillment.id}) for order ${order.code}`,
        loggerCtx,
      );
    } catch (e: any) {
      Logger.error(
        `Failed to fulfill order ${order.code}: ${e?.message}. Transition this order manually to 'Delivered' after checking that it exists in Sendcloud.`,
        loggerCtx,
        util.inspect(e),
      );
    }
  }

  async upsertConfig(
    ctx: RequestContext,
    config: {
      secret: string;
      publicKey: string;
      defaultPhoneNr: string;
    },
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
    ctx: RequestContext,
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
    orderCode: string,
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
        loggerCtx,
      );
    }
    const hasSendcloudHandler = order.shippingLines.find(
      (line) =>
        line.shippingMethod?.fulfillmentHandlerCode === sendcloudHandler.code,
    );
    if (!hasSendcloudHandler) {
      return Logger.info(
        `Order ${order.code} does not have SendCloud set as handler. Not syncing this order.`,
        loggerCtx,
      );
    }
    await this.safeFulfill(ctx, order);
    Logger.info(
      `Syncing order ${orderCode} for channel ${ctx.channel.token}`,
      loggerCtx,
    );
    const result = await this.createOrderInSendcloud(ctx, order);
    if (result) {
      Logger.info(
        `Order ${order.code} synced to SendCloud: ${result.id}`,
        loggerCtx,
      );
    }
  }

  async logHistoryEntry(
    ctx: RequestContext,
    orderId: ID,
    error?: unknown,
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
      false,
    );
  }
}
