import { CSaldo } from './CSaldo';

/**
 * Saldi
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Saldi {
  /** cSaldo[] */
  cSaldo?: Array<CSaldo>;
}
