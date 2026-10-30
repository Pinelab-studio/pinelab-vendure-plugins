import { Body, Controller, Post } from '@nestjs/common';
import { Ctx, Logger, RequestContext } from '@vendure/core';
import { asError } from 'catch-unknown';
import { EventPayload } from '../types';
import { ShipmateService } from './shipmate.service';

@Controller('shipmate')
export class ShipmateController {
  constructor(private shipmentService: ShipmateService) {}
  @Post()
  async event(@Ctx() _ctx: RequestContext, @Body() payload: EventPayload) {
    try {
      await this.shipmentService.updateOrderState(payload);
    } catch (e) {
      Logger.error(
        `Shipmate Order state update failed with the message: ${
          asError(e).message
        }`,
      );
    }
  }
}
