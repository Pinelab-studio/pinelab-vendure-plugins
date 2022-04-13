import { CFilter2 } from './CFilter2';

/** GetFacturen */
export interface GetFacturen {
  /** s:string */
  SessionID?: string;
  /** s:string */
  SecurityCode2?: string;
  /** cFilter */
  cFilter?: CFilter2;
}
