import { LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { stripeSubscriptionHandler } from './stripe-subscription.handler';
import { gql } from 'graphql-tag';
import { StripeSubscriptionService } from './stripe-subscription.service';
import {
  StripeSubscriptionController,
  StripeSubscriptionResolver,
} from './stripe-subscription.controller';
import { PLUGIN_INIT_OPTIONS } from './constants';

export interface StripeSubscriptionPluginOptions {}

export enum PaymentFrequency {
  PAID_IN_FULL = 'Paid in full',
  MONTHLY = 'Monthly',
}

export enum BillingMoment {
  FIRST_OF_THE_MONTH = 'Every first day of the month',
  LAST_OF_THE_MONTH = 'Every last day of the month',
}

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
    config.customFields.ProductVariant.push(
      // TODO BillingMoment
      {
        name: 'subscriptionDuration',
        label: [
          {
            languageCode: LanguageCode.en,
            value: 'Subscription duration in months',
          },
        ],
        type: 'int',
        public: true,
      },
      {
        name: 'paymentFrequency',
        label: [
          {
            languageCode: LanguageCode.en,
            value: 'Payment frequency',
          },
        ],
        type: 'string',
        options: [
          { value: PaymentFrequency.MONTHLY },
          { value: PaymentFrequency.PAID_IN_FULL },
        ],
        public: true,
      },
      {
        name: 'downpaymentCycles',
        label: [
          {
            languageCode: LanguageCode.en,
            value: 'Downpayment cycles',
          },
        ],
        description: [
          {
            languageCode: LanguageCode.en,
            value:
              "The amount of payment cycles that has to be paid upfront. For example: when the payment frequency is 'Monthly' and downpayment cycles is '2', the customer has to pay 2 months up front during checkout to subscribe.",
          },
        ],

        type: 'int',
        public: true,
      }
    );
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
