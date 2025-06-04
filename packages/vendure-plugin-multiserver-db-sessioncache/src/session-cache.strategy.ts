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
  sessionRepository?: Repository<SessionCache>;
  init(injector: Injector) {
    this.sessionRepository = injector
      .get(DataSource)
      .getRepository(SessionCache);
  }

  async get(sessionToken: string): Promise<CachedSession | undefined> {
    if (!this.sessionRepository) {
      // Getting a cached session should not propagate the error to the client
      Logger.error(
        'MultiServerDbSessionCache repository not initialized',
        loggerCtx
      );
      return;
    }
    const retrieved = await this.sessionRepository.findOneBy({
      id: sessionToken,
    });
    return retrieved?.session;
  }

  async set(session: CachedSession) {
    if (!this.sessionRepository) {
      Logger.error(
        'MultiServerDbSessionCache repository not initialized',
        loggerCtx
      );
      return;
    }
    const sessionData = new SessionCache();
    sessionData.id = session.token;
    sessionData.session = session;
    await this.sessionRepository.upsert(sessionData, ['id']).catch((e: any) => {
      // Saving a cached session should not propagate the error to the client
      if (e instanceof Error) {
        Logger.error(e.message, loggerCtx, e.stack);
      } else {
        Logger.error(e, loggerCtx);
      }
    });
  }

  async delete(sessionToken: string) {
    if (!this.sessionRepository) {
      Logger.error(
        'MultiServerDbSessionCache repository not initialized',
        loggerCtx
      );
      return;
    }
    await this.sessionRepository.delete({ id: sessionToken });
  }

  async clear() {
    if (this.sessionRepository) {
      await this.sessionRepository.clear();
    }
  }
}
