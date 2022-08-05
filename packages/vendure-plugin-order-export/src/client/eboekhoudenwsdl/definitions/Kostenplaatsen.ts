import { CKostenplaats } from './CKostenplaats';

/**
 * Kostenplaatsen
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Kostenplaatsen {
  /** cKostenplaats[] */
  cKostenplaats?: Array<CKostenplaats>;
}
