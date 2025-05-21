import { Controller, Get } from '@nestjs/common';
import { Ctx, RequestContext } from '@vendure/core';
import { AutoCancelOrdersService } from '../service/auto-cancel-orders.service';

@Controller('cancel-stale-orders')
export class AutoCancelOrdersController {
  constructor(private autoCancelOrdersService: AutoCancelOrdersService) {}

  @Get('trigger')
  async cancelOldOrders(@Ctx() ctx: RequestContext) {
    return await this.autoCancelOrdersService.triggerCancelOrders(ctx);
  }
}
