import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  CustomerService,
  EntityHydrator,
  Order,
  PaymentMethodService,
  ProductVariantService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { SubscriptionHelper } from '../';
import { AcceptBluePluginOptions } from '../accept-blue-plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  AcceptBlueCardPaymentMethod,
  CreditCardPaymentInput,
  HandlePaymentResult,
} from '../types';
import { AcceptBlueClient } from './accept-blue-client';
import { acceptBluePaymentHandler } from './accept-blue-handler';

@Injectable()
export class AcceptBlueService {
  constructor(
    private readonly productVariantService: ProductVariantService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly customerService: CustomerService,
    private readonly entityHydrator: EntityHydrator,
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

  /**
   * Handles credit card payments for order
   * 1. Get or Create customer
   * 2. Create payment method
   * Call payWithSavedPaymentMethod() to do the actual payment
   */
  async payWithCreditCard(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    ccDetails: CreditCardPaymentInput
  ): Promise<HandlePaymentResult> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    const customer = await client.getOrCreateCustomer(
      order.customer.emailAddress
    );
    // Save payment method
    const paymentMethod = await client.getOrCreatePaymentMethod(
      customer.id,
      ccDetails
    );
    return await this.payWithSavedPaymentMethod(
      ctx,
      order,
      amount,
      client,
      paymentMethod.id
    );
  }

  /**
   * 1. Create recurring schedule for customer + with the saved payment method
   * 2. Create charge for customer with the saved payment method
   */
  async payWithSavedPaymentMethod(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    paymentMethodId: number | string
  ): Promise<HandlePaymentResult> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    const customer = await client.getCustomer(order.customer.emailAddress);
    if (!customer) {
      throw new UserInputError(
        `No customer found in Accept blue with email ${order.customer.emailAddress} not found`
      );
    }
    if (!order.customer) {
      throw new UserInputError(
        `Order must have a customer before creating a payment`
      );
    }
    if (!order.customer.user) {
      throw new UserInputError(
        `Saved payment methods can only be used for registered customers, ${order.customer.emailAddress} (customer ID ${order.customer.id}) is not a registered customer`
      );
    }
    // TODO create recurring schedule
    // TODO create one time charge
    return {
      customerId: 'TODO',
      paymentMethodId,
      recurringScheduleResult: null,
      chargeResult: null,
    };
  }

  async getPaymentMethods(
    ctx: RequestContext
  ): Promise<AcceptBlueCardPaymentMethod[]> {
    const client = await this.getClientForChannel(ctx);
    if (!ctx.activeUserId) {
      throw new Error(`User is not logged in!`);
    }
    const customer = await this.customerService.findOneByUserId(
      ctx,
      ctx.activeUserId
    );
    if (!customer) {
      throw new Error(`No customer found for user ${ctx.activeUserId}`);
    }
    // TODO we need to get the active blue customer id to get payment methods
    await client.getPaymentMethods(1);
    // return await client.getPaymentMethods(customer.customFields.activeBlueCustomerId);
    throw new Error('NOT IMPLEMENT');
  }

  async getClientForChannel(ctx: RequestContext): Promise<AcceptBlueClient> {
    const methods = await this.paymentMethodService.findAll(ctx, {
      filter: {
        enabled: { eq: true },
      },
    });
    const acceptBlueMethod = methods.items.find(
      (m) => m.handler.code === acceptBluePaymentHandler.code
    );
    if (!acceptBlueMethod) {
      throw new Error(
        `No enabled payment method found with code ${acceptBluePaymentHandler.code}`
      );
    }
    const apiKey = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'apiKey'
    )?.value;
    const pin = acceptBlueMethod.handler.args.find(
      (a) => a.name === 'pin'
    )?.value;
    if (!apiKey || !pin) {
      throw new Error(
        `No apiKey or pin found on configured Accept Blue payment method`
      );
    }
    return new AcceptBlueClient(apiKey, pin);
  }
}
