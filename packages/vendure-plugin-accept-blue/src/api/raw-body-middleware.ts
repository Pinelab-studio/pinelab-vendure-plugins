import { raw } from 'body-parser';
import * as http from 'http';
import { RequestWithRawBody } from '../types';

/**
 * Middleware which adds the raw request body to the incoming message object. This is needed by
 * Authorizenet to properly verify webhook events.
 */
export const rawBodyMiddleware = raw({
  type: '*/*',
  verify(
    req: RequestWithRawBody,
    res: http.ServerResponse,
    buf: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    encoding: string
  ) {
    if (Buffer.isBuffer(buf)) {
      req.rawBody = Buffer.from(buf);
    }
    return true;
  },
});
