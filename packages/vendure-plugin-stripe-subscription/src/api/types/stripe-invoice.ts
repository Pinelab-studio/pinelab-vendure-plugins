import { Metadata } from './stripe.types';

export interface StripeInvoice {
  id: string;
  object: string;
  account_country: string;
  account_name: string;
  account_tax_ids: any;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  amount_shipping: number;
  application: any;
  application_fee_amount: any;
  attempt_count: number;
  attempted: boolean;
  auto_advance: boolean;
  automatic_tax: AutomaticTax;
  billing_reason: string;
  charge: any;
  collection_method: string;
  created: number;
  currency: string;
  custom_fields: any;
  customer: string;
  customer_address: any;
  customer_email: string;
  customer_name: string;
  customer_phone: any;
  customer_shipping: any;
  customer_tax_exempt: string;
  customer_tax_ids: any[];
  default_payment_method: any;
  default_source: any;
  default_tax_rates: any[];
  description: string;
  discount: any;
  discounts: any[];
  due_date: any;
  effective_at: number;
  ending_balance: number;
  footer: any;
  from_invoice: any;
  hosted_invoice_url: string;
  invoice_pdf: string;
  last_finalization_error: any;
  latest_revision: any;
  lines: Lines;
  livemode: boolean;
  metadata: Metadata;
  next_payment_attempt: any;
  number: string;
  on_behalf_of: any;
  paid: boolean;
  paid_out_of_band: boolean;
  payment_intent: any;
  payment_settings: PaymentSettings;
  period_end: number;
  period_start: number;
  post_payment_credit_notes_amount: number;
  pre_payment_credit_notes_amount: number;
  quote: any;
  receipt_number: any;
  rendering_options: any;
  shipping_cost: any;
  shipping_details: any;
  starting_balance: number;
  statement_descriptor: any;
  status: string;
  status_transitions: StatusTransitions;
  subscription: string;
  subscription_details: SubscriptionDetails;
  subtotal: number;
  subtotal_excluding_tax: number;
  tax: any;
  test_clock: any;
  total: number;
  total_discount_amounts: any[];
  total_excluding_tax: number;
  total_tax_amounts: any[];
  transfer_data: any;
  webhooks_delivered_at: number;
}

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
