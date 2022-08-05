/**
 * cFilter
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface CFilter3 {
  /** s:long */
  MutatieNr?: string;
  /** s:long */
  MutatieNrVan?: string;
  /** s:long */
  MutatieNrTm?: string;
  /** s:string */
  Factuurnummer?: string;
  /** s:dateTime */
  DatumVan?: string;
  /** s:dateTime */
  DatumTm?: string;
}
