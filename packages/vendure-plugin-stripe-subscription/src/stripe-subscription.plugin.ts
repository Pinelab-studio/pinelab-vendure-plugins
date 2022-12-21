import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import { gql } from 'graphql-tag';
import { StripeSubscriptionService } from './stripe-subscription.service';
import {
  StripeSubscriptionController,
  StripeSubscriptionResolver,
} from './stripe-subscription.controller';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { productVariantCustomFields } from './subscription-custom-fields';

export interface StripeSubscriptionPluginOptions {}

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
      }
      input StripeSubscriptionPricingInput {
        productVariantId: ID!
        startDate: DateTime
        downpayment: Int
      }
      extend type Query {
        """
        Preview the pricing model of a given subscription.
        Start date and downpayment are optional: if not supplied, the subscriptions default will be used
        """
        getStripeSubscriptionPricing(
          input: StripeSubscriptionPricingInput
        ): StripeSubscriptionPricing
      }
      extend type Mutation {
        createStripeSubscriptionCheckout(paymentMethodCode: String!): String!
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
    config.customFields.ProductVariant.push(...productVariantCustomFields);
    return config;
  },
})
export class StripeSubscriptionPlugin {
  static options: Required<StripeSubscriptionPluginOptions>;

  static init(options: Partial<StripeSubscriptionPluginOptions>) {
    this.options = options;
    return StripeSubscriptionPlugin;
  }
}
