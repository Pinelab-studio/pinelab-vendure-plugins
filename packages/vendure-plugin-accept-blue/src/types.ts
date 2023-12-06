export interface Customer {
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
  active: true;
}

export interface CreditCardChargeInput {
  amount: number,
  name: string,
  transaction_details: {
    description: string,
    clerk: string,
    terminal: string,
    client_ip: string,
    signature: string,
    invoice_number: string,
    po_number: string,
    order_number: string
  },
  line_items: [
    {
      sku: string,
      name: string,
      description: string,
      cost: 0.0001,
      quantity: 1,
      tax_rate: 30,
      tax_amount: 0,
      unit_of_measure: str,
      commodity_code: stringst,
      discount_rate: 100,
      discount_amount: 0
    }
  ],
  billing_info: {
    first_name: string,
    last_name: string,
    street: string,
    street2: string,
    state: string,
    city: string,
    zip: string,
    country: string,
    phone: string
  },
  shipping_info: {
    first_name: string,
    last_name: string,
    street: string,
    street2: string,
    state: string,
    city: string,
    zip: string,
    country: string,
    phone: string
  },
  custom_fields: {
    custom1: string,
    custom2: string,
    custom3: string,
    custom4: string,
    custom5: string,
    custom6: string,
    custom7: string,
    custom8: string,
    custom9: string,
    custom10: string,
    custom11: string,
    custom12: string,
    custom13: string,
    custom14: string,
    custom15: string,
    custom16: string,
    custom17: string,
    custom18: string,
    custom19: string,
    custom20: string
  },
  ignore_duplicates: false,
  customer: {
    send_receipt: false,
    email: string,
    fax: string,
    identifier: string,
    customer_id: 1
  },
  transaction_flags: {
    allow_partial_approval: false,
    is_recurring: false,
    is_installment: false,
    is_customer_initiated: false,
    cardholder_present: false,
    card_present: false,
    terminal: {
      operating_environment: 0,
      cardholder_authentication_method: 0,
      cardholder_authentication_entity: 0,
      print_capability: false
    }
  },
  avs_address: string,
  avs_zip: string,
  expiry_month: 1,
  expiry_year: 2020,
  cvv2: stri,
  3d_secure: {
    eci: 00,
    cavv: stringstringstringstringstri,
    ds_trans_id: 084f49cd-2a97-4b13-87a7-a1bd8267cb20
  },
  card: stringstringst,
  capture: true,
  save_card: false
}
