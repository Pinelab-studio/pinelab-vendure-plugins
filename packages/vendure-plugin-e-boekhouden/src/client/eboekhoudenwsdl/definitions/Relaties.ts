import { ORel } from './ORel';

/**
 * Relaties
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Relaties {
  /** cRelatie[] */
  cRelatie?: Array<ORel>;
}
