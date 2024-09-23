/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Customer,
  CustomerService,
  EntityHydrator,
  EventBus,
  ID,
  Logger,
  Order,
  OrderLine,
  PaymentMethod,
  PaymentMethodEvent,
  PaymentMethodService,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import crypto from 'node:crypto';
import { filter } from 'rxjs';
import { In, SelectQueryBuilder } from 'typeorm';
import * as util from 'util';
import { SubscriptionHelper } from '../';
import { AcceptBluePluginOptions } from '../accept-blue-plugin';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import {
  AcceptBlueChargeTransaction,
  AcceptBlueEvent,
  AcceptBluePaymentMethod,
  AcceptBlueRecurringSchedule,
  AcceptBlueRecurringScheduleTransaction,
  CheckPaymentMethodInput,
  HandlePaymentResult,
  NoncePaymentMethodInput,
  SavedPaymentMethodInput,
} from '../types';
import {
  getNrOfBillingCyclesLeft,
  isToday,
  toAcceptBlueFrequency,
  toGraphqlRefundStatus,
  toSubscriptionInterval,
} from '../util';
import { AcceptBlueClient } from './accept-blue-client';
import { acceptBluePaymentHandler } from './accept-blue-handler';
import {
  AcceptBlueRefundResult,
  AcceptBlueSubscription,
  AcceptBlueTransaction,
} from './generated/graphql';
import { AcceptBlueTransactionEvent } from './accept-blue-transaction-event';

@Injectable()
export class AcceptBlueService implements OnApplicationBootstrap {
  constructor(
    productVariantService: ProductVariantService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly customerService: CustomerService,
    private readonly entityHydrator: EntityHydrator,
    private connection: TransactionalConnection,
    private eventBus: EventBus,
    moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: AcceptBluePluginOptions
  ) {
    this.subscriptionHelper = new SubscriptionHelper(
      loggerCtx,
      moduleRef,
      productVariantService,
      this.options.subscriptionStrategy
    );
  }

  readonly subscriptionHelper: SubscriptionHelper;

  onApplicationBootstrap() {
    this.eventBus
      .ofType(PaymentMethodEvent)
      .pipe(
        filter(
          (data) => data.entity.handler?.code === acceptBluePaymentHandler.code
        )
      )
      .subscribe(({ ctx, entity }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.registerWebhook(ctx, entity).catch((err: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
          Logger.error(
            `Failed to register webhook: ${err?.message}`,
            loggerCtx,
            util.inspect(err)
          );
        });
      });
  }

  /**
   * Register a webhook with the Accept Blue platform
   */
  async registerWebhook(ctx: RequestContext, paymentMethod: PaymentMethod) {
    const client = await this.getClientForChannel(ctx);
    const webhookUrl = `${this.options.vendureHost}/accept-blue/webhook/${ctx.channel.token}`;
    const existingHooks = await client.getWebhooks();
    const existingHook = existingHooks.find(
      (hook) => hook.webhook_url === webhookUrl
    );
    let webhookSecret: string;
    if (existingHook) {
      Logger.info(`Webhook for this server is already registered`, loggerCtx);
      webhookSecret = existingHook.signature;
    } else {
      // Create a new hook if none exists yet
      const webhook = await client.createWebhook({
        webhook_url: webhookUrl,
        description: 'Notify Vendure of any events on the Accept Blue platform',
        active: true,
      });
      webhookSecret = webhook.signature;
    }
    const signatureArg = paymentMethod.handler.args.find(
      (a) => a.name === 'webhookSecret'
    );
    if (signatureArg) {
      // Set value if signature arg already present
      signatureArg.value = webhookSecret;
    } else {
      // Otherwise push signature arg to handler args
      paymentMethod.handler.args.push({
        name: 'webhookSecret',
        value: webhookSecret,
      });
    }
    await this.connection.getRepository(ctx, PaymentMethod).save(paymentMethod);
    Logger.info(
      `The AcceptBlue PaymentMethod (${paymentMethod.code})'s webhook signature has been updated`,
      loggerCtx
    );
  }

