/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Customer,
  CustomerService,
  EntityHydrator,
  EventBus,
  ForbiddenError,
  ID,
  Logger,
  Order,
  OrderLine,
  OrderService,
  PaymentMethod,
  PaymentMethodEvent,
  PaymentMethodService,
  ProductVariantService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import crypto from 'node:crypto';
import { filter } from 'rxjs';
import { In } from 'typeorm';
import * as util from 'util';
import { SubscriptionHelper } from '../';
import { AcceptBluePluginOptions } from '../accept-blue-plugin';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { AcceptBlueSubscriptionEvent } from '../events/accept-blue-subscription-event';
import { AcceptBlueTransactionEvent } from '../events/accept-blue-transaction-event';
import {
  AcceptBlueChargeTransaction,
  AcceptBlueCustomerInput,
  AcceptBlueEvent,
  AcceptBluePaymentMethod,
  AcceptBlueRecurringSchedule,
  AcceptBlueRecurringScheduleTransaction,
  CheckPaymentMethodInput,
  EnabledPaymentMethodsArgs,
  AppleOrGooglePayInput,
  HandlePaymentResult,
  NoncePaymentMethodInput,
  SavedPaymentMethodInput,
  StorefrontKeys,
} from '../types';
import {
  getNrOfBillingCyclesLeft,
  isSavedPaymentMethod,
  isToday,
  toAcceptBlueFrequency,
  toGraphqlRefundStatus,
  toSubscriptionInterval,
} from '../util';
import { AcceptBlueClient } from './accept-blue-client';
import { acceptBluePaymentHandler } from './accept-blue-handler';
import {
  AcceptBluePaymentMethodQuote,
  AcceptBlueRefundResult,
  AcceptBlueSubscription,
  AcceptBlueSurcharges,
  AcceptBlueTransaction,
  UpdateAcceptBlueSubscriptionInput,
} from './generated/graphql';

@Injectable()
export class AcceptBlueService implements OnApplicationBootstrap {
  constructor(
    productVariantService: ProductVariantService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly customerService: CustomerService,
    private readonly entityHydrator: EntityHydrator,
    private readonly orderService: OrderService,
    private readonly connection: TransactionalConnection,
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
    // Register webhooks whenever an Accept Blue payment method is created or updated
    this.eventBus
      .ofType(PaymentMethodEvent)
      .pipe(
        filter(
          (data) => data.entity.handler?.code === acceptBluePaymentHandler.code
        )
      )
      .subscribe(({ ctx, entity }) => {
        this.registerWebhook(ctx, entity).catch((err) => {
          Logger.error(
            `Failed to register webhook: ${asError(err).message}`,
            loggerCtx,
            util.inspect(err)
          );
        });
      });
  }

  /**
   * Register a webhook with the Accept Blue platform. Checks if a webhook for this host already exists, and creates one if not.
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

  async getOrCreateCustomerForOrder(
    ctx: RequestContext,
    client: AcceptBlueClient,
    order: Order
  ): Promise<number> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    if (!ctx.activeUserId) {
      throw new UserInputError(
        `We can only handle Accept Blue payments for logged in users, because we need to save the payment methods on Accept Blue customers`
      );
    }
    const acceptBlueCustomer = await client.upsertCustomer(
      order.customer.emailAddress,
      this.mapToAcceptBlueCustomerInput(order, order.customer)
    );
    await this.customerService.update(ctx, {
      id: order.customer?.id,
      customFields: { acceptBlueCustomerId: acceptBlueCustomer.id },
    });
    return acceptBlueCustomer.id;
  }

  /**
   * Handles payments for order for either Nonce or Checks
   * 1. Get or Create customer
   * 2. Create payment method
   * 3. Create recurring schedules
   * 4. Create charge transaction
   */
  async handleTraditionalPaymentForOrder(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    input:
      | NoncePaymentMethodInput
      | CheckPaymentMethodInput
      | SavedPaymentMethodInput
  ): Promise<HandlePaymentResult> {
    const acceptBlueCustomerId = await this.getOrCreateCustomerForOrder(
      ctx,
      client,
      order
    );
    // Get or create payment method, depending on the input given
    let paymentMethod: AcceptBluePaymentMethod;
    if (isSavedPaymentMethod(input as SavedPaymentMethodInput)) {
      const foundMethod = await client.getPaymentMethod(
        acceptBlueCustomerId,
        (input as SavedPaymentMethodInput).paymentMethodId
      );
      if (!foundMethod) {
        throw new UserInputError(
          `No Accept Blue payment method found with id ${
            (input as SavedPaymentMethodInput).paymentMethodId
          }`
        );
      }
      paymentMethod = foundMethod;
    } else {
      paymentMethod = await client.getOrCreatePaymentMethod(
        acceptBlueCustomerId,
        input as NoncePaymentMethodInput | CheckPaymentMethodInput
      );
    }
    client.throwIfPaymentMethodNotAllowed(paymentMethod);
    await this.createRecurringSchedule(ctx, order, client, paymentMethod.id);
    let chargeTransaction: AcceptBlueChargeTransaction | undefined;
    if (amount > 0) {
      const subscriptionOrderLines =
        await this.subscriptionHelper.getSubscriptionOrderLines(ctx, order);
      chargeTransaction = await client.createCharge(paymentMethod.id, amount, {
        // Pass subscription orderLine's as custom field, so we receive it in incoming webhooks
        custom1: JSON.stringify(subscriptionOrderLines.map((l) => l.id)),
      });
    }
    const chargeTransactionId = chargeTransaction?.transaction?.id;
    Logger.info(
      `Settled payment for order '${order.code}', for Accept Blue customer '${acceptBlueCustomerId}' and one time charge transaction '${chargeTransactionId}'`,
      loggerCtx
    );
    return {
      amount,
      state: 'Settled',
      transactionId: chargeTransactionId
        ? String(chargeTransactionId)
        : undefined,
      metadata: chargeTransaction,
    };
  }

