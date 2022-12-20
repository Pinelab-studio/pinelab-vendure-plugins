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

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: gql`
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
