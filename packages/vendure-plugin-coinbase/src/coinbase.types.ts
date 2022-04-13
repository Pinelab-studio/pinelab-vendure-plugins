export interface Timeline {
  time: Date;
  status: string;
}

export interface Metadata {
  customer_id: string;
  customer_name: string;
}

export interface Local {
  amount: string;
  currency: string;
}

export interface Bitcoin {
  amount: string;
  currency: string;
}

export interface Ethereum {
  amount: string;
  currency: string;
}

export interface Pricing {
  local: Local;
  bitcoin: Bitcoin;
  ethereum: Ethereum;
}

export interface OverpaymentAbsoluteThreshold {
  amount: string;
  currency: string;
}

export interface UnderpaymentAbsoluteThreshold {
  amount: string;
  currency: string;
}

export interface PaymentThreshold {
  overpayment_absolute_threshold: OverpaymentAbsoluteThreshold;
  overpayment_relative_threshold: string;
  underpayment_absolute_threshold: UnderpaymentAbsoluteThreshold;
  underpayment_relative_threshold: string;
}

export interface Addresses {
  bitcoin: string;
  ethereum: string;
}

export interface Data {
  id: string;
  resource: string;
  code: string;
  name: string;
  description: string;
  logo_url: string;
  hosted_url: string;
  created_at: Date;
  expires_at: Date;
  confirmed_at: Date;
  timeline: Timeline[];
  metadata: Metadata;
  pricing_type: string;
  pricing: Pricing;
  payments: any[];
  payment_threshold: PaymentThreshold;
  addresses: Addresses;
  redirect_url: string;
  cancel_url: string;
}

export interface ChargeResult {
  data: Data;
}

export interface ChargeInput {
  name: string;
  description: string;
  local_price: {
    amount: string;
    currency: string;
  };
  metadata: {
    orderCode: string;
    channelToken: string;
  };
  pricing_type: 'fixed_price' | 'no_price';
  redirect_url: string;
}

export interface ChargeConfirmedWebhookEvent {
  event?: {
    id?: string;
    type?:
      | 'charge:created'
      | 'charge:confirmed'
      | 'charge:failed'
      | 'charge:pending';
    data?: {
      id?: string;
      code?: string;
      metadata?: {
        orderCode?: string;
        channelToken?: string;
      };
      addresses?: {
        [key: string]: string;
      };
    };
  };
}
