import {
  Customer,
  CustomFieldConfig,
  LanguageCode,
  Order,
  OrderLine,
  ProductVariant,
} from '@vendure/core';
import { schedules } from './schedule.service';

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
  customFields: {
    downpayment?: number;
    startDate?: Date;
  };
}

/**
 * An order that can have subscriptions in it
 */
export interface OrderWithSubscriptions extends Order {
  lines: (OrderLine & { productVariant: VariantWithSubscriptionFields })[];
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
    ui: { tab: 'subscription' },
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
    ui: { tab: 'subscription' },
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
    ui: { tab: 'subscription' },
  },
  {
    name: 'startDate',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Start dDate',
      },
    ],
    type: 'datetime',
    public: true,
    nullable: true,
    ui: { tab: 'subscription' },
  },
];
