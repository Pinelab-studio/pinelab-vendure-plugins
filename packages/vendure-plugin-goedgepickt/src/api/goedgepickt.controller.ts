import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { Request } from 'express';
import { loggerCtx } from '../constants';
import { GoedgepicktService } from './goedgepickt.service';
import {
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
} from './goedgepickt.types';

@Controller('goedgepickt')
export class GoedgepicktController {
  constructor(private service: GoedgepicktService) {}

  @Post('webhook/:channelToken')
  async webhook(
    @Param('channelToken') channelToken: string,
    @Req() req: Request,
    @Body() body: IncomingStockUpdateEvent | IncomingOrderStatusEvent,
    @Headers('signature') signature: string
  ) {
    Logger.info(
      `Incoming event ${body?.event} for channel ${channelToken}`,
      loggerCtx
    );
    if (!signature) {
      return Logger.warn(
        `Ignoring incoming event without signature for channel ${channelToken}`,
        loggerCtx
      );
    }
    if (!channelToken) {
      return Logger.warn(
        `Ignoring incoming event without channelToken`,
        loggerCtx
      );
    }
    try {
      const ctx = await this.service.getCtxForChannel(channelToken);
      switch (body.event) {
        case 'orderStatusChanged':
          await this.service.jobQueue.add(
            {
              action: 'incoming-order-status-webhook',
              ctx: ctx.serialize(),
              orderCode: body.orderNumber,
              orderUuid: body.orderUuid,
            },
            { retries: 20 }
          );
          break;
        case 'stockUpdated':
          await this.service.jobQueue.add(
            {
              action: 'incoming-stock-webhook',
              ctx: ctx.serialize(),
              sku: body.productSku,
            },
            { retries: 20 }
          );
          break;
        case 'compoundProductStockUpdated':
          await this.service.jobQueue.add(
            {
              action: 'incoming-stock-webhook',
              ctx: ctx.serialize(),
              sku: body.productSku,
            },
            { retries: 20 }
          );
          break;
        default:
          return Logger.warn(
            `Unknown incoming event: ${JSON.stringify(body)}`,
            loggerCtx
          );
      }
      Logger.info(
        `Successfully created jobs for incoming webhook with event ${body.event} for channel ${channelToken}`,
        loggerCtx
      );
    } catch (err: any) {
      Logger.error(
        `Failed to create jobs for incoming webhook ${body?.event} for channel ${channelToken}: ${err?.message}`,
        loggerCtx,
        JSON.stringify(err, Object.getOwnPropertyNames(err))
      );
      throw err;
    }
    return;
  }
}
