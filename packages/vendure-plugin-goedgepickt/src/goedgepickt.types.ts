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
