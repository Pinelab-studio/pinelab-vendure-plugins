import { ErrorMsg } from './ErrorMsg';
import { Mutaties } from './Mutaties';

/**
 * GetMutatiesResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetMutatiesResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Mutaties */
  Mutaties?: Mutaties;
}
