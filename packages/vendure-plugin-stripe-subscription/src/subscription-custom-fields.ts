import {
  CustomFieldConfig,
  LanguageCode,
  Order,
  OrderLine,
  ProductVariant,
} from '@vendure/core';
import { SubscriptionBillingInterval } from './generated/graphql';

/**
 * Custom fields for managing subscriptions.
 * See {@link productVariantCustomFields} for more information on each field
 */
export interface VariantWithSubscriptionFields extends ProductVariant {
  customFields: {
    subscriptionDownpayment?: number;
    durationInterval?: DurationInterval;
    durationCount?: number;
    startDate?: StartDate;
    billingInterval?: SubscriptionBillingInterval;
    billingCount?: number;
  };
}

export interface ValidatedVariantWithSubscriptionFields extends ProductVariant {
  customFields: {
    subscriptionDownpayment?: number;
    durationInterval: DurationInterval;
    durationCount: number;
    startDate: StartDate;
    billingInterval: SubscriptionBillingInterval;
    billingCount: number;
  };
}

/**
 * An order that can have subscriptions in it
 */
export interface OrderWithSubscriptions extends Order {
  lines: (OrderLine & { productVariant: VariantWithSubscriptionFields })[];
}

export enum DurationInterval {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum StartDate {
  START = 'Start of the billing interval',
  END = 'End of the billing interval',
}

export const productVariantCustomFields: CustomFieldConfig[] = [
  /* ------------ Downpayment -------------------------- */
  {
    name: 'subscriptionDownpayment',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Subscription downpayment',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value:
          'Optional downpayment for a subscription. ' +
          'If set, the customer is required to pay this amount up front, ' +
          'and it will be deducted from the monthly price ',
      },
    ],
    type: 'int',
    public: true,
    nullable: true,
    ui: { tab: 'subscription', component: 'currency-form-input' },
  },
  /* ------------ Duration interval -------------------------- */
  {
    name: 'durationInterval',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Duration interval',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'Interval used to specify the duration of the subscription',
      },
    ],
    type: 'string',
    options: [
      { value: DurationInterval.DAY },
      { value: DurationInterval.WEEK },
      { value: DurationInterval.MONTH },
      { value: DurationInterval.YEAR },
    ],
    public: true,
    nullable: true,
    ui: { tab: 'subscription' },
  },
  /* ------------ Duration count -------------------------- */
  {
    name: 'durationCount',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Duration count',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'The nr of intervals for the duration of the subscription',
      },
    ],
    type: 'int',
    public: true,
    nullable: true,
    ui: { tab: 'subscription' },
  },
  /* ------------ Start date -------------------------- */
  {
    name: 'startDate',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Start date',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'I.E. "start of the week"',
      },
    ],
    type: 'string',
    options: [{ value: StartDate.START }, { value: StartDate.END }],
    public: true,
    nullable: true,
    ui: { tab: 'subscription' },
  },
  /* ------------ Billing interval -------------------------- */
  {
    name: 'billingInterval',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Billing interval',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'The interval used for billing and start date',
      },
    ],
    type: 'string',
    options: [
      { value: SubscriptionBillingInterval.Week },
      { value: SubscriptionBillingInterval.Month },
    ],
    public: true,
    nullable: true,
    ui: { tab: 'subscription' },
  },
  /* ------------ Billing count -------------------------- */
  {
    name: 'billingCount',
    label: [
      {
        languageCode: LanguageCode.en,
        value: 'Billing count',
      },
    ],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'The nr. of intervals for billing',
      },
    ],
    type: 'int',
    public: true,
    nullable: true,
    ui: { tab: 'subscription' },
  },
];
