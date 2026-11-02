import * as http from 'node:http';
import { raw } from 'body-parser';
import type { Request } from 'express';

export interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}
/**
 * Middleware which adds the raw request body to the incoming message object. This is needed by
 * Stripe to properly verify webhook events.
 */
export const rawBodyMiddleware = raw({
  type: '*/*',
  verify(
    req: RequestWithRawBody,
    _res: http.ServerResponse,
    buf: Buffer,
    _encoding: string,
  ) {
    if (Buffer.isBuffer(buf)) {
      req.rawBody = Buffer.from(buf);
    }
    return true;
  },
});
