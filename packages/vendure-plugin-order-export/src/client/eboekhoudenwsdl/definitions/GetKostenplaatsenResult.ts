import { ErrorMsg } from './ErrorMsg';
import { Kostenplaatsen } from './Kostenplaatsen';

/**
 * GetKostenplaatsenResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetKostenplaatsenResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Kostenplaatsen */
  Kostenplaatsen?: Kostenplaatsen;
}
