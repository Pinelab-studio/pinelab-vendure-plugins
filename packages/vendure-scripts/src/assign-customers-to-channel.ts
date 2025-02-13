import {
  Customer,
  ID,
  Injector,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { IsNull } from 'typeorm';
import { assignEntitiesToChannel } from './util';

export async function assignCustomersToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  await assignEntitiesToChannel<Customer>(
    sourceChannelId,
    targetChannelId,
    injector,
    ctx,
    getCustomers,
    batch
  );
}

function getCustomers(
  ctx: RequestContext,
  sourceChanneId: ID,
  injector: Injector,
  skip: number = 0,
  take: number = 10
): Promise<Customer[]> {
  console.log(`Getting customers ${skip} to ${take + skip}`);
  const conn = injector.get(TransactionalConnection);
  const customerRepo = conn.getRepository(ctx, Customer);
  return customerRepo
    .createQueryBuilder('customer')
    .innerJoin('customer.channels', 'channel')
    .select('customer.id')
    .setFindOptions({
      take,
      skip,
      where: {
        deletedAt: IsNull(),
        channels: {
          id: sourceChanneId,
        },
      },
    })
    .getMany();
}
