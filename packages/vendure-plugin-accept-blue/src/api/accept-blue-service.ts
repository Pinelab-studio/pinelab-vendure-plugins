import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Order,
  ProductVariantService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { SubscriptionHelper } from '../';
import { AcceptBluePluginOptions } from '../accept-blue-plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  CreditCardPaymentMethodInput,
  HandleCardPaymentResult,
} from '../types';
import { AcceptBlueClient } from './accept-blue-client';

@Injectable()
export class AcceptBlueService {
  constructor(
    productVariantService: ProductVariantService,
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
   * 3. Create recurring schedule
   * 4. Create charge
   */
  async handleCardPayment(
    ctx: RequestContext,
    order: Order,
    amount: number,
    client: AcceptBlueClient,
    ccDetails: CreditCardPaymentMethodInput
  ): Promise<HandleCardPaymentResult> {
    if (!order.customer) {
      throw new UserInputError(`Order must have a customer`);
    }
    const customer = await client.getOrCreateCustomer(
      order.customer.emailAddress
    );
    const paymentMethod = await client.createPaymentMethod(
      customer.identifier,
      ccDetails
    );
    // TODO create recurring schedule + one time charge
    return {
      customerId: customer.identifier,
      paymentMethodId: paymentMethod.id,
      recurringScheduleResult: null,
      chargeResult: null,
    };
  }
}
