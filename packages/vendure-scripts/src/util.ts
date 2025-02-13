import {
  ChannelAware,
  ID,
  Injector,
  Logger,
  RequestContext,
  TransactionalConnection,
  VendureEntity,
} from '@vendure/core';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { loggerCtx } from './constants';

export type GetEntityFunction<T> = (
  ctx: RequestContext,
  sourceChannelId: ID,
  injector: Injector,
  skip: number,
  take: number,
  condition?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
) => Promise<T[]>;

export async function assignEntitiesToChannel<
  T extends VendureEntity & ChannelAware
>(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  getEntityFn: GetEntityFunction<T>,
  batchSize: number
): Promise<void> {
  let totalCount = 0;
  const conn = injector.get(TransactionalConnection);
  let items: T[];
  await conn.startTransaction(ctx);
  do {
    items = await getEntityFn(
      ctx,
      sourceChannelId,
      injector,
      totalCount,
      batchSize
    );
    if (items.length) {
      const entity = items[0].constructor;
      await injector
        .get(DataSource)
        .getRepository(entity)
        .createQueryBuilder()
        .relation('channels')
        .of(items)
        .add(targetChannelId)
        .catch((e) => {
          Logger.error(
            `Error assigning ${entity.name}s ${totalCount}-${
              totalCount + batchSize - 1
            } to Channel`,
            loggerCtx
          );
          throw e;
        });
      totalCount += items.length;
    }
  } while (items.length);
  await conn.commitOpenTransaction(ctx);
}
