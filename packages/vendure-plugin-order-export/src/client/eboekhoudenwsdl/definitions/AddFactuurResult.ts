import { ErrorMsg } from './ErrorMsg';

/**
 * AddFactuurResult
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface AddFactuurResult {
  /** ErrorMsg */
  ErrorMsg?: ErrorMsg;
  /** s:string */
  Factuurnummer?: string;
}
