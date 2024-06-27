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
import { loggerCtx } from '../constants';

export type GetEntityFunction<T> = (
  ctx: RequestContext,
  sourceChannelId: ID,
  injector: Injector,
  batch: number,
  skip: number,
  condition?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
) => Promise<T[]>;

export async function assignEntitiesToChannel<
  T extends VendureEntity & ChannelAware
>(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  getEntity: GetEntityFunction<T>,
  batch: number,
  condition?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
): Promise<void> {
  let totalCount = 0;
  const conn = injector.get(TransactionalConnection);
  let items: T[];
  await conn.startTransaction(ctx);
  do {
    items = await getEntity(
      ctx,
      sourceChannelId,
      injector,
      batch,
      totalCount,
      condition
    );
    if (items.length) {
      await injector
        .get(DataSource)
        .getRepository(items[0].constructor)
        .createQueryBuilder()
        .relation('channels')
        .of(items)
        .add(targetChannelId)
        .catch((e) => {
          Logger.error(`Error assigning customers to Channel`, loggerCtx);
          throw e;
        });
      totalCount += items.length;
    }
  } while (items.length);
  await conn.commitOpenTransaction(ctx);
}
