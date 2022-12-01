import { Inject, Injectable } from '@nestjs/common';
import {
  ActiveOrderService,
  ChannelService,
  EntityHydrator,
  ErrorResult,
  LanguageCode,
  Logger,
  Order,
  OrderService,
  OrderStateTransitionError,
  PaymentMethod,
  PaymentMethodService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import Stripe from 'stripe';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { StripeSubscriptionPluginOptions } from './stripe-subscription.plugin';
import { IncomingCheckoutWebhook } from './stripe.types';

@Injectable()
export class StripeSubscriptionService {
  constructor(
    private paymentMethodService: PaymentMethodService,
    private activeOrderService: ActiveOrderService,
    private entityHydrator: EntityHydrator,
    private channelService: ChannelService,
    private orderService: OrderService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private options: StripeSubscriptionPluginOptions
  ) {}

  async createStripeSubscriptionPaymentLink(
    ctx: RequestContext,
    paymentMethodCode: string
  ): Promise<string> {
    // Get paymentmethod by code
    // Get apiKey from method
    // get products from activeOrder
    // Get or create subscriptions based on products in activeOrder https://stripe.com/docs/billing/subscriptions/multiple-products
    // Create paymentLink for created subscriptions: https://stripe.com/docs/payments/payment-links/api
    // Use installments https://stripe.com/docs/billing/subscriptions/subscription-schedules/use-cases#installment-plans
    const [order, paymentMethod] = await Promise.all([
      this.activeOrderService.getActiveOrder(ctx, undefined),
      this.getPaymentMethod(ctx, paymentMethodCode),
    ]);
    if (!order) {
      throw new UserInputError('No active order for session');
    }
    await this.entityHydrator.hydrate(ctx, order, {
      relations: [
        'customer',
        'lines.productVariant.product',
        'shippingLines.shippingMethod',
      ],
    });
    if (!order.lines?.length) {
      throw new UserInputError('Cannot create payment intent for empty order');
    }
    if (!order.customer) {
      throw new UserInputError(
        'Cannot create payment intent for order without customer'
      );
    }
    if (!order.shippingLines?.length) {
      throw new UserInputError(
        'Cannot create payment intent for order without shippingMethod'
      );
    }
    if (!paymentMethod) {
      throw new UserInputError(
        `No paymentMethod found with code ${paymentMethodCode}`
      );
    }
    const apiKey = paymentMethod.handler.args.find(
      (arg) => arg.name === 'apiKey'
    )?.value;
    let redirectUrl = paymentMethod.handler.args.find(
      (arg) => arg.name === 'redirectUrl'
    )?.value;
    if (!apiKey || !redirectUrl) {
      Logger.warn(
        `CreatePaymentIntent failed, because no apiKey or redirect is configured for ${paymentMethod.code}`,
        loggerCtx
      );
      throw new UserInputError(
        `Paymentmethod ${paymentMethod.code} has no apiKey or redirectUrl configured`
      );
    }
    const stripe = new Stripe(apiKey, {
      apiVersion: null as any, // Null uses accounts default version
    });
    // FIXME Create prices with correct downpayment
    /*    const subscription = await stripe.subscriptions.create({
          customer: 'cus_MW2cN5ZB8vCy4f',
          items: [{price: 'price_CBXbz9i7AIOTzr'}, {price: 'price_IFuCu48Snc02bc', quantity: 2}],
        });*/
    // FIXME use real dynamic values
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      locale: 'en',
      line_items: [
        {
          price: 'price_1MACWhDzZuaioTddo4JPtlgz', // one time downpayment
          quantity: 1,
        },
        {
          price: 'price_1MACTGDzZuaioTddFW0kxY56', // monthly
          quantity: 1,
        },
      ],
      metadata: {
        orderCode: order.code,
        channelToken: ctx.channel.token,
        paymentMethodId: paymentMethod.id,
      },
      success_url: `${redirectUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${redirectUrl}?session_id={CHECKOUT_SESSION_ID}`,
    });
    if (!session.url) {
      Logger.error(`Failed to create payment link ${JSON.stringify(session)}`);
      throw Error('Failed to create payment link');
    }
    return session.url;
  }

  async handlePaymentCompleteEvent({
    data: { object: eventData },
  }: IncomingCheckoutWebhook): Promise<void> {
    const orderCode = eventData.metadata.orderCode;
    const channelToken = eventData.metadata.channelToken;
    const paymentMethodId = eventData.metadata.paymentMethodId;
    // TODO set iterations for the created subscription, to prevent a forever-subscription
    if (!orderCode) {
      throw Error(
        `Incoming webhook is missing metadata.orderCode, cannot process this event`
      );
    }
    if (!channelToken) {
      throw Error(
        `Incoming webhook is missing metadata.channelToken, cannot process this event`
      );
    }
    if (!channelToken) {
      throw Error(
        `Incoming webhook is missing metadata.channelToken, cannot process this event`
      );
    }
    if (!paymentMethodId) {
      throw Error(
        `Incoming webhook is missing metadata.paymentMethodId, cannot process this event`
      );
    }
    if (eventData.status !== 'complete') {
      Logger.info(
        `Received incoming webhook with status ${eventData.status}, not processing this event.`,
        loggerCtx
      );
      return;
    }
    const ctx = await this.createContext(channelToken);
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(`Cannot find order with code ${orderCode}`);
    }
    const paymentMethod = await this.paymentMethodService.findOne(
      ctx,
      paymentMethodId
    );
    if (!paymentMethod) {
      throw Error(`Cannot find payment method with id ${paymentMethodId}`);
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
        method: paymentMethod.code,
        metadata: {
          subscriptionId: eventData.subscription,
        },
      }
    );
    if ((addPaymentToOrderResult as ErrorResult).errorCode) {
      throw Error(
        `Error adding payment to order ${order.code}: ${
          (addPaymentToOrderResult as ErrorResult).message
        }`
      );
    }
    Logger.info(
      `Successfully settled payment for order ${order.code} for channel ${channelToken}`
    );
  }

  private async getPaymentMethod(
    ctx: RequestContext,
    paymentMethodCode: string
  ): Promise<PaymentMethod | undefined> {
    const paymentMethods = await this.paymentMethodService.findAll(ctx);
    return paymentMethods.items.find((pm) => pm.code === paymentMethodCode);
  }

  private async createContext(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
      languageCode: LanguageCode.en,
    });
  }
}
