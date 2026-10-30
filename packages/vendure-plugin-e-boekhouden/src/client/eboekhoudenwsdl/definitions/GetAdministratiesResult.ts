import { Administraties } from './Administraties';
import { ErrorMsg } from './ErrorMsg';

/**
 * GetAdministratiesResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetAdministratiesResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Administraties */
  Administraties?: Administraties;
}
