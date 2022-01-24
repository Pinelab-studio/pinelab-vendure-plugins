import { Body, Controller, Headers, Post } from '@nestjs/common';
import {
  MyParcelError,
  MyparcelService,
  MyparcelStatusChangeEvent,
} from './myparcel.service';
import { MyparcelPlugin } from '../myparcel.plugin';
import { Logger } from '@vendure/core';
import { logger } from "@vendure/ui-devkit/compiler/utils";
import { loggerCtx } from "@vendure/core/dist/job-queue/constants";

@Controller('myparcel')
export class MyparcelController {
  constructor(private myparcelService: MyparcelService) {}

  @Post('update-status')
  async webhook(
    @Body() body: MyparcelStatusChangeEvent,
    @Headers('X-MyParcel-Authorization') auth: string
  ): Promise<void> {
    Logger.info(`Incoming webhook ${body?.data?.hooks}`, MyparcelPlugin.loggerCtx);
    const incomingKey = Buffer.from(auth, 'base64').toString();
    const config = await this.myparcelService.getConfigByKey(incomingKey).catch(error => {
      Logger.error(error, MyparcelPlugin.loggerCtx);
      throw error;
    });
    const shipmentId = body?.data?.hooks?.[0]?.shipment_id;
    const status = body?.data?.hooks?.[0]?.status;
    if (!shipmentId || !status) {
      return Logger.error(
        `Invalid incoming webhook: ${JSON.stringify(body.data)}`,
        MyparcelPlugin.loggerCtx
      );
    }
    Logger.info(
      `Incoming status-change for shipment ${shipmentId} for channel ${config.channelId} with status ${status}`,
      MyparcelPlugin.loggerCtx
    );
    await this.myparcelService.updateStatus(config.channelId, shipmentId, status);
  }
}
