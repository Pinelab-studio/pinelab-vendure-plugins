import { ErrorMsg } from './ErrorMsg';

/**
 * AddMutatieResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface AddMutatieResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** s:long */
  Mutatienummer?: string;
}
