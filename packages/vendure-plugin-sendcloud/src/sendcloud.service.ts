import {
  Injectable,
  OnApplicationBootstrap,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import {
  ChannelService,
  EmptyOrderLineSelectionError,
  EventBus,
  FulfillmentStateTransitionError,
  Logger,
  Order,
  OrderService,
  OrderStateTransitionEvent,
  ProductVariant,
  RequestContext,
  TransactionalConnection,
  translateDeep,
} from '@vendure/core';
import { filter } from 'rxjs/operators';
import { SendcloudClient } from './sendcloud.client';
import {
  addCouponCodes,
  addNote,
  addNrOfOrders,
  toParcelInput,
} from './sendcloud.adapter';
import { Parcel } from './types/sendcloud-api-response.types';
import { SendcloudParcelStatus } from './types/sendcloud-parcel-status';
import { OrderLineInput } from '@vendure/admin-ui/core';
import { Fulfillment } from '@vendure/core/dist/entity/fulfillment/fulfillment.entity';
import { Connection } from 'typeorm';
import { loggerCtx, PLUGIN_OPTIONS } from './constants';
import { SendcloudOptions } from './types/sendcloud-options';
import { LanguageCode } from '@vendure/common/lib/generated-types';

@Injectable()
export class SendcloudService implements OnApplicationBootstrap {
  client: SendcloudClient;
  // Dirty hack to prevent duplicate event listener
  static isListening = false;

  constructor(
    @Inject(PLUGIN_OPTIONS) private options: SendcloudOptions,
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    private rawConnection: Connection,
    private orderService: OrderService,
    private channelService: ChannelService
  ) {
    this.client = new SendcloudClient(options.publicKey, options.secret);
  }

  onApplicationBootstrap(): void {
    if (!SendcloudService.isListening) {
      SendcloudService.isListening = true;
      this.eventBus
        .ofType(OrderStateTransitionEvent)
        .pipe(
          filter((event) => {
            const isPickup = !!event.order.shippingLines.find(
              (s) => s.shippingMethodId == 11
            );
            return event.toState === 'PaymentSettled' && !isPickup;
          })
        )
        .subscribe((event) =>
          this.syncToSendloud(event.ctx, event.order).catch((e) =>
            Logger.error(
              `Failed to sync order ${event.order.code} to SendCloud, ${e}`,
              loggerCtx
            )
          )
        );
      Logger.info(`Listening for settled orders`, loggerCtx);
    }
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
      line.productVariant.product = product;
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

  /**
   * Get ctx for DEFAULT channel
   */
  async createContext(): Promise<RequestContext> {
    const channel = await this.channelService.getDefaultChannel();
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }
}
