/**
 * cFactuurRegel
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface CFactuurRegel {
  /** s:double */
  Aantal?: string;
  /** s:string */
  Eenheid?: string;
  /** s:string */
  Code?: string;
  /** s:string */
  Omschrijving?: string;
  /** s:double */
  PrijsPerEenheid?: string;
  /** s:string */
  BTWCode?: string;
  /** s:string */
  TegenrekeningCode?: string;
  /** s:long */
  KostenplaatsID?: string;
}
