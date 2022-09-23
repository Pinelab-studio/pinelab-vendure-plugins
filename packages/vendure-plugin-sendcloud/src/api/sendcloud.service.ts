import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ChannelService,
  EmptyOrderLineSelectionError,
  EventBus,
  FulfillmentStateTransitionError,
  ID,
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
import {
  addCouponCodes,
  addNote,
  addNrOfOrders,
  toParcelInput,
} from './sendcloud.adapter';
import { OrderLineInput } from '@vendure/admin-ui/core';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';
import { Connection } from 'typeorm';
import { loggerCtx } from './constants';
import { SendcloudConfigEntity } from './sendcloud-config.entity';
import { SendcloudClient } from './sendcloud.client';
import { sendcloudHandler } from './sendcloud.handler';
import { fulfillAll } from '../../../util/src';

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
    private moduleRef: ModuleRef
  ) {}

  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'sendcloud',
      process: async ({ data }) => {
        try {
          await this.autoFulfill(data.channelToken, data.orderCode);
        } catch (error) {
          Logger.warn(
            `Failed to autofulfill order ${data.orderCode} for channel ${data.channelToken}`,
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
      console.log(JSON.stringify(event.order));
      const sendcloudCode = event.order.shippingLines.find(
        (line) => line.shippingMethod?.code === sendcloudHandler.code
      );
      if (!sendcloudCode) {
        return Logger.info(
          `Order ${event.order.code} does not have SendCloud set as handler. Not autofulfilling this order.`,
          loggerCtx
        );
      }
      await this.jobQueue.add(
        {
          orderCode: event.order.code,
          channelToken: event.ctx.channel.token,
        },
        { retries: 10 }
      );
    });
  }

  async syncToSendloud(
    originalCtx: RequestContext,
    order: Order
  ): Promise<Parcel> {
    const variantIds = order.lines.map((l) => l.productVariant.id);
    const variantsWithProduct = await this.connection.findByIdsInChannel(
      originalCtx,
      ProductVariant,
      variantIds,
      originalCtx.channelId,
      { relations: ['translations', 'product', 'product.translations'] }
    );
    order.lines.forEach((line) => {
      const product = variantsWithProduct.find(
        (variant) => variant.id === line.productVariant.id
      )?.product;
      line.productVariant.product = product!;
      line.productVariant = translateDeep(
        line.productVariant,
        originalCtx.channel.defaultLanguageCode
      );
    });
    let nrOfOrders = undefined;
    if (order.customer?.id) {
      const orders = await this.connection.getRepository(Order).find({
        where: {
          customer: { id: order.customer.id },
          state: 'Delivered',
        },
      });
      nrOfOrders = orders.length;
    }
    const parcelInput = toParcelInput(order);

    // TODO additional parcel input strategy
    if ((order.customFields as any).customerNote) {
      addNote(parcelInput, (order.customFields as any).customerNote);
    }
    addNrOfOrders(parcelInput, nrOfOrders);
    addCouponCodes(parcelInput, order.couponCodes);
    return this.client.createParcel(parcelInput);
  }

  /**
   * Update order by given orderCode, returns undefined if no action was taken
   * Returns order if transition wa successful
   */
  async updateOrder(
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
    const ctx = await this.createContext();
    let order = await this.rawConnection
      .getRepository(Order)
      .findOne({ code: orderCode }, { relations: ['lines', 'lines.items'] });
    if (!order) {
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
      const res: any = await this.shipAll(ctx, order);
      return Logger.info(
        `Successfully update order ${orderCode} to ${sendcloudStatus.orderState}`,
        loggerCtx
      );
    }
    order = await this.rawConnection
      .getRepository(Order)
      .findOne({ code: orderCode }, { relations: ['lines', 'lines.items'] }); // refetch order for concurrency
    if (sendcloudStatus.orderState === 'Delivered') {
      if (order.state !== 'Shipped') {
        await this.shipAll(ctx, order).catch((e) => {
          Logger.error(e, loggerCtx);
        }); // ShipAll in case previous webhook was missed, but catch because it might have been done already
      }
      const fulfillments = await this.orderService.getOrderFulfillments(
        ctx,
        order
      );
      const [result] = await Promise.all(
        fulfillments.map((f) =>
          this.orderService.transitionFulfillmentToState(
            ctx,
            f.id,
            sendcloudStatus.orderState!
          )
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
  async shipAll(
    ctx: RequestContext,
    order: Order
  ): Promise<Fulfillment | FulfillmentStateTransitionError> {
    const lines: OrderLineInput[] = order.lines.map(
      (line) =>
        ({
          orderLineId: line.id,
          quantity: line.quantity,
        } as OrderLineInput)
    );
    const fulfillment = await this.orderService.createFulfillment(ctx, {
      handler: {
        code: 'manual-fulfillment',
        arguments: [
          {
            name: 'method',
            value: 'Sendcloud',
          },
          {
            name: 'trackingCode',
            value: '-',
          },
        ],
      },
      lines: lines,
    });
    if ((fulfillment as EmptyOrderLineSelectionError).errorCode) {
      const error = fulfillment as EmptyOrderLineSelectionError;
      throw Error(
        `Unable to ship all items for order ${order.code}: ${error.errorCode} - ${error.message}`
      );
    }
    return this.orderService.transitionFulfillmentToState(
      ctx,
      (fulfillment as any).id,
      'Shipped'
    );
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

  async getConfig(ctx: RequestContext): Promise<SendcloudConfigEntity | void> {
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
    let order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      return Logger.error(
        `No order found with code ${orderCode}. Can not autofulfill this order.`,
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
