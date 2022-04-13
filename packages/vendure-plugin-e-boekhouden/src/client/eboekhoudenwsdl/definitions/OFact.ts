import { Regels } from './Regels';

/**
 * oFact
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface OFact {
  /** s:string */
  Factuurnummer?: string;
  /** s:string */
  Relatiecode?: string;
  /** s:dateTime */
  Datum?: string;
  /** s:long */
  Betalingstermijn?: string;
  /** s:string */
  Factuursjabloon?: string;
  /** s:boolean */
  PerEmailVerzenden?: string;
  /** s:string */
  EmailOnderwerp?: string;
  /** s:string */
  EmailBericht?: string;
  /** s:string */
  EmailVanAdres?: string;
  /** s:string */
  EmailVanNaam?: string;
  /** s:boolean */
  AutomatischeIncasso?: string;
  /** s:string */
  IncassoIBAN?: string;
  /** s:string */
  IncassoMachtigingSoort?: string;
  /** s:string */
  IncassoMachtigingID?: string;
  /** s:dateTime */
  IncassoMachtigingDatumOndertekening?: string;
  /** s:boolean */
  IncassoMachtigingFirst?: string;
  /** s:string */
  IncassoRekeningNummer?: string;
  /** s:string */
  IncassoTnv?: string;
  /** s:string */
  IncassoPlaats?: string;
  /** s:string */
  IncassoOmschrijvingRegel1?: string;
  /** s:string */
  IncassoOmschrijvingRegel2?: string;
  /** s:string */
  IncassoOmschrijvingRegel3?: string;
  /** s:boolean */
  InBoekhoudingPlaatsen?: string;
  /** s:string */
  BoekhoudmutatieOmschrijving?: string;
  /** Regels */
  Regels?: Regels;
}
