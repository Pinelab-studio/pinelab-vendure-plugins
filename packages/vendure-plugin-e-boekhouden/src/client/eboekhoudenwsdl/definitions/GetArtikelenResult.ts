import { Artikelen } from './Artikelen';
import { ErrorMsg } from './ErrorMsg';

/**
 * GetArtikelenResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface GetArtikelenResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** Artikelen */
  Artikelen?: Artikelen;
}
