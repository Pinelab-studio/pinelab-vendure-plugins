import { MutatieRegels } from './MutatieRegels';

/**
 * oMut
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface OMut {
  /** s:long */
  MutatieNr?: string;
  /** enMutatieSoorten|s:string|OpeningsSaldo,FactuurOntvangen,FactuurVerstuurd,FactuurbetalingOntvangen,FactuurbetalingVerstuurd,GeldOntvangen,GeldUitgegeven,Memoriaal */
  Soort?: string;
  /** s:dateTime */
  Datum?: string;
  /** s:string */
  Rekening?: string;
  /** s:string */
  RelatieCode?: string;
  /** s:string */
  Factuurnummer?: string;
  /** s:string */
  Boekstuk?: string;
  /** s:string */
  Omschrijving?: string;
  /** s:string */
  Betalingstermijn?: string;
  /** s:string */
  Betalingskenmerk?: string;
  /** s:string */
  InExBTW?: string;
  /** MutatieRegels */
  MutatieRegels?: MutatieRegels;
}
