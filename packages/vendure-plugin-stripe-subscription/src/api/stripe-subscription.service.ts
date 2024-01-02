import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { StockMovementType } from '@vendure/common/lib/generated-types';
import {
  ActiveOrderService,
  ChannelService,
  EntityHydrator,
  ErrorResult,
  EventBus,
  HistoryService,
  ID,
  Injector,
  JobQueue,
  JobQueueService,
  LanguageCode,
  Logger,
  Order,
  OrderLine,
  OrderLineEvent,
  OrderService,
  OrderStateTransitionError,
  PaymentMethod,
  PaymentMethodEvent,
  PaymentMethodService,
  ProductService,
  ProductVariantService,
  RequestContext,
  SerializedRequestContext,
  StockMovementEvent,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { Cancellation } from '@vendure/core/dist/entity/stock-movement/cancellation.entity';
import { Release } from '@vendure/core/dist/entity/stock-movement/release.entity';
import { randomUUID } from 'crypto';
import { sub } from 'date-fns';
import { Request } from 'express';
import { filter } from 'rxjs/operators';
import Stripe from 'stripe';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { StripeSubscriptionPluginOptions } from '../stripe-subscription.plugin';
import {
  StripeSubscription,
  StripeSubscriptionIntent,
} from './generated/graphql';
import {
  Subscription,
  SubscriptionStrategy,
} from './strategy/subscription-strategy';
import { StripeClient } from './stripe.client';
import { StripeInvoice } from './types/stripe-invoice';
import {
  StripePaymentIntent,
  StripeSetupIntent,
} from './types/stripe-payment-intent';
import { printMoney } from './util';
import { stripeSubscriptionHandler } from './vendure-config/stripe-subscription.handler';

export interface StripeContext {
  paymentMethod: PaymentMethod;
  stripeClient: StripeClient;
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
    private entityHydrator: EntityHydrator,
    private channelService: ChannelService,
    private orderService: OrderService,
    private historyService: HistoryService,
    private eventBus: EventBus,
    private jobQueueService: JobQueueService,
    private moduleRef: ModuleRef,
    private connection: TransactionalConnection,
    private productVariantService: ProductVariantService,
    private productService: ProductService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private options: StripeSubscriptionPluginOptions
  ) {
    this.strategy = this.options.subscriptionStrategy!;
  }

  private jobQueue!: JobQueue<JobData>;
  readonly strategy: SubscriptionStrategy;
  /**
   * The plugin expects these events to come in via webhooks
   */
  static webhookEvents: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    'payment_intent.succeeded',
    'setup_intent.succeeded',
    'invoice.payment_failed',
    'invoice.payment_succeeded',
    'invoice.payment_action_required',
  ];

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
      if (event.type !== 'created') {
        return;
      }
      if (
        await this.strategy.isSubscription(
          event.ctx,
          event.orderLine.productVariant,
          new Injector(this.moduleRef)
        )
      ) {
        await this.connection
          .getRepository(event.ctx, OrderLine)
          .update(
            { id: event.orderLine.id },
            { customFields: { subscriptionHash: randomUUID() } }
          );
      }
    });
    // Listen for stock cancellation or release events, to cancel an order lines subscription
    this.eventBus
      .ofType(StockMovementEvent)
      .pipe(
        filter(
          (event) =>
            event.type === StockMovementType.RELEASE ||
            event.type === StockMovementType.CANCELLATION
        )
      )
      .subscribe(async (event) => {
        const cancelOrReleaseEvents = event.stockMovements as (
          | Cancellation
          | Release
        )[];
        const stockEvents = cancelOrReleaseEvents
          // Filter out non-sub orderlines
          .filter(
            (event) => (event.orderLine.customFields as any).subscriptionIds
          );
        await Promise.all(
          // Push jobs
          stockEvents.map((stockEvent) =>
            this.jobQueue.add({
              ctx: event.ctx.serialize(),
              action: 'cancelSubscriptionsForOrderline',
              orderLineId: stockEvent.orderLine.id,
            })
          )
        );
      });
    // Listen for PaymentMethod create or update, to automatically create webhooks
    this.eventBus.ofType(PaymentMethodEvent).subscribe(async (event) => {
      if (event.type === 'created' || event.type === 'updated') {
        const paymentMethod = event.entity;
        if (paymentMethod.handler.code === stripeSubscriptionHandler.code) {
          await this.registerWebhooks(event.ctx, paymentMethod).catch((e) => {
            Logger.error(
              `Failed to register webhooks for channel ${event.ctx.channel.token}: ${e}`,
              loggerCtx
            );
          });
        }
      }
    });
  }

  /**
   * Register webhook with the right events if they don't exist yet.
   * If already exists, the existing hook is deleted and a new one is created.
   * Existence is checked by name.
   *
   * Saves the webhook secret irectly on the payment method
   */
  async registerWebhooks(
    ctx: RequestContext,
    paymentMethod: PaymentMethod
  ): Promise<Stripe.Response<Stripe.WebhookEndpoint> | undefined> {
    const webhookDescription = `Vendure Stripe Subscription Webhook for channel ${ctx.channel.token}`;
    const apiKey = paymentMethod.handler.args.find(
      (arg) => arg.name === 'apiKey'
    )?.value;
    if (!apiKey) {
      throw new UserInputError(
        `No api key found for payment method ${paymentMethod.code}, can not register webhooks`
      );
    }
    const stripeClient = new StripeClient('not-yet-available-secret', apiKey, {
      apiVersion: null as any, // Null uses accounts default version
    });
    const webhookUrl = `${this.options.vendureHost}/stripe-subscriptions/webhook`;
    // Get existing webhooks and check if url and events match. If not, create them
    const webhooks = await stripeClient.webhookEndpoints.list({ limit: 100 });
    if (webhooks.data.length === 100) {
      Logger.error(
        `Your Stripe account has too many webhooks setup, ` +
          `you will need to manually create the webhook with events ${StripeSubscriptionService.webhookEvents.join(
            ', '
          )}`,
        loggerCtx
      );
      return;
    }
    const existingWebhook = webhooks.data.find(
      (w) => w.description === webhookDescription
    );
    if (existingWebhook) {
      await stripeClient.webhookEndpoints.del(existingWebhook.id);
    }
    const createdHook = await stripeClient.webhookEndpoints.create({
      enabled_events: StripeSubscriptionService.webhookEvents,
      description: webhookDescription,
      url: webhookUrl,
    });
    // Update webhook secret in paymentMethod
    paymentMethod.handler.args.forEach((arg) => {
      if (arg.name === 'webhookSecret') {
        arg.value = createdHook.secret!;
      }
    });
    const res = await this.connection
      .getRepository(ctx, PaymentMethod)
      .save(paymentMethod);
    Logger.info(
      `Created webhook ${createdHook.id} for channel ${ctx.channel.token}`,
      loggerCtx
    );
    return createdHook;
  }

  async previewSubscription(
    ctx: RequestContext,
    productVariantId: ID,
    customInputs?: any
  ): Promise<StripeSubscription[]> {
    const variant = await this.productVariantService.findOne(
      ctx,
      productVariantId
    );
    if (!variant) {
      throw new UserInputError(
        `No product variant with id '${productVariantId}' found`
      );
    }
    const injector = new Injector(this.moduleRef);
    if (!(await this.strategy.isSubscription(ctx, variant, injector))) {
      throw new UserInputError(
        `Product variant '${variant.id}' is not a subscription product`
      );
    }
    const subscriptions = await this.strategy.previewSubscription(
      ctx,
      injector,
      variant,
      customInputs
    );
    if (Array.isArray(subscriptions)) {
      return subscriptions.map((sub) => ({
        ...sub,
        variantId: variant.id,
      }));
    } else {
      return [
        {
          ...subscriptions,
          variantId: variant.id,
        },
      ];
    }
  }

  async previewSubscriptionForProduct(
    ctx: RequestContext,
    productId: ID,
    customInputs?: any
  ): Promise<StripeSubscription[]> {
    const { items: variants } =
      await this.productVariantService.getVariantsByProductId(ctx, productId);
    if (!variants?.length) {
      throw new UserInputError(`No variants for product '${productId}' found`);
    }
    const subscriptions = await Promise.all(
      variants.map((v) => this.previewSubscription(ctx, v.id, customInputs))
    );
    return subscriptions.flat();
  }

  async cancelSubscriptionForOrderLine(
    ctx: RequestContext,
    orderLineId: ID
  ): Promise<void> {
    const order = await this.orderService.findOneByOrderLineId(
      ctx,
      orderLineId,
      ['lines']
    );
    if (!order) {
      throw Error(`Order for OrderLine ${orderLineId} not found`);
    }
    const line = order?.lines.find((l) => l.id == orderLineId) as
      | any
      | undefined;
    if (!line?.customFields.subscriptionIds?.length) {
      return Logger.info(
        `OrderLine ${orderLineId} of ${orderLineId} has no subscriptionIds. Not cancelling anything... `,
        loggerCtx
      );
    }
    await this.entityHydrator.hydrate(ctx, line, { relations: ['order'] });
    const { stripeClient } = await this.getStripeContext(ctx);
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

  /**
   * Proxy to Stripe to retrieve subscriptions created for the current channel.
   * Proxies to the Stripe api, so you can use the same filtering, parameters and options as defined here
   * https://stripe.com/docs/api/subscriptions/list
   */
  async getAllSubscriptions(
    ctx: RequestContext,
    params?: Stripe.SubscriptionListParams,
    options?: Stripe.RequestOptions
  ): Promise<Stripe.ApiListPromise<Stripe.Subscription>> {
    const { stripeClient } = await this.getStripeContext(ctx);
    return stripeClient.subscriptions.list(params, options);
  }

  /**
   * Get a subscription directly from Stripe
   */
  async getSubscription(
    ctx: RequestContext,
    subscriptionId: string
  ): Promise<Stripe.Response<Stripe.Subscription>> {
    const { stripeClient } = await this.getStripeContext(ctx);
    return stripeClient.subscriptions.retrieve(subscriptionId);
  }

  async createIntent(ctx: RequestContext): Promise<StripeSubscriptionIntent> {
    let order = await this.activeOrderService.getActiveOrder(ctx, undefined);
    if (!order) {
      throw new UserInputError('No active order for session');
    }
    await this.entityHydrator.hydrate(ctx, order, {
      relations: ['customer', 'shippingLines', 'lines.productVariant'],
      applyProductVariantPrices: true,
    });
    if (!order.lines?.length) {
      throw new UserInputError('Cannot create intent for empty order');
    }
    if (!order.customer) {
      throw new UserInputError(
        'Cannot create intent for order without customer'
      );
    }
    if (!order.shippingLines?.length) {
      throw new UserInputError(
        'Cannot create intent for order without shippingMethod'
      );
    }
    // Check if Stripe Subscription paymentMethod is eligible for this order
    const eligibleStripeMethodCodes = (
      await this.orderService.getEligiblePaymentMethods(ctx, order.id)
    )
      .filter((m) => m.isEligible)
      .map((m) => m.code);
    const { stripeClient, paymentMethod } = await this.getStripeContext(ctx);
    if (!eligibleStripeMethodCodes.includes(paymentMethod.code)) {
      throw new UserInputError(
        `No eligible payment method found for order ${order.code} with handler code '${stripeSubscriptionHandler.code}'`
      );
    }
    await this.orderService.transitionToState(
      ctx,
      order.id,
      'ArrangingPayment'
    );
    const stripeCustomer = await stripeClient.getOrCreateCustomer(
      order.customer
    );
    const stripePaymentMethods = ['card']; // TODO make configurable per channel
    let intent: Stripe.PaymentIntent | Stripe.SetupIntent;
    if (order.totalWithTax > 0) {
      // Create PaymentIntent + off_session, because we have both one-time and recurring payments. Order total is only > 0 if there are one-time payments
      intent = await stripeClient.paymentIntents.create({
        customer: stripeCustomer.id,
        payment_method_types: stripePaymentMethods,
        setup_future_usage: 'off_session',
        amount: order.totalWithTax,
        currency: order.currencyCode,
        metadata: {
          orderCode: order.code,
          channelToken: ctx.channel.token,
          amount: order.totalWithTax,
        },
      });
    } else {
      // Create SetupIntent, because we only have recurring payments
      intent = await stripeClient.setupIntents.create({
        customer: stripeCustomer.id,
        payment_method_types: stripePaymentMethods,
        usage: 'off_session',
        metadata: {
          orderCode: order.code,
          channelToken: ctx.channel.token,
          amount: order.totalWithTax,
        },
      });
    }
    const intentType =
      intent.object === 'payment_intent' ? 'PaymentIntent' : 'SetupIntent';
    if (!intent.client_secret) {
      throw Error(
        `No client_secret found in ${intentType} response, something went wrong!`
      );
    }
    Logger.info(
      `Created ${intentType} '${intent.id}' for order ${order.code}`,
      loggerCtx
    );
    return {
      clientSecret: intent.client_secret,
      intentType,
    };
  }

  /**
   * This defines the actual subscriptions and prices for each order line, based on the configured strategy.
   * Doesn't allow recurring amount to be below 0 or lower
   */
  async getSubscriptionsForOrder(
    ctx: RequestContext,
    order: Order
  ): Promise<(Subscription & { orderLineId: ID; variantId: ID })[]> {
    const injector = new Injector(this.moduleRef);
    // Only define subscriptions for orderlines with a subscription product variant
    const subscriptionOrderLines = await this.getSubscriptionOrderLines(
      ctx,
      order
    );
    const subscriptions = await Promise.all(
      subscriptionOrderLines.map(async (line) => {
        const subs = await this.getSubscriptionsForOrderLine(ctx, line, order);
        // Add orderlineId and variantId to subscription
        return subs.map((sub) => ({
          orderLineId: line.id,
          variantId: line.productVariant.id,
          ...sub,
        }));
      })
    );
    const flattenedSubscriptionsArray = subscriptions.flat();
    // Validate recurring amount
    flattenedSubscriptionsArray.forEach((subscription) => {
      if (
        !subscription.recurring.amount ||
        subscription.recurring.amount <= 0
      ) {
        throw Error(
          `[${loggerCtx}]: Defined subscription for order line ${subscription.variantId} must have a recurring amount greater than 0`
        );
      }
    });
    return flattenedSubscriptionsArray;
  }

  async getSubscriptionsForOrderLine(
    ctx: RequestContext,
    orderLine: OrderLine,
    order: Order
  ): Promise<Subscription[]> {
    const injector = new Injector(this.moduleRef);
    const subs = await this.strategy.defineSubscription(
      ctx,
      injector,
      orderLine.productVariant,
      orderLine.order,
      orderLine.customFields,
      orderLine.quantity
    );
    if (Array.isArray(subs)) {
      return subs;
    }
    return [subs];
  }

  /**
   * Get order lines that have a subscription product variant
   */
  async getSubscriptionOrderLines(
    ctx: RequestContext,
    order: Order
  ): Promise<OrderLine[]> {
    const subscriptionOrderLines: OrderLine[] = [];
    await Promise.all(
      order.lines.map(async (l) => {
        if (
          await this.strategy.isSubscription(
            ctx,
            l.productVariant,
            new Injector(this.moduleRef)
          )
        ) {
          subscriptionOrderLines.push(l);
        }
      })
    );
    return subscriptionOrderLines;
  }

  /**
   * Checks if the order has any variants that should be treated as subscriptions
   */
  async hasSubscriptions(ctx: RequestContext, order: Order): Promise<boolean> {
    const subscriptionOrderLines = await this.getSubscriptionOrderLines(
      ctx,
      order
    );
    return subscriptionOrderLines.length > 0;
  }

  /**
   * Handle failed subscription payments that come in after the initial payment intent
   */
  async handleInvoicePaymentFailed(
    ctx: RequestContext,
    object: StripeInvoice,
    order: Order
  ): Promise<void> {
    // TODO: Emit StripeSubscriptionPaymentFailed(subscriptionId, order, stripeInvoiceObject: StripeInvoice)
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
   * Handle the initial succeeded setup or payment intent.
   * Creates subscriptions in Stripe in the background via the jobqueue
   */
  async handleIntentSucceeded(
    ctx: RequestContext,
    object: StripePaymentIntent | StripeSetupIntent,
    order: Order
  ): Promise<void> {
    const {
      paymentMethod: { code: paymentMethodCode },
    } = await this.getStripeContext(ctx);
    if (!object.customer) {
      await this.logHistoryEntry(
        ctx,
        order.id,
        '',
        `No customer ID found in incoming webhook. Can not create subscriptions for this order.`
      );
      throw Error(`No customer found in webhook data for order ${order.code}`);
    }
    // Create subscriptions for customer
    this.jobQueue
      .add(
        {
          action: 'createSubscriptionsForOrder',
          ctx: ctx.serialize(),
          orderCode: order.code,
          stripePaymentMethodId: object.payment_method,
          stripeCustomerId: object.customer,
        },
        { retries: 0 } // Only 1 try, because subscription creation isn't idempotent
      )
      .catch((e) =>
        Logger.error(
          `Failed to add subscription-creation job to queue`,
          loggerCtx
        )
      );
    // Settle payment for order
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
          setupIntentId: object.id,
          amount: object.metadata.amount,
        },
      }
    );
    if ((addPaymentToOrderResult as ErrorResult).errorCode) {
      throw Error(
        `[${loggerCtx}]: Error adding payment to order ${order.code}: ${
          (addPaymentToOrderResult as ErrorResult).message
        }`
      );
    }
    Logger.info(
      `Successfully settled payment for order ${
        order.code
      } with amount ${printMoney(object.metadata.amount)}, for channel ${
        ctx.channel.token
      }`,
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
    const order = await this.orderService.findOneByCode(ctx, orderCode, [
      'customer',
      'lines',
      'lines.productVariant',
    ]);
    if (!order) {
      throw Error(`[${loggerCtx}]: Cannot find order with code ${orderCode}`);
    }
    try {
      if (!(await this.hasSubscriptions(ctx, order))) {
        Logger.info(
          `Order ${order.code} doesn't have any subscriptions. No action needed`,
          loggerCtx
        );
        return;
      }
      const { stripeClient } = await this.getStripeContext(ctx);
      const customer = await stripeClient.customers.retrieve(stripeCustomerId);
      if (!customer) {
        throw Error(
          `[${loggerCtx}]: Failed to create subscription for customer ${stripeCustomerId} because it doesn't exist in Stripe`
        );
      }
      const subscriptionDefinitions = await this.getSubscriptionsForOrder(
        ctx,
        order
      );
      Logger.info(`Creating subscriptions for ${orderCode}`, loggerCtx);
      // <orderLineId, subscriptionIds>
      const subscriptionsPerOrderLine = new Map<ID, string[]>();
      for (const subscriptionDefinition of subscriptionDefinitions) {
        try {
          const product = await stripeClient.products.create({
            name: subscriptionDefinition.name,
          });
          const createdSubscription =
            await stripeClient.createOffSessionSubscription({
              customerId: stripeCustomerId,
              productId: product.id,
              currencyCode: order.currencyCode,
              amount: subscriptionDefinition.recurring.amount,
              interval: subscriptionDefinition.recurring.interval,
              intervalCount: subscriptionDefinition.recurring.intervalCount,
              paymentMethodId: stripePaymentMethodId,
              startDate: subscriptionDefinition.recurring.startDate,
              endDate: subscriptionDefinition.recurring.endDate,
              description: `'${subscriptionDefinition.name} for order '${order.code}'`,
              orderCode: order.code,
              channelToken: ctx.channel.token,
            });
          if (
            createdSubscription.status !== 'active' &&
            createdSubscription.status !== 'trialing'
          ) {
            // Created subscription is not active for some reason. Log error and continue to next
            Logger.error(
              `Failed to create active subscription ${subscriptionDefinition.name} (${createdSubscription.id}) for order ${order.code}! It is still in status '${createdSubscription.status}'`,
              loggerCtx
            );
            await this.logHistoryEntry(
              ctx,
              order.id,
              `Failed to create subscription ${subscriptionDefinition.name}`,
              `Subscription status is ${createdSubscription.status}`,
              subscriptionDefinition,
              createdSubscription.id
            );
            continue;
          }
          Logger.info(
            `Created subscription '${subscriptionDefinition.name}' (${
              createdSubscription.id
            }): ${printMoney(subscriptionDefinition.recurring.amount)}`,
            loggerCtx
          );
          await this.logHistoryEntry(
            ctx,
            order.id,
            `Created subscription for ${subscriptionDefinition.name}`,
            undefined,
            subscriptionDefinition,
            createdSubscription.id
          );
          // Add created subscriptions per order line
          const existingSubscriptionIds =
            subscriptionsPerOrderLine.get(subscriptionDefinition.orderLineId) ||
            [];
          existingSubscriptionIds.push(createdSubscription.id);
          subscriptionsPerOrderLine.set(
            subscriptionDefinition.orderLineId,
            existingSubscriptionIds
          );
        } catch (e: unknown) {
          await this.logHistoryEntry(
            ctx,
            order.id,
            'An unknown error occured creating subscriptions',
            e
          );
          throw e;
        }
      }
      // Save subscriptionIds per order line
      for (const [
        orderLineId,
        subscriptionIds,
      ] of subscriptionsPerOrderLine.entries()) {
        await this.saveSubscriptionIds(ctx, orderLineId, subscriptionIds);
      }
    } catch (e: unknown) {
      await this.logHistoryEntry(ctx, order.id, '', e);
      throw e;
    }
  }

  /**
   * Save subscriptionIds on order line
   */
  async saveSubscriptionIds(
    ctx: RequestContext,
    orderLineId: ID,
    subscriptionIds: string[]
  ): Promise<void> {
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
   * Get the Stripe context for the current channel.
   * The Stripe context consists of the Stripe client and the Vendure payment method connected to the Stripe account
   */
  async getStripeContext(ctx: RequestContext): Promise<StripeContext> {
    const paymentMethods = await this.paymentMethodService.findAll(ctx, {
      filter: { enabled: { eq: true } },
    });
    const stripePaymentMethods = paymentMethods.items.filter(
      (pm) => pm.handler.code === stripeSubscriptionHandler.code
    );
    if (stripePaymentMethods.length > 1) {
      throw new UserInputError(
        `Multiple payment methods found with handler 'stripe-subscription', there should only be 1 per channel!`
      );
    }
    const paymentMethod = stripePaymentMethods[0];
    if (!paymentMethod) {
      throw new UserInputError(
        `No enabled payment method found with handler 'stripe-subscription'`
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
      paymentMethod: paymentMethod,
      stripeClient: new StripeClient(webhookSecret, apiKey, {
        apiVersion: null as any, // Null uses accounts default version
      }),
    };
  }

  async logHistoryEntry(
    ctx: RequestContext,
    orderId: ID,
    message: string,
    error?: unknown,
    subscription?: Subscription,
    subscriptionId?: string
  ): Promise<void> {
    let prettifiedError = error
      ? JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
      : undefined; // Make sure its serializable
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
          subscription,
        },
      },
      false
    );
  }
}
