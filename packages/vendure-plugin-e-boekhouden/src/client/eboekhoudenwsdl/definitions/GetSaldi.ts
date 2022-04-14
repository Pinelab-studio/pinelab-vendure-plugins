import { CFilter1 } from './CFilter1';

/** GetSaldi */
export interface GetSaldi {
  /** s:string */
  SessionID?: string;
  /** s:string */
  SecurityCode2?: string;
  /** cFilter */
  cFilter?: CFilter1;
}
