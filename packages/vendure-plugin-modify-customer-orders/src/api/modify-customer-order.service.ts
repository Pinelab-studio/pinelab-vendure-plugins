import { Injectable } from '@nestjs/common';
import {
  ID,
  Logger,
  Order,
  OrderService,
  RequestContext,
  UserInputError,
  assertFound,
} from '@vendure/core';
import { loggerCtx } from '../constants';

@Injectable()
export class ModifyCustomerOrderService {
  constructor(private readonly orderService: OrderService) {}
  async transitionToDraftState(ctx: RequestContext, id: ID) {
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
