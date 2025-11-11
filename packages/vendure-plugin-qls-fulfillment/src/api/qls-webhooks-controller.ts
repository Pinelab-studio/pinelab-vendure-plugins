import { Controller, Param, Post, Req } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import { asError } from 'catch-unknown';
import { Request } from 'express';
import { QlsProductService } from '../services/qls-product.service';
import { QlsFulfillmentProduct } from '../types';

@Controller('qls')
export class QlsWebhooksController {
  constructor(
    private channelService: ChannelService,
    private qlsService: QlsProductService
  ) {}

  /**
   * Endpoint for fulfilment product stock changes
   */
  @Post('webhook/fulfillment_product/stock')
  async events(
    @Param('channelToken') channelToken: string,
    @Req() request: Request
  ) {
    const ctx = await this.getCtxForChannel(channelToken);
    try {
      await this.qlsService.updateStock(
        ctx,
        request.body as QlsFulfillmentProduct
      );
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
