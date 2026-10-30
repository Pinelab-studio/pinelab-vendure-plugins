import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Ctx, Logger, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import { MyparcelService, MyparcelStatusChangeEvent } from './myparcel.service';

@Controller('myparcel')
export class MyparcelController {
  constructor(private myparcelService: MyparcelService) {}

  @Post('update-status')
  async webhook(
    @Ctx() ctx: RequestContext,
    @Body() body: MyparcelStatusChangeEvent,
    @Headers('X-MyParcel-Authorization') auth: string,
  ): Promise<void> {
    const status = body?.data?.hooks?.[0]?.status;
    const shipmentId = body?.data?.hooks?.[0]?.shipment_id;
    Logger.info(`Incoming webhook ${shipmentId}`, loggerCtx);
    const incomingKey = Buffer.from(auth, 'base64').toString();
    if (!shipmentId || !status) {
      return Logger.error(
        `Invalid incoming webhook: ${JSON.stringify(body.data)}`,
        loggerCtx,
      );
    }
    const config = await this.myparcelService
      .getConfigByKey(ctx, incomingKey)
      .catch((error) => {
        Logger.error('Failed to get config for incoming key', loggerCtx, error);
        throw error;
      });
    Logger.info(
      `Incoming status-change for shipment ${shipmentId} for channel ${config.channelId} with status ${status}`,
      loggerCtx,
    );
    await this.myparcelService.updateStatus(
      ctx,
      config.channelId,
      shipmentId,
      status,
    );
  }
}
