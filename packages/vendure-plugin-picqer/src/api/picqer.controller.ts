import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { Request } from 'express';
import { loggerCtx } from '../constants';
import { PicqerService } from './picqer.service';
import { IncomingWebhook } from './types';
import util from 'util';

@Controller('picqer')
export class PicqerController {
  constructor(private picqerService: PicqerService) {}

  @Post('hooks/:channelToken')
  async webhook(
    @Req() req: Request,
    @Body() body: IncomingWebhook,
    @Headers('X-Picqer-Signature') signature: string,
    @Param('channelToken') channelToken: string
  ): Promise<void> {
    Logger.info(
      `Incoming hook ${body.event} for channel ${channelToken}`,
      loggerCtx
    );
    // Middleware isn't loaded when using the test server from @vendure/testing, so we use the normal body
    const rawBody = (req as any).rawBody || JSON.stringify(body);
    try {
      await this.picqerService.handleHook({
        body,
        channelToken,
        rawBody,
        signature,
      });
    } catch (e: any) {
      const orderCode = (body as any)?.data?.reference;
      Logger.error(
        `Error handling incoming hook '${body.event}' (order code: ${orderCode}): ${e.message}`,
        loggerCtx,
        util.inspect(e)
      );
      throw e;
    }
  }
}
