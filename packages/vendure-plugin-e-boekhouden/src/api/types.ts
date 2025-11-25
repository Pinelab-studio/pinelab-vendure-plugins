import { RequestContext } from '@vendure/core';
import { Order } from '@vendure/core';

/**
 * Codes as defined in the e-Boekhouden documentation
 * https://cdn.e-boekhouden.nl/handleiding/Documentation_soap_english.pdf
 */
export type EBoekhoudenBTWCode =
  | 'HOOG_VERK'
  | 'HOOG_VERK_21'
  | 'LAAG_VERK'
  | 'LAAG_VERK_9'
  | 'LAAG_VERK_L9'
  | 'VERL_VERK_9'
  | 'VERL_VERK'
  | 'AFW'
  | 'BU_EU_VERK'
  | 'BI_EU_VERK'
  | 'BI_EU_VERK_D'
  | 'AFST_VERK'
  | 'LAAG_INK'
  | 'LAAG_INK_9'
  | 'VERL_INK_LG'
  | 'HOOG_INK'
  | 'HOOG_INK_21'
  | 'VERL_INK'
  | 'AFW_VERK'
  | 'BU_EU_INK'
  | 'BI_EU_INK'
  | 'GEEN';

export type GetTaxCodeFn = (
  ctx: RequestContext,
  order: Order,
  taxRate: number
) => EBoekhoudenBTWCode;

export interface EBoekhoudenOptions {
  getTaxCode: GetTaxCodeFn;
}
