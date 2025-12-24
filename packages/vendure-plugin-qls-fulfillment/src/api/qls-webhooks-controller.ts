import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ChannelService,
  ForbiddenError,
  Logger,
  RequestContext,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { Request } from 'express';
import { QlsProductService } from '../services/qls-product.service';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { QlsPluginOptions } from '../types';
import { QlsOrderService } from '../services/qls-order.service';
import {
  IncomingOrderWebhook,
  IncomingStockWebhook,
} from '../lib/client-types';

@Controller('qls')
export class QlsWebhooksController {
  constructor(
    private channelService: ChannelService,
    private qlsProductService: QlsProductService,
    private qlsOrderService: QlsOrderService,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions
  ) {}

  /**
   * Endpoint for all incoming webhooks
   */
  @Post('/webhook/:channelToken')
  async events(
    @Param('channelToken') channelToken: string,
    @Query('secret') webhookSecret: string,
    @Req() request: Request,
    @Body() body: IncomingStockWebhook | IncomingOrderWebhook
  ) {
    if (webhookSecret !== this.options.webhookSecret) {
      Logger.warn(
        `Incoming webhook with invalid secret for channel '${channelToken}' to '${request.url}'`,
        loggerCtx
      );
      throw new ForbiddenError();
    }
    try {
      const ctx = await this.getCtxForChannel(channelToken);
      if (!ctx) {
        return Logger.error(
          `Incoming webhook with invalid channel token for channel '${channelToken}' to '${request.url}'`,
          loggerCtx,
          JSON.stringify(body)
        );
      }
      if (isStockWebhook(body)) {
        await this.qlsProductService.updateStockBySku(
          ctx,
          body.sku,
          body.amount_available
        );
      } else if (isOrderWebhook(body)) {
        await this.qlsOrderService.handleOrderStatusUpdate(ctx, body);
      } else {
        throw Error(`Invalid webhook body: ${JSON.stringify(body)}`);
      }
    } catch (error) {
      Logger.error(`QLS webhook error: ${asError(error).message}`);
      throw error;
    }
  }

  private async getCtxForChannel(
    token: string
  ): Promise<RequestContext | undefined> {
    const channel = await this.channelService.getChannelFromToken(token);
    if (token !== channel.token) {
      // This validation is needed. Vendure returns the default channel when a non-existing channel token is provided.
      return undefined;
    }
    return new RequestContext({
      apiType: 'admin',
      authorizedAsOwnerOnly: false,
      channel,
      isAuthorized: true,
    });
  }
}

function isStockWebhook(
  body: IncomingStockWebhook | IncomingOrderWebhook
): body is IncomingStockWebhook {
  return 'amount_available' in body;
}

function isOrderWebhook(
  body: IncomingStockWebhook | IncomingOrderWebhook
): body is IncomingOrderWebhook {
  return 'customer_reference' in body && 'status' in body;
}
