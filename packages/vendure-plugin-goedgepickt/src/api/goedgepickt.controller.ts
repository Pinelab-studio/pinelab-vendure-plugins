import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Channel, Logger, TransactionalConnection } from '@vendure/core';
import { Request } from 'express';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { GoedgepicktService } from './goedgepickt.service';
import {
  GoedgepicktPluginConfig,
  IncomingOrderStatusEvent,
  IncomingStockUpdateEvent,
} from './goedgepickt.types';

@Controller('goedgepickt')
export class GoedgepicktController {
  constructor(
    private service: GoedgepicktService,
    private connection: TransactionalConnection,
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
    const channels = await this.connection.getRepository(Channel).find();
    for (const channel of channels.filter((c) => c.customFields?.ggEnabled)) {
      await this.service.doFullSync(channel.token).catch((err) => {
        Logger.error(
          `Failed to create fullsync jobs for channel ${channel.id}: ${err.message}`,
          loggerCtx
        );
      });
    }
  }

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
