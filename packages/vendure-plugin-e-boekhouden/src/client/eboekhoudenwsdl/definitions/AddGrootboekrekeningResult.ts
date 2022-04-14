import { ErrorMsg } from './ErrorMsg';

/**
 * AddGrootboekrekeningResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface AddGrootboekrekeningResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** s:long */
  Gb_ID?: string;
}
