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
  image_url?: number;
  price_cost?: number;
  price_store?: number;
  order_unit?: number;
};

export type QlsFulfillmentProduct = {
  id: string;
  company_id: string;
  name: string;
  description: string;
  ean: string;
  sku: string;
  hs_code: string;
  amount_available: number;
  amount_total: number;
  amount_reserverd: number;
  image_url: number;
  price_cost: number;
  price_store: number;
  order_unit: number;
  created: string;
  modified: string;
};

export type QlsFulfillmentStock = {
  id: string;
  name: string;
  ean: string;
  sku: string;
  amount_total: number;
  amount_reserved: number;
  amount_blocked: number;
  amount_available: number;
  amount_salable: number;
  amount_sold: number;
  amount_backorder: number;
  amount_forecast: number;
  amount_internally_moving: number;
  amount_prognose: number;
  amount_incoming: number;
  amount_preorderable: number;
};
