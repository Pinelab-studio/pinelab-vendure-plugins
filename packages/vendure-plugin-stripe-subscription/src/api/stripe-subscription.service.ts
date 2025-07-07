import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { StockMovementType } from '@vendure/common/lib/generated-types';
import {
  ActiveOrderService,
  ChannelService,
  EntityHydrator,
  EntityNotFoundError,
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
  PaymentMethod,
  PaymentMethodEvent,
  PaymentMethodService,
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
import { Request } from 'express';
import { filter } from 'rxjs/operators';
import Stripe from 'stripe';
import { Subscription, SubscriptionHelper } from '../';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { StripeSubscriptionPluginOptions } from '../stripe-subscription.plugin';
import { StripeSubscriptionIntent } from './generated/shop-graphql';
import { StripeClient } from './stripe.client';
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

interface CancelSubscriptionsJob {
  action: 'cancelSubscriptionsForOrderline';
  ctx: SerializedRequestContext;
  orderLineId: ID;
}

export type JobData = CancelSubscriptionsJob;

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
    productVariantService: ProductVariantService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private options: StripeSubscriptionPluginOptions
  ) {
    this.subscriptionHelper = new SubscriptionHelper(
      loggerCtx,
      moduleRef,
      productVariantService,
      this.options.subscriptionStrategy!
    );
  }

  private jobQueue!: JobQueue<JobData>;
  readonly subscriptionHelper: SubscriptionHelper;
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
        } else {
          Logger.error(
            `Unknown action '${data.action}' in job queue ${this.jobQueue.name}`,
            loggerCtx
          );
        }
      },
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
        if (paymentMethod.handler?.code === stripeSubscriptionHandler.code) {
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
      `Created webhook ${createdHook.id} for payment method '${res.code}' for channel ${ctx.channel.token}`,
      loggerCtx
    );
    return createdHook;
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

  async createIntent(
    ctx: RequestContext,
    stripePaymentMethods?: string[],
    setupFutureUsage?: Stripe.PaymentIntentCreateParams.SetupFutureUsage
  ): Promise<StripeSubscriptionIntent> {
    let order = await this.activeOrderService.getActiveOrder(ctx, undefined);
    if (!order) {
      throw new UserInputError('No active order for session');
    }
    return this.createIntentByOrder(
      ctx,
      order,
      stripePaymentMethods,
      setupFutureUsage
    );
  }

  async createIntentForDraftOrder(
    ctx: RequestContext,
    orderId: ID,
    stripePaymentMethods?: string[],
    setupFutureUsage?: Stripe.PaymentIntentCreateParams.SetupFutureUsage
  ): Promise<StripeSubscriptionIntent> {
    let order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new EntityNotFoundError('Order', orderId);
    }
    // TODO Perhaps need an order state check (Draft, ArrangingPayment) here?
    // But state transition verification will likely be a good place for this as well
    return this.createIntentByOrder(
      ctx,
      order,
      stripePaymentMethods,
      setupFutureUsage
    );
  }

  async createIntentByOrder(
    ctx: RequestContext,
    order: Order,
    stripePaymentMethods?: string[],
    setupFutureUsage?: Stripe.PaymentIntentCreateParams.SetupFutureUsage
  ): Promise<StripeSubscriptionIntent> {
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
    let intent: Stripe.PaymentIntent | Stripe.SetupIntent;
    if (order.totalWithTax > 0) {
      // Create PaymentIntent + off_session, because we have both one-time and recurring payments. Order total is only > 0 if there are one-time payments
      intent = await stripeClient.paymentIntents.create({
        customer: stripeCustomer.id,
        ...(stripePaymentMethods?.length
          ? { payment_method_types: stripePaymentMethods }
          : {}),
        setup_future_usage: setupFutureUsage,
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
   * Handle failed subscription payments that come in after the initial payment intent
   */
  async handleInvoicePaymentFailed(
    ctx: RequestContext,
    invoiceId: string,
    order: Order
  ): Promise<void> {
    // TODO: Emit StripeSubscriptionPaymentFailed(subscriptionId, order, stripeInvoiceObject: StripeInvoice)
    const { stripeClient } = await this.getStripeContext(ctx);
    const invoice = await stripeClient.invoices.retrieve(invoiceId);
    const amount = invoice.lines?.data[0]?.plan?.amount;
    const message = amount
      ? `Subscription payment of ${printMoney(amount)} failed`
      : 'Subscription payment failed';
    await this.logHistoryEntry(
      ctx,
      order.id,
      message,
      `${message} - ${invoice.id}`,
      undefined,
      invoice.subscription
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

    if (order.state === 'PaymentSettled') {
      Logger.warn(
        `Order ${order.code} is already in state PaymentSettled, not processing this intent again`,
        loggerCtx
      );
      throw Error(
        `Order ${order.code} is already in state PaymentSettled, not processing this intent again`
      );
    }

    const {
      paymentMethod: { code: paymentMethodCode },
      stripeClient,
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
    // Fetch setup or payment intent from Stripe
    let intent: Stripe.PaymentIntent | Stripe.SetupIntent;
    if (object.object === 'payment_intent') {
      intent = await stripeClient.paymentIntents.retrieve(object.id);
    } else {
      intent = await stripeClient.setupIntents.retrieve(object.id);
    }
    if (intent.status !== 'succeeded') {
      throw Error(
        `Intent '${object.id}' for order '${order.code}' is not succeeded, but '${intent.status}'. Not handling this event.`
      );
    }

    // Create subscriptions for customer
    try {
      await this.createSubscriptions(
        ctx,
        order.code,
        object.customer,
        object.payment_method
      );
    } catch (error) {
      Logger.error(
        `Failed to create subscription for order '${order.code}' for channel ${ctx.channel.token}: ${error}`,
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
    }

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
      if (!(await this.subscriptionHelper.hasSubscriptions(ctx, order))) {
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
      const subscriptionDefinitions =
        await this.subscriptionHelper.getSubscriptionsForOrder(ctx, order);
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
    if (!apiKey) {
      Logger.warn(
        `No api key is configured for ${paymentMethod.code}`,
        loggerCtx
      );
      throw Error(
        `Payment method ${paymentMethod.code} has no api key configured`
      );
    }
    if (!webhookSecret) {
      Logger.warn(
        `No webhook secret configured for ${paymentMethod.code}`,
        loggerCtx
      );
      throw Error(
        `Payment method ${paymentMethod.code} has no webhook secret configured`
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
    subscriptionId?: any
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
