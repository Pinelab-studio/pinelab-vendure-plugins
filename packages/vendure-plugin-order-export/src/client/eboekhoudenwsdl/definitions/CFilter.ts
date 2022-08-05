/**
 * cFilter
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface CFilter {
  /** s:string */
  GbCode?: string;
  /** s:long */
  KostenPlaatsId?: string;
  /** s:dateTime */
  DatumVan?: string;
  /** s:dateTime */
  DatumTot?: string;
}
