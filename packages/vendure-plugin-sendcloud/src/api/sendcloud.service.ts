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
  FulfillmentStateTransitionError,
  ID,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  ProductVariant,
  RequestContext,
  TransactionalConnection,
  translateDeep,
} from '@vendure/core';
import { toParcelInput } from './sendcloud.adapter';
import { Connection } from 'typeorm';
import { loggerCtx, PLUGIN_OPTIONS } from './constants';
import { SendcloudConfigEntity } from './sendcloud-config.entity';
import { SendcloudClient } from './sendcloud.client';
import { sendcloudHandler } from './sendcloud.handler';
import { fulfillAll, transitionToShipped } from '../../../util/src';
import { Parcel, ParcelInputItem } from './types/sendcloud-api.types';
import {
  SendcloudParcelStatus,
  SendcloudPluginOptions,
} from './types/sendcloud.types';

interface SendcloudJobData {
  orderCode: string;
  channelToken: string;
}

@Injectable()
export class SendcloudService implements OnApplicationBootstrap, OnModuleInit {
  // @ts-ignore
  private jobQueue!: JobQueue<SendcloudJobData>;

  constructor(
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    private rawConnection: Connection,
    private orderService: OrderService,
    private channelService: ChannelService,
    private jobQueueService: JobQueueService,
    private moduleRef: ModuleRef,
    @Inject(PLUGIN_OPTIONS) private options: SendcloudPluginOptions,
    private entityHydrator: EntityHydrator
  ) {}

  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'sendcloud',
      process: async ({ data }) => {
        try {
          await this.autoFulfill(data.channelToken, data.orderCode);
        } catch (error) {
          Logger.warn(
            `Failed to autofulfill order ${data.orderCode} for channel ${data.channelToken}: ${error}`,
            loggerCtx
          );
          throw error;
        }
      },
    });
  }

  onApplicationBootstrap(): void {
    // Listen for Settled orders for autoFulfillment
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      await this.jobQueue.add(
        {
          orderCode: event.order.code,
          channelToken: event.ctx.channel.token,
        },
        { retries: 10 }
      );
    });
  }

  async syncToSendloud(ctx: RequestContext, order: Order): Promise<Parcel> {
    await this.entityHydrator.hydrate(ctx, order, {
      relations: [
        'lines',
        'lines.productVariant',
        'lines.productVariant.product',
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
    const parcelInput = toParcelInput(order, this.options);
    parcelInput.parcel_items.unshift(...additionalParcelItems);
    return (await this.getClient(ctx)).createParcel(parcelInput);
  }

  /**
   * Update order by given orderCode, returns undefined if no action was taken
   * Returns order if transition wa successful
   */
  async updateOrder(
    ctx: RequestContext,
    sendcloudStatus: SendcloudParcelStatus,
    orderCode: string
  ): Promise<void> {
    if (!sendcloudStatus.orderState) {
      Logger.debug(
        `Cannot update order with code ${orderCode}: No orderState is set for SendCloud status "${sendcloudStatus.message} (${sendcloudStatus.id})"`,
        loggerCtx
      );
      return;
    }
    let order = await this.rawConnection
      .getRepository(Order)
      .findOne({ code: orderCode }, { relations: ['lines', 'lines.items'] });
    if (!order) {
      Logger.warn(
        `Cannot update status from SendCloud: No order with code ${orderCode} found`,
        loggerCtx
      );
      throw Error(
        `Cannot update status from SendCloud: No order with code ${orderCode} found`
      );
    }
    if (order.state === sendcloudStatus.orderState) {
      return Logger.debug(
        `Cannot update order with code ${orderCode}: Order already has state ${order.state}`,
        loggerCtx
      );
    }
    if (sendcloudStatus.orderState === 'Shipped') {
      await this.shipAll(ctx, order);
      return Logger.info(
        `Successfully update order ${orderCode} to ${sendcloudStatus.orderState}`,
        loggerCtx
      );
    }
    order = await this.rawConnection
      .getRepository(Order)
      .findOneOrFail(
        { code: orderCode },
        { relations: ['lines', 'lines.items'] }
      ); // Refetch in case state was updated
    if (sendcloudStatus.orderState === 'Delivered') {
      if (order.state !== 'Shipped') {
        await this.shipAll(ctx, order).catch((e) => {
          Logger.warn(e, loggerCtx);
        }); // ShipAll in case previous webhook was missed, but catch because it might have been done already
      }
      const fulfillments = await this.orderService.getOrderFulfillments(
        ctx,
        order
      );
      const [result] = await Promise.all(
        fulfillments.map((f) =>
          this.orderService.transitionFulfillmentToState(ctx, f.id, 'Delivered')
        )
      );
      if ((result as FulfillmentStateTransitionError)?.errorCode) {
        const error = result as FulfillmentStateTransitionError;
        Logger.error(
          `Cannot transition order ${orderCode} from ${error.fromState} to ${error.toState}: ${error.transitionError}`
        );
        return;
      }
      return Logger.info(
        `Successfully update order ${orderCode} to ${sendcloudStatus.orderState}`,
        loggerCtx
      );
    }
  }

  /**
   * Fulfill and ship all items
   */
  async shipAll(ctx: RequestContext, order: Order): Promise<void> {
    await transitionToShipped(this.orderService, ctx, order, {
      code: sendcloudHandler.code,
      arguments: [],
    });
  }

  async upsertConfig(
    ctx: RequestContext,
    config: {
      secret: string;
      publicKey: string;
    }
  ): Promise<SendcloudConfigEntity> {
    const repo = this.connection.getRepository(ctx, SendcloudConfigEntity);
    const existing = await repo.findOne({ channelId: String(ctx.channelId) });
    if (existing) {
      await repo.update(existing.id, {
        secret: config.secret,
        publicKey: config.publicKey,
      });
    } else {
      await repo.insert({
        channelId: String(ctx.channelId),
        secret: config.secret,
        publicKey: config.publicKey,
      });
    }
    return repo.findOneOrFail({ channelId: String(ctx.channelId) });
  }

  async getConfig(
    ctx: RequestContext
  ): Promise<SendcloudConfigEntity | undefined> {
    return this.connection
      .getRepository(ctx, SendcloudConfigEntity)
      .findOne({ channelId: String(ctx.channelId) });
  }

  async getClient(ctx: RequestContext): Promise<SendcloudClient> {
    const config = await this.getConfig(ctx);
    if (!config || !config?.secret || !config.publicKey) {
      throw Error(`Incomplete config found for channel ${ctx.channel.token}`);
    }
    return new SendcloudClient(config.publicKey, config.secret);
  }

  async createContext(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }

  private async autoFulfill(
    channelToken: string,
    orderCode: string
  ): Promise<void> {
    const ctx = await this.createContext(channelToken);
    const config = await this.getConfig(ctx);
    if (!config?.secret || !config?.publicKey) {
      return;
    }
    Logger.info(
      `Autofulfilling order ${orderCode} for channel ${channelToken}`,
      loggerCtx
    );
    let order = await this.orderService.findOneByCode(ctx, orderCode, [
      'shippingLines',
      'shippingLines.shippingMethod',
      'lines',
    ]);
    if (!order) {
      return Logger.error(
        `No order found with code ${orderCode}. Can not autofulfill this order.`,
        loggerCtx
      );
    }
    const hasSendcloudHandler = order.shippingLines.find(
      (line) =>
        line.shippingMethod?.fulfillmentHandlerCode === sendcloudHandler.code
    );
    if (!hasSendcloudHandler) {
      return Logger.info(
        `Order ${order.code} does not have SendCloud set as handler. Not autofulfilling this order.`,
        loggerCtx
      );
    }
    await fulfillAll(ctx, this.orderService, order, {
      code: sendcloudHandler.code,
      arguments: [],
    });
    Logger.info(`Order ${order.code} autofulfilled`, loggerCtx);
  }
}
