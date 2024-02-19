import { GetAdministraties } from '../definitions/GetAdministraties';
import { GetAdministratiesResponse } from '../definitions/GetAdministratiesResponse';
import { GetSaldo } from '../definitions/GetSaldo';
import { GetSaldoResponse } from '../definitions/GetSaldoResponse';
import { GetSaldi } from '../definitions/GetSaldi';
import { GetSaldiResponse } from '../definitions/GetSaldiResponse';
import { AddFactuur } from '../definitions/AddFactuur';
import { AddFactuurResponse } from '../definitions/AddFactuurResponse';
import { GetFacturen } from '../definitions/GetFacturen';
import { GetFacturenResponse } from '../definitions/GetFacturenResponse';
import { AddMutatie } from '../definitions/AddMutatie';
import { AddMutatieResponse } from '../definitions/AddMutatieResponse';
import { GetMutaties } from '../definitions/GetMutaties';
import { GetMutatiesResponse } from '../definitions/GetMutatiesResponse';
import { AddGrootboekrekening } from '../definitions/AddGrootboekrekening';
import { AddGrootboekrekeningResponse } from '../definitions/AddGrootboekrekeningResponse';
import { UpdateGrootboekrekening } from '../definitions/UpdateGrootboekrekening';
import { UpdateGrootboekrekeningResponse } from '../definitions/UpdateGrootboekrekeningResponse';
import { GetGrootboekrekeningen } from '../definitions/GetGrootboekrekeningen';
import { GetGrootboekrekeningenResponse } from '../definitions/GetGrootboekrekeningenResponse';
import { AddRelatie } from '../definitions/AddRelatie';
import { AddRelatieResponse } from '../definitions/AddRelatieResponse';
import { UpdateRelatie } from '../definitions/UpdateRelatie';
import { UpdateRelatieResponse } from '../definitions/UpdateRelatieResponse';
import { GetRelaties } from '../definitions/GetRelaties';
import { GetRelatiesResponse } from '../definitions/GetRelatiesResponse';
import { GetOpenPosten } from '../definitions/GetOpenPosten';
import { GetOpenPostenResponse } from '../definitions/GetOpenPostenResponse';
import { OpenSession } from '../definitions/OpenSession';
import { OpenSessionResponse } from '../definitions/OpenSessionResponse';
import { OpenSessionSub } from '../definitions/OpenSessionSub';
import { OpenSessionSubResponse } from '../definitions/OpenSessionSubResponse';
import { CloseSession } from '../definitions/CloseSession';
import { CloseSessionResponse } from '../definitions/CloseSessionResponse';
import { AutoLogin } from '../definitions/AutoLogin';
import { AutoLoginResponse } from '../definitions/AutoLoginResponse';
import { GetKostenplaatsen } from '../definitions/GetKostenplaatsen';
import { GetKostenplaatsenResponse } from '../definitions/GetKostenplaatsenResponse';
import { GetArtikelen } from '../definitions/GetArtikelen';
import { GetArtikelenResponse } from '../definitions/GetArtikelenResponse';

export interface SoapAppSoap12 {
  GetAdministraties(
    getAdministraties: GetAdministraties,
    callback: (
      err: any,
      result: GetAdministratiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetSaldo(
    getSaldo: GetSaldo,
    callback: (
      err: any,
      result: GetSaldoResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetSaldi(
    getSaldi: GetSaldi,
    callback: (
      err: any,
      result: GetSaldiResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  AddFactuur(
    addFactuur: AddFactuur,
    callback: (
      err: any,
      result: AddFactuurResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetFacturen(
    getFacturen: GetFacturen,
    callback: (
      err: any,
      result: GetFacturenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  AddMutatie(
    addMutatie: AddMutatie,
    callback: (
      err: any,
      result: AddMutatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetMutaties(
    getMutaties: GetMutaties,
    callback: (
      err: any,
      result: GetMutatiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  AddGrootboekrekening(
    addGrootboekrekening: AddGrootboekrekening,
    callback: (
      err: any,
      result: AddGrootboekrekeningResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  UpdateGrootboekrekening(
    updateGrootboekrekening: UpdateGrootboekrekening,
    callback: (
      err: any,
      result: UpdateGrootboekrekeningResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetGrootboekrekeningen(
    getGrootboekrekeningen: GetGrootboekrekeningen,
    callback: (
      err: any,
      result: GetGrootboekrekeningenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  AddRelatie(
    addRelatie: AddRelatie,
    callback: (
      err: any,
      result: AddRelatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  UpdateRelatie(
    updateRelatie: UpdateRelatie,
    callback: (
      err: any,
      result: UpdateRelatieResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetRelaties(
    getRelaties: GetRelaties,
    callback: (
      err: any,
      result: GetRelatiesResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetOpenPosten(
    getOpenPosten: GetOpenPosten,
    callback: (
      err: any,
      result: GetOpenPostenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  OpenSession(
    openSession: OpenSession,
    callback: (
      err: any,
      result: OpenSessionResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  OpenSessionSub(
    openSessionSub: OpenSessionSub,
    callback: (
      err: any,
      result: OpenSessionSubResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  CloseSession(
    closeSession: CloseSession,
    callback: (
      err: any,
      result: CloseSessionResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  AutoLogin(
    autoLogin: AutoLogin,
    callback: (
      err: any,
      result: AutoLoginResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetKostenplaatsen(
    getKostenplaatsen: GetKostenplaatsen,
    callback: (
      err: any,
      result: GetKostenplaatsenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
  GetArtikelen(
    getArtikelen: GetArtikelen,
    callback: (
      err: any,
      result: GetArtikelenResponse,
      rawResponse: any,
      soapHeader: any,
      rawRequest: any,
    ) => void,
  ): void;
}
