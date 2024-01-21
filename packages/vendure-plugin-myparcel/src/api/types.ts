import { Order, OrderLine } from '@vendure/core';
import { OrderAddress } from '@vendure/common/lib/generated-types';
import { GraphQLError } from 'graphql';

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export interface MyparcelConfig {
  vendureHost: string;
  /**
   * Update webhook in MyParcel platform on Vendure startup or not
   */
  syncWebhookOnStartup?: boolean;
  /**
   * If you ship outside the EU, you should implement this function to get
   * {@link CustomsInformation} per order item
   */
  getCustomsInformationFn?: (orderLine: OrderLine) => CustomsInformation;
  shipmentStrategy: MyParcelShipmentStrategy;
}

/**
 * Customs information per item for overseas shipping
 * https://myparcelnl.github.io/api/#7_E
 */
export interface CustomsInformation {
  /**
   * Weight in grams per unit
   */
  weightInGrams: number;
  /**
   * International Standard Industry Classification
   */
  classification: string;
  /**
   * Country of origin. Has to be a capitalized country code, I.E. 'NL'
   */
  countryCodeOfOrigin: string;
}

export interface MyparcelRecipient {
  cc: string;
  region?: string;
  city: string;
  street: string;
  number: string;
  number_suffix?: string;
  postal_code: string;
  person: string;
  phone?: string;
  email?: string;
}

export interface MyparcelShipmentOptions {
  package_type: number;
  label_description?: string;
}

export interface CustomsDeclaration {
  contents: string | number;
  invoice: string;
  weight: number;
  items: CustomsItem[];
}

export interface ItemValue {
  amount: number;
  currency: string;
}

export interface CustomsItem {
  description: string;
  amount: number;
  weight: number;
  item_value: ItemValue;
  classification: string;
  country: string;
}

export interface MyparcelShipment {
  carrier: number;
  reference_identifier?: string;
  recipient: MyparcelRecipient;
  options: MyparcelShipmentOptions;
  customs_declaration?: CustomsDeclaration;
  physical_properties?: {
    weight: number;
  };
}

export interface MyParcelShipmentStrategy {
  getShipment: (
    address: OrderAddress,
    order: Order,
    customsContent: string
  ) => MyparcelShipment;
}

export class MyParcelError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'MY_PARCEL_ERROR' } });
  }
}
