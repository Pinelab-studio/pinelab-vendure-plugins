import { VendurePlugin } from '@vendure/core';
import { MultiServerDbSessionCache } from './session-cache';
import { MultiServerDbSessionCacheStrategy } from './session-cache.strategy';

@VendurePlugin({
  entities: [MultiServerDbSessionCache],
  configuration: (config) => {
    config.authOptions.sessionCacheStrategy =
      new MultiServerDbSessionCacheStrategy();
    return config;
  },
})
export class MultiServerDbSessionCachePlugin {}
