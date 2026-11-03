import { raw } from 'body-parser';

/**
 * Reads every request body under `/order-integration/` as raw bytes, whatever its
 * Content-Type, so strategies can verify signatures over the exact bytes received.
 * Package-local on purpose: importing `packages/util` would move the build output.
 */
export const rawBodyMiddleware = raw({ type: () => true });
