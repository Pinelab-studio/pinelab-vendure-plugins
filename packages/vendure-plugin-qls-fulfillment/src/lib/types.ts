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

export type QlsFulfillmentProductInput = {
  name: string;
  ean?: string;
  sku: string;
  image_url?: string;
  price_cost?: number;
  price_store?: number;
  order_unit?: number;
};

export type QlsFulfillmentProduct = {
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
