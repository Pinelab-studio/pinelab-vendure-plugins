import { Controller, Post, Body } from '@nestjs/common';
import { EventPayload } from '../types';
import { ShipmateService } from './shipmate.service';
import { RequestContext, Ctx, Logger } from '@vendure/core';
import { asError } from 'catch-unknown';

@Controller('shipmate')
export class ShipmateController {
  constructor(private shipmentService: ShipmateService) {}
  @Post()
  async event(@Ctx() ctx: RequestContext, @Body() payload: EventPayload) {
    try {
      await this.shipmentService.updateOrderState(payload);
    } catch (e) {
      Logger.error(
        `Shipmate Order state update failed with the message: ${
          asError(e).message
        }`
      );
    }
  }
}