  /**
   * For Google Pay, we need to create a charge first, then the payment method, then the recurring schedules.
   * This is different from 'traditional' methods, where we can create the payment methods immediately.
   *
   * 1. Get or Create customer
   * 2. Create charge
   * 3. Create recurring schedules
   */
  async handleAppleOrGooglePayment(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    input: AppleOrGooglePayInput
  ): Promise<HandlePaymentResult> {
    client.throwIfPaymentMethodNotAllowed(input);
    const googleAmountInCents = input.amount * 100;
    if (amount !== googleAmountInCents) {
      throw new UserInputError(
        `Amount in Google Pay payment method does not match the order amount. Expected '${amount}', got '${googleAmountInCents}' from the Google Pay payment`
      );
    }
    // Create Charge
    const subscriptionOrderLines =
      await this.subscriptionHelper.getSubscriptionOrderLines(ctx, order);
    const chargeTransaction = await client.createDigitalWalletCharge(input, {
      // Pass subscription orderLine's as custom field, so we receive it in incoming webhooks
      custom1: JSON.stringify(subscriptionOrderLines.map((l) => l.id)),
    });
    const acceptBlueCustomerId = await this.getOrCreateCustomerForOrder(
      ctx,
      client,
      order
    );
    const acceptBluePaymentMethod = await client.createPaymentMethod(
      acceptBlueCustomerId,
      {
        source: `ref-${chargeTransaction.reference_number}`,
      }
    );
    await this.createRecurringSchedule(
      ctx,
      order,
      client,
      acceptBluePaymentMethod.id
    );
    Logger.info(
      `Settled payment for order '${order.code}' with '${input.source}', for Accept Blue customer '${acceptBlueCustomerId}' and one time charge transaction '${chargeTransaction.transaction?.id}'`,
      loggerCtx
    );
    return {
      amount,
      state: 'Settled',
      transactionId: chargeTransaction.transaction?.id
        ? String(chargeTransaction.transaction.id)
        : undefined,
      metadata: chargeTransaction,
    };
  }

