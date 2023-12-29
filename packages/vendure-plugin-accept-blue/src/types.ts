export interface AcceptBlueCustomer {
  id: string;
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
  billing_info?: {
    first_name: string;
    last_name: string;
    street: string;
    street2: string;
    state: string;
    city: string;
    zip: string;
    country: string;
    phone: string;
  };
  shipping_info?: {
    first_name: string;
    last_name: string;
    street: string;
    street2: string;
    state: string;
    city: string;
    zip: string;
    country: string;
    phone: string;
  };
  active: boolean;
}

export type AddPaymentInput = CreditCardPaymentInput | SavedMethodInput;

export interface CreditCardPaymentInput {
  card: string;
  expiry_month: number;
  expiry_year: number;
  avs_address: string;
  avs_zip: string;
  name: string;
}

export interface SavedMethodInput {
  paymentMethodId: number;
}

export interface HandlePaymentResult {
  customerId: string;
  paymentMethodId: string | number;
  recurringScheduleResult: any;
  chargeResult: any;
}

export interface AcceptBluePaymentMethod {
  id: string;
  customer_id: string;
  created_at: Date;
  avs_address: string;
  avs_zip: string;
  name: string;
  expiry_month: number;
  expiry_year: number;
  payment_method_type: string;
  card_type?: string;
  last4: string;
}
