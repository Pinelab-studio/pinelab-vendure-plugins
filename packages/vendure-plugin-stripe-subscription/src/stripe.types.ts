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
  customer: string;
  payment_method: string;
  metadata: Metadata;
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
