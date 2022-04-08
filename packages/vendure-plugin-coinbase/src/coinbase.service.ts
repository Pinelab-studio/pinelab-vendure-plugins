import { Injectable } from '@nestjs/common';
import {
  ActiveOrderService,
  ChannelService,
  EntityHydrator,
  ErrorResult,
  Logger,
  OrderService,
  OrderStateTransitionError,
  PaymentMethodService,
  RequestContext,
} from '@vendure/core';
import { coinbaseHandler } from './coinbase.handler';
import { loggerCtx } from './constants';
import { CoinbaseClient } from './coinbase.client';
import { ChargeConfirmedWebhookEvent } from './coinbase.types';

@Injectable()
export class CoinbaseService {
  constructor(
    private activeOrderService: ActiveOrderService,
    private orderService: OrderService,
    private channelService: ChannelService,
    private paymentMethodService: PaymentMethodService,
    private entityHydrator: EntityHydrator
  ) {}

  async createPaymentIntent(ctx: RequestContext): Promise<string> {
    const order = await this.activeOrderService.getOrderFromContext(ctx);
    if (!order) {
      throw Error('No active order found for session');
    }
    await this.entityHydrator.hydrate(ctx, order, {
      relations: ['lines', 'customer', 'shippingLines'],
    });
    if (!order.lines?.length) {
      throw Error('Cannot create payment intent for empty order');
    }
    if (!order.customer) {
      throw Error('Cannot create payment intent for order without customer');
    }
    if (!order.shippingLines?.length) {
      throw Error(
        'Cannot create payment intent for order without shippingMethod'
      );
    }
    const { apiKey, redirectUrl } = await this.getCoinbasePaymentMethod(ctx);
    const client = new CoinbaseClient({ apiKey });
    const result = await client.createCharge({
      name: `Order ${order.code}`,
      description: `Order ${order.code}`,
      local_price: {
        amount: `${(order.totalWithTax / 100).toFixed(2)}`,
        currency: order.currencyCode,
      },
      metadata: {
        orderCode: order.code,
        channelToken: ctx.channel.token,
      },
      pricing_type: 'fixed_price',
      redirect_url: `${redirectUrl}/${order.code}`,
    });
    return result.data.hosted_url;
  }

  async settlePayment(
    event: ChargeConfirmedWebhookEvent['event']
  ): Promise<void> {
    if (event?.type !== 'charge:confirmed') {
      Logger.info(
        `Incoming webhook is of type ${event?.type} for order ${event?.data?.metadata?.orderCode}, not processing this event.`,
        loggerCtx
      );
      return;
    }
    if (
      !event.data?.metadata?.orderCode ||
      !event.data.metadata.channelToken ||
      !event.data.code
    ) {
      throw Error(
        `Incoming Coinbase webhook is missing metadata.orderCode, metadata.channelToken or code field: ${JSON.stringify(
          event.data?.metadata
        )}`
      );
    }
    const orderCode = event.data.metadata.orderCode;
    const ctx = new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      channel: await this.channelService.getChannelFromToken(
        event.data.metadata.channelToken
      ),
      authorizedAsOwnerOnly: false,
    });
    const { apiKey, method } = await this.getCoinbasePaymentMethod(ctx);
    const client = new CoinbaseClient({ apiKey });
    const charge = await client.getCharge(event.data.code);
    console.log(JSON.stringify(charge));
    if (!charge.data.confirmed_at) {
      Logger.error(
        `Requested charge ${event.data.code} does not have 'confirmed_at' on Coinbase. This payment will not be settled.`,
        loggerCtx
      );
      return;
    }
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(
        `Unable to find order ${orderCode}, unable to settle payment ${event.data.code}!`
      );
    }
    if (order.state !== 'ArrangingPayment') {
      const transitionToStateResult = await this.orderService.transitionToState(
        ctx,
        order.id,
        'ArrangingPayment'
      );
      if (transitionToStateResult instanceof OrderStateTransitionError) {
        throw Error(
          `Error transitioning order ${order.code} from ${transitionToStateResult.fromState} to ${transitionToStateResult.toState}: ${transitionToStateResult.message}`
        );
      }
    }
    const addPaymentToOrderResult = await this.orderService.addPaymentToOrder(
      ctx,
      order.id,
      {
        method: method.code,
        metadata: {
          id: event.id,
          code: event.data.code,
          addresses: event.data.addresses,
          metadata: event.data.metadata,
        },
      }
    );
    if ((addPaymentToOrderResult as ErrorResult).errorCode) {
      throw Error(
        `Error adding payment to order ${orderCode}: ${
          (addPaymentToOrderResult as ErrorResult).message
        }`
      );
    }
    Logger.info(`Payment for order ${orderCode} settled`, loggerCtx);
  }

  private async getCoinbasePaymentMethod(ctx: RequestContext) {
    let { items } = await this.paymentMethodService.findAll(ctx);
    const method = items.find(
      (item) => item.handler.code === coinbaseHandler.code
    );
    if (!method) {
      throw Error(
        `No paymentMethod configured with handler ${coinbaseHandler.code}`
      );
    }
    const apiKey = method.handler.args.find((arg) => arg.name === 'apiKey');
    const redirectUrl = method.handler.args.find(
      (arg) => arg.name === 'redirectUrl'
    );
    if (!apiKey || !redirectUrl) {
      Logger.error(
        `CreatePaymentIntent failed, because no apiKey or redirect is configured for ${method.code}`,
        loggerCtx
      );
      throw Error(
        `Paymentmethod ${method.code} has no apiKey, sharedSecret or redirectUrl configured`
      );
    }
    return {
      apiKey: apiKey.value,
      redirectUrl: redirectUrl.value.endsWith('/')
        ? redirectUrl.value.slice(0, -1)
        : redirectUrl.value, // remove appending slash
      method,
    };
  }
}
