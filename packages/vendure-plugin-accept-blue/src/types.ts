import type { Request } from 'express';
export interface CustomFields {
  custom1?: string;
}

enum AcceptBlueAVSResultCode {
  YYY = 'YYY', // Address: Match & 5 Digit Zip: Match
  YYX = 'YYX', // Address: Match & 9 Digit Zip: Match
  NYZ = 'NYZ', // Address: No Match & 5 Digit Zip: Match
  NYW = 'NYW', // Address: No Match & 9 Digit Zip: Match
  YNA = 'YNA', // Address: Match & 5 Digit Zip: No Match
  NNN = 'NNN', // Address: No Match & 5 Digit Zip: No Match
  XXW = 'XXW', // Card Number Not On File
  XXU = 'XXU', // Address Information not verified for domestic transaction
  XXR = 'XXR', // Retry / System Unavailable
  XXS = 'XXS', // Service Not Supported
  XXE = 'XXE', // Address Verification Not Allowed For Card Type
  XXG = 'XXG', // Global Non-AVS participant
  YYG = 'YYG', // International Address: Match & Postal: Not Compatible
  GGG = 'GGG', // International Address: Match & Postal: Match
  YGG = 'YGG', // International Address: No Compatible & Postal: Match
  NNC = 'NNC', // International Address: Address not verified
  NA = 'NA', // No AVS response (Typically no AVS data sent or swiped transaction)
}

export interface AcceptBlueAddress {
  first_name: string;
  last_name: string;
  street: string;
  street2: string;
  state: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
}

/** +++++ Transactions +++++ */

