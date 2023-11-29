import {
  Controller,
  ForbiddenException,
  Headers,
  Param,
  Post,
  Req,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import { Request } from 'express';
import util from 'util';
import { loggerCtx } from '../constants';
import { PicqerService } from './picqer.service';
import { IncomingWebhook } from './types';

@Controller('picqer')
export class PicqerController {
  constructor(
    private picqerService: PicqerService,
    private channelService: ChannelService
  ) {}

  @Post('hooks/:channelToken')
  async webhook(
    @Req() request: Request,
    @Headers('X-Picqer-Signature') signature: string,
    @Param('channelToken') channelToken: string
  ): Promise<void> {
    const body = JSON.parse(request.body.toString()) as IncomingWebhook;
    const rawBody = (request as any).rawBody;
    Logger.info(
      `Incoming hook ${body.event} for channel ${channelToken}`,
      loggerCtx
    );
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

  @Get('pull-stock-levels/:channelToken')
  async pullStockLevels(
    @Headers('Authorization') authHeader: string,
    @Param('channelToken') channelToken: string
  ): Promise<void> {
    if (!authHeader) {
      throw new ForbiddenException('No bearer token provided');
    }
    const channel = await this.channelService.getChannelFromToken(channelToken);
    if (!channel) {
      throw new BadRequestException(
        `No channel found for token ${channelToken}`
      );
    }
    const apiKey = authHeader.replace('Bearer ', '').replace('bearer ', '');
    const ctx = new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
    const picqerConfig = await this.picqerService.getConfig(ctx);
    if (picqerConfig?.apiKey !== apiKey) {
      throw new ForbiddenException('Invalid bearer token');
    }
    await this.picqerService.createStockLevelJobs(ctx);
  }
}
