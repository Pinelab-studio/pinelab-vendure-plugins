import {
  Customer,
  ID,
  Injector,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { IsNull } from 'typeorm';
export function getCustomers(
  ctx: RequestContext,
  sourceChanneId: ID,
  injector: Injector,
  take: number = 10,
  skip: number = 0
): Promise<Customer[]> {
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
