/**
 * QLS API types only
 */

export interface QlsApiResponse<T> {
  meta: {
    code: number;
  };
  data: T;
  pagination?: {
    page: number;
    limit: number;
    count: number;
    pageCount: number;
    nextPage: boolean;
    prevPage: boolean;
  };
}

export type FulfillmentProductInput = {
  name: string;
  ean?: string;
  sku: string;
  image_url?: string;
  price_cost?: number;
  price_store?: number;
  order_unit?: number;
};

export type FulfillmentProduct = {
  id: string;
  company_id: string;
  collection_id: string | null;
  dimensions: unknown;
  article_number: string | null;
  ean: string;
  name: string;
  sku: string;
  image_url: string | null;
  country_code_of_origin: string | null;
  hs_code: string | null;
  need_barcode_picking: boolean;
  need_best_before_stock: boolean;
  need_serial_number: boolean;
  amount_available: number;
  amount_reserved: number;
  amount_total: number;
  price_cost: number | null;
  price_store: number | null;
  weight: number;
  created: string;
  modified: string;
  foldable: boolean;
  fulfillment_product_brand_id: string | null;
  description: string | null;
  amount_blocked: number;
  status: string | null;
  suppliers: unknown[];
  barcodes: string[];
  image_url_handheld: string | null;
  barcodes_and_ean: string[];
};

export interface FulfillmentOrderInput {
  brand_id: string;
  customer_reference: string;
  processable: string; // ISO datetime string
  servicepoint_code?: string;
  total_price: number;
  receiver_contact: FulfillmentOrderReceiverContactInput;
  custom_values?: CustomValue[];
  products: FulfillmentOrderLineInput[];
  delivery_options: string[];
}

export interface FulfillmentOrderReceiverContactInput {
  name: string;
  companyname: string;
  street: string;
  housenumber: string;
  address2?: string | null;
  postalcode: string;
  locality: string;
  country: string;
  email?: string | null;
  phone?: string | null;
  vat?: string | null;
  eori?: string | null;
  oss?: string | null;
}

export interface CustomValue {
  key: string;
  value: string;
}

export interface FulfillmentOrderLineInput {
  amount_ordered: number;
  product_id: string;
  name: string;
  custom_values?: CustomValue[];
}

export type QlsOrderStatus =
  | 'concept'
  | 'error_validation'
  | 'received'
  | 'pending'
  | 'partically_sent'
  | 'sent';

export interface FulfillmentOrder {
  id: string;
  customer_reference: string;
  amount_delivered: number | null;
  amount_reserved: number | null;
  amount_total: number;
  status: QlsOrderStatus;
  created: string;
  modified: string;
  cancelled: boolean | null;
  hold: boolean | null;
  processable: string;
  shop_integration_id: string | null;
  shop_integration_reference: string | null;
  need_customs_information: boolean | null;
  brand: string | null;
  receiver_contact: {
    companyName: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    street: string;
    houseNumber: string | null;
    address2: string | null;
    postalCode: string | null;
    locality: string;
    country: string;
  };
  delivery_options: string[];
  products: Array<{
    id: string;
    order_id: string;
    product_id: string;
    name: string;
    shop_integration_reference: string | null;
    status: string | null;
    amount_open: number | null;
    amount_ordered: number;
    amount_reserved: number | null;
    amount_delivered: number | null;
    amount_original: number | null;
    country_code_of_origin: string | null;
    hs_code: string | null;
    price_per_unit: number | null;
    custom1: string | null;
    special_handling: string | null;
    weight_per_unit: number | null;
    company_id: string;
    created: string;
    modified: string;
    product: unknown;
  }>;
}

export type IncomingStockWebhook = Pick<
  FulfillmentProduct,
  'sku' | 'amount_available'
>;

export type IncomingOrderWebhook = Pick<
  FulfillmentOrder,
  | 'customer_reference'
  | 'status'
  | 'cancelled'
  | 'amount_delivered'
  | 'amount_total'
>;
