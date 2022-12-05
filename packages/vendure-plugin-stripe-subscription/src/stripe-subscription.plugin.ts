import {
  PluginCommonModule,
  RequestContext,
  VendurePlugin,
} from '@vendure/core';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import { gql } from 'graphql-tag';
import { StripeSubscriptionService } from './stripe-subscription.service';
import {
  StripeSubscriptionController,
  StripeSubscriptionResolver,
} from './stripe-subscription.controller';
import { PLUGIN_INIT_OPTIONS } from './constants';

export interface StripeSubscriptionPluginOptions {}

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: gql`
      extend type Mutation {
        createStripeSubscriptionPaymentLink(paymentMethodCode: String!): String!
      }
    `,
    resolvers: [StripeSubscriptionResolver],
  },
  adminApiExtensions: {
    schema: gql`
      extend enum HistoryEntryType {
        SUBSCRIPTION_ERROR
      }
    `,
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
