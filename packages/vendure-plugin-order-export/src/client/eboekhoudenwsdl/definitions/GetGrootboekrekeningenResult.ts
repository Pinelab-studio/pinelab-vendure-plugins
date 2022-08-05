import { ErrorMsg } from './ErrorMsg';
import { Rekeningen } from './Rekeningen';

/**
 * GetGrootboekrekeningenResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetGrootboekrekeningenResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Rekeningen */
  Rekeningen?: Rekeningen;
}
