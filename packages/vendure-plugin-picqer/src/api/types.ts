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

export interface CustomerData {
  idcustomer: number;
  idtemplate: any;
  customerid: string;
  name: string;
  contactname: string;
  telephone: string;
  emailaddress: string;
  discount: number;
  vatnumber: string;
  calculatevat: boolean;
  default_order_remarks: string;
  auto_split: boolean;
  language: string;
  addresses: AddressData[];
}

export interface AddressData {
  idcustomer_address: number;
  name: string;
  contactname: any;
  address: string;
  address2: any;
  zipcode: string;
  city: string;
  region: any;
  country: string;
  defaultinvoice: boolean;
  defaultdelivery: boolean;
}

export interface CustomerInput {
  name: string;
  contactname?: string;
  telephone?: string;
  emailaddress?: string;
  addresses?: AddressInput[];
}

export interface AddressInput {
  name: string;
  address?: string;
  zipcode?: string;
  city?: string;
  region?: any;
  country?: string;
  defaultinvoice?: boolean;
  defaultdelivery?: boolean;
}

export interface OrderData {
  idorder: number;
  idcustomer: number;
  idtemplate: number;
  idshippingprovider_profile: any;
  orderid: string;
  deliveryname: string;
  deliverycontactname: string;
  deliveryaddress: string;
  deliveryaddress2: any;
  deliveryzipcode: string;
  deliverycity: string;
  deliveryregion: any;
  deliverycountry: string;
  full_delivery_address: string;
  invoicename: string;
  invoicecontactname: string;
  invoiceaddress: string;
  invoiceaddress2: any;
  invoicezipcode: string;
  invoicecity: string;
  invoiceregion: any;
  invoicecountry: string;
  full_invoice_address: string;
  telephone: any;
  emailaddress: any;
  reference: any;
  customer_remarks: any;
  pickup_point_data: any;
  partialdelivery: boolean;
  auto_split: boolean;
  invoiced: boolean;
  preferred_delivery_date: any;
  discount: number;
  calculatevat: boolean;
  status: string;
  public_status_page: string;
  created: string;
  updated: string;
  warehouses: number[];
  products: Product[];
  pricelists: number[];
}

export interface Product {
  idorder_product: number;
  idproduct: number;
  idvatgroup: number;
  productcode: string;
  name: string;
  remarks: string;
  price: number;
  amount: number;
  amount_cancelled: number;
  weight: number;
  partof_idorder_product: any;
  has_parts: boolean;
}

export interface OrderInput {
  idcustomer?: number;
  reference: string;
  emailaddress: string;
  telephone: string;
  deliveryname: string;
  deliverycontactname?: string;
  deliveryaddress?: string;
  deliveryaddress2?: string;
  deliveryzipcode?: string;
  deliverycity?: string;
  deliveryregion?: string;
  deliverycountry?: string;
  invoicename: string;
  invoicecontactname?: string;
  invoiceaddress?: string;
  invoiceaddress2?: any;
  invoicezipcode?: string;
  invoicecity?: string;
  invoiceregion?: string;
  invoicecountry?: string;
  products: OrderProductInput[];
}

export interface OrderProductInput {
  idproduct: number;
  amount: number;
}

export interface PickListWebhookData {
  idpicklist: number;
  picklistid: string;
  idcustomer: number;
  idorder: number;
  idreturn: any;
  idwarehouse: number;
  idtemplate: number;
  idshippingprovider_profile: any;
  deliveryname: string;
  deliverycontact: string;
  deliveryaddress: string;
  deliveryaddress2: any;
  deliveryzipcode: string;
  deliverycity: any;
  deliveryregion: any;
  deliverycountry: string;
  telephone: string;
  emailaddress: string;
  reference: string;
  assigned_to_iduser: any;
  invoiced: boolean;
  urgent: boolean;
  preferred_delivery_date: any;
  status: string;
  totalproducts: number;
  totalpicked: number;
  snoozed_until: any;
  closed_by_iduser: number;
  closed_at: string;
  created: string;
  updated: string;
  products: PickListProductData[];
  comment_count: number;
}

export interface PickListProductData {
  idpicklist_product: number;
  idproduct: number;
  idorder_product: number;
  idreturn_product_replacement: any;
  idvatgroup: number;
  productcode: string;
  name: string;
  remarks: any;
  amount: number;
  amountpicked: number;
  amount_picked: number;
  price: number;
  weight: number;
  stocklocation: string;
  stock_location: string;
  partof_idpicklist_product: any;
  has_parts: boolean;
  pick_locations: PickLocation[];
}

export interface PickLocation {
  idlocation: number;
  name: string;
  amount: number;
}

export interface WebhookInput {
  name: string;
  event: 'orders.completed';
  address: string;
  secret: string;
}

// ------------- Webhook types ------------

export interface OrderCompletedWebhook {
  idhook: number
  name: 'orders.completed'
  event: string
  event_triggered_at: string
  data: Data
}

export interface Data {
  idorder: number
  idcustomer: number
  orderid: string
  deliveryname: string
  deliverycontactname: string
  deliveryaddress: string
  deliveryaddress2: any
  deliveryzipcode: string
  deliverycity: string
  deliveryregion: any
  deliverycountry: string
  invoicename: string
  invoicecontactname: string
  invoiceaddress: string
  invoiceaddress2: any
  invoicezipcode: string
  invoicecity: string
  invoiceregion: any
  invoicecountry: string
  reference: string
  partialdelivery: boolean
  discount: number
  status: string
  public_status_page: string
  created: string
  updated: string
  products: Product[]
  tags: Tags
  orderfields: Orderfield[]
}

export interface Product {
  idproduct: number
  idvatgroup: number
  productcode: string
  name: string
  remarks: string
  price: number
  amount: number
  weight: number
}

export interface Tags {
  TopWebshop: TopWebshop
  SummerProducts: SummerProducts
}

export interface TopWebshop {
  idtag: number
  title: string
  color: string
  inherit: boolean
  textColor: string
}

export interface SummerProducts {
  idtag: number
  title: string
  color: string
  inherit: boolean
  textColor: string
}

export interface Orderfield {
  idorderfield: number
  title: string
  value: string
}
