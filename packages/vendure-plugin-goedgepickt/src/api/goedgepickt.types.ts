export interface GoedgepicktPluginConfig {
  vendureHost: string;
  /**
   * Used to validate incoming sync webhook
   */
  endpointSecret: string;
  /**
   * Set webhook in Goedgepickt when saving credentials
   */
  setWebhook?: boolean;
}

export interface ProductInput {
  uuid?: string;
  name: string;
  sku: string;
  productId: string;
  stockManagement: boolean;
  url: string;
  picture?: string;
  price: string;
}

export interface Product {
  uuid: string;
  sku: string;
  ean?: string;
  barcode?: string;
  name: string;
  description?: string;
  price?: string;
  costPrice?: string;
  taxRate?: string;
  weight?: number;
  length?: string;
  height?: string;
  width?: string;
  productAttributes?: any[];
  internalComment?: string;
  picture?: string;
  stock?: Stock;
}

export interface Stock {
  freeStock: number;
  totalStock: number;
  reservedStock: number;
  unlimitedStock: number;
  minimalStock: number;
  fillStockTo: number;
}

export interface OrderInput {
  orderId: string;
  orderDisplayId?: string;
  createDate: string;
  finishDate?: string;
  orderStatus: OrderStatus;
  orderItems: OrderItemInput[];
  shippingFirstName?: string;
  shippingLastName?: string;
  shippingCompany?: string;
  shippingAddress: string;
  shippingHouseNumber: number;
  shippingHouseNumberAddition?: string;
  shippingAddress2?: string;
  shippingZipcode?: string;
  shippingCity?: string;
  shippingCountry?: string;
  shippingMethod?: string;
  paymentMethod?: string;
  billingFirstName?: string;
  billingLastName?: string;
  billingCompany?: string;
  billingHouseNumber?: number;
  billingHouseNumberAddition?: string;
  billingZipcode?: string;
  billingCity?: string;
  billingCountry?: string;
  billingEmail?: string;
  billingPhone?: string;
  pickupLocationData?: {
    locationNumber?: string;
    carrier?: string;
    location?: string;
    street?: string;
    houseNumber?: string;
    zipcode?: string;
    city?: string;
    country?: string;
  };
  ignoreUnknownProductWarnings?: boolean;
}

export type OrderStatus = 'on_hold' | 'open' | 'completed';

export interface OrderItemInput {
  sku: string;
  taxRate: number;
  productName: string;
  productQuantity: number;
}

export interface Order {
  orderUuid: string;
}

export interface IncomingStockUpdateEvent {
  event: 'stockUpdated';
  newStock: string;
  productSku: string;
  productUuid: string;
}

export interface IncomingOrderStatusEvent {
  event: 'orderStatusChanged';
  newStatus: OrderStatus;
  orderNumber: string;
  orderUuid: string;
}

export interface Webhook {
  webhookUuid: string;
  webhookEvent: GoedgepicktEvent;
  webhookSecret: string;
  targetUrl: string;
  webshopName: string;
  webshopUuid: string;
}

export interface Webshop {
  uuid: string;
  name: string;
  url: string;
  platform: string;
}

export enum GoedgepicktEvent {
  stockChanged = 'product.stockChanged',
  orderStatusChanged = 'order.statusChanged',
}
