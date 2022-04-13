import { CFactuurList } from './CFactuurList';

/**
 * Facturen
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Facturen {
  /** cFactuurList[] */
  cFactuurList?: Array<CFactuurList>;
}
