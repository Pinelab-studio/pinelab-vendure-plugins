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
import { sendcloudPermission } from './index';
import { SendcloudConfigEntity } from './sendcloud-config.entity';

@Resolver()
export class SendcloudResolver {
  constructor(
    private service: SendcloudService,
    private orderService: OrderService
  ) {}

  @Mutation()
  @Allow(Permission.UpdateOrder)
  async sendToSendCloud(
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

  @Mutation()
  @Allow(sendcloudPermission.Permission)
  async updateSendCloudConfig(
    @Ctx() ctx: RequestContext,
    @Args('secret') secret: string,
    @Args('publicKey') publicKey: string
  ): Promise<SendcloudConfigEntity> {
    return this.service.upsertConfig(ctx, { secret, publicKey });
  }
}
