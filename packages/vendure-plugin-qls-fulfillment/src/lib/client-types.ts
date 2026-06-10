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
  /**
   * Main EAN of the product
   */
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
  barcodes: Array<{
    id: number;
    fulfillment_product_id: string;
    company_id: string;
    barcode: string;
    created: string;
    modified: string;
  }>;
  image_url_handheld: string | null;
  /**
   * All EANs of the product, including the main EAN
   */
  barcodes_and_ean: string[];
  warehouse_stocks?: unknown[];
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
  delivery_options: { tag: string }[];
}

export interface FulfillmentOrderReceiverContactInput {
  name: string;
  companyname?: string;
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

/**
 * This is the full data returend by the QLS API when fetching a fulfillment product by ID
 * Getting via list, sku or filtering does NOT return this full object
 */
export interface FulfillmentProductDetail {
  data: Data;
  meta: Meta;
  errors: any[];
  pagination: any;
}

export interface Data {
  id: string;
  company_id: string;
  collection_id: any;
  dimensions: Dimensions;
  article_number: any;
  ean: string;
  name: string;
  sku: string;
  image_url: string;
  country_code_of_origin: any;
  hs_code: any;
  need_barcode_picking: boolean;
  need_best_before_stock: boolean;
  need_serial_number: boolean;
  amount_available: number;
  amount_reserved: number;
  amount_total: number;
  price_cost: number;
  price_store: any;
  weight: number;
  created: string;
  modified: string;
  foldable: boolean;
  fulfillment_product_brand_id: string;
  description: any;
  amount_blocked: number;
  status: any;
  bundles: any[];
  product_brand: ProductBrand;
  product_values: ProductValue[];
  suppliers: Supplier[];
  vas: Va[];
  product_master_cartons: any[];
  product_measurements: ProductMeasurement[];
  barcodes: any[];
  warehouse_stock_transfers: WarehouseStockTransfer[];
  bundle_products: any[];
  warehouse_stocks: WarehouseStock[];
  mappings: Mapping[];
  order_unit: any;
  image_url_handheld: string;
  barcodes_and_ean: string[];
}

export interface Dimensions {
  length: string;
  width: string;
  height: string;
}

export interface ProductBrand {
  id: string;
  company_id: string;
  name: string;
}

export interface ProductValue {
  id: number;
  fulfillment_product_id: string;
  key: string;
  value: string;
}

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  _joinData: JoinData;
}

export interface JoinData {
  id: number;
  fulfillment_product_id: string;
  supplier_id: string;
  supplier_code: any;
}

export interface Va {
  id: number;
  fulfillment_product_id: string;
  vas_id: number;
  value_added_service: ValueAddedService;
}

export interface ValueAddedService {
  id: number;
  short: string;
  name: string;
  type_id: number;
  price: number;
  description: string;
  entity_type?: string;
  entity_id?: number;
  company_id: any;
  enabled: boolean;
  parent_id: any;
  sort: number;
  visible: boolean;
  setting: Setting;
  vas_type: VasType;
}

export interface Setting {
  use_for_tote_hash: number;
}

export interface VasType {
  id: number;
  short: string;
  name: string;
  description: any;
  type: string;
  info_text?: string;
}

export interface ProductMeasurement {
  id: string;
  product_id: string;
  dimensions: Dimensions2;
  weight: number;
  product_measurementscol: any;
  creator: string;
  creator_company_id?: string;
  creator_user_id?: string;
  created: string;
  creator_user?: CreatorUser;
}

export interface Dimensions2 {
  length: string;
  width: string;
  height: string;
}

export interface CreatorUser {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  permissions: any;
  created: string;
  modified: string;
  language_id: number;
  personnel_number: string;
  has_beta_version: boolean;
  password_changed: string;
  remember_token: string;
  email_verified_at: any;
}

export interface WarehouseStockTransfer {
  id: string;
  company_id: string;
  product_id: string;
  source_stock_id: any;
  amount_total: number;
  amount_transferred: number;
  remarks: any;
  source: string;
  status: string;
  created: string;
  modified: string;
  best_before: any;
  fulfillment_product_batch_id: any;
  creator_user_id: string;
  purchase_order_label_product_id: any;
  purchase_order_label_product: any;
  warehouse_stock_transfer_box_mappings: WarehouseStockTransferBoxMapping[];
  creator: Creator;
  company: Company;
  amount_pending: number;
}

export interface WarehouseStockTransferBoxMapping {
  id: string;
  box_id: string;
  transfer_id: string;
  created: string;
  modified: string;
  deleted: any;
  warehouse_box: WarehouseBox;
}

export interface WarehouseBox {
  id: string;
  company_id: string;
  trolley_id: any;
  warehouse_id: number;
  type_id: any;
  code: string;
  position: any;
  created: string;
  modified: string;
  deleted: any;
  prefix: string;
}

