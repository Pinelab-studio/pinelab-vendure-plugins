import { ErrorMsg } from './ErrorMsg';
import { Relaties } from './Relaties';

/**
 * GetRelatiesResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetRelatiesResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Relaties */
  Relaties?: Relaties;
}
