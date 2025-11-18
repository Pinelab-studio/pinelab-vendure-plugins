import { Controller, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import { asError } from 'catch-unknown';
import { Request } from 'express';
import { QlsProductService } from '../services/qls-product.service';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { QlsPluginOptions } from '../types';
import { FulfillmentProduct } from '../lib/client-types';

@Controller('qls')
export class QlsWebhooksController {
  constructor(
    private channelService: ChannelService,
    private qlsService: QlsProductService,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions
  ) {}

  /**
   * Endpoint for fulfilment product stock changes
   */
  @Post('/stock/:channelToken')
  async events(
    @Param('channelToken') channelToken: string,
    @Query('secret') webhookSecret: string,
    @Req() request: Request
  ) {
    if (webhookSecret !== this.options.webhookSecret) {
      return Logger.warn(
        `Incoming webhook with invalid secret for channel '${channelToken}' to '${request.url}'`,
        loggerCtx
      );
    }
    try {
      const ctx = await this.getCtxForChannel(channelToken);
      const body = request.body as FulfillmentProduct;
      const availableStock = body.amount_available;
      if (availableStock === undefined || availableStock === null) {
        return Logger.error(
          `Incoming webhook with invalid available stock to '${request.url}'`,
          loggerCtx,
          JSON.stringify(body)
        );
      }
      if (!body.sku) {
        return Logger.error(
          `Incoming webhook with invalid sku '${body.sku}' to '${request.url}'`,
          loggerCtx,
          JSON.stringify(body)
        );
      }
      await this.qlsService.updateStockBySku(ctx, body.sku, availableStock);
    } catch (error) {
      Logger.error(`QLS webhook error: ${asError(error).message}`);
      throw error;
    }
  }

  private async getCtxForChannel(token: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(token);
    return new RequestContext({
      apiType: 'admin',
      authorizedAsOwnerOnly: false,
      channel,
      isAuthorized: true,
    });
  }
}
