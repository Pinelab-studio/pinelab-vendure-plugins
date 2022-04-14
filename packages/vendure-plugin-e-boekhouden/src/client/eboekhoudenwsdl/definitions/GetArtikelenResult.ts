import { ErrorMsg } from './ErrorMsg';
import { Artikelen } from './Artikelen';

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
