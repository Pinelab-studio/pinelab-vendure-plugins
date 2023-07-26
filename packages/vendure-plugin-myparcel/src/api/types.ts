import { OrderLine } from '@vendure/core';

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
