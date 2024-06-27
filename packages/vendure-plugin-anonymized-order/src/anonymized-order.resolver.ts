import { Args, Query, Resolver, Info } from '@nestjs/graphql';
import { Ctx, Order, RequestContext } from '@vendure/core';
import { AnonymizeOrderService } from './anonymized-order.service';

@Resolver()
export class AnonymizeOrderShopResolver {
  constructor(private readonly anonymizeOrderService: AnonymizeOrderService) {}

  @Query()
  async anonymizedOrder(
    @Ctx() ctx: RequestContext,
    @Args() args: { orderCode: string; emailAddress: string },
    @Info() info: any
  ): Promise<Order> {
    return await this.anonymizeOrderService.getAnonymizedOrder(
      ctx,
      args.orderCode,
      args.emailAddress
    );
  }
}
