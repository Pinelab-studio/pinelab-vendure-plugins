import { CMutatieRegel } from './CMutatieRegel';

/**
 * MutatieRegels
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface MutatieRegels {
  /** cMutatieRegel[] */
  cMutatieRegel?: Array<CMutatieRegel>;
}
