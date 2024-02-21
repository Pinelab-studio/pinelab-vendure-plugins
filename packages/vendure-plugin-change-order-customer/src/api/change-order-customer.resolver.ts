import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  Order,
  Permission,
  RequestContext,
  Transaction,
} from '@vendure/core';
import { CreateCustomerInput } from '@vendure/common/lib/generated-types';
import { ChangeOrderCustomerService } from './change-order-customer.service';
@Resolver()
export class ChangeOrderCustomerResolver {
  constructor(private readonly service: ChangeOrderCustomerService) {}

  @Mutation()
  @Transaction()
  @Allow(Permission.UpdateOrder)
  async setCustomerForOrder(
    @Ctx() ctx: RequestContext,
    @Args()
    {
      orderId,
      customerId,
      input,
    }: { orderId: ID; customerId?: ID; input?: CreateCustomerInput }
  ): Promise<Order> {
    return await this.service.setCustomerForOrder(
      ctx,
      orderId,
      customerId || input
    );
  }
}
