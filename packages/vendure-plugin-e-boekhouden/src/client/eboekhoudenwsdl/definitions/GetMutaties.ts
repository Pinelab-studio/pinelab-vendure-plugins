import { CFilter3 } from './CFilter3';

/** GetMutaties */
export interface GetMutaties {
  /** s:string */
  SessionID?: string;
  /** s:string */
  SecurityCode2?: string;
  /** cFilter */
  cFilter?: CFilter3;
}
