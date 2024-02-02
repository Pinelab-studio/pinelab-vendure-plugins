import { PinelabPluginAdminComponentsService } from './pinelab-plugin-admin-components.service';
import {
  Controller,
  Post,
  Res,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { pinelabPluginComponetsPermission } from './pinelab-plugin-admin-components.resolver';

@Controller('invoices')
export class PinelabPluginAdminComponentsController {
  constructor(
    private readonly invoiceService: PinelabPluginAdminComponentsService
  ) {}

  @Allow(pinelabPluginComponetsPermission.Permission)
  @Post('/preview/:orderCode?')
  async preview(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
    @Body() body: { template: string },
    @Param('orderCode') orderCode?: string
  ) {
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    if (!body?.template || !body?.template.trim()) {
      throw new BadRequestException('No template given');
    }
    const stream = await this.invoiceService.previewInvoiceWithTemplate(
      ctx,
      body.template,
      orderCode
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview-invoice.pdf"`,
    });
    return stream.pipe(res);
  }
}
