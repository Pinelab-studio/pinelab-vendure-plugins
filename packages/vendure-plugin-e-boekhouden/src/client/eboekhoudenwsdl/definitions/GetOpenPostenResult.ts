import { ErrorMsg } from './ErrorMsg';
import { Openposten } from './Openposten';

/**
 * GetOpenPostenResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetOpenPostenResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Openposten */
  Openposten?: Openposten;
}
