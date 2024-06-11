import { Controller, Post, Body } from '@nestjs/common';
import { EventPayload } from '../types';
import { ShipmateService } from './shipmate.service';
import { Transaction } from '@vendure/core';

@Controller('shipmate')
export class ShipmateController {
  constructor(private shipmentService: ShipmateService) {}
  @Transaction()
  @Post()
  async event(@Body() payload: EventPayload) {
    await this.shipmentService.updateOrderState(payload);
  }
}
