import { ErrorMsg } from './ErrorMsg';

/**
 * OpenSessionResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface OpenSessionResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** s:string */
  SessionID?: string;
}
