import { Controller, Get } from '@nestjs/common';
import { Ctx, RequestContext } from '@vendure/core';
import { OrderCleanupService } from '../service/order-cleanup.service';

@Controller('order-cleanup')
export class OrderCleanupController {
  constructor(private orderCleanupService: OrderCleanupService) {}

  @Get('trigger')
  async cancelOldOrders(@Ctx() ctx: RequestContext) {
    return await this.orderCleanupService.triggerCancelOrders(ctx);
  }
}
