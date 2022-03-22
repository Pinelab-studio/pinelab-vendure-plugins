import { Injectable } from '@nestjs/common';
import {
  ActiveOrderService,
  ChannelService,
  EntityHydrator,
  Logger,
  OrderService,
  PaymentMethodService,
  RequestContext,
} from '@vendure/core';
import { coinbaseHandler } from './coinbase.handler';
import { loggerCtx } from './constants';
import Coinbase from 'coinbase-commerce-node';

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
    const { apiKey, redirectUrl } = await this.getCoinbaseMethod(ctx);

    // FIXME init is static. use our own client?

    /*    const client = Coinbase.Client.init(apiKey);
    const result = await client.({
      name: `Order ${order.code}`,
      description: `Order ${order.code}`,
      local_price: {
        amount: `${(order.totalWithTax / 100).toFixed(2)}`,
        currency: order.currencyCode
      },
      pricing_type: 'fixed_price',
      redirect_url: `${redirectUrl}/${order.code}`
    });*/
    return result.hosted_url;
  }

  async getCoinbaseMethod(ctx: RequestContext) {
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
    const sharedSecret = method.handler.args.find(
      (arg) => arg.name === 'sharedSecret'
    );
    if (!apiKey || !redirectUrl || !sharedSecret) {
      Logger.error(
        `CreatePaymentIntent failed, because no apiKey, sharedSecret or redirect is configured for ${method.code}`,
        loggerCtx
      );
      throw Error(
        `Paymentmethod ${method.code} has no apiKey, sharedSecret or redirectUrl configured`
      );
    }
    return {
      apiKey: apiKey.value,
      sharedSecret: sharedSecret.value,
      redirectUrl: redirectUrl.value.endsWith('/')
        ? redirectUrl.value.slice(0, -1)
        : redirectUrl.value, // remove appending slash
      method,
    };
  }
}
