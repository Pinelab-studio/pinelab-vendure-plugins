import {
  PluginCommonModule,
  RequestContext,
  VendurePlugin,
} from '@vendure/core';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import { gql } from 'graphql-tag';
import { StripeSubscriptionService } from './stripe-subscription.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: gql`
      extend type Mutation {
        createSubscriptionIntent(paymentMethodCode: String): String!
      }
    `,
    resolvers: [],
  },
  providers: [StripeSubscriptionService],
  configuration: (config) => {
    config.paymentOptions.paymentMethodHandlers.push(stripeSubscriptionHandler);
    return config;
  },
})
export class StockMonitoringPlugin {}
