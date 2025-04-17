import { Metadata } from './stripe.common';

export interface AutomaticTax {
  enabled: boolean;
  status: any;
}

export interface Lines {
  object: string;
  data: Daum[];
  has_more: boolean;
  total_count: number;
  url: string;
}

export interface Daum {
  id: string;
  object: string;
  amount: number;
  amount_excluding_tax: number;
  currency: string;
  description: string;
  discount_amounts: any[];
  discountable: boolean;
  discounts: any[];
  livemode: boolean;
  metadata: Metadata;
  period: Period;
  plan: Plan;
  price: Price;
  proration: boolean;
  proration_details: ProrationDetails;
  quantity: number;
  subscription: string;
  subscription_item: string;
  tax_amounts: any[];
  tax_rates: any[];
  type: string;
  unit_amount_excluding_tax: string;
}

export interface Period {
  end: number;
  start: number;
}

export interface Plan {
  id: string;
  object: string;
  active: boolean;
  aggregate_usage: any;
  amount: number;
  amount_decimal: string;
  billing_scheme: string;
  created: number;
  currency: string;
  interval: string;
  interval_count: number;
  livemode: boolean;
  metadata: Metadata;
  nickname: any;
  product: string;
  tiers_mode: any;
  transform_usage: any;
  trial_period_days: any;
  usage_type: string;
}

export interface Price {
  id: string;
  object: string;
  active: boolean;
  billing_scheme: string;
  created: number;
  currency: string;
  custom_unit_amount: any;
  livemode: boolean;
  lookup_key: any;
  metadata: Metadata;
  nickname: any;
  product: string;
  recurring: Recurring;
  tax_behavior: string;
  tiers_mode: any;
  transform_quantity: any;
  type: string;
  unit_amount: number;
  unit_amount_decimal: string;
}

export interface Recurring {
  aggregate_usage: any;
  interval: string;
  interval_count: number;
  trial_period_days: any;
  usage_type: string;
}

export interface ProrationDetails {
  credited_items: any;
}

export interface PaymentSettings {
  default_mandate: any;
  payment_method_options: any;
  payment_method_types: any;
}

export interface StatusTransitions {
  finalized_at: number;
  marked_uncollectible_at: any;
  paid_at: number;
  voided_at: any;
}

export interface SubscriptionDetails {
  metadata: Metadata;
}
