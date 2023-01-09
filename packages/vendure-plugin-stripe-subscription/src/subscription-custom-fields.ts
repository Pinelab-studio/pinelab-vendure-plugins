import {
  Customer,
  CustomFieldConfig,
  LanguageCode,
  Order,
  OrderLine,
  ProductVariant,
} from '@vendure/core';
import { schedules } from './schedule.service';
import { Schedule } from './schedule.entity';
import { StripeSubscriptionPricing } from './ui/generated/graphql';

/**
 * Custom fields for managing subscriptions.
 * See {@link productVariantCustomFields} for more information on each field
 */
export interface VariantWithSubscriptionFields extends ProductVariant {
  customFields: {
    subscriptionSchedule?: string;
  };
}

export interface CustomerWithSubscriptionFields extends Customer {
  customFields: {
    stripeCustomerId?: string;
  };
}

export interface OrderLineWithSubscriptionFields extends OrderLine {
  subscriptionPricing?: StripeSubscriptionPricing;
  customFields: {
    downpayment?: number;
    startDate?: Date;
    pricing?: StripeSubscriptionPricing;
  };
  productVariant: VariantWithSubscriptionFields;
}

/**
 * An order that can have subscriptions in it
 */
export interface OrderWithSubscriptions extends Order {
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
        value: 'Susbcription schedule',
      },
    ],
    type: 'string',
    options: schedules.map((s) => ({ value: s.name! })),
    public: true,
    nullable: true,
    ui: { tab: 'Subscription' },
  },
  {
    name: 'subscriptionSchedule2',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Susbcription schedule2',
      },
    ],
    type: 'relation',
    entity: Schedule,
    graphQLType: 'StripeSubscriptionSchedule',
    eager: false,
    public: true,
    nullable: true,
    ui: { ui: 'schedule-form-selector' },
  },
];

export const customerCustomFields: CustomFieldConfig[] = [
  /* ------------ Stripe customer ID -------------------------- */
  {
    name: 'stripeCustomerId',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Stripe customer ID',
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
];
