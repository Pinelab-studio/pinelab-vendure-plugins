import { OGb } from './OGb';

/**
 * Rekeningen
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Rekeningen {
  /** cGrootboekrekening[] */
  cGrootboekrekening?: Array<OGb>;
}
