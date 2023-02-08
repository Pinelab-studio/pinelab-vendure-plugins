import { Inject, Injectable } from '@nestjs/common';
import {
  ActiveOrderService,
  ChannelService,
  CustomerService,
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
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  UserInputError,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { StripeSubscriptionPluginOptions } from './stripe-subscription.plugin';
import { IncomingStripeWebhook } from './stripe.types';
import {
  OrderWithSubscriptions,
  VariantWithSubscriptionFields,
} from './subscription-custom-fields';
import { StripeClient } from './stripe.client';
import {
  StripeSubscriptionPricing,
  StripeSubscriptionPricingInput,
} from './ui/generated/graphql';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import { Request } from 'express';
import {
  calculateSubscriptionPricing,
  getNextCyclesStartDate,
  printMoney,
} from './pricing.helper';

export interface StripeHandlerConfig {
  paymentMethodCode: string;
  stripeClient: StripeClient;
  webhookSecret: string;
}

export interface JobData {
  action: 'createSubscriptionsForOrder';
  ctx: SerializedRequestContext;
  orderCode: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
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
    private jobQueueService: JobQueueService,
    private customerService: CustomerService
  ) {}

  private jobQueue!: JobQueue<JobData>;

  async onModuleInit() {
    // Create jobQueue with handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'stripe-subscription',
      process: async ({ data, id }) => {
        try {
          const ctx = RequestContext.deserialize(data.ctx);
          await this.createSubscriptions(
            ctx,
            data.orderCode,
            data.stripeCustomerId,
            data.stripePaymentMethodId
          );
        } catch (error) {
          Logger.warn(
            `Failed to process job ${data.action} (${id}) for channel ${data.ctx._channel.token}: ${error}`,
            loggerCtx
          );
          throw error;
        }
      },
    });
  }

  async createPaymentIntent(ctx: RequestContext): Promise<string> {
    const order = (await this.activeOrderService.getActiveOrder(
      ctx,
      undefined
    )) as OrderWithSubscriptions;
    if (!order) {
      throw new UserInputError('No active order for session');
    }
    await this.entityHydrator.hydrate(ctx, order, {
      relations: ['customer', 'shippingLines', 'lines.productVariant'],
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
    const { stripeClient } = await this.getStripeHandler(ctx, order.id);
    const stripeCustomer = await stripeClient.getOrCreateClient(order.customer);
    this.customerService
      .update(ctx, {
        id: order.customer.id,
        customFields: {
          stripeCustomerId: stripeCustomer.id,
        },
      })
      .catch((err) =>
        Logger.error(
          `Failed to update stripeCustomerId ${stripeCustomer.id} for ${order.customer.emailAddress}`,
          loggerCtx,
          err
        )
      );
    let totalAmountDueNow = 0;
    const hasSubscriptionProducts = order.lines.some(
      (l) => l.productVariant.customFields.subscriptionSchedule
    );
    await Promise.all(
      order.lines.map(async (line) => {
        totalAmountDueNow += line.proratedLinePriceWithTax;
        Logger.info(
          `Added ${printMoney(
            line.proratedLinePriceWithTax // Prorated line price has subscriptionPrice because of our custom strategy
          )} to payment intent for ${line.productVariant.name}`,
          loggerCtx
        );
      })
    );
    const intent = await stripeClient.paymentIntents.create({
      customer: stripeCustomer.id,
      payment_method_types: ['card'], // TODO make configurable per channel
      setup_future_usage: hasSubscriptionProducts
        ? 'off_session'
        : 'on_session',
      amount: totalAmountDueNow,
      currency: order.currencyCode,
      metadata: {
        orderCode: order.code,
        channelToken: ctx.channel.token,
        amount: totalAmountDueNow,
      },
    });
    return intent.client_secret!;
  }

  /**
   * Used for previewing the prices including VAT of a subscription
   */
  async getPricing(
    ctx: RequestContext,
    input: StripeSubscriptionPricingInput
  ): Promise<StripeSubscriptionPricing> {
    const variant = (await this.variantService.findOne(
      ctx,
      input.productVariantId!
    )) as VariantWithSubscriptionFields;
    if (!variant || !variant?.enabled) {
      throw new UserInputError(
        `No variant found with id ${input!.productVariantId}`
      );
    }
    return calculateSubscriptionPricing(variant, input);
  }

  async handlePaymentCompleteEvent(
    { type, data: { object: eventData } }: IncomingStripeWebhook,
    signature: string | undefined,
    rawBodyPayload: Buffer,
    req: Request
  ): Promise<void> {
    if (type !== 'payment_intent.succeeded') {
      Logger.info(
        `Received incoming '${type}' webhook, not processing this event.`,
        loggerCtx
      );
      return;
    }
    const orderCode = eventData.metadata.orderCode;
    const channelToken = eventData.metadata.channelToken;
    if (!orderCode) {
      return Logger.warn(
        `Incoming webhook is missing metadata.orderCode, cannot process this event`,
        loggerCtx
      );
    }
    if (!channelToken) {
      return Logger.warn(
        `Incoming webhook is missing metadata.channelToken, cannot process this event`,
        loggerCtx
      );
    }
    const ctx = await this.createContext(channelToken, req);
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(`Cannot find order with code ${orderCode}`);
    }
    if (!eventData.customer) {
      await this.logHistoryEntry(
        ctx,
        order.id,
        '',
        `No customer ID found in incoming webhook. Can not create subscriptions for this order.`
      );
      throw Error(`No customer found in webhook data for order ${order.code}`);
    }
    // Create subscriptions for customer
    const { stripeClient, paymentMethodCode } = await this.getStripeHandler(
      ctx,
      order.id
    );
    if (!this.options?.disableWebhookSignatureChecking) {
      stripeClient.validateWebhookSignature(rawBodyPayload, signature);
    }
    await this.jobQueue.add(
      {
        action: 'createSubscriptionsForOrder',
        ctx: ctx.serialize(),
        orderCode: order.code,
        stripePaymentMethodId: eventData.payment_method,
        stripeCustomerId: eventData.customer,
      },
      { retries: 0 }
    ); // Only 1 try, because subscription creation isn't transaction-proof
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
        method: paymentMethodCode,
        metadata: {
          setupIntentId: eventData.id,
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
      `Successfully settled payment for order ${order.code} for channel ${channelToken}`,
      loggerCtx
    );
  }

  /**
   * Create subscriptions for customer based on order
   */
  private async createSubscriptions(
    ctx: RequestContext,
    orderCode: string,
    stripeCustomerId: string,
    stripePaymentMethodId: string
  ): Promise<void> {
    const order = (await this.orderService.findOneByCode(ctx, orderCode, [
      'customer',
      'lines',
      'lines.productVariant',
    ])) as OrderWithSubscriptions;
    if (!order) {
      throw Error(`Cannot find order with code ${orderCode}`);
    }
    const { stripeClient } = await this.getStripeHandler(ctx, order.id);
    const customer = await stripeClient.customers.retrieve(stripeCustomerId);
    if (!customer) {
      throw Error(
        `Failed to create subscription for ${stripeCustomerId} because the customer doesn't exist in Stripe`
      );
    }
    for (const orderLine of order.lines) {
      const pricing = await this.getPricing(ctx, {
        startDate: orderLine.customFields.startDate,
        downpaymentWithTax: orderLine.customFields.downpayment,
        productVariantId: orderLine.productVariant.id as string,
      });
      if (pricing.schedule.paidUpFront && !pricing.schedule.autoRenew) {
        continue; // Paid up front without autoRenew doesn't need a subscription
      }
      Logger.info(
        `Creating subscriptions with pricing ${JSON.stringify(pricing)}`,
        loggerCtx
      );
      try {
        const product = await stripeClient.products.create({
          name: `${orderLine.productVariant.name} (${order.code})`,
        });
        const recurring = await stripeClient.createOffSessionSubscription({
          customerId: stripeCustomerId,
          productId: product.id,
          currencyCode: order.currencyCode,
          amount: pricing.recurringPriceWithTax,
          interval: pricing.interval,
          intervalCount: pricing.intervalCount,
          paymentMethodId: stripePaymentMethodId,
          startDate: pricing.subscriptionStartDate,
          endDate: pricing.subscriptionEndDate || undefined,
          description: orderLine.productVariant.name,
        });
        if (recurring.status !== 'active' && recurring.status !== 'trialing') {
          Logger.error(
            `Failed to create active subscription ${recurring.id} for order ${order.code}! It is still in status '${recurring.status}'`,
            loggerCtx
          );
          await this.logHistoryEntry(
            ctx,
            order.id,
            'recurring',
            `Subscription status is ${recurring.status}`,
            pricing,
            recurring.id
          );
        } else {
          Logger.info(
            `Created subscription ${recurring.id}: ${printMoney(
              pricing.recurringPriceWithTax
            )} every ${pricing.intervalCount} ${
              pricing.interval
            }(s) with startDate ${pricing.subscriptionStartDate} for order ${
              order.code
            }`,
            loggerCtx
          );
          await this.logHistoryEntry(
            ctx,
            order.id,
            'recurring',
            undefined,
            pricing,
            recurring.id
          );
        }
        if (pricing.downpaymentWithTax) {
          // Create downpayment with the interval of the duration. So, if the subscription renews in 6 months, then the downpayment should occur every 6 months
          const downpaymentProduct = await stripeClient.products.create({
            name: `${orderLine.productVariant.name} - Downpayment (${order.code})`,
          });
          const schedule =
            orderLine.productVariant.customFields.subscriptionSchedule;
          if (!schedule) {
            throw new UserInputError(
              `Variant ${orderLine.productVariant.id} doesn't have a schedule attached`
            );
          }
          const downpaymentInterval = schedule.durationInterval;
          const downpaymentIntervalCount = schedule.durationCount;
          const nextDownpaymentDate = getNextCyclesStartDate(
            new Date(),
            schedule.startMoment,
            schedule.durationInterval,
            schedule.durationCount,
            schedule.fixedStartDate
          );
          const downpayment = await stripeClient.createOffSessionSubscription({
            customerId: stripeCustomerId,
            productId: downpaymentProduct.id,
            currencyCode: order.currencyCode,
            amount: pricing.downpaymentWithTax,
            interval: downpaymentInterval,
            intervalCount: downpaymentIntervalCount,
            paymentMethodId: stripePaymentMethodId,
            startDate: nextDownpaymentDate,
            endDate: pricing.subscriptionEndDate || undefined,
            description: `Downpayment`,
          });
          if (
            downpayment.status !== 'active' &&
            downpayment.status !== 'trialing'
          ) {
            Logger.error(
              `Failed to create active subscription ${downpayment.id} for order ${order.code}! It is still in status '${downpayment.status}'`,
              loggerCtx
            );
            await this.logHistoryEntry(
              ctx,
              order.id,
              'downpayment',
              'Failed to create active subscription',
              undefined,
              downpayment.id
            );
          } else {
            Logger.info(
              `Created downpayment subscription ${downpayment.id}: ${printMoney(
                pricing.downpaymentWithTax
              )} every ${downpaymentIntervalCount} ${downpaymentInterval}(s) with startDate ${
                pricing.subscriptionStartDate
              } for order ${order.code}`,
              loggerCtx
            );
            await this.logHistoryEntry(
              ctx,
              order.id,
              'downpayment',
              undefined,
              pricing,
              downpayment.id
            );
          }
        }
      } catch (e: unknown) {
        await this.logHistoryEntry(ctx, order.id, '', e);
        throw e;
      }
    }
  }

  async createContext(
    channelToken: string,
    req: Request
  ): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
      languageCode: LanguageCode.en,
      req,
    });
  }

  /**
   * Get the paymentMethod with the stripe handler, should be only 1!
   */
  private async getStripeHandler(
    ctx: RequestContext,
    orderId: ID
  ): Promise<StripeHandlerConfig> {
    const paymentMethodQuotes =
      await this.orderService.getEligiblePaymentMethods(ctx, orderId);
    const paymentMethodQuote = paymentMethodQuotes.find(
      (pm) => pm.code.indexOf('stripe-subscription') > -1
    );
    if (!paymentMethodQuote) {
      throw Error(`No payment method found with code 'stripe-subscription'`);
    }
    const paymentMethod = await this.paymentMethodService.findOne(
      ctx,
      paymentMethodQuote.id
    );
    if (
      !paymentMethod ||
      paymentMethod.handler.code !== stripeSubscriptionHandler.code
    ) {
      throw Error(
        `Payment method '${paymentMethodQuote.code}' doesn't have handler '${stripeSubscriptionHandler.code}' configured.`
      );
    }
    const apiKey = paymentMethod.handler.args.find(
      (arg) => arg.name === 'apiKey'
    )?.value;
    let webhookSecret = paymentMethod.handler.args.find(
      (arg) => arg.name === 'webhookSecret'
    )?.value;
    if (!apiKey || !webhookSecret) {
      Logger.warn(
        `No api key or webhook secret is configured for ${paymentMethod.code}`,
        loggerCtx
      );
      throw Error(
        `Payment method ${paymentMethod.code} has no api key or webhook secret configured`
      );
    }
    return {
      paymentMethodCode: paymentMethod.code,
      stripeClient: new StripeClient(webhookSecret, apiKey, {
        apiVersion: null as any, // Null uses accounts default version
      }),
      webhookSecret,
    };
  }

  async logHistoryEntry(
    ctx: RequestContext,
    orderId: ID,
    name: string,
    error?: unknown,
    pricing?: StripeSubscriptionPricing,
    subscriptionId?: string
  ): Promise<void> {
    let prettifiedError = error
      ? JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
      : undefined; // Make sure its serializable
    let prettifierPricing = pricing
      ? {
          ...pricing,
          totalProratedAmountWithTax: printMoney(
            pricing.totalProratedAmountWithTax
          ),
          downpaymentWithTax: printMoney(pricing.downpaymentWithTax),
          recurringPriceWithTax: printMoney(pricing.recurringPriceWithTax),
          amountDueNowWithTax: printMoney(pricing.amountDueNowWithTax),
          dayRateWithTax: printMoney(pricing.dayRateWithTax),
        }
      : undefined;
    await this.historyService.createHistoryEntryForOrder(
      {
        ctx,
        orderId,
        type: 'STRIPE_SUBSCRIPTION_NOTIFICATION' as any,
        data: {
          name,
          valid: !error,
          error: prettifiedError,
          subscriptionId,
          pricing: prettifierPricing,
        },
      },
      false
    );
  }
}
