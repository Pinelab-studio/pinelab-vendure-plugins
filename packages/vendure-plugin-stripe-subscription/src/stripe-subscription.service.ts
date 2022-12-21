import { Inject, Injectable } from '@nestjs/common';
import {
  ActiveOrderService,
  ChannelService,
  EntityHydrator,
  ErrorResult,
  EventBus,
  HistoryService,
  ID,
  JobQueue,
  JobQueueService,
  LanguageCode,
  Logger,
  OrderService,
  OrderStateTransitionError,
  PaymentMethodService,
  ProductVariant,
  ProductVariantEvent,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  UserInputError,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { StripeSubscriptionPluginOptions } from './stripe-subscription.plugin';
import { IncomingCheckoutWebhook } from './stripe.types';
import { HistoryEntryType } from '@vendure/common/lib/generated-types';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import {
  OrderWithSubscriptions,
  ValidatedVariantWithSubscriptionFields,
  VariantWithSubscriptionFields,
} from './subscription-custom-fields';
import { StripeClient } from './stripe.client';
import { Stripe } from 'stripe';
import { getDayRate, getDaysUntilNextStartDate } from './util';
import {
  StripeSubscriptionPricing,
  StripeSubscriptionPricingInput,
} from './generated/graphql';

export interface StripeHandlerConfig {
  stripeClient: StripeClient;
  redirectUrl: string;
  downpaymentLabel?: string;
  prorationLabel?: string;
}

export interface JobData {
  action: 'created' | 'updated' | 'deleted';
  ctx: SerializedRequestContext;
  variants: ProductVariant[];
}

@Injectable()
export class StripeSubscriptionService {
  constructor(
    private paymentMethodService: PaymentMethodService,
    private activeOrderService: ActiveOrderService,
    private variantService: ProductVariantService,
    private entityHydrator: EntityHydrator,
    private channelService: ChannelService,
    private orderService: OrderService,
    private historyService: HistoryService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private options: StripeSubscriptionPluginOptions,
    private eventBus: EventBus,
    private jobQueueService: JobQueueService
  ) {}

  // @ts-ignore
  private jobQueue!: JobQueue<JobData>;

  async onModuleInit() {
    // Create jobQueue with handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'stripe-subscription',
      process: async ({ data, id }) => {
        try {
          const ctx = RequestContext.deserialize(data.ctx);
          if (data.action === 'created' || data.action === 'updated') {
            await this.upsertStripeProduct(ctx, data.variants);
          } else if (data.action === 'deleted') {
            await this.deleteStripeProduct(ctx, data.variants);
          }
        } catch (error) {
          Logger.warn(
            `Failed to process job ${data.action} (${id}) for channel ${data.ctx._channel.token}: ${error}`,
            loggerCtx
          );
          throw error;
        }
      },
    });
    // Subscribe to events
    this.eventBus.ofType(ProductVariantEvent).subscribe((event) =>
      this.jobQueue.add(
        {
          ctx: event.ctx.serialize(),
          action: event.type,
          variants: event.entity,
        },
        { retries: 10 }
      )
    );
  }

  /**
   * Creates or updates Product in Stripe based on the given variants
   */
  async upsertStripeProduct(
    ctx: RequestContext,
    variants: VariantWithSubscriptionFields[]
  ) {
    // TODO
    //  create product in Stripe based on variant if its a subscription (has duration) ?? OR do we also save yearly one time payments?
    //  Create prorated price per day: yearly price / 365
    //  Create yearly price for preconfigured downpayment
    //  Save Stripe product Reference on Product
    //  Save stripe price-references on variant: downpaymentPrice, dailyProrationPrice,
    const { stripeClient } = await this.getStripeHandler(ctx);
    for (const variant of variants) {
      // variant.customFields.stripeProductId = await stripeClient.getOrCreateProductId(variant);
    }
    await this.variantService.update(ctx, variants); // Update all variants and their references
  }

  async deleteStripeProduct(ctx: RequestContext, variants: ProductVariant[]) {
    // TODO delete stripe product
  }

  async createStripeSubscriptionCheckout(
    ctx: RequestContext,
    paymentMethodCode: string
  ): Promise<string> {
    const order = (await this.activeOrderService.getActiveOrder(
      ctx,
      undefined
    )) as OrderWithSubscriptions;
    if (!order) {
      throw new UserInputError('No active order for session');
    }
    await this.entityHydrator.hydrate(ctx, order, {
      relations: ['customer', 'shippingLines', 'lines.productVariant'],
      applyProductVariantPrices: true,
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
    const hasUnsupportedSubscriptions = order.lines.some(
      (line) => line.productVariant.customFields.subscriptionDownpayment
    );
    if (hasUnsupportedSubscriptions) {
      throw new UserInputError(`Downpayments are not supported yet`);
    }
    if (order.lines.length > 1) {
      throw new UserInputError(
        `Only single subscription checkouts are supported for now`
      );
    }
    const session = await this.createSingleSubscriptionCheckout(
      ctx,
      order,
      paymentMethodCode
    );
    if (!session.url) {
      Logger.error(`Failed to create payment link ${JSON.stringify(session)}`);
      throw Error('Failed to create payment link');
    }
    this.logOrderHistory(
      ctx,
      order.id,
      `Stripe checkout created: ${session.url}`
    ).catch((e) =>
      Logger.error(
        `Failed to add Stripe checkout url to order history`,
        loggerCtx,
        e
      )
    );
    return session.url;
  }

  /**
   * Used for previewing the price of a subscription
   */
  async getSubscriptionPricing(
    ctx: RequestContext,
    input?: StripeSubscriptionPricingInput,
    variant?: VariantWithSubscriptionFields
  ): Promise<StripeSubscriptionPricing> {
    if (!variant && !input?.productVariantId) {
      throw Error(
        `Either variant or input.productvariantId is needed to calculate pricing!`
      );
    }
    if (!variant) {
      variant = (await this.variantService.findOne(
        ctx,
        input!.productVariantId
      )) as VariantWithSubscriptionFields;
      if (!variant) {
        throw new UserInputError(
          `No variant found with id ${input!.productVariantId}`
        );
      }
    }
    const { customFields: subscriptionFields } =
      this.validateVariantAsSubscription(variant);
    const daysUntilStart = getDaysUntilNextStartDate(
      input?.startDate || new Date(),
      subscriptionFields.billingInterval,
      subscriptionFields.startDate
    );
    const dayRate = getDayRate(
      variant.priceWithTax,
      subscriptionFields.durationInterval!,
      subscriptionFields.durationCount!
    );
    return {
      downpayment: 0, // TODO
      totalProratedAmount: daysUntilStart * dayRate,
      proratedDays: daysUntilStart,
      dayRate,
      recurringPrice: variant.priceWithTax,
      interval: subscriptionFields.billingInterval,
      intervalCount: subscriptionFields.billingCount,
    };
  }

  /**
   * Throw an error if not all necessary subscription fields are present on a variant
   * @private
   */
  private validateVariantAsSubscription(
    variant: VariantWithSubscriptionFields
  ): ValidatedVariantWithSubscriptionFields {
    if (
      !variant.customFields.billingInterval ||
      !variant.customFields.billingCount ||
      !variant.customFields.durationInterval ||
      !variant.customFields.durationCount ||
      !variant.customFields.startDate
    ) {
      throw new UserInputError(
        `Variants doesn't have necessary subscription custom fields, cannot calculate subscription pricing`
      );
    }
    return variant as ValidatedVariantWithSubscriptionFields;
  }

  /**
   * Create a checkout session specific to paid-in-full memberships
   */
  private async createSingleSubscriptionCheckout(
    ctx: RequestContext,
    order: OrderWithSubscriptions,
    paymentMethodCode: string
  ): Promise<Stripe.Checkout.Session> {
    if (order.lines.length > 1) {
      throw new UserInputError(
        'We only support checkout of a single membership per order for now!'
      );
    }
    const { stripeClient, redirectUrl, prorationLabel } =
      await this.getStripeHandler(ctx);
    const line = order.lines[0];
    const pricing = await this.getSubscriptionPricing(
      ctx,
      undefined,
      line.productVariant
    );
    const recurringPrice: Stripe.Checkout.SessionCreateParams.LineItem = {
      quantity: 1,
      price_data: {
        product_data: {
          name: line.productVariant.name,
        },
        currency: order.currencyCode,
        unit_amount: pricing.recurringPrice,
        // For paid-in-full we use the duration of the subscription as renewal
        recurring: {
          interval: pricing.interval,
          interval_count: pricing.intervalCount,
        },
      },
    };
    const sessionInput: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      locale: 'en',
      customer_email: order.customer!.emailAddress,
      line_items: [recurringPrice],
      metadata: {
        orderCode: order.code,
        channelToken: ctx.channel.token,
        paymentMethodCode,
        amount: order.totalWithTax,
      },
      success_url: `${redirectUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${redirectUrl}?session_id={CHECKOUT_SESSION_ID}`,
    };

    if (pricing.proratedDays) {
      // This means we have to add proration to the checkout
      const proratedPrice: Stripe.Checkout.SessionCreateParams.LineItem = {
        price_data: {
          currency: order.currencyCode,
          unit_amount: pricing.dayRate,
          product_data: {
            name: prorationLabel || 'Prorated amount',
          },
        },
        quantity: pricing.proratedDays,
      };
      sessionInput.line_items!.push(proratedPrice);
      sessionInput.subscription_data = {
        trial_period_days: pricing.proratedDays, // set start date
      };
    }
    return stripeClient.checkout.sessions.create(sessionInput);
  }

  // TODO create subscription for yearly downpayments and monthly membership fee
  //   OR create yearly one-time fee for paid-in-full
  async handlePaymentCompleteEvent({
    data: { object: eventData },
  }: IncomingCheckoutWebhook): Promise<void> {
    const orderCode = eventData.metadata.orderCode;
    const channelToken = eventData.metadata.channelToken;
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
    if (eventData.status !== 'complete') {
      Logger.info(
        `Received incoming webhook with status ${eventData.status}, not processing this event.`,
        loggerCtx
      );
      return;
    }
    // Status is complete, we can settle payment
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
        method: eventData.metadata.paymentMethodCode,
        metadata: {
          subscriptionId: eventData.subscription,
          amount: eventData.metadata.amount,
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
    // TODO create subscriptions for customers
  }

  async createContext(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
      languageCode: LanguageCode.en,
    });
  }

  async logOrderHistory(
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

  /**
   * Get the paymentMethod with the stripe handler, should be only 1!
   */
  private async getStripeHandler(
    ctx: RequestContext
  ): Promise<StripeHandlerConfig> {
    const paymentMethods = await this.paymentMethodService.findAll(ctx);
    const paymentMethod = paymentMethods.items.find(
      (pm) => pm.code === stripeSubscriptionHandler.code
    );
    if (!paymentMethod) {
      throw new UserInputError(
        `No paymentMethod found with handler ${stripeSubscriptionHandler.code}`
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
      stripeClient: new StripeClient(apiKey, {
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
}
