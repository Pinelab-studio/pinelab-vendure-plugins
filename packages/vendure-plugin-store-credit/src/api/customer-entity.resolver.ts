import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  RequestContext,
  Customer,
  TransactionalConnection,
} from '@vendure/core';
import { Wallet } from '../entities/wallet.entity';

@Resolver('Customer')
export class CustomerEntityResolver {
  constructor(private connection: TransactionalConnection) {}

  @ResolveField()
  wallets(
    @Ctx() ctx: RequestContext,
    @Parent() customer: Customer
  ): Promise<Wallet[]> {
    return this.connection.getRepository(ctx, Wallet).find({
      where: { customer: { id: customer.id } },
      relations: ['ledgerEntries'],
    });
  }
}
