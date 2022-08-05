/**
 * cMutatieListRegel
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface CMutatieListRegel {
  /** s:decimal */
  BedragInvoer?: string;
  /** s:decimal */
  BedragExclBTW?: string;
  /** s:decimal */
  BedragBTW?: string;
  /** s:decimal */
  BedragInclBTW?: string;
  /** s:string */
  BTWCode?: string;
  /** s:decimal */
  BTWPercentage?: string;
  /** s:string */
  Factuurnummer?: string;
  /** s:string */
  TegenrekeningCode?: string;
  /** s:long */
  KostenplaatsID?: string;
}
