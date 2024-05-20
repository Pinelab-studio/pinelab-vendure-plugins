import { Controller, Post, Body, HttpStatus } from '@nestjs/common';
import { EventPayload } from '../types';
import { Ctx, RequestContext } from '@vendure/core';
import { ShipmateService } from './shipmate.service';

@Controller('shipmate')
export class ShipmateController {
  constructor(private shipmentService: ShipmateService) {}
  @Post()
  event(@Ctx() ctx: RequestContext, @Body() payload: EventPayload) {
    return this.shipmentService.updateOrderState(ctx, payload);
  }
}