interface AcceptBlueTerminal {
  operating_environment: number;
  cardholder_authentication_method: number;
  cardholder_authentication_entity: number;
  print_capability: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TransactionFlags {
  allow_partial_approval: boolean;
  is_recurring: boolean;
  is_installment: boolean;
  is_customer_initiated: boolean;
  cardholder_present: boolean;
  card_present: boolean;
  terminal: AcceptBlueTerminal;
}

interface TransactionDetails {
  description: string;
  clerk: string;
  terminal: string;
  client_ip: string;
  signature: string;
  invoice_number: string;
  po_number: string;
  order_number: string;
  batch_id: number;
  source: string;
  terminal_name: string;
  username: string;
  type: 'charge' | 'credit';
  reference_number: number;
  schedule_id: number;
}

export interface AcceptBlueAmountInput {
  tax: number;
  surcharge: number;
  shipping: number;
  tip: number;
  discount: number;
}

export interface AcceptBlueAmountDetails extends AcceptBlueAmountInput {
  amount: number;
  subtotal: number;
  original_requested_amount: number;
  original_authorized_amount: number;
}

interface TransactionCustomer {
  identifier: string;
  email: string;
  fax?: string | null;
  customer_id: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ChargeCustomer extends TransactionCustomer {
  send_receipt: boolean;
}

/** +++++ Customer +++++ */

export interface AcceptBlueCustomerInput {
  identifier: string;
  customer_number?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  website?: string;
  phone?: string;
  alternate_phone?: string;
  billing_info?: AcceptBlueAddress;
  shipping_info?: AcceptBlueAddress;
  active?: boolean;
}

export interface AcceptBlueCustomer {
  id: number;
  /**
   * On creation, we set the emailaddress as identifier
   */
  identifier: string;
  customer_number: string;
  first_name?: string;
  last_name?: string;
  email: string;
  website?: string;
  phone?: string;
  alternate_phone?: string;
  billing_info?: AcceptBlueAddress;
  shipping_info?: AcceptBlueAddress;
  active: boolean;
}

/** +++++ Payment +++++ */

type CardType = 'Visa' | 'MasterCard' | 'Discover' | 'Amex' | 'JCB' | 'Diners';
export type AccountType = 'Checking' | 'Savings';
export type SecCode = 'PPD' | 'CCD' | 'TEL' | 'WEB';

/** +++++ Customer Payment Methods +++++ */

export interface AcceptBlueCardPaymentMethod {
  id: number;
  customer_id: string;
  created_at: Date;
  name: string;
  payment_method_type: 'card';
  last4: string;
  avs_address: string;
  avs_zip: string;
  expiry_month: number;
  expiry_year: number;
  card_type: string;
}

export interface AcceptBlueCheckPaymentMethod {
  id: number;
  customer_id: string;
  created_at: Date;
  name: string;
  payment_method_type: 'check';
  last4: string;
  routing_number: string;
  account_type: AccountType;
  sec_code: SecCode;
}

export type AcceptBluePaymentMethod =
  | AcceptBlueCardPaymentMethod
  | AcceptBlueCheckPaymentMethod;

export interface CreditCardPaymentMethodInput {
  card: string;
  expiry_month: number;
  expiry_year: number;
  avs_zip: string;
  cvv2?: string;
  name?: string;
  avs_address?: string;
}

export interface CheckPaymentMethodInput {
  name: string;
  routing_number: string;
  account_number: string;
  account_type: AccountType;
  sec_code: SecCode;
}

export interface NoncePaymentMethodInput {
  /*
   * The appropriate prefix must be used:
   * Reference number: ref-
   * Payment method ID: pm-
   * Token: tkn-
   * Nonce token: nonce-
   */
  source: string;
  expiry_month: number;
  expiry_year: number;
  last4: string;
}

export interface SavedPaymentMethodInput {
  paymentMethodId: number;
}

export interface CheckPaymentMethodInput {
  routing_number: string;
  account_number: string;
  name: string;
  account_type: AccountType;
  sec_code: SecCode;
}

export interface HandlePaymentResult {
  customerId: string;
  paymentMethodId: string | number;
  recurringScheduleResult: AcceptBlueRecurringSchedule[];
  /**
   * If the amount is 0, no one time charge was created
   */
  chargeResult?: AcceptBlueChargeTransaction;
}

/** +++++ Recurring ++++++ */

export type Frequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'biannually'
  | 'annually';

export interface AcceptBlueRecurringSchedule {
  id: number;
  customer_id: number;
  created_at: Date;
  title: string;
  frequency: Frequency;
  amount: number;
  next_run_date: Date;
  num_left: number;
  payment_method_id: number;
  active: boolean;
  receipt_email: string;
  /*
   * - active: The schedule is active and will run on the next_run_date.
   * - declined: The last transaction run by the schedule was declined. If the schedule has not completed the set number of retries, it will retry the next day.
   * - error: The last transaction run by the schedule failed with an error. If the schedule has not completed the set number of retries, it will retry the next day.
   * - finished: The schedule has finished the specified number of times to run.
   * - failed: The schedule has completed the set number of retries after failing to run, and will not retry again until the next time of the specified frequency (e.g. the next month).
   */
  status: 'active' | 'declined' | 'error' | 'finished' | 'failed';
  prev_run_date: Date;
  transaction_count: number;
}

export interface AcceptBlueRecurringScheduleInput {
  title: string;
  amount: number;
  payment_method_id: number;
  frequency?: Frequency;
  next_run_date?: Date;
  num_left?: number;
  active?: boolean;
  receipt_email?: string;
  use_this_source_key?: boolean;
}

export interface AcceptBlueRecurringScheduleTransaction {
  id: number;
  created_at: Date;
  settled_date: Date;
  amount_details: AcceptBlueAmountDetails;
  transaction_details: TransactionDetails;
  customer: TransactionCustomer;
  billing_info: AcceptBlueAddress;
  shipping_info: AcceptBlueAddress;
  custom_fields: CustomFields;
  status_details: {
    error_code: string;
    error_message: string;
    status: string;
  };
  card_details?: {
    name: string;
    last4: string;
    expiry_month: number;
    expiry_year: number;
    card_type: string;
  };
  check_details?: {
    name: string;
    routing_number: string;
    account_number_last4: string;
    account_type: number;
  };
}

/** +++++ Events / webhooks +++++ */

export interface CardTransaction {
  id: number;
  created_at: string;
  settled_date: string;
  amount_details: AcceptBlueAmountDetails;
  transaction_details: TransactionDetails;
  customer: TransactionCustomer;
  billing_info: AcceptBlueAddress;
  shipping_info: AcceptBlueAddress;
  custom_fields: CustomFields;
}

interface AcceptBlueBinType {
  type: 'C' | 'D' | null;
}

export interface AcceptBlueTransaction {
  version: string;
  status: 'Approved' | 'Partially Approved' | 'Declined' | 'Error';
  status_code: 'A' | 'P' | 'D' | 'E';
  error_message: string;
  error_code: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents
  error_details: string | any;
  reference_number: number;
}

export interface AcceptBlueChargeTransaction extends AcceptBlueTransaction {
  auth_amount: number;
  auth_code: string;
  avs_result: string;
  avs_result_code: AcceptBlueAVSResultCode;
  cvv2_result: string;
  cvv2_result_code: 'M' | 'N' | 'P' | 'U' | 'X';
  card_type: CardType;
  last_4: string;
  card_ref: string | null;
  bin_type?: AcceptBlueBinType;
  transaction?: CardTransaction;
}

export interface AcceptBlueEvent {
  type: 'succeeded' | 'updated' | 'declined' | 'error' | 'status';
  subType: string;
  event: 'transaction';
  id: string;
  timestamp: string;
  data: AcceptBlueChargeTransaction;
}

export interface TransactionSuccess extends AcceptBlueEvent {
  type: 'succeeded';
  subType: 'charge' | 'credit' | 'refund';
}

export interface TransactionUpdate extends AcceptBlueEvent {
  type: 'updated';
  subType: 'adjust' | 'void';
}

export interface TransactionDeclined extends AcceptBlueEvent {
  type: 'declined';
  subType: 'charge' | 'credit' | 'refund' | 'adjust' | 'void';
}

export interface TransactionError extends AcceptBlueEvent {
  type: 'error';
  subType: 'charge' | 'credit' | 'refund' | 'adjust' | 'void';
}

export interface TransactionStatus extends AcceptBlueEvent {
  type: 'status';
  subType:
    | 'settled'
    | 'reserve'
    | 'originated'
    | 'pending'
    | 'voided'
    | 'returned'
    | 'error'
    | 'cancelled'
    | 'unknown';
}

export interface BatchObject {
  id: number;
  opened_at: string | null;
  auto_close_date: string | null;
  closed_at: string | null;
  platform: string;
  sequence_number: number;
}

export interface BatchEvent {
  type: 'closed';
  event: 'batch';
  id: string;
  timestamp: string;
  data: BatchObject;
}

export interface AcceptBlueWebhookInput {
  webhook_url: string;
  description: string;
  active: true;
}

export interface AcceptBlueWebhook {
  id: number;
  signature: string;
  webhook_url: string;
  description: string;
  active: boolean;
}

export interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}
