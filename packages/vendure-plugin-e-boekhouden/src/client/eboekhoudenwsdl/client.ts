import {
  Client as SoapClient,
  createClientAsync as soapCreateClientAsync,
} from 'soap';
import { GetAdministraties } from './definitions/GetAdministraties';
import { GetAdministratiesResponse } from './definitions/GetAdministratiesResponse';
import { GetSaldo } from './definitions/GetSaldo';
import { GetSaldoResponse } from './definitions/GetSaldoResponse';
import { GetSaldi } from './definitions/GetSaldi';
import { GetSaldiResponse } from './definitions/GetSaldiResponse';
import { AddFactuur } from './definitions/AddFactuur';
import { AddFactuurResponse } from './definitions/AddFactuurResponse';
import { GetFacturen } from './definitions/GetFacturen';
import { GetFacturenResponse } from './definitions/GetFacturenResponse';
import { AddMutatie } from './definitions/AddMutatie';
import { AddMutatieResponse } from './definitions/AddMutatieResponse';
import { GetMutaties } from './definitions/GetMutaties';
import { GetMutatiesResponse } from './definitions/GetMutatiesResponse';
import { AddGrootboekrekening } from './definitions/AddGrootboekrekening';
import { AddGrootboekrekeningResponse } from './definitions/AddGrootboekrekeningResponse';
import { UpdateGrootboekrekening } from './definitions/UpdateGrootboekrekening';
import { UpdateGrootboekrekeningResponse } from './definitions/UpdateGrootboekrekeningResponse';
import { GetGrootboekrekeningen } from './definitions/GetGrootboekrekeningen';
import { GetGrootboekrekeningenResponse } from './definitions/GetGrootboekrekeningenResponse';
import { AddRelatie } from './definitions/AddRelatie';
import { AddRelatieResponse } from './definitions/AddRelatieResponse';
import { UpdateRelatie } from './definitions/UpdateRelatie';
import { UpdateRelatieResponse } from './definitions/UpdateRelatieResponse';
import { GetRelaties } from './definitions/GetRelaties';
import { GetRelatiesResponse } from './definitions/GetRelatiesResponse';
import { GetOpenPosten } from './definitions/GetOpenPosten';
import { GetOpenPostenResponse } from './definitions/GetOpenPostenResponse';
import { OpenSession } from './definitions/OpenSession';
import { OpenSessionResponse } from './definitions/OpenSessionResponse';
import { OpenSessionSub } from './definitions/OpenSessionSub';
import { OpenSessionSubResponse } from './definitions/OpenSessionSubResponse';
import { CloseSession } from './definitions/CloseSession';
import { CloseSessionResponse } from './definitions/CloseSessionResponse';
import { AutoLogin } from './definitions/AutoLogin';
import { AutoLoginResponse } from './definitions/AutoLoginResponse';
import { GetKostenplaatsen } from './definitions/GetKostenplaatsen';
import { GetKostenplaatsenResponse } from './definitions/GetKostenplaatsenResponse';
import { GetArtikelen } from './definitions/GetArtikelen';
import { GetArtikelenResponse } from './definitions/GetArtikelenResponse';
import { SoapApp } from './services/SoapApp';

