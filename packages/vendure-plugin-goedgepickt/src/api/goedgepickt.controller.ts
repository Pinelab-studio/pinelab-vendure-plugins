import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Get,
  Inject,
  Req,
} from '@nestjs/common';
import { GoedgepicktService } from './goedgepickt.service';
import { Logger } from '@vendure/core';
import {
  GoedgepicktPluginConfig,
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
} from './goedgepickt.types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { Request } from 'express';

@Controller('goedgepickt')
export class GoedgepicktController {
  constructor(
    private service: GoedgepicktService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: GoedgepicktPluginConfig,
  ) {}

  @Get('fullsync/:secret')
  async sync(@Param('secret') secret: string): Promise<void> {
    if (secret !== this.config.endpointSecret) {
      Logger.warn(
        `Invalid incoming fullsync request with secret ${secret}`,
        loggerCtx,
      );
      return;
    }
    const configs = await this.service.getConfigs();
    for (const config of configs.filter((config) => config.enabled)) {
      await this.service.createFullsyncJobs(config.channelToken);
    }
  }

  @Post('webhook/:channelToken')
  async webhook(
    @Param('channelToken') channelToken: string,
    @Req() req: Request,
    @Body() body: IncomingStockUpdateEvent | IncomingOrderStatusEvent,
    @Headers('signature') signature: string,
  ) {
    Logger.info(
      `Incoming event ${body?.event} for channel ${channelToken}`,
      loggerCtx,
    );
    if (!signature) {
      return Logger.warn(
        `Ignoring incoming event without signature for channel ${channelToken}`,
        loggerCtx,
      );
    }
    if (!channelToken) {
      return Logger.warn(
        `Ignoring incoming event without channelToken`,
        loggerCtx,
      );
    }
    try {
      const ctx = await this.service.getCtxForChannel(channelToken);
      const client = await this.service.getClientForChannel(ctx);
      if (!client) {
        return;
      }
      const rawBody = (req as any).rawBody || JSON.stringify(body); // TestEnvironment doesnt have middleware applied, so no rawBody available
      switch (body.event) {
        case 'orderStatusChanged':
          if (!client.isOrderWebhookSignatureValid(rawBody, signature)) {
            return Logger.warn(
              `Not processing webhook with event '${body.event}' for channel ${channelToken} because it has an invalid signature. Given invalid signature: '${signature}'`,
              loggerCtx,
            );
          }
          await this.service.updateOrderStatus(
            ctx,
            body.orderNumber,
            body.orderUuid,
            body.newStatus,
          );
          break;
        case 'stockUpdated':
          if (!client.isStockWebhookSignatureValid(rawBody, signature)) {
            return Logger.warn(
              `Not processing webhook with event '${body.event}' for channel ${channelToken} because it has an invalid signature. Given invalid signature: '${signature}'`,
              loggerCtx,
            );
          }
          await this.service.processStockUpdateEvent(
            ctx,
            body.productSku,
            Number(body.newStock),
          );
          break;
        default:
          return Logger.warn(
            `Unknown incoming event: ${JSON.stringify(body)}`,
            loggerCtx,
          );
      }
      Logger.info(
        `Successfully processed webhook with event ${body.event} for channel ${channelToken}`,
        loggerCtx,
      );
    } catch (err: any) {
      Logger.error(
        `Failed to process incoming webhook ${body?.event} for channel ${channelToken}: ${err?.message}`,
        loggerCtx,
        JSON.stringify(err, Object.getOwnPropertyNames(err)),
      );
      throw err;
    }
    return;
  }
}
