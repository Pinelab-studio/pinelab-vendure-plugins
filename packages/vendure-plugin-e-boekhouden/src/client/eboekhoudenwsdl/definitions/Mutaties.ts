import { CMutatieList } from './CMutatieList';

/**
 * Mutaties
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Mutaties {
  /** cMutatieList[] */
  cMutatieList?: Array<CMutatieList>;
}
