import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, Order, RequestContext } from '@vendure/core';
import { AnonymizeOrderService } from './anonymized-order.service';

@Resolver()
export class AnonymizeOrderShopResolver {
  constructor(private readonly anonymizeOrderService: AnonymizeOrderService) {}

  @Query()
  async anonymizedOrder(
    @Ctx() ctx: RequestContext,
    @Args() args: { orderCode: string; emailAddress: string }
  ): Promise<Order | undefined> {
    return await this.anonymizeOrderService.anonymizedOrder(
      ctx,
      args.orderCode,
      args.emailAddress
    );
  }
}
