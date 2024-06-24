import { Controller, Post, Body } from '@nestjs/common';
import { EventPayload } from '../types';
import { ShipmateService } from './shipmate.service';
import { RequestContext, Transaction, Ctx } from '@vendure/core';

@Controller('shipmate')
export class ShipmateController {
  constructor(private shipmentService: ShipmateService) {}
  @Post()
  async event(@Ctx() ctx: RequestContext, @Body() payload: EventPayload) {
    await this.shipmentService.updateOrderState(payload);
  }
}
