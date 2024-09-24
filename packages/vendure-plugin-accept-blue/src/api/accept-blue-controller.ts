import { Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import { Request } from 'express';
import { loggerCtx } from '../constants';
import { AcceptBlueEvent } from '../types';
import { AcceptBlueService } from './accept-blue-service';
import { asError } from 'catch-unknown';

@Controller('accept-blue')
export class AcceptBlueController {
  constructor(
    private channelService: ChannelService,
    private acceptBlueService: AcceptBlueService
  ) {}

  /**
   * Endpoint for all incoming events from Accept Blue
   */
  @Post('webhook/:channelToken')
  async events(
    @Param('channelToken') channelToken: string,
    @Req() request: Request,
    @Headers('X-Signature') signature: string
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const rawBody = (request as any).rawBody as Buffer;
    const body = JSON.parse(rawBody.toString('utf-8')) as AcceptBlueEvent; // We have to parse it ourselves, because of the rawBody middleware
    const ctx = await this.getCtxForChannel(channelToken);
    await this.acceptBlueService
      .handleIncomingWebhook(ctx, body, rawBody, signature)
      .catch((e) => {
        Logger.error(
          `Error handling Accept Blue webhook event: ${asError(e).message}`,
          loggerCtx
        );
        throw e;
      });
  }

  async getCtxForChannel(token: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(token);
    return new RequestContext({
      apiType: 'admin',
      authorizedAsOwnerOnly: false,
      channel,
      isAuthorized: true,
    });
  }
}
