import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Get,
  Inject,
} from '@nestjs/common';
import { GoedgepicktService } from './goedgepickt.service';
import { Logger } from '@vendure/core';
import {
  GoedgepicktPluginConfig,
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
} from './goedgepickt.types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';

@Controller('goedgepickt')
export class GoedgepicktController {
  constructor(
    private service: GoedgepicktService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: GoedgepicktPluginConfig
  ) {}

  @Get('fullsync/:secret')
  async sync(@Param('secret') secret: string): Promise<void> {
    if (secret !== this.config.endpointSecret) {
      Logger.warn(
        `Invalid incoming fullsync request with secret ${secret}`,
        loggerCtx
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
    @Body() body: IncomingStockUpdateEvent | IncomingOrderStatusEvent,
    @Headers('Signature') signature: string
  ) {
    Logger.info(
      `Incoming event ${body?.event} for channel ${channelToken}`,
      loggerCtx
    );
    try {
      const client = await this.service.getClientForChannel(channelToken);
      if (body.event === 'orderStatusChanged') {
        client.validateOrderWebhookSignature(body, signature);
        await this.service.updateOrderStatus(
          channelToken,
          body.orderNumber,
          body.newStatus
        );
      } else if (body.event === 'stockUpdated') {
        client.validateStockWebhookSignature(body, signature);
        await this.service.processStockUpdateEvent(
          channelToken,
          body.productSku,
          Number(body.newStock)
        );
      } else {
        Logger.warn(
          `Unknown incoming event: ${JSON.stringify(body)}`,
          loggerCtx
        );
      }
    } catch (err) {
      Logger.error(
        `Failed to process incoming webhook ${body?.event} for channel ${channelToken}`,
        loggerCtx,
        err
      );
      throw err;
    }
  }
}
