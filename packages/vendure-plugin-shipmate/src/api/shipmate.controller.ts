import { Controller, Post, Body, HttpStatus } from '@nestjs/common';
import { EventPayload } from '../types';

@Controller('shipmate')
export class ShipmateController {
  @Post()
  event(@Body() payload: EventPayload) {
    return HttpStatus.OK;
  }
}