  async getEligiblePaymentMethods(
    ctx: RequestContext
  ): Promise<AcceptBluePaymentMethodQuote[]> {
    const client = await this.getClientForChannel(ctx);
    const storefrontKeys = await this.getStorefrontKeys(ctx, undefined);
    return client.enabledPaymentMethods.map((pm) => ({
      name: pm,
      tokenizationKey: storefrontKeys.acceptBlueHostedTokenizationKey,
      googlePayMerchantId: storefrontKeys.acceptBlueGooglePayMerchantId,
      googlePayGatewayMerchantId:
        storefrontKeys.acceptBlueGooglePayGatewayMerchantId,
    }));
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

  async updateSubscription(
    ctx: RequestContext,
    input: UpdateAcceptBlueSubscriptionInput
  ): Promise<AcceptBlueSubscription> {
    const scheduleId = input.id;
    const orderLine = await this.findOrderLineByScheduleId(ctx, scheduleId);
    if (!orderLine) {
      throw new UserInputError(
        `No order exists with an Accept Blue subscription id of ${scheduleId}`
      );
    }
    await this.entityHydrator.hydrate(ctx, orderLine, {
      relations: ['order', 'productVariant'],
    });
    const client = await this.getClientForChannel(ctx);
    const schedule = await client.updateRecurringSchedule(scheduleId, {
      title: input.title ?? undefined,
      amount: input.amount ?? undefined,
      frequency: input.frequency ?? undefined,
      next_run_date: input.nextRunDate ?? undefined,
      num_left: input.numLeft ?? undefined,
      active: input.active ?? undefined,
      receipt_email: input.receiptEmail || undefined,
    });
    // Write History entry on order
    await this.orderService.addNoteToOrder(ctx, {
      id: orderLine.order.id,
      note: `Subscription updated: ${JSON.stringify(input)}`,
      isPublic: true,
    });
    const subscription = this.mapToGraphqlSubscription(
      schedule,
      orderLine.productVariant.id
    );
    // Publish event
    await this.eventBus.publish(
      new AcceptBlueSubscriptionEvent(ctx, subscription, 'updated', input)
    );
    return subscription;
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

  async getSurcharges(ctx: RequestContext): Promise<AcceptBlueSurcharges> {
    const client = await this.getClientForChannel(ctx);
    return await client.getSurcharges();
  }

  async getClientForChannel(ctx: RequestContext): Promise<AcceptBlueClient> {
    const acceptBlueMethod = await this.getAcceptBlueMethod(ctx);
    if (!acceptBlueMethod) {
      throw new Error(
        `No enabled payment method found with code ${acceptBluePaymentHandler.code}`
      );
    }
    // Find the handler arguments and pass the enabled payment methods to the client
    const mapToBoolean = (value: string | undefined) =>
      value === 'true' ? true : false;
    const apiKey = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'apiKey'
    )?.value;
    const pin = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'pin'
    )?.value;
    const testMode = mapToBoolean(
      acceptBlueMethod.handler.args.find((a) => a.name === 'testMode')?.value
    );
    if (!apiKey) {
      throw new Error(
        `No apiKey or pin found on configured Accept Blue payment method`
      );
    }
    const enabledPaymentMethodArgs: EnabledPaymentMethodsArgs = {
      allowAmex: mapToBoolean(
        acceptBlueMethod.handler.args.find((a) => a.name === 'allowAmex')?.value
      ),
      allowECheck: mapToBoolean(
        acceptBlueMethod.handler.args.find((a) => a.name === 'allowECheck')
          ?.value
      ),
      allowDiscover: mapToBoolean(
        acceptBlueMethod.handler.args.find((a) => a.name === 'allowDiscover')
          ?.value
      ),
      allowMasterCard: mapToBoolean(
        acceptBlueMethod.handler.args.find((a) => a.name === 'allowMasterCard')
          ?.value
      ),
      allowVisa: mapToBoolean(
        acceptBlueMethod.handler.args.find((a) => a.name === 'allowVisa')?.value
      ),
      allowApplePay: mapToBoolean(
        acceptBlueMethod.handler.args.find((a) => a.name === 'allowApplePay')
          ?.value
      ),
      allowGooglePay: mapToBoolean(
        acceptBlueMethod.handler.args.find((a) => a.name === 'allowGooglePay')
          ?.value
      ),
    };
    return new AcceptBlueClient(
      apiKey,
      pin,
      enabledPaymentMethodArgs,
      testMode
    );
  }

  /**
   * Resolves the keys needed on the storefront for different types of payment methods:
   *
   * Hosted tokenization key: The key needed to tokenize a creditcard on the frontend
   * Google Pay merchant ID and Gateway Merchant Id: to render Google Pay button on the frontend
   *
   * If a `parentPaymentMethodId` is given, we only return the keys if the parent payment method is an Accept Blue payment method.
   */
  async getStorefrontKeys(
    ctx: RequestContext,
    parentPaymentMethodId: ID | undefined
  ): Promise<StorefrontKeys> {
    const [acceptBlueMethod, client] = await Promise.all([
      this.getAcceptBlueMethod(ctx),
      this.getClientForChannel(ctx),
    ]);
    if (
      parentPaymentMethodId &&
      acceptBlueMethod?.id != parentPaymentMethodId
    ) {
      // If the parent payment method is not an Accept Blue payment method, we don't need to return any keys
      return {};
    }
    const tokenizationSourceKey = acceptBlueMethod?.handler.args.find(
      (a) => a.name === 'tokenizationSourceKey'
    )?.value;
    const googlePayMerchantId = acceptBlueMethod?.handler.args.find(
      (a) => a.name === 'googlePayMerchantId'
    )?.value;
    const googlePayGatewayMerchantId = acceptBlueMethod?.handler.args.find(
      (a) => a.name === 'googlePayGatewayMerchantId'
    )?.value;
    console.log(typeof client.testMode);
    return {
      acceptBlueHostedTokenizationKey: tokenizationSourceKey,
      acceptBlueGooglePayMerchantId: googlePayMerchantId,
      acceptBlueGooglePayGatewayMerchantId: googlePayGatewayMerchantId,
      acceptBlueTestMode: client.testMode,
    };
  }

