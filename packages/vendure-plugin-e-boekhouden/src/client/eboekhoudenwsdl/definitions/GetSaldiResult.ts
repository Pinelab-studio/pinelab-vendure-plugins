import { ErrorMsg } from './ErrorMsg';
import { Saldi } from './Saldi';

/**
 * GetSaldiResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetSaldiResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Saldi */
  Saldi?: Saldi;
}
