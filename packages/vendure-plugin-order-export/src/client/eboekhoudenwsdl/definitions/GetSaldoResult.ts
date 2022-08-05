import { ErrorMsg } from './ErrorMsg';

/**
 * GetSaldoResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetSaldoResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** s:double */
  Saldo?: string;
}
