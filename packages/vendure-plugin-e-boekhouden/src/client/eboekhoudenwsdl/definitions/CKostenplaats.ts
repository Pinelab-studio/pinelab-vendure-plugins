/**
 * cKostenplaats
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface CKostenplaats {
  /** s:long */
  KostenplaatsId?: string;
  /** s:string */
  Omschrijving?: string;
  /** s:long */
  KostenplaatsParentId?: string;
}