export interface EBoekhoudenWsdlClient extends SoapClient {
  SoapApp: SoapApp;
  GetAdministratiesAsync(
    getAdministraties: GetAdministraties,
  ): Promise<
    [
      result: GetAdministratiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetSaldoAsync(
    getSaldo: GetSaldo,
  ): Promise<
    [
      result: GetSaldoResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetSaldiAsync(
    getSaldi: GetSaldi,
  ): Promise<
    [
      result: GetSaldiResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddFactuurAsync(
    addFactuur: AddFactuur,
  ): Promise<
    [
      result: AddFactuurResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetFacturenAsync(
    getFacturen: GetFacturen,
  ): Promise<
    [
      result: GetFacturenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddMutatieAsync(
    addMutatie: AddMutatie,
  ): Promise<
    [
      result: AddMutatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetMutatiesAsync(
    getMutaties: GetMutaties,
  ): Promise<
    [
      result: GetMutatiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddGrootboekrekeningAsync(
    addGrootboekrekening: AddGrootboekrekening,
  ): Promise<
    [
      result: AddGrootboekrekeningResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  UpdateGrootboekrekeningAsync(
    updateGrootboekrekening: UpdateGrootboekrekening,
  ): Promise<
    [
      result: UpdateGrootboekrekeningResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetGrootboekrekeningenAsync(
    getGrootboekrekeningen: GetGrootboekrekeningen,
  ): Promise<
    [
      result: GetGrootboekrekeningenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddRelatieAsync(
    addRelatie: AddRelatie,
  ): Promise<
    [
      result: AddRelatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  UpdateRelatieAsync(
    updateRelatie: UpdateRelatie,
  ): Promise<
    [
      result: UpdateRelatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetRelatiesAsync(
    getRelaties: GetRelaties,
  ): Promise<
    [
      result: GetRelatiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetOpenPostenAsync(
    getOpenPosten: GetOpenPosten,
  ): Promise<
    [
      result: GetOpenPostenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  OpenSessionAsync(
    openSession: OpenSession,
  ): Promise<
    [
      result: OpenSessionResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  OpenSessionSubAsync(
    openSessionSub: OpenSessionSub,
  ): Promise<
    [
      result: OpenSessionSubResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  CloseSessionAsync(
    closeSession: CloseSession,
  ): Promise<
    [
      result: CloseSessionResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AutoLoginAsync(
    autoLogin: AutoLogin,
  ): Promise<
    [
      result: AutoLoginResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetKostenplaatsenAsync(
    getKostenplaatsen: GetKostenplaatsen,
  ): Promise<
    [
      result: GetKostenplaatsenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetArtikelenAsync(
    getArtikelen: GetArtikelen,
  ): Promise<
    [
      result: GetArtikelenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetAdministratiesAsync(
    getAdministraties: GetAdministraties,
  ): Promise<
    [
      result: GetAdministratiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetSaldoAsync(
    getSaldo: GetSaldo,
  ): Promise<
    [
      result: GetSaldoResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetSaldiAsync(
    getSaldi: GetSaldi,
  ): Promise<
    [
      result: GetSaldiResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddFactuurAsync(
    addFactuur: AddFactuur,
  ): Promise<
    [
      result: AddFactuurResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetFacturenAsync(
    getFacturen: GetFacturen,
  ): Promise<
    [
      result: GetFacturenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddMutatieAsync(
    addMutatie: AddMutatie,
  ): Promise<
    [
      result: AddMutatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetMutatiesAsync(
    getMutaties: GetMutaties,
  ): Promise<
    [
      result: GetMutatiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddGrootboekrekeningAsync(
    addGrootboekrekening: AddGrootboekrekening,
  ): Promise<
    [
      result: AddGrootboekrekeningResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  UpdateGrootboekrekeningAsync(
    updateGrootboekrekening: UpdateGrootboekrekening,
  ): Promise<
    [
      result: UpdateGrootboekrekeningResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetGrootboekrekeningenAsync(
    getGrootboekrekeningen: GetGrootboekrekeningen,
  ): Promise<
    [
      result: GetGrootboekrekeningenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AddRelatieAsync(
    addRelatie: AddRelatie,
  ): Promise<
    [
      result: AddRelatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  UpdateRelatieAsync(
    updateRelatie: UpdateRelatie,
  ): Promise<
    [
      result: UpdateRelatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetRelatiesAsync(
    getRelaties: GetRelaties,
  ): Promise<
    [
      result: GetRelatiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetOpenPostenAsync(
    getOpenPosten: GetOpenPosten,
  ): Promise<
    [
      result: GetOpenPostenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  OpenSessionAsync(
    openSession: OpenSession,
  ): Promise<
    [
      result: OpenSessionResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  OpenSessionSubAsync(
    openSessionSub: OpenSessionSub,
  ): Promise<
    [
      result: OpenSessionSubResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  CloseSessionAsync(
    closeSession: CloseSession,
  ): Promise<
    [
      result: CloseSessionResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  AutoLoginAsync(
    autoLogin: AutoLogin,
  ): Promise<
    [
      result: AutoLoginResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetKostenplaatsenAsync(
    getKostenplaatsen: GetKostenplaatsen,
  ): Promise<
    [
      result: GetKostenplaatsenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
  GetArtikelenAsync(
    getArtikelen: GetArtikelen,
  ): Promise<
    [
      result: GetArtikelenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ]
  >;
}

/** Create EBoekhoudenWsdlClient */
export function createClientAsync(
  ...args: Parameters<typeof soapCreateClientAsync>
): Promise<EBoekhoudenWsdlClient> {
  return soapCreateClientAsync(args[0], args[1], args[2]) as any;
}
