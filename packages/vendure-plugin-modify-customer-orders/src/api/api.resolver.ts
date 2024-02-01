import { Resolver, Mutation, Args } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  RequestContext,
  Permission,
  OrderService,
  ID,
  UserInputError,
  Order,
  assertFound,
  Logger,
} from '@vendure/core';
import { loggerCtx } from '../constants';
@Resolver()
export class AdminApiResolver {
  constructor(private readonly orderService: OrderService) {}

  @Mutation()
  @Allow(Permission.CreateOrder)
  async convertOrderToDraft(
    @Ctx() ctx: RequestContext,
    @Args('id') id: ID
  ): Promise<Order> {
    const order = await this.orderService.findOne(ctx, id);
    if (order?.state !== 'AddingItems') {
      throw new UserInputError(
        `Only active orders can be changed to a draft order`
      );
    }
    const transitionlResult = await this.orderService.transitionToState(
      ctx,
      id,
      'Draft'
    );
    if (transitionlResult instanceof Order) {
      Logger.info(
        `Transitioned Order with id ${transitionlResult.id} from 'AddingItems' to 'Draft'`,
        loggerCtx
      );
      return await assertFound(
        this.orderService.findOne(ctx, transitionlResult.id)
      );
    }
    Logger.error(
      `Failed to transition Order with id ${id} to 'Draft' state`,
      loggerCtx
    );
    throw transitionlResult;
  }
}
