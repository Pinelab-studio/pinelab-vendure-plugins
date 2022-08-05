import { OFact } from './OFact';

/** AddFactuur */
export interface AddFactuur {
  /** s:string */
  SessionID?: string;
  /** s:string */
  SecurityCode2?: string;
  /** oFact */
  oFact?: OFact;
}
