import { ErrorMsg } from './ErrorMsg';
import { Facturen } from './Facturen';

/**
 * GetFacturenResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetFacturenResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Facturen */
  Facturen?: Facturen;
}
