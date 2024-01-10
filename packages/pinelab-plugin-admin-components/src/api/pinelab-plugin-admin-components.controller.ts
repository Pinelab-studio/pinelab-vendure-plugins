import { PinelabPluginAdminComponentsService } from './pinelab-plugin-admin-components.service';
import {
  Controller,
  Post,
  Res,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { pinelabPluginComponetsPermission } from './pinelab-plugin-admin-components.resolver';

@Controller('invoices')
export class PinelabPluginAdminComponentsController {
  constructor(private readonly service: PinelabPluginAdminComponentsService) {}

  @Allow(pinelabPluginComponetsPermission.Permission)
  @Post('/preview')
  async preview(
    @Ctx() ctx: RequestContext,
    @Res() req: Request,
    @Res() res: Response,
    @Body() data: { template: string }
  ) {
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    if (!data?.template || !data?.template.trim()) {
      throw new BadRequestException('No template given');
    }
    const stream = await this.service.testTemplate(ctx, data.template);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="test-invoice.pdf"`,
    });
    stream.pipe(res);
  }
}