  /**
   * Handles payments for order for either Nonce or Checks
   * 1. Get or Create customer
   * 2. Create payment method
   */
  async handlePaymentForOrder(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    input:
      | NoncePaymentMethodInput
      | CheckPaymentMethodInput
      | SavedPaymentMethodInput
  ): Promise<HandlePaymentResult> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    if (!ctx.activeUserId) {
      throw new UserInputError(
        `We can only handle Accept Blue payments for logged in users, because we need to save the payment methods on Accept Blue customers`
      );
    }
    const acceptBlueCustomer = await client.getOrCreateCustomer(
      order.customer.emailAddress
    );
    await this.customerService.update(ctx, {
      id: order.customer?.id,
      customFields: { acceptBlueCustomerId: acceptBlueCustomer.id },
    });
    let paymentMethodId: number | undefined;
    if ((input as SavedPaymentMethodInput).paymentMethodId) {
      paymentMethodId = (input as SavedPaymentMethodInput).paymentMethodId;
    } else {
      const paymentMethod = await client.getOrCreatePaymentMethod(
        acceptBlueCustomer.id,
        input as NoncePaymentMethodInput | CheckPaymentMethodInput
      );
      paymentMethodId = paymentMethod.id;
    }
    const recurringSchedules = await this.createRecurringSchedule(
      ctx,
      order,
      client,
      paymentMethodId
    );
    let chargeResult: AcceptBlueChargeTransaction | undefined;
    if (amount > 0) {
      const subscriptionOrderLines =
        await this.subscriptionHelper.getSubscriptionOrderLines(ctx, order);
      chargeResult = await client.createCharge(paymentMethodId, amount, {
        // Pass subscription orderLine's as custom field, so we receive it in incoming webhooks
        custom1: this.stringifyOrderLineCustomField(
          subscriptionOrderLines.map((l) => l.id)
        ),
      });
    }
    return {
      customerId: String(acceptBlueCustomer.id),
      paymentMethodId: paymentMethodId,
      recurringScheduleResult: recurringSchedules,
      chargeResult,
    };
  }

  /**
   * Create recurring schedule for customer with the saved payment method
   */
  async createRecurringSchedule(
    ctx: RequestContext,
    order: Order,
    client: AcceptBlueClient,
    paymentMethodId: number
  ): Promise<AcceptBlueRecurringSchedule[]> {
    if (!order.customer) {
      throw new UserInputError(
        `Order must have a customer before creating a payment`
      );
    }
    if (!order.customer.user) {
      // We don't want unregistered users to be able to use someone's email address to pay
      throw new UserInputError(
        `Saved payment methods can only be used for registered customers, ${order.customer.emailAddress} (customer ID ${order.customer.id}) is not a registered customer`
      );
    }
    const acceptBlueCustomer = await client.getCustomer(
      order.customer.emailAddress
    );
    if (!acceptBlueCustomer) {
      throw new UserInputError(
        `No customer found in Accept bBlue with email ${order.customer.emailAddress} not found`
      );
    }
    // Create recurring schedules
    const subscriptionDefinitions = (
      await this.subscriptionHelper.getSubscriptionsForOrder(ctx, order)
    ).map((subscription) => {
      // Mapping and validation for all subscriptions, before actually calling the Accept Blue API
      const {
        recurring: { startDate, endDate },
      } = subscription;
      // throws error if frequency can't be mapped
      const frequency = toAcceptBlueFrequency(subscription);
      // Get number of billing cycles if an end date is given
      const billingCyclesLeft = endDate
        ? getNrOfBillingCyclesLeft(startDate, endDate, frequency)
        : 0;
      // Only pass next_run_date if it's not today, because the API requires this date to be in the future
      const nextRunDate = isToday(startDate) ? undefined : startDate;
      return {
        ...subscription,
        frequency,
        billingCyclesLeft,
        nextRunDate,
      };
    });
    // Map<orderLineId, subscriptionIds> to save on orderLine custom field
    const subscriptionsPerOrderLine = new Map<ID, number[]>();
    const recurringSchedules: AcceptBlueRecurringSchedule[] = [];
    for (const subscriptionDefinition of subscriptionDefinitions) {
      const recurringSchedule = await client.createRecurringSchedule(
        acceptBlueCustomer.id,
        {
          title: subscriptionDefinition.name,
          active: true,
          amount: subscriptionDefinition.recurring.amount,
          frequency: subscriptionDefinition.frequency,
          num_left: subscriptionDefinition.billingCyclesLeft,
          payment_method_id: paymentMethodId,
          receipt_email: order.customer.emailAddress,
          next_run_date: subscriptionDefinition.nextRunDate,
        }
      );
      // Save subscriptionId for orderLine
      const subscriptionIds =
        subscriptionsPerOrderLine.get(subscriptionDefinition.orderLineId) ?? [];
      subscriptionIds.push(recurringSchedule.id);
      subscriptionsPerOrderLine.set(
        subscriptionDefinition.orderLineId,
        subscriptionIds
      );
      recurringSchedules.push(recurringSchedule);
    }
    await this.entityHydrator.hydrate(ctx, order, { relations: ['lines'] });
    // save subscription IDS on orderLine custom field
    await Promise.all(
      Array.from(subscriptionsPerOrderLine).map(
        async ([orderLineId, subscriptionIds]) => {
          const orderLine = order.lines.find((l) => l.id === orderLineId);
          if (orderLine) {
            orderLine.customFields.acceptBlueSubscriptionIds = subscriptionIds;
            await this.connection.getRepository(ctx, OrderLine).save(orderLine);
          }
        }
      )
    );
    return recurringSchedules;
  }

  /**
   * Resolve the subscriptions for an order line. For a placed order, this will also fetch transactions per subscription
   */
  async getSubscriptionsForOrderLine(
    ctx: RequestContext,
    orderLine: OrderLine,
    order: Order
  ): Promise<AcceptBlueSubscription[]> {
    if (order.orderPlacedAt) {
      // Return actual created subscriptions for placed orders
      const client = await this.getClientForChannel(ctx);
      const subscriptionIds =
        orderLine.customFields.acceptBlueSubscriptionIds ?? [];
      const createdSubscriptions = await client.getRecurringSchedules(
        subscriptionIds
      );
      return await Promise.all(
        createdSubscriptions.map(async (s) => {
          const transactions = await client.getTransactionsForRecurringSchedule(
            s.id
          );
          // Map to Graphql Transaction type
          const graphqlTransactions = transactions.map((t) =>
            this.mapToGraphqlTransaction(t)
          );
          return this.mapToGraphqlSubscription(
            s,
            orderLine.productVariant.id,
            graphqlTransactions
          );
        })
      );
    }
    // If the order is not placed, we dynamically generate subscriptions
    const subscriptionsForOrderLine =
      await this.subscriptionHelper.getSubscriptionsForOrderLine(
        ctx,
        orderLine,
        orderLine.order
      );
    return subscriptionsForOrderLine.map((s) => {
      return {
        ...s,
        variantId: orderLine.productVariant.id,
        transactions: [],
      };
    });
  }

  /**
   * Get the payment methods stored in Accept Blue for the given customer
   */
  async getSavedPaymentMethods(
    ctx: RequestContext,
    customer: Customer
  ): Promise<AcceptBluePaymentMethod[]> {
    const client = await this.getClientForChannel(ctx);
    if (!ctx.activeUserId) {
      throw new Error(`User is not logged in!`);
    }
    if (!customer) {
      throw new Error(`No customer found for user ${ctx.activeUserId}`);
    }
    return await client.getPaymentMethods(
      customer.customFields.acceptBlueCustomerId
    );
  }

  async refund(
    ctx: RequestContext,
    transactionId: number,
    amount?: number,
    cvv2?: string
  ): Promise<AcceptBlueRefundResult> {
    const client = await this.getClientForChannel(ctx);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const refundResult = await client.refund(transactionId, amount, cvv2);
    let errorDetails: string | undefined = undefined;
    if (refundResult.error_details) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      errorDetails =
        typeof refundResult.error_details === 'object'
          ? JSON.stringify(refundResult.error_details)
          : refundResult.error_details;
    }
    Logger.info(
      `Attempted refund of transaction '${transactionId}' by user '${ctx.activeUserId}' resulted in status '${refundResult.status}'`,
      loggerCtx
    );
    return {
      version: refundResult.version,
      referenceNumber: refundResult.reference_number,
      status: toGraphqlRefundStatus(refundResult.status),
      errorCode: refundResult.error_code,
      errorMessage: refundResult.error_message,
      errorDetails,
    };
  }

  async getClientForChannel(ctx: RequestContext): Promise<AcceptBlueClient> {
    const acceptBlueMethod = await this.getAcceptBlueMethod(ctx);
    const apiKey = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'apiKey'
    )?.value;
    const pin = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'pin'
    )?.value;
    const testMode = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'testMode'
    )?.value as boolean | undefined;
    if (!apiKey) {
      throw new Error(
        `No apiKey or pin found on configured Accept Blue payment method`
      );
    }
    return new AcceptBlueClient(apiKey, pin, testMode);
  }

  async getHostedTokenizationKey(ctx: RequestContext): Promise<string | null> {
    const acceptBlueMethod = await this.getAcceptBlueMethod(ctx);
    const tokenizationSourceKey = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'tokenizationSourceKey'
    )?.value;
    return tokenizationSourceKey ?? null;
  }

  async getAcceptBlueMethod(ctx: RequestContext): Promise<PaymentMethod> {
    const methods = await this.paymentMethodService.findAll(ctx, {
      filter: {
        enabled: { eq: true },
      },
    });
    const acceptBlueMethod = methods.items.filter(
      (m) => m.handler.code === acceptBluePaymentHandler.code
    );
    if (acceptBlueMethod.length > 1) {
      throw Error(
        `More than one enabled payment method found with code ${acceptBluePaymentHandler.code}. There should be only 1 per channel`
      );
    }
    if (acceptBlueMethod.length === 0) {
      throw new Error(
        `No enabled payment method found with code ${acceptBluePaymentHandler.code}`
      );
    }
    return acceptBlueMethod[0];
  }

  /**
   * Handle incoming webhooks from Accept Blue
   */
  async handleIncomingWebhook(
    ctx: RequestContext,
    event: AcceptBlueEvent,
    rawBody: Buffer,
    incomingSignature: string
  ): Promise<void> {
    Logger.info(
      `Handling incoming webhook '${event.subType}' '${event.event}' '${event.type}' (${event.id}) ...`,
      loggerCtx
    );
    const acceptBlueMethod = await this.getAcceptBlueMethod(ctx);
    const savedSecret = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'webhookSecret'
    )?.value;
    if (!savedSecret) {
      throw new Error(
        'No webhook secret found on Accept Blue payment method, can not validate incoming webhook'
      );
    }
    if (!this.isValidSignature(savedSecret, rawBody, incomingSignature)) {
      throw new Error('Incoming webhook has invalid signature');
    }
    // Get corresponding order lines
    const scheduleId = event.data.transaction?.transaction_details?.schedule_id;
    const orderLineIds = this.parseOrderLineCustomField(
      event.data.transaction?.custom_fields?.custom1
    );
    let orderLines: OrderLine[] = [];
    if (scheduleId) {
      // Transactions for a schedule will have a scheduleId
      const orderLine = await this.findOrderLineByScheduleId(ctx, scheduleId);
      orderLines = [orderLine];
    } else {
      // Direct transactions from the checkout will have orderLineIds as custom field, and are not attached to a schedule
      orderLines = await this.connection
        .getRepository(ctx, OrderLine)
        .find({ where: { id: In(orderLineIds) } });
    }
    if (!orderLines.length) {
      Logger.error(
        `No order lines found for incoming webhook, we can not connect this event to an order line: ${JSON.stringify(
          event
        )}`,
        loggerCtx
      );
      return;
    }
    for (const orderLine of orderLines) {
      // Hydrate sensible relations
      await this.entityHydrator.hydrate(ctx, orderLine, {
        relations: ['order', 'order.customer'],
      });
      await this.eventBus.publish(
        new AcceptBlueTransactionEvent(
          event.type,
          event,
          orderLine,
          event.data.transaction?.id
        )
      );
      Logger.debug(
        `Published AcceptBlueTransactionEvent (${event.id}) for orderLine ${orderLine.id}`,
        loggerCtx
      );
    }
    Logger.info(
      `Successfully handled incoming webhook '${event.subType}' '${event.event}' '${event.type}' (${event.id})`,
      loggerCtx
    );
  }

  /**
   * Find an order line based on the Accept Blue schedule ID that was saved during order placement
   */
  async findOrderLineByScheduleId(
    ctx: RequestContext,
    scheduleId: number
  ): Promise<OrderLine> {
    const orderLine = await this.mapSubscriptionScheduleFilter(
      ctx,
      scheduleId
    ).getOne();
    if (!orderLine) {
      throw Error(`No order line found with scheduleId ${scheduleId}`);
    }
    return orderLine;
  }

  /**
   * Validate if the incoming webhook is signed with the secret we have saved.
   */
  isValidSignature(
    savedSecret: string,
    rawBody: Buffer,
    incomingSignature: string
  ): boolean {
    const hash = crypto
      .createHmac('sha256', savedSecret)
      .update(rawBody)
      .digest('hex');
    return hash === incomingSignature;
  }

  /**
   * Parse orderLine Ids from the incoming Accept Blue custom field
   */
  parseOrderLineCustomField(customField1?: string): ID[] {
    if (!customField1) {
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const orderLineIds = JSON.parse(customField1);
    if (!Array.isArray(orderLineIds)) {
      throw new Error(`Given custom field is not an array`);
    }
    return orderLineIds as ID[];
  }

  /**
   * Stringify orderLine id's, so that we can pass it as custom field to Accept Blue
   */
  stringifyOrderLineCustomField(orderLineIds: ID[]): string {
    return JSON.stringify(orderLineIds);
  }

  private mapSubscriptionScheduleFilter(
    ctx: RequestContext,
    scheduleId: number
  ): SelectQueryBuilder<OrderLine> {
    const dbType = this.connection.rawConnection.driver.options.type;
    const repo = this.connection.getRepository(ctx, OrderLine);
    switch (dbType) {
      case 'postgres':
        return repo
          .createQueryBuilder('orderLine')
          .where(
            ":scheduleId = ANY(string_to_array(orderLine.customFields.acceptBlueSubscriptionIds, ','))"
          )
          .setParameter('scheduleId', scheduleId);
      case 'mysql':
      case 'mssql':
        return repo
          .createQueryBuilder('orderLine')
          .where(
            'FIND_IN_SET(:scheduleId, orderLine.customFields->>"$.acceptBlueSubscriptionIds")'
          )
          .setParameter('scheduleId', scheduleId);
      case 'sqljs':
      case 'sqlite':
        return repo
          .createQueryBuilder('orderLine')
          .where(
            "INSTR(',' || orderLine.customFields.acceptBlueSubscriptionIds || ',', :scheduleId) > 0",
            {
              scheduleId: `,${scheduleId},`,
            }
          );
      default:
        return repo
          .createQueryBuilder('orderLine')
          .where(
            "POSITION(',' || :scheduleId || ',' IN ',' || orderLine.customFields.acceptBlueSubscriptionIds || ',') > 0",
            {
              scheduleId: `${scheduleId}`,
            }
          );
    }
  }
  /**
   * Map a subscription from Accept Blue to the GraphQL Subscription type
   */
  private mapToGraphqlSubscription(
    subscription: AcceptBlueRecurringSchedule,
    variantId: ID,
    transactions: AcceptBlueTransaction[] = []
  ): AcceptBlueSubscription {
    const { interval, intervalCount } = toSubscriptionInterval(
      subscription.frequency
    );
    return {
      id: subscription.id,
      amountDueNow: 0,
      name: subscription.title,
      priceIncludesTax: true,
      variantId,
      recurring: {
        amount: subscription.amount,
        interval,
        intervalCount,
        startDate: subscription.created_at,
      },
      transactions,
    };
  }
  /**
   * Map a transaction from Accept Blue to the GraphQL Transaction type
   */
  private mapToGraphqlTransaction(
    transaction: AcceptBlueRecurringScheduleTransaction
  ): AcceptBlueTransaction {
    return {
      id: transaction.id,
      amount: transaction.amount_details.amount,
      createdAt: transaction.created_at,
      settledAt: transaction.settled_date
        ? new Date(transaction.settled_date)
        : undefined,
      cardDetails: transaction.card_details
        ? {
            name: transaction.card_details.name,
            cardType: transaction.card_details.card_type,
            expiryMonth: transaction.card_details.expiry_month,
            expiryYear: transaction.card_details.expiry_year,
            last4: transaction.card_details.last4,
          }
        : undefined,
      checkDetails: transaction.check_details
        ? {
            name: transaction.check_details.name,
            last4: transaction.check_details.account_number_last4,
            routingNumber: transaction.check_details.routing_number,
          }
        : undefined,
      status: transaction.status_details.status,
      errorCode: transaction.status_details.error_code,
      errorMessage: transaction.status_details.error_message,
    };
  }
}
