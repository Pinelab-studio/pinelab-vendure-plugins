import { Controller, Post, Body } from '@nestjs/common';
import { EventPayload } from '../types';
import { Ctx, RequestContext } from '@vendure/core';
import { ShipmateService } from './shipmate.service';

@Controller('shipmate')
export class ShipmateController {
  constructor(private shipmentService: ShipmateService) {}
  @Post()
  event(@Body() payload: EventPayload) {
    return this.shipmentService.updateOrderState(payload);
  }
}
