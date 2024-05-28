import { Controller, Post, Body, Res } from '@nestjs/common';
import { EventPayload } from '../types';
import { ShipmateService } from './shipmate.service';
import { Response } from 'express';

@Controller('shipmate')
export class ShipmateController {
  constructor(private shipmentService: ShipmateService) {}
  @Post()
  async event(@Res() res: Response, @Body() payload: EventPayload) {
    await this.shipmentService.updateOrderState(payload, res);
  }
}
