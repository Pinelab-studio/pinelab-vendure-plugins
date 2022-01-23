import { Body, Controller, Headers, Post } from '@nestjs/common';
import {
  MyParcelError,
  MyparcelService,
  MyparcelStatusChangeEvent,
} from './myparcel.service';
import { MyparcelPlugin } from '../myparcel.plugin';
import { Logger } from '@vendure/core';

@Controller('myparcel')
export class MyparcelController {
  constructor(private myparcelService: MyparcelService) {}

  @Post('update-status')
  async webhook(
    @Body() body: MyparcelStatusChangeEvent,
    @Headers('X-MyParcel-Authorization') auth: string
  ): Promise<void> {
    const incomingKey = Buffer.from(auth, 'base64').toString();
    const entry = Object.entries(MyparcelPlugin.apiKeys).find(
      ([_, apiKey]) => apiKey === incomingKey
    );
    if (!entry) {
      throw new MyParcelError(
        `Could not validate incoming webhook with auth header ${incomingKey}`
      );
    }
    const shipmentId = body?.data?.hooks[0].shipment_id;
    const status = body?.data?.hooks[0].status;
    if (!shipmentId || !status) {
      return Logger.error(
        `Invalid incoming webhook: ${JSON.stringify(body.data)}`,
        MyparcelPlugin.loggerCtx
      );
    }
    const [channelToken] = entry;
    Logger.debug(
      `Incoming status-change for shipment ${shipmentId} for channel ${channelToken} with status ${status}`,
      MyparcelPlugin.loggerCtx
    );
    await this.myparcelService.updateStatus(channelToken, shipmentId, status);
  }
}
