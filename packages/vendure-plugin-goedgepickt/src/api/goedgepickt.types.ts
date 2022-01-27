export interface GoedgepicktPluginConfig {
  configPerChannel: ClientConfig[];
}

/**
 * Channel specific configs like apiKey and webshopUuid per channel
 */
export interface ClientConfig {
  channelToken: string;
  apiKey: string;
  webshopUuid: string;
  /**
   * Key for validating incoming order status webhooks
   */
  orderWebhookKey: string;
  /**
   * * Key for validating incoming stock update webhooks
   */
  stockWebhookKey: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  productId: string;
  stockManagement: boolean;
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
  createDate: Date;
  finishDate?: Date;
  orderStatus: OrderStatus;
  orderItems: OrderItemInput[];
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
