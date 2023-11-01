import { StripeInvoice } from './stripe-invoice';
import { StripePaymentIntent } from './stripe-payment-intent';

export interface Metadata {
  orderCode: string;
  channelToken: string;
  paymentMethodCode: string;
  amount: number;
}

export interface Data {
  object: StripeInvoice | StripePaymentIntent;
}

export interface Request {
  id?: any;
  idempotency_key?: any;
}

export interface IncomingStripeWebhook {
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
