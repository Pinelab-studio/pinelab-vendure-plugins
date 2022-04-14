import { ORel } from './ORel';

/** AddRelatie */
export interface AddRelatie {
  /** s:string */
  SessionID?: string;
  /** s:string */
  SecurityCode2?: string;
  /** oRel */
  oRel?: ORel;
}
