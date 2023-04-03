export interface ProductInput {
  name: string;
  idvatgroup: number;
  productcode: string;
  price: number;
  description?: string;
}

export interface ProductResponse {
  idproduct: number;
  idvatgroup: number;
  idsupplier: any;
  productcode: string;
  name: string;
  price: number;
  fixedstockprice: number;
  productcode_supplier: string;
  deliverytime: any;
  description: any;
  barcode: any;
  unlimitedstock: boolean;
  weight: any;
  length: any;
  width: any;
  height: any;
  stock: any[];
}

export interface VatGroup {
  idvatgroup: number;
  name: string;
  percentage: number;
}
