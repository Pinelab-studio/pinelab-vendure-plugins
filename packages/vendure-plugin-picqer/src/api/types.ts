import { ProductVariant } from '@vendure/core';

export interface ProductInput {
  name: string;
  idvatgroup: number;
  productcode: string;
  price: number;
  description?: string;
  barcode?: string;
  active?: boolean;
}

export interface VatGroup {
  idvatgroup: number;
  name: string;
  percentage: number;
}

export type VariantWithStock = Pick<
  ProductVariant,
  'id' | 'sku' | 'stockAllocated' | 'stockOnHand'
>;

export interface Webhook {
  idhook: number;
  name: string;
  event: 'products.free_stock_changed' | 'orders.completed';
  address: string;
  active: boolean;
  secret: boolean | string;
}

export interface WebhookInput {
  name: string;
  event: 'products.free_stock_changed' | 'orders.completed';
  address: string;
  secret: string;
}

export type IncomingWebhook = IncomingProductWebhook; // TODO | IncomingOrderWebhook;

export interface IncomingProductWebhook {
  idhook: number;
  name: string;
  event: string;
  event_triggered_at: string;
  data: ProductData;
}

export interface ProductData {
  idproduct: number;
  idvatgroup: number;
  idsupplier: any;
  productcode: string;
  name: string;
  price: number;
  fixedstockprice: number;
  productcode_supplier: string;
  deliverytime: any;
  description: string;
  barcode: string;
  type: string;
  unlimitedstock: boolean;
  weight: number;
  minimum_purchase_quantity: number;
  purchase_in_quantities_of: number;
  hs_code: any;
  country_of_origin: any;
  active: boolean;
  productfields: Productfield[];
  images: string[];
  stock: Stock[];
}

export interface Productfield {
  idproductfield: number;
  title: string;
  value: string;
}

export interface Stock {
  idwarehouse: number;
  stock: number;
  reserved: number;
  reservedbackorders: number;
  reservedpicklists: number;
  reservedallocations: number;
  freestock: number;
  freepickablestock: number;
}
