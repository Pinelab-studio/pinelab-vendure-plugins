import { VendurePlugin } from '@vendure/core';
import { SessionCache } from './session-cache';
import { MultiServerDbSessionCacheStrategy } from './session-cache.strategy';

@VendurePlugin({
  entities: [SessionCache],
  configuration: (config) => {
    config.authOptions.sessionCacheStrategy =
      new MultiServerDbSessionCacheStrategy();
    return config;
  },
  compatibility: '>=2.2.0',
})
export class MultiServerDbSessionCachePlugin {}
