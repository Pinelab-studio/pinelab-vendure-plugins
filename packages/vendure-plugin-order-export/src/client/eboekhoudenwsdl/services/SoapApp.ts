import { SoapAppSoap } from '../ports/SoapAppSoap';
import { SoapAppSoap12 } from '../ports/SoapAppSoap12';

export interface SoapApp {
  readonly SoapAppSoap: SoapAppSoap;
  readonly SoapAppSoap12: SoapAppSoap12;
}
