import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Logger } from '@vendure/core';
import { loggerCtx } from '../constants';
import { PicqerService } from './picqer.service';
import { IncomingProductWebhook } from './types';

@Controller('picqer')
export class PicqerController {
  constructor(private picqerService: PicqerService) {}

  @Post('hooks/:channelToken')
  async webhook(
    @Req() req: Request,
    @Body() body: IncomingProductWebhook,
    @Headers('X-Picqer-Signature') signature: string,
    @Param('channelToken') channelToken: string
  ): Promise<void> {
    const rawBody = (req as any).rawBody || JSON.stringify(body);
    // TODO
  }
}