export interface Creator {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  permissions: any;
  created: string;
  modified: string;
  language_id: number;
  personnel_number: any;
  has_beta_version: boolean;
  password_changed: string;
  remember_token: string;
  email_verified_at: any;
}

export interface Company {
  id: string;
  tenant_id: string;
  affiliate_id: any;
  name: string;
  anonymous_name: string;
  invoice_contact_id: string;
  active: boolean;
  shipments_last_7_days: number;
  legacy_shipments_last_7_days: number;
  heavy_shipments: boolean;
  default_user_role_id: string;
  financial_relation_id: string;
  has_employee: boolean;
  has_fulfillment: boolean;
  has_route: boolean;
  has_signed_gdpr: boolean;
  pickup_timeframe_start: any;
  pickup_timeframe_end: any;
  fulfillment_average_handling_time: any;
  outstanding_invoices_status: string;
  outstanding_invoices_amount: number;
  legal_companyname: any;
  legal_coc: any;
  legal_vat: any;
  onboarding_status: string;
  status: string;
  created: string;
  modified: string;
  deleted: any;
  price_change: any;
  auto_secondwave: boolean;
  priority_support: boolean;
  mollie_customer_id: any;
  company_group_id: any;
  test: boolean;
  enable_software_charge: boolean;
}

export interface WarehouseStock {
  id: number;
  product_id: string;
  autostore_bin_id: string;
  zone_id: number;
  row_number: string;
  rack_number: string;
  shelf_number: string;
  number: string;
  amount_current: number;
  amount_reserved: number;
  best_before: any;
  created: string;
  modified: string;
  deleted: any;
  best_before_cutoff: any;
  blocked: any;
  autostore_bin: AutostoreBin;
  warehouse_zone: WarehouseZone;
  product_batch: any[];
  amount_available: number;
  code: string;
  code_formatted: string;
  is_changed_for_replenishment: boolean;
  location: string;
}

export interface AutostoreBin {
  id: string;
  autostore_id: string;
  autostore_bin_id: number;
  autostore_bin_layout_id: string;
  zone_id: number;
  content_code: string;
  bin_type: number;
  created?: string;
  modified: string;
  deleted: any;
  depth: number;
  xpos: number;
  ypos: number;
  transferred_in: string;
  mode: string;
}

export interface WarehouseZone {
  id: number;
  company_id: string;
  name: string;
  pickable: boolean;
  flip_row_numbers: boolean;
  warehouse_id: number;
  batchable: boolean;
  isolated: boolean;
  autostore_id: string;
  has_pallets: boolean;
  block_reservation_after: any;
  warehouse_zone_group_id: any;
  has_quarantine: boolean;
  partially_replenishment_allowed: boolean;
  allow_automatic_replenishment: boolean;
  company: Company2;
}

export interface Company2 {
  id: string;
  tenant_id: string;
  affiliate_id: any;
  name: string;
  anonymous_name: string;
  invoice_contact_id: string;
  active: boolean;
  shipments_last_7_days: number;
  legacy_shipments_last_7_days: number;
  heavy_shipments: boolean;
  default_user_role_id: string;
  financial_relation_id: string;
  has_employee: boolean;
  has_fulfillment: boolean;
  has_route: boolean;
  has_signed_gdpr: boolean;
  pickup_timeframe_start: any;
  pickup_timeframe_end: any;
  fulfillment_average_handling_time: any;
  outstanding_invoices_status: string;
  outstanding_invoices_amount: number;
  legal_companyname: any;
  legal_coc: any;
  legal_vat: any;
  onboarding_status: string;
  status: string;
  created: string;
  modified: string;
  deleted: any;
  price_change: any;
  auto_secondwave: boolean;
  priority_support: boolean;
  mollie_customer_id: any;
  company_group_id: any;
  test: boolean;
  enable_software_charge: boolean;
}

export interface Mapping {
  id: string;
  product_id: string;
  shop_integration_id: string;
  shop_integration_reference: string;
  shop_integration_reference2: string;
  stock: number;
  sync_stock: boolean;
  created: string;
  modified: string;
  deleted: any;
  synced: string;
  exception_count: number;
  name: string;
  ean: string;
  sku: string;
  shop_integration: ShopIntegration;
}

export interface ShopIntegration {
  id: string;
  company_id: string;
  brand_id: string;
  type_id: number;
  name: string;
  created: string;
  modified: string;
  deleted: any;
  last_imported: string;
  last_imported_order_insights: any;
  last_imported_shipment_insights: any;
  last_imported_purchase_order: any;
  fulfillment_sync_orders: boolean;
  fulfillment_sync_products: boolean;
  fulfillment_sync_stock: boolean;
  fulfillment_sync_purchase_orders: boolean;
  fulfillment_product_create_new: boolean;
  fulfillment_product_match_by_name: boolean;
  fulfillment_product_match_by_ean: boolean;
  fulfillment_product_match_by_sku: boolean;
  fulfillment_product_match_fields: string;
  last_imported_products: any;
  exception_count_importing_products: number;
}

export interface Meta {
  code: number;
}
