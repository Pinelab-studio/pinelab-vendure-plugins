import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Logger,
  OrderService,
  Permission,
  RequestContext,
} from '@vendure/core';
import { SendcloudService } from './sendcloud.service';

@Resolver()
export class SendcloudResolver {
  constructor(
    private service: SendcloudService,
    private orderService: OrderService
  ) {}

  @Mutation()
  @Allow(Permission.UpdateOrder)
  async sendToSendcloud(
    @Ctx() ctx: RequestContext,
    @Args('orderId') orderId: string
  ): Promise<boolean> {
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new Error(`No order with id ${orderId} exists`);
    }
    Logger.info(
      `Sync to Sendcloud mutation called by user ${ctx.activeUserId} for order ${orderId}`
    );
    await this.service.syncToSendloud(ctx, order);
    return true;
  }
}
