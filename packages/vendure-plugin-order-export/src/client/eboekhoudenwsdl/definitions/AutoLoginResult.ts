import { ErrorMsg } from './ErrorMsg';

/**
 * AutoLoginResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface AutoLoginResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** s:string */
  Token?: string;
}
