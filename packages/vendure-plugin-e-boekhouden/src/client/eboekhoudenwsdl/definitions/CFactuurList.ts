import { Relatiecode } from './Relatiecode';
import { Regels } from './Regels';

/**
 * cFactuurList
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface CFactuurList {
  /** s:string */
  Factuurnummer?: string;
  /** Relatiecode */
  Relatiecode?: Relatiecode;
  /** s:dateTime */
  Datum?: string;
  /** s:long */
  Betalingstermijn?: string;
  /** s:double */
  TotaalExclBTW?: string;
  /** s:double */
  TotaalBTW?: string;
  /** s:double */
  TotaalInclBTW?: string;
  /** s:double */
  TotaalOpenstaand?: string;
  /** s:string */
  URLPDFBestand?: string;
  /** Regels */
  Regels?: Regels;
}
