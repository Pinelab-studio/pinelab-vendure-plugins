import bodyParser from 'body-parser';
import { Middleware } from '@vendure/core';

/**
 * Set req.rawBody before any other middleware changes the body. Used to verify incoming request signatures for example.
 * @param route
 */
export function createRawBodyMiddleWare(route: string): Middleware {
  return {
    route,
    beforeListen: true,
    handler: bodyParser.json({
      verify(req, _, buf) {
        if (Buffer.isBuffer(buf)) {
          (req as any).rawBody = Buffer.from(buf);
        }
        return true;
      },
    }),
  };
}
