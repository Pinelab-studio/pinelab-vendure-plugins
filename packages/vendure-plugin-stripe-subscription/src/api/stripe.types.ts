export interface Metadata {
  orderCode: string;
  channelToken: string;
  paymentMethodCode: string;
  amount: number;
}

export interface Object {
  id: string;
  object: string;
  customer: string;
  payment_method: string;
  metadata: Metadata;
  subscription: string;
  lines?: {
    data: {
      metadata: Metadata;
      plan: {
        amount: number;
      };
    }[];
  };
}

export interface Data {
  object: Object;
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
