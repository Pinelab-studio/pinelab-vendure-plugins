import {
  CachedSession,
  InternalServerError,
  Logger,
  SessionCacheStrategy,
  TransactionalConnection,
  UserInputError,
  Injector,
} from '@vendure/core';
import { DataSource, Repository } from 'typeorm';
import { MultiServerDbSessionCache } from './session-cache';
export class MultiServerDbSessionCacheStrategy implements SessionCacheStrategy {
  conn?: TransactionalConnection;
  dataSource?: DataSource;
  multiServerDBSessionCache?: Repository<MultiServerDbSessionCache>;
  init(injector: Injector) {
    this.dataSource = injector.get(DataSource);
    this.multiServerDBSessionCache = this.dataSource.getRepository(
      MultiServerDbSessionCache
    );
  }

  async get(sessionToken: string): Promise<CachedSession | undefined> {
    if (!this.multiServerDBSessionCache) {
      throw new InternalServerError(
        'MultiServerDbSessionCache repository not initialized'
      );
    }
    const retrieved = await this.multiServerDBSessionCache
      .createQueryBuilder('multiServerDBSessionCache')
      .where('multiServerDBSessionCache.sessionToken = :sessionToken ', {
        sessionToken,
      })
      .getOne();
    return retrieved?.session;
  }

  async set(session: CachedSession) {
    if (!this.multiServerDBSessionCache) {
      throw new InternalServerError(
        'MultiServerDbSessionCache repository not initialized'
      );
    }
    const sessionData = new MultiServerDbSessionCache();
    sessionData.sessionToken = session.token;
    sessionData.session = session;
    await this.multiServerDBSessionCache.save(sessionData);
  }

  async delete(sessionToken: string) {
    if (!this.multiServerDBSessionCache) {
      throw new InternalServerError(
        'MultiServerDbSessionCache repository not initialized'
      );
    }
    await this.multiServerDBSessionCache.delete({ sessionToken });
  }

  async clear() {
    if (this.multiServerDBSessionCache) {
      await this.multiServerDBSessionCache.delete({});
    }
  }
}
