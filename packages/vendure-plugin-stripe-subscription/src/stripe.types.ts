export interface AutomaticTax {
  enabled: boolean;
  status?: any;
}

export interface CustomText {
  shipping_address?: any;
  submit?: any;
}

export interface Address {
  city?: any;
  country: string;
  line1?: any;
  line2?: any;
  postal_code?: any;
  state?: any;
}

export interface CustomerDetails {
  address: Address;
  email: string;
  name: string;
  phone?: any;
  tax_exempt: string;
  tax_ids: any[];
}

export interface Metadata {
  orderCode: string;
  channelToken: string;
  paymentMethodCode: string;
  amount: number;
}

export interface PhoneNumberCollection {
  enabled: boolean;
}

export interface TotalDetails {
  amount_discount: number;
  amount_shipping: number;
  amount_tax: number;
}

export interface Object {
  id: string;
  object: string;
  after_expiration?: any;
  allow_promotion_codes?: any;
  amount_subtotal: number;
  amount_total: number;
  automatic_tax: AutomaticTax;
  billing_address_collection?: any;
  cancel_url: string;
  client_reference_id?: any;
  consent?: any;
  consent_collection?: any;
  created: number;
  currency: string;
  custom_text: CustomText;
  customer: string;
  customer_creation: string;
  customer_details: CustomerDetails;
  customer_email?: any;
  expires_at: number;
  livemode: boolean;
  locale: string;
  metadata: Metadata;
  mode: string;
  payment_intent?: any;
  payment_link?: any;
  payment_method_collection: string;
  payment_method_options?: any;
  payment_method_types: string[];
  payment_status: string;
  phone_number_collection: PhoneNumberCollection;
  recovered_from?: any;
  setup_intent?: any;
  shipping?: any;
  shipping_address_collection?: any;
  shipping_options: any[];
  shipping_rate?: any;
  status: string;
  submit_type?: any;
  subscription: string;
  success_url: string;
  total_details: TotalDetails;
  url?: any;
}

export interface Data {
  object: Object;
}

export interface Request {
  id?: any;
  idempotency_key?: any;
}

export interface IncomingCheckoutWebhook {
  id: string;
  object: string;
  api_version: string;
  created: number;
  data: Data;
  livemode: boolean;
  pending_webhooks: number;
  request: Request;
  type: string;
}
