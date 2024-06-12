import { CurrencyCode } from '@vendure/core';
import { CustomOrderFields } from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomOrderFields {
    shipmateReference: string;
  }
}

type JSONLike = {
  [key in string]: string;
};

export interface ShipmateUser {
  id: string;
  user_type: string;
  first_name: string;
  last_name: string;
  email: string;
  account_name: string;
  merchant_id: string;
}

export interface GetResponseTokenBody {
  username: string;
  password: string;
}

export interface GetTokenReponseData {
  token: string;
  user: ShipmateUser;
}

export interface GetTokenRespose {
  message: string;
  data: GetTokenReponseData;
}

export interface ValidationRules {
  is_required: boolean;
  min_length: number;
  max_length: number;
  regex: string;
  /**
   * Accepts comma separated, quote encapsulated (and escaped) list of options.
   */
  options: string;
  numeric_type: 'INT' | 'DECIMAL';
  min_value: number;
  max_value: number;
}

export interface ShipmateCustomFields {
  name: string;
  /**
   * 	The unique key for the Custom Field, used as the key in key => value pairs
   */
  key: string;
  /**
   * 	The entity on Shipmate this Custom Field is for.
   */
  entity: 'SHIPMENT' | 'PARCEL' | 'CONTACT' | 'SKU';
  data_type: 'NUMERIC' | 'TEXT' | 'BOOLEAN' | 'LIST';
  source: 'DIRECT' | 'FIXED' | 'MAPPED';
  mapped_to: string;
  default_value: string;
  data_validation_rules: ValidationRules;
}

export interface ShipmateAddress {
  name: string;
  company_name: string;
  telephone: string;
  email_address: string;
  line_1: string;
  line_2: string;
  line_3: string;
  city: string;
  county: string;
  postcode: string;
  /**
   * The two character ISO 3166-1 country code of the address
   */
  country: string;
}

export interface Items {
  /**
   * Used to link Items across multiple parcels.
   */
  item_line_id?: string;
  sku?: string;
  short_description?: string;
  full_description?: string;
  /**
   * Country of origin. Full name or ISO Alpha-2 code (e.g., "United Kingdom" or "GB").
   */
  country_of_origin?: string;
  harmonised_code?: string;
  /**
   * The weight of each item in grammes
   */
  item_weight?: number;
  /**
   * 	The value of each item in your account's base currency (2 d.p.).
   */
  item_value?: number;
  item_quantity?: number;
}

export interface ExportPurpose {
  gift: boolean;
  documents: boolean;
  sale_of_goods: boolean;
  commercial_sample: boolean;
  returned_goods: boolean;
  other: string;
}

export interface CustomsDeclarations {
  /**
   * Defaults to value on account
   */
  duty_method?: 'DAP' | 'DDP';
  /**
   * Defaults to Order Reference.
   */
  commercial_invoice_number?: string;
  /**
   * Defaults to 0.00.
   */
  insurance_value?: number;
  /**
   * Defaults to 0.00.
   */
  freight_value?: number;
  /**
   * Defaults to 0.00.
   */
  packing_value?: number;
  /**
   * Defaults to 0.00.
   */
  handling_value?: number;
  /**
   * Defaults to 0.00.
   */
  other_value?: number;
  /**
   * Defaults to 0.00.
   */
  currency_code?: CurrencyCode;
  /**
   * Defaults to 0.00.
   */
  export_license_number?: string;
  /**
   * Defaults to 0.00.
   */
  export_certificate_number?: string;
  /**
   * Accepts upto 10000 chars
   */
  other_export_comments?: string;
  export_purpose: ExportPurpose;
}

export interface Parcels {
  reference: string;
  packaging_type_key?: string;
  /**
   * The weight of the Parcel in grammes
   */
  weight: number;
  /**
   * The width of the Parcel in centimetres
   */
  width: number;
  /**
   * The length of the Parcel in centimetres
   */
  length: number;
  /**
   * The depth of the Parcel in centimetres
   */
  depth: number;
  /**
   * upto to 2 decimal places
   */
  value: string;
  items: Items[];
  customs_declaration?: CustomsDeclarations;
  custom_fields?: JSONLike;
}

export interface Shipment {
  shipment_reference: string;
  order_reference: string;
  delivery_service_key?: string;
  /**
   * If not provided, then your default location will be used
   */
  location_code?: string;
  /**
   * In YYYY-mm-dd HH:ii:ss format, default to current date
   */
  despatch_date?: string;
  to_address: ShipmateAddress;
  parcels: Parcels[];
  delivery_instructions: string;
  custom_fields?: JSONLike;
  /**
   * optional for domestic Shipments.
   */
  customs_declaration?: CustomsDeclarations;
  /**
   * optional for domestic Shipments.
   */
  recipient_vat_number?: string;
  /**
   * optional for domestic Shipments.
   */
  recipient_eori_number?: string;
  /**
   * Defaults to ZPL if omiited
   */
  format?: string;
  /**
   * Default value is false.
   */
  print_labels: boolean;
  /**
   * print_labels must be set to true when setting this attribute
   */
  print_to_user?: string;
}

export interface CreateShipmentResponse {
  message: string;
  data: NewShipment[];
}

export interface NewShipmentAddress {
  delivery_name: string;
  line_1: string;
  line_2: string;
  line_3: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
}

export interface NewShipment {
  shipment_reference: string;
  parcel_reference: string;
  carrier: string;
  service_name: string;
  tracking_reference: string;
  created_by: string;
  created_with: string;
  created_at: string;
  price: string;
  estimated_delivery_date: string;
  to_address: NewShipmentAddress;
  pdf: string;
  zpl: string;
  png: string;
}

//-----------Event Payloads---------------

export interface EventPayload {
  auth_token: string;
  request_token: string;
  event:
    | 'SHIPMENT_CREATED'
    | 'SHIPMENT_CANCELLED'
    | 'TRACKING_UPDATED'
    | 'TRACKING_COLLECTED'
    | 'TRACKING_IN_TRANSIT'
    | 'TRACKING_OUT_FOR_DELIVERY'
    | 'TRACKING_DELIVERED'
    | 'TRACKING_DELIVERY_FAILED';
  shipment_reference: string;
  source: string;
  order_reference: string;
  carrier: string;
  carrier_account: string;
}

export interface TrackingEventPayload extends EventPayload {
  parcel_reference: string;
  tracking_number: string;
  tracking_event_code: string;
  tracking_event_type: string;
  tracking_event_name: string;
  tracking_event_description: string;
  tracking_event_time: string;
  tracking_url: string;
  tracking_url_carrier: string;
}

export interface ShipmentEventPayload extends EventPayload {
  parcel_references: string;
  tracking_numbers: string;
}

export interface LabelEventPayload extends EventPayload {
  parcel_references: string;
  tracking_numbers: string;
  labels: string;
}
