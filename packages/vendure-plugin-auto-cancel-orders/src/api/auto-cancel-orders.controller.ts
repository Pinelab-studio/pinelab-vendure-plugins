import { Controller, Get } from '@nestjs/common';
import { Ctx, RequestContext } from '@vendure/core';
import { AutoCancelOrdersService } from 'service/auto-cancel-orders.service';

@Controller('auto-cancel-orders')
export class AutoCancelOrdersController {
  constructor(private autoCancelOrdersService: AutoCancelOrdersService) {}

  @Get('/cancel-orders/')
  async cancelOldOrders(@Ctx() ctx: RequestContext) {
    return this.autoCancelOrdersService.triggerCancelOrders(ctx);
  }
}
