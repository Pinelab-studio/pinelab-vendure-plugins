import {
  Customer,
  CustomFieldConfig,
  LanguageCode,
  Order,
  OrderLine,
  ProductVariant,
} from '@vendure/core';
import { Schedule } from './schedule.entity';
import { StripeSubscriptionPricing } from '../ui/generated/graphql';

/**
 * Custom fields for managing subscriptions.
 * See {@link productVariantCustomFields} for more information on each field
 */
export interface VariantWithSubscriptionFields extends ProductVariant {
  customFields: {
    subscriptionSchedule?: Schedule;
  };
}

export interface CustomerWithSubscriptionFields extends Customer {
  customFields: {
    stripeSubscriptionCustomerId?: string;
  };
}

export interface OrderLineWithSubscriptionFields extends OrderLine {
  subscriptionPricing?: StripeSubscriptionPricing;
  customFields: {
    downpayment?: number;
    startDate?: Date;
    subscriptionIds?: string[];
    subscriptionHash?: string;
  };
  productVariant: VariantWithSubscriptionFields;
}

/**
 * An order that can have subscriptions in it
 */
export interface OrderWithSubscriptionFields extends Order {
  lines: (OrderLineWithSubscriptionFields & {
    productVariant: VariantWithSubscriptionFields;
  })[];
  customer: CustomerWithSubscriptionFields;
}

export const productVariantCustomFields: CustomFieldConfig[] = [
  {
    name: 'subscriptionSchedule',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Subscription Schedule',
      },
    ],
    type: 'relation',
    entity: Schedule,
    graphQLType: 'StripeSubscriptionSchedule',
    public: true,
    nullable: true,
    eager: true,
    ui: { component: 'schedule-form-selector', tab: 'Subscription' },
  },
];

export const customerCustomFields: CustomFieldConfig[] = [
  /* ------------ Stripe customer ID -------------------------- */
  {
    name: 'stripeSubscriptionCustomerId',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Stripe Customer ID',
      },
    ],
    type: 'string',
    public: false,
    nullable: true,
    ui: { tab: 'Subscription' },
  },
];

export const orderLineCustomFields: CustomFieldConfig[] = [
  {
    name: 'downpayment',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Downpayment',
      },
    ],
    type: 'int',
    public: true,
    nullable: true,
    ui: { tab: 'Subscription', component: 'currency-form-input' },
  },
  {
    name: 'startDate',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Start Date',
      },
    ],
    type: 'datetime',
    public: true,
    nullable: true,
    ui: { tab: 'Subscription' },
  },
  {
    name: 'subscriptionIds',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Downpayment',
      },
    ],
    type: 'string',
    list: true,
    public: false,
    readonly: true,
    internal: true,
    nullable: true,
  },
  {
    name: 'subscriptionHash',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Subscription hash',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'Unique hash to separate order lines',
      },
    ],
    type: 'string',
    list: true,
    public: false,
    readonly: true,
    internal: true,
    nullable: true,
  },
];
