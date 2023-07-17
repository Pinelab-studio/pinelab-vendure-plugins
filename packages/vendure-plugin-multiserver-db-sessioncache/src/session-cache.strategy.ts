import {
  CachedSession,
  Injector,
  InternalServerError,
  Logger,
  SessionCacheStrategy,
} from '@vendure/core';
import { DataSource, Repository } from 'typeorm';
import { MultiServerDbSessionCache } from './session-cache';

const loggerCtx = `MutliServerDbSessionCacheStrategy`;

export class MultiServerDbSessionCacheStrategy implements SessionCacheStrategy {
  multiServerDBSessionCache?: Repository<MultiServerDbSessionCache>;
  init(injector: Injector) {
    this.multiServerDBSessionCache = injector
      .get(DataSource)
      .getRepository(MultiServerDbSessionCache);
  }

  async get(sessionToken: string): Promise<CachedSession | undefined> {
    if (!this.multiServerDBSessionCache) {
      throw new InternalServerError(
        'MultiServerDbSessionCache repository not initialized'
      );
    }
    const retrieved = await this.multiServerDBSessionCache
      .createQueryBuilder('multiServerDBSessionCache')
      .where({ id: sessionToken })
      .getOne();
    if (retrieved) {
      Logger.debug(
        `Cache hit for session '${sessionToken}' last updated at ${retrieved.updatedAt}`,
        loggerCtx
      );
    } else {
      Logger.debug(`No cache hit for session '${sessionToken}'`, loggerCtx);
    }
    return retrieved?.session;
  }

  async set(session: CachedSession) {
    if (!this.multiServerDBSessionCache) {
      throw new InternalServerError(
        'MultiServerDbSessionCache repository not initialized'
      );
    }
    const sessionData = new MultiServerDbSessionCache();
    sessionData.id = session.token;
    sessionData.session = session;
    await this.multiServerDBSessionCache.save(sessionData);
  }

  async delete(sessionToken: string) {
    if (!this.multiServerDBSessionCache) {
      throw new InternalServerError(
        'MultiServerDbSessionCache repository not initialized'
      );
    }
    await this.multiServerDBSessionCache.delete({ id: sessionToken });
  }

  async clear() {
    if (this.multiServerDBSessionCache) {
      await this.multiServerDBSessionCache.delete({});
    }
  }
}
