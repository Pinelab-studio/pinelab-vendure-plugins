import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import { gql } from 'graphql-tag';
import { StripeSubscriptionService } from './stripe-subscription.service';
import {
  StripeSubscriptionController,
  StripeSubscriptionResolver,
} from './stripe-subscription.controller';
import { PLUGIN_INIT_OPTIONS } from './constants';
import {
  customerCustomFields,
  orderLineCustomFields,
  productVariantCustomFields,
} from './subscription-custom-fields';
import { createRawBodyMiddleWare } from '../../util/src/raw-body';
import { SubscriptionOrderItemCalculation } from './subscription-order-item-calculation';

export interface StripeSubscriptionPluginOptions {
  /**
   * Only use this for testing purposes, NEVER in production
   */
  disableWebhookSignatureChecking: boolean;
}

const _scalars = gql`
  scalar DateTime
`;

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: gql`
      enum SubscriptionBillingInterval {
        week
        month
      }
      type StripeSubscriptionPricing {
        downpayment: Int!
        totalProratedAmount: Int!
        proratedDays: Int!
        dayRate: Int!
        recurringPrice: Int!
        interval: SubscriptionBillingInterval!
        intervalCount: Int!
        amountDueNow: Int!
        subscriptionStartDate: DateTime!
      }
      input StripeSubscriptionPricingInput {
        productVariantId: ID!
        startDate: DateTime
        downpayment: Int
      }
      extend type Query {
        """
        Preview the pricing model of a given subscription. Prices are excluding tax!
        Start date and downpayment are optional: if not supplied, the subscriptions default will be used.
        """
        stripeSubscriptionPricing(
          input: StripeSubscriptionPricingInput
        ): StripeSubscriptionPricing
        """
        Preview the pricing model of a given subscription. Prices are excluding tax!
        Start date and downpayment are optional: if not supplied, the subscriptions default will be used.
        """
        stripeSubscriptionPricingForOrderLine(
          orderLineId: ID
        ): StripeSubscriptionPricing
      }
      extend type Mutation {
        createStripeSubscriptionIntent: String!
      }
    `,
    resolvers: [StripeSubscriptionResolver],
  },
  controllers: [StripeSubscriptionController],
  providers: [
    StripeSubscriptionService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => StripeSubscriptionPlugin.options,
    },
  ],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(stripeSubscriptionHandler);
    config.apiOptions.middleware.push(
      createRawBodyMiddleWare('/stripe-subscription*')
    );
    config.orderOptions.orderItemPriceCalculationStrategy =
      new SubscriptionOrderItemCalculation();
    config.customFields.ProductVariant.push(...productVariantCustomFields);
    config.customFields.Customer.push(...customerCustomFields);
    config.customFields.OrderLine.push(...orderLineCustomFields);
    return config;
  },
})
export class StripeSubscriptionPlugin {
  static options: StripeSubscriptionPluginOptions;

  static init(options: StripeSubscriptionPluginOptions) {
    this.options = options;
    return StripeSubscriptionPlugin;
  }
}
