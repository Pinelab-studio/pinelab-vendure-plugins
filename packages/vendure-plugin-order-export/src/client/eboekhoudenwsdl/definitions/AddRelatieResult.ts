import { ErrorMsg } from './ErrorMsg';

/**
 * AddRelatieResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface AddRelatieResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** s:long */
  Rel_ID?: string;
}
