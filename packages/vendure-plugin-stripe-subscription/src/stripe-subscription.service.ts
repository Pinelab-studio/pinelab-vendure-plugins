import { Injectable } from '@nestjs/common';
import { StockMovementType } from '@vendure/common/lib/generated-types';
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
  Order,
  OrderLine,
  OrderLineEvent,
  OrderService,
  OrderStateTransitionError,
  PaymentMethodService,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  StockMovementEvent,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { loggerCtx } from './constants';
import { IncomingStripeWebhook } from './stripe.types';
import {
  OrderLineWithSubscriptionFields,
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
import { filter } from 'rxjs/operators';
import {
  calculateSubscriptionPricing,
  getNextCyclesStartDate,
  printMoney,
} from './pricing.helper';
import { Cancellation } from '@vendure/core/dist/entity/stock-movement/cancellation.entity';
import { Release } from '@vendure/core/dist/entity/stock-movement/release.entity';
import { randomUUID } from 'crypto';

export interface StripeHandlerConfig {
  paymentMethodCode: string;
  stripeClient: StripeClient;
  webhookSecret: string;
}

interface CreateSubscriptionsJob {
  action: 'createSubscriptionsForOrder';
  ctx: SerializedRequestContext;
  orderCode: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
}

interface CancelSubscriptionsJob {
  action: 'cancelSubscriptionsForOrderline';
  ctx: SerializedRequestContext;
  orderLineId: ID;
}

export type JobData = CreateSubscriptionsJob | CancelSubscriptionsJob;

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
    private eventBus: EventBus,
    private jobQueueService: JobQueueService,
    private customerService: CustomerService,
    private connection: TransactionalConnection
  ) {}

  private jobQueue!: JobQueue<JobData>;

  async onModuleInit() {
    // Create jobQueue with handlers
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'stripe-subscription',
      process: async ({ data, id }) => {
        const ctx = RequestContext.deserialize(data.ctx);
        if (data.action === 'cancelSubscriptionsForOrderline') {
          this.cancelSubscriptionForOrderLine(ctx, data.orderLineId);
        } else if (data.action === 'createSubscriptionsForOrder') {
          const order = await this.orderService.findOneByCode(
            ctx,
            data.orderCode,
            []
          );
          try {
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
            if (order) {
              await this.logHistoryEntry(
                ctx,
                order.id,
                'Failed to create subscription',
                error
              );
            }
            throw error;
          }
        }
      },
    });
    // Add unique hash for subscriptions, so Vendure creates a new order line
    this.eventBus.ofType(OrderLineEvent).subscribe(async (event) => {
      const orderLine = event.orderLine as OrderLineWithSubscriptionFields;
      if (
        event.type === 'created' &&
        orderLine.productVariant.customFields.subscriptionSchedule
      ) {
        await this.connection
          .getRepository(event.ctx, OrderLine)
          .update(
            { id: event.orderLine.id },
            { customFields: { subscriptionHash: randomUUID() } }
          );
      }
    });
    // Listen for stock cancellation or release events
    this.eventBus
      .ofType(StockMovementEvent)
      .pipe(
        // Filter by event type
        filter(
          (event) =>
            event.type === StockMovementType.RELEASE ||
            event.type === StockMovementType.CANCELLATION
        )
      )
      .subscribe(async (event) => {
        const orderLinesWithSubscriptions = (
          event.stockMovements as (Cancellation | Release)[]
        )
          .map(
            (stockMovement) =>
              stockMovement.orderItem.line as OrderLineWithSubscriptionFields
          )
          // Filter out non-sub orderlines
          .filter((orderLine) => orderLine.customFields.subscriptionIds);
        await Promise.all(
          // Push jobs
          orderLinesWithSubscriptions.map((line) =>
            this.jobQueue.add({
              ctx: event.ctx.serialize(),
              action: 'cancelSubscriptionsForOrderline',
              orderLineId: line.id,
            })
          )
        );
      });
  }

  async cancelSubscriptionForOrderLine(
    ctx: RequestContext,
    orderLineId: ID
  ): Promise<void> {
    const order = (await this.orderService.findOneByOrderLineId(
      ctx,
      orderLineId,
      ['lines']
    )) as OrderWithSubscriptions | undefined;
    if (!order) {
      throw Error(`Order for OrderLine ${orderLineId} not found`);
    }
    const line = order?.lines.find((l) => l.id == orderLineId);
    if (!line?.customFields.subscriptionIds?.length) {
      return Logger.info(
        `OrderLine ${orderLineId} of ${orderLineId} has no subscriptionIds. Not cancelling anything... `,
        loggerCtx
      );
    }
    await this.entityHydrator.hydrate(ctx, line, { relations: ['order'] });
    const { stripeClient } = await this.getStripeHandler(ctx, line.order.id);
    for (const subscriptionId of line.customFields.subscriptionIds) {
      try {
        await stripeClient.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        Logger.info(`Cancelled subscription ${subscriptionId}`);
        await this.logHistoryEntry(
          ctx,
          order!.id,
          `Cancelled subscription ${subscriptionId}`,
          undefined,
          undefined,
          subscriptionId
        );
      } catch (e: unknown) {
        Logger.error(
          `Failed to cancel subscription ${subscriptionId}`,
          loggerCtx
        );
        await this.logHistoryEntry(
          ctx,
          order.id,
          `Failed to cancel ${subscriptionId}`,
          e,
          undefined,
          subscriptionId
        );
      }
    }
  }

  async createPaymentIntent(ctx: RequestContext): Promise<string> {
    let order = (await this.activeOrderService.getActiveOrder(
      ctx,
      undefined
    )) as OrderWithSubscriptions;
    if (!order) {
      throw new UserInputError('No active order for session');
    }
    if (!order.totalWithTax) {
      // Add a verification fee to the order to support orders that are actually $0
      order = (await this.orderService.addSurchargeToOrder(ctx, order.id, {
        description: 'Verification fee',
        listPrice: 100,
        listPriceIncludesTax: true,
      })) as OrderWithSubscriptions;
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
    const hasSubscriptionProducts = order.lines.some(
      (l) => l.productVariant.customFields.subscriptionSchedule
    );
    const intent = await stripeClient.paymentIntents.create({
      customer: stripeCustomer.id,
      payment_method_types: ['card'], // TODO make configurable per channel
      setup_future_usage: hasSubscriptionProducts
        ? 'off_session'
        : 'on_session',
      amount: order.totalWithTax,
      currency: order.currencyCode,
      metadata: {
        orderCode: order.code,
        channelToken: ctx.channel.token,
        amount: order.totalWithTax,
      },
    });
    Logger.info(
      `Created payment intent '${intent.id}' for order ${order.code}`,
      loggerCtx
    );
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

  /**
   * Handle future subscription payments that come in after the initial payment intent
   */
  async handleInvoicePaymentSucceeded(
    ctx: RequestContext,
    { data: { object } }: IncomingStripeWebhook,
    order: Order
  ): Promise<void> {
    const amount = object.lines?.data?.[0]?.plan?.amount;
    const message = amount
      ? `Received subscription payment of ${printMoney(amount)}`
      : 'Received subscription payment';
    await this.logHistoryEntry(
      ctx,
      order.id,
      message,
      undefined,
      undefined,
      object.subscription
    );
  }

  /**
   * Handle failed subscription payments that come in after the initial payment intent
   */
  async handleInvoicePaymentFailed(
    ctx: RequestContext,
    { data: { object } }: IncomingStripeWebhook,
    order: Order
  ): Promise<void> {
    const amount = object.lines?.data[0]?.plan?.amount;
    const message = amount
      ? `Subscription payment of ${printMoney(amount)} failed`
      : 'Subscription payment failed';
    await this.logHistoryEntry(
      ctx,
      order.id,
      message,
      `${message} - ${object.id}`,
      undefined,
      object.subscription
    );
  }

  /**
   * Handle the initial payment Intent succeeded.
   * Creates subscriptions in Stripe for customer attached to this order
   */
  async handlePaymentIntentSucceeded(
    ctx: RequestContext,
    { data: { object: eventData } }: IncomingStripeWebhook,
    order: Order
  ): Promise<void> {
    const { paymentMethodCode } = await this.getStripeHandler(ctx, order.id);
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
      `Successfully settled payment for order ${order.code} for channel ${ctx.channel.token}`,
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
    let orderLineCount = 0;
    for (const orderLine of order.lines) {
      orderLineCount++; // Start with 1
      const createdSubscriptions: string[] = [];
      const pricing = await this.getPricing(ctx, {
        startDate: orderLine.customFields.startDate,
        downpaymentWithTax: orderLine.customFields.downpayment,
        productVariantId: orderLine.productVariant.id as string,
      });
      if (pricing.schedule.paidUpFront && !pricing.schedule.autoRenew) {
        continue; // Paid up front without autoRenew doesn't need a subscription
      }
      Logger.info(`Creating subscriptions for ${orderCode}`, loggerCtx);
      try {
        const product = await stripeClient.products.create({
          name: `${orderLine.productVariant.name} (${order.code})`,
        });
        const recurringSubscription =
          await stripeClient.createOffSessionSubscription({
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
            orderCode: order.code,
            channelToken: ctx.channel.token,
          });
        createdSubscriptions.push(recurringSubscription.id);
        if (
          recurringSubscription.status !== 'active' &&
          recurringSubscription.status !== 'trialing'
        ) {
          Logger.error(
            `Failed to create active subscription ${recurringSubscription.id} for order ${order.code}! It is still in status '${recurringSubscription.status}'`,
            loggerCtx
          );
          await this.logHistoryEntry(
            ctx,
            order.id,
            'Failed to create subscription',
            `Subscription status is ${recurringSubscription.status}`,
            pricing,
            recurringSubscription.id
          );
        } else {
          Logger.info(
            `Created subscription ${recurringSubscription.id}: ${printMoney(
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
            `Created subscription for line ${orderLineCount}`,
            undefined,
            pricing,
            recurringSubscription.id
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
          const downpaymentSubscription =
            await stripeClient.createOffSessionSubscription({
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
              orderCode: order.code,
              channelToken: ctx.channel.token,
            });
          createdSubscriptions.push(recurringSubscription.id);
          if (
            downpaymentSubscription.status !== 'active' &&
            downpaymentSubscription.status !== 'trialing'
          ) {
            Logger.error(
              `Failed to create active subscription ${downpaymentSubscription.id} for order ${order.code}! It is still in status '${downpaymentSubscription.status}'`,
              loggerCtx
            );
            await this.logHistoryEntry(
              ctx,
              order.id,
              'Failed to create downpayment subscription',
              'Failed to create active subscription',
              undefined,
              downpaymentSubscription.id
            );
          } else {
            Logger.info(
              `Created downpayment subscription ${
                downpaymentSubscription.id
              }: ${printMoney(
                pricing.downpaymentWithTax
              )} every ${downpaymentIntervalCount} ${downpaymentInterval}(s) with startDate ${
                pricing.subscriptionStartDate
              } for order ${order.code}`,
              loggerCtx
            );
            await this.logHistoryEntry(
              ctx,
              order.id,
              `Created downpayment subscription for line ${orderLineCount}`,
              undefined,
              pricing,
              downpaymentSubscription.id
            );
          }
        }
        await this.saveSubscriptionIds(ctx, orderLine.id, createdSubscriptions);
      } catch (e: unknown) {
        await this.logHistoryEntry(ctx, order.id, '', e);
        throw e;
      }
    }
  }

  async saveSubscriptionIds(
    ctx: RequestContext,
    orderLineId: ID,
    subscriptionIds: string[]
  ) {
    await this.connection
      .getRepository(ctx, OrderLine)
      .update({ id: orderLineId }, { customFields: { subscriptionIds } });
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
  async getStripeHandler(
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
    message: string,
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
          message,
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
