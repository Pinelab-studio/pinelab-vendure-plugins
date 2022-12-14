import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ActiveOrderService,
  ChannelService,
  EntityHydrator,
  ErrorResult,
  HistoryService,
  ID,
  LanguageCode,
  Logger,
  OrderService,
  OrderStateTransitionError,
  PaymentMethod,
  PaymentMethodService,
  RequestContext,
  UserInputError,
  EventBus,
  ProductEvent,
  ProductVariant,
  ProductVariantEvent,
  Product,
} from '@vendure/core';
import Stripe from 'stripe';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { StripeSubscriptionPluginOptions } from './stripe-subscription.plugin';
import { IncomingCheckoutWebhook } from './stripe.types';
import { HistoryEntryType } from '@vendure/common/lib/generated-types';

export interface StripeHandlerConfig {
  stripeClient: Stripe;
  redirectUrl: string;
  downpaymentLabel?: string;
  prorationLabel?: string;
}

@Injectable()
export class StripeSubscriptionService {
  constructor(
    private paymentMethodService: PaymentMethodService,
    private activeOrderService: ActiveOrderService,
    private entityHydrator: EntityHydrator,
    private channelService: ChannelService,
    private orderService: OrderService,
    private historyService: HistoryService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private options: StripeSubscriptionPluginOptions,
    private eventBus: EventBus
  ) {}

  // @ts-ignore
  private jobQueue!: JobQueue<JobData>;

  onModuleInit() {
    this.eventBus
      .ofType(ProductVariantEvent)
      .subscribe(this.handleProductEvent);
    // TODO jobqueue creation for stripe products
  }

  async handleProductEvent(event: ProductVariantEvent): Promise<void> {
    Logger.info(
      `Handling ${event.constructor.name} '${event.type}'`,
      loggerCtx
    );
    console.log(JSON.stringify(event.entity)); // FIXME
    console.log(JSON.stringify(event.input)); // FIXME
    try {
      if (event.type === 'created') {
        //  await this.createStripeProduct(event.ctx, event.entity)
      }
    } catch (err: unknown) {
      Logger.error(`Failed to handle ${event.constructor.name}`, loggerCtx);
    }
  }

  async createStripeProduct(productWithVariants: Product) {
    // TODO
    //  create product in Stripe based on variant if its a subscription (has duration) ?? OR do we also save yearly one time payments?
    //  Create prorated price per day: yearly price / 365
    //  Create yearly price for preconfigured downpayment
    //  Save Stripe product Reference on Product
    //  Save stripe price-references on variant: downpaymentPrice, dailyProrationPrice,
  }

  async deleteStripeProduct() {
    // TODO delete stripe product
  }

  async updateStripeProduct(ctx: RequestContext) {
    // TODO update stripe product
    Logger.info('Updating stripe product');
  }

  async createStripeSubscriptionPaymentLink(
    ctx: RequestContext,
    paymentMethodCode: string
  ): Promise<string> {
    const order = await this.activeOrderService.getActiveOrder(ctx, undefined);
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
    const { stripeClient, redirectUrl } = await this.getStripeHandler(
      ctx,
      paymentMethodCode
    );

    // TODO
    //  Throw error when memberships with different intervals
    //  create one time checkout for Downpayment + prorated if a membership
    //  OR create a one time payment for the paid-in-full amount. This will be converted to yearly
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      locale: 'en',
      customer_email: order.customer.emailAddress,
      /*      discounts: [{
        coupon: 'rOHUq3ml' // Downpayment discount
      }],*/
      line_items: [
        {
          price: 'price_1MChzwDzZuaioTddKwNnihVq',
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 20,
      },
      metadata: {
        orderCode: order.code,
        channelToken: ctx.channel.token,
        paymentMethodCode: paymentMethodCode,
        // TODO add amount in $ of subcriptions to prevent order update after stripe checkout
        //   Add the subscriptions to be created on webhook handling
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

  // TODO create subscription for yearly downpayments and monthly membership fee
  //   OR create yearly one-time fee for paid-in-full
  async handlePaymentCompleteEvent({
    data: { object: eventData },
  }: IncomingCheckoutWebhook): Promise<void> {
    const orderCode = eventData.metadata.orderCode;
    const channelToken = eventData.metadata.channelToken;
    const paymentMethodCode = eventData.metadata.paymentMethodCode;
    const endDate = eventData.metadata.endDate;
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
    const ctx = await this.createContext(channelToken);
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(`Cannot find order with code ${orderCode}`);
    }
    if (!paymentMethodCode) {
      throw Error(
        `Incoming webhook is missing metadata.paymentMethodCode, cannot process this event`
      );
    }
    if (eventData.status !== 'complete') {
      Logger.info(
        `Received incoming webhook with status ${eventData.status}, not processing this event.`,
        loggerCtx
      );
      return;
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
        method: paymentMethodCode,
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
    const subscriptionId = eventData.subscription;
    if (!endDate) {
      await this.logOrderHistory(
        ctx,
        order.id,
        `!! Failed to set subscription end date for subscription ${subscriptionId}!`
      );
      return Logger.error(
        `Incoming webhook is missing metadata.endDate, failed to set end date for subscription ${subscriptionId}`,
        loggerCtx
      );
    }
    try {
      const { stripeClient } = await this.getStripeHandler(
        ctx,
        paymentMethodCode
      );
      // FIXME not needed
      await stripeClient.subscriptions.update(subscriptionId, {
        cancel_at: endDate,
      });
      await this.logOrderHistory(
        ctx,
        order.id,
        `Updated subscription to end at ${new Date(endDate * 1000)
          .toISOString()
          .substr(0, 10)}`
      );
    } catch (e: unknown) {
      await this.logOrderHistory(
        ctx,
        order.id,
        `!! Failed to set subscription end date for subscription ${subscriptionId}: ${
          (e as any)?.message
        }`
      );
      throw e;
    }
  }

  private async getPaymentMethodByCode(
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

  private async getStripeHandler(
    ctx: RequestContext,
    paymentMethodCode: string
  ): Promise<StripeHandlerConfig> {
    const paymentMethod = await this.getPaymentMethodByCode(
      ctx,
      paymentMethodCode
    );
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
    return {
      stripeClient: new Stripe(apiKey, {
        apiVersion: null as any, // Null uses accounts default version
      }),
      redirectUrl,
      downpaymentLabel: paymentMethod.handler.args.find(
        (arg) => arg.name === 'downpaymentLabel'
      )?.value,
      prorationLabel: paymentMethod.handler.args.find(
        (arg) => arg.name === 'prorationLabel'
      )?.value,
    };
  }

  private async logOrderHistory(
    ctx: RequestContext,
    orderId: ID,
    message: string
  ): Promise<void> {
    await this.historyService.createHistoryEntryForOrder(
      {
        ctx,
        orderId,
        type: HistoryEntryType.ORDER_NOTE,
        data: {
          note: message,
        },
      },
      false
    );
  }
}