  async getAcceptBlueMethod(
    ctx: RequestContext
  ): Promise<PaymentMethod | undefined> {
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
    if (event.event === 'batch') {
      Logger.info(
        `Ignoring incoming webhook of type '${event.event}' '${event.type}' (${event.id})`,
        loggerCtx
      );
      return;
    }
    Logger.info(
      `Handling incoming webhook '${event.subType}' '${event.event}' '${event.type}' (${event.id}) ...`,
      loggerCtx
    );
    const acceptBlueMethod = await this.getAcceptBlueMethod(ctx);
    const savedSecret = acceptBlueMethod?.handler.args.find(
      (a) => a.name === 'webhookSecret'
    )?.value;
    if (!savedSecret) {
      throw new Error(
        'No webhook secret found on Accept Blue payment method, can not validate incoming webhook'
      );
    }
    if (!this.isValidSignature(savedSecret, rawBody, incomingSignature)) {
      throw new ForbiddenError();
    }
    // Get corresponding order lines based on the incoming webhook fields: Either schedule_id or custom_fields should be defined
    const scheduleId = event.data.transaction?.transaction_details?.schedule_id;
    const orderLineIds = this.parseOrderLineCustomField(
      event.data.transaction?.custom_fields?.custom1
    );
    let orderLines: OrderLine[] = [];
    if (scheduleId) {
      // Transactions for a schedule will have a scheduleId
      const orderLine = await this.findOrderLineByScheduleId(ctx, scheduleId);
      if (orderLine) {
        orderLines = [orderLine];
      }
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
          ctx,
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
  ): Promise<OrderLine | null | undefined> {
    const result = await this.connection
      .getRepository(ctx, OrderLine)
      .createQueryBuilder('orderLine')
      .where(
        'orderLine.customFields.acceptBlueSubscriptionIds LIKE :scheduleId',
        { scheduleId: `%${scheduleId}%` }
      )
      .getMany();
    // We query with LIKE, because array custom fields are stored as simple-json in the database
    // With LIKE, we can get false positives, so we check again if the parsed result contains the exact scheduleId
    return result.find((orderLine) =>
      orderLine.customFields.acceptBlueSubscriptionIds.includes(scheduleId)
    );
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
   * Map a Vendure customer to an Accept Blue customer.
   * Uses the order's shipping and billing address as customer address
   */
  mapToAcceptBlueCustomerInput(
    order: Order,
    customer: Customer
  ): AcceptBlueCustomerInput {
    const shippingName = order.shippingAddress?.fullName?.split(' ');
    const shippingAddress: AcceptBlueCustomerInput['shipping_info'] = {
      first_name: shippingName?.[0] ?? customer.firstName,
      last_name: shippingName?.[1] ?? customer.lastName,
      street: order.shippingAddress?.streetLine1,
      street2: order.shippingAddress?.streetLine2,
      zip: order.shippingAddress?.postalCode,
      state: order.shippingAddress?.province,
      phone: order.shippingAddress?.phoneNumber,
      city: order.shippingAddress?.city,
      country: order.shippingAddress?.countryCode,
    };
    const billingName = order.billingAddress?.fullName?.split(' ');
    const billingAddress: AcceptBlueCustomerInput['billing_info'] = {
      first_name: billingName?.[0] ?? customer.firstName,
      last_name: billingName?.[1] ?? customer.lastName,
      street: order.billingAddress?.streetLine1,
      street2: order.billingAddress?.streetLine2,
      zip: order.billingAddress?.postalCode,
      state: order.billingAddress?.province,
      phone: order.billingAddress?.phoneNumber,
      city: order.billingAddress?.city,
      country: order.billingAddress?.countryCode,
    };
    return {
      first_name: customer.firstName,
      last_name: customer.lastName,
      identifier: customer.emailAddress,
      email: customer.emailAddress,
      shipping_info: shippingAddress,
      billing_info: billingAddress,
      phone: customer.phoneNumber,
    };
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
