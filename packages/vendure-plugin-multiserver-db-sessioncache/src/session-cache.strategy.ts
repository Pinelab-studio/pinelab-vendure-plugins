import {
  CachedSession,
  Injector,
  InternalServerError,
  Logger,
  SessionCacheStrategy,
} from '@vendure/core';
import { DataSource, Repository } from 'typeorm';
import { SessionCache } from './session-cache';

const loggerCtx = `MutliServerDbSessionCacheStrategy`;

export class MultiServerDbSessionCacheStrategy implements SessionCacheStrategy {
  multiServerDBSessionCache?: Repository<SessionCache>;
  init(injector: Injector) {
    this.multiServerDBSessionCache = injector
      .get(DataSource)
      .getRepository(SessionCache);
  }

  async get(sessionToken: string): Promise<CachedSession | undefined> {
    if (!this.multiServerDBSessionCache) {
      // Getting a cached session should not propagate the error to the client
      Logger.error(
        'MultiServerDbSessionCache repository not initialized',
        loggerCtx,
      );
      return;
    }
    const retrieved = await this.multiServerDBSessionCache.findOneBy({
      id: sessionToken,
    });
    return retrieved?.session;
  }

  async set(session: CachedSession) {
    if (!this.multiServerDBSessionCache) {
      Logger.error(
        'MultiServerDbSessionCache repository not initialized',
        loggerCtx,
      );
      return;
    }
    const sessionData = new SessionCache();
    sessionData.id = session.token;
    sessionData.session = session;
    await this.multiServerDBSessionCache
      .upsert(sessionData, ['id'])
      .catch((e: any) => {
        // Saving a cached session should not propagate the error to the client
        if (e instanceof Error) {
          Logger.error(e.message, loggerCtx, e.stack);
        } else {
          Logger.error(e, loggerCtx);
        }
      });
  }

  async delete(sessionToken: string) {
    if (!this.multiServerDBSessionCache) {
      Logger.error(
        'MultiServerDbSessionCache repository not initialized',
        loggerCtx,
      );
      return;
    }
    await this.multiServerDBSessionCache.delete({ id: sessionToken });
  }

  async clear() {
    if (this.multiServerDBSessionCache) {
      await this.multiServerDBSessionCache.delete({});
    }
  }
}
