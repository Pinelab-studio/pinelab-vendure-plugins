import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  Order,
  Permission,
  RequestContext,
} from '@vendure/core';
import { ModifyCustomerOrderService } from './modify-customer-order.service';
@Resolver()
export class AdminApiResolver {
  constructor(
    private readonly modifyCustomerOrder: ModifyCustomerOrderService,
  ) {}

  @Mutation()
  @Allow(Permission.CreateOrder)
  async convertOrderToDraft(
    @Ctx() ctx: RequestContext,
    @Args('id') id: ID,
  ): Promise<Order> {
    return this.modifyCustomerOrder.transitionToDraftState(ctx, id);
  }
}
