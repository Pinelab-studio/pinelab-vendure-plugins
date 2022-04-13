/**
 * cArtikel
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface CArtikel {
  /** s:long */
  ArtikelID?: string;
  /** s:string */
  ArtikelOmschrijving?: string;
  /** s:string */
  ArtikelCode?: string;
  /** s:string */
  GroepOmschrijving?: string;
  /** s:string */
  GroepCode?: string;
  /** s:string */
  Eenheid?: string;
  /** s:decimal */
  InkoopprijsExclBTW?: string;
  /** s:decimal */
  VerkoopprijsExclBTW?: string;
  /** s:decimal */
  VerkoopprijsInclBTW?: string;
  /** s:string */
  BTWCode?: string;
  /** s:string */
  TegenrekeningCode?: string;
  /** s:decimal */
  BtwPercentage?: string;
  /** s:long */
  KostenplaatsID?: string;
  /** s:boolean */
  Actief?: string;
}
