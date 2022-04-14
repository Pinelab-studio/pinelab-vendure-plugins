import { CFilter4 } from './CFilter4';

/** GetGrootboekrekeningen */
export interface GetGrootboekrekeningen {
  /** s:string */
  SessionID?: string;
  /** s:string */
  SecurityCode2?: string;
  /** cFilter */
  cFilter?: CFilter4;
}
