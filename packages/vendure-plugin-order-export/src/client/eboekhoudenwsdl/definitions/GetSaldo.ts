import { CFilter } from './CFilter';

/** GetSaldo */
export interface GetSaldo {
  /** s:string */
  SessionID?: string;
  /** s:string */
  SecurityCode2?: string;
  /** cFilter */
  cFilter?: CFilter;
}
