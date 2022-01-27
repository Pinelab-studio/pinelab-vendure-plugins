import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { GoedgepicktService } from './goedgepickt.service';
import { Logger } from '@vendure/core';
import {
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
} from './goedgepickt.types';
import { loggerCtx } from '../constants';

@Controller('goedgepickt')
export class GoedgepicktController {
  constructor(private service: GoedgepicktService) {}

  @Post('webhook/:channelToken')
  async webhook(
    @Param('channelToken') channelToken: string,
    @Body() body: IncomingStockUpdateEvent | IncomingOrderStatusEvent,
    @Headers('Signature') signature: string
  ) {
    Logger.info(
      `Incoming event ${body.event} for channel ${channelToken}`,
      loggerCtx
    );
    const client = this.service.getClientForChannel(channelToken);
    if (body.event === 'orderStatusChanged') {
      client.validateOrderWebhookSignature(JSON.stringify(body), signature);
      await this.service.updateOrderStatus(body);
    } else if (body.event === 'stockUpdated') {
      client.validateStockWebhookSignature(JSON.stringify(body), signature);
      await this.service.updateStock(body);
    } else {
      Logger.warn(`Unknown incoming event: ${JSON.stringify(body)}`, loggerCtx);
    }
  }
}
