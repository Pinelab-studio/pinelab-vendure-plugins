import { CAdministratie } from './CAdministratie';

/**
 * Administraties
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Administraties {
  /** cAdministratie[] */
  cAdministratie?: Array<CAdministratie>;
}
