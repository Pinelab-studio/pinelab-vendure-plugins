import { ErrorMsg } from './ErrorMsg';
import { Administraties } from './Administraties';

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
