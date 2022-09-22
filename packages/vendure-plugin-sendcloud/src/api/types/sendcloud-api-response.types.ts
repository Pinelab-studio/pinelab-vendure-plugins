export interface Parcel {
  id: number;
  name: string;
  company_name: string;
  address: string;
  address_divided: AddressDivided;
  city: string;
  postal_code: string;
  telephone: string;
  email: string;
  date_created: string;
  date_updated: string;
  date_announced: string;
  tracking_number: string;
  weight: string;
  label: Label;
  customs_declaration: CustomsDeclaration;
  status: Status;
  data: any[];
  country: Country;
  shipment: Shipment;
  colli_tracking_number: string;
  colli_uuid: string;
  collo_nr: number;
  collo_count: number;
  awb_tracking_number: null;
  box_number: null;
  order_number?: string;
}

export interface AddressDivided {
  street: string;
  house_number: string;
}

export interface Country {
  iso_3: string;
  iso_2: string;
  name: string;
}

export interface CustomsDeclaration {}

export interface Label {
  normal_printer: string[];
  label_printer: string;
}

export interface Shipment {
  id: number;
  name: string;
}

export interface Status {
  id: number;
  message: string;
}

export interface IncomingWebhookBody {
  action: 'parcel_status_changed' | string;
  timestamp: number;
  parcel?: Parcel;
}
