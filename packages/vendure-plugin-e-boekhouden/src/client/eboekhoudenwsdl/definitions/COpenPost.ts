/**
 * cOpenPost
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface COpenPost {
  /** s:dateTime */
  MutDatum?: string;
  /** s:string */
  MutFactuur?: string;
  /** s:string */
  RelCode?: string;
  /** s:string */
  RelBedrijf?: string;
  /** s:double */
  Bedrag?: string;
  /** s:double */
  Voldaan?: string;
  /** s:double */
  Openstaand?: string;
}
