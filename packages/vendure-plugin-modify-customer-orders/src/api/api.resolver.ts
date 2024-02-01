import { Resolver, Mutation, Args } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  RequestContext,
  Permission,
  ID,
  Order,
} from '@vendure/core';
import { ModifyCustomerOrderService } from './modify-customer-order.service';
@Resolver()
export class AdminApiResolver {
  constructor(
    private readonly modifyCustomerOrder: ModifyCustomerOrderService
  ) {}

  @Mutation()
  @Allow(Permission.CreateOrder)
  async convertOrderToDraft(
    @Ctx() ctx: RequestContext,
    @Args('id') id: ID
  ): Promise<Order> {
    return this.modifyCustomerOrder.transitionToDraftState(ctx, id);
  }
}
