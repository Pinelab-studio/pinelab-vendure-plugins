import { PDFTemplateService } from './pdf-template.service';
import {
  Controller,
  Post,
  Get,
  Res,
  Param,
  Query,
  Body,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import {
  Allow,
  Ctx,
  EntityHydrator,
  ForbiddenError,
  ID,
  OrderService,
  RequestContext,
  RequestContextService,
  UserInputError,
} from '@vendure/core';
import { pdfDownloadPermission } from './pdf-template.resolver';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { PDFTemplatePluginOptions } from '../pdf-template-plugin';

@Controller('order-pdf')
export class PDFTemplateController {
  constructor(
    private readonly pdfTemplateService: PDFTemplateService,
    private readonly orderService: OrderService,
    private readonly entityHydrator: EntityHydrator,
    private readonly requestContextService: RequestContextService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: PDFTemplatePluginOptions
  ) {}

  @Allow(pdfDownloadPermission.Permission)
  @Post('/preview/')
  async preview(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
    @Body() body: { template: string }
  ) {
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    if (!body?.template || !body?.template.trim()) {
      throw new BadRequestException('No template given');
    }
    const stream = await this.pdfTemplateService.downloadPDF(
      ctx,
      undefined,
      body.template
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview.pdf"`,
    });
    return stream.pipe(res);
  }

  @Allow(pdfDownloadPermission.Permission)
  @Get('/download/:templateId/')
  async downloadMultiple(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
    @Param('templateId') templateId: ID,
    @Query('orderCodes') orderCodesString: string
  ) {
    const orderCodes = orderCodesString.split(',');
    if (String(templateId).startsWith('T_')) {
      // Remove T_ prefix on ID's in test environment
      templateId = String(templateId).replace('T_', '');
    }
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    if (orderCodes?.length == 1) {
      // Return single as inline PDF
      const orderCode = orderCodes[0];
      const order = await this.orderService.findOneByCode(ctx, orderCode);
      if (!order) {
        throw new UserInputError(`No order with code ${orderCode} found`);
      }
      const stream = await this.pdfTemplateService.downloadPDF(
        ctx,
        templateId,
        undefined,
        order
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="download.pdf"`,
      });
      return stream.pipe(res);
    } else {
      // Return multiple as ZIP
      const orders = (
        await this.orderService.findAll(
          ctx,
          { filter: { code: { in: orderCodes } } },
          []
        )
      ).items;
      if (!orders?.length) {
        throw new UserInputError(`No order with codes ${orderCodes} found`);
      }
      const stream = await this.pdfTemplateService.downloadMultiplePDFs(
        ctx,
        templateId,
        orders
      );
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `inline; filename="pdf-${orders.length}.zip"`,
      });
      return stream.pipe(res);
    }
  }

  @Get('/download/:channelToken/:orderCode/:templateId/:emailAddress')
  async publicDownload(
    @Res() res: Response,
    @Param('channelToken') channelToken: string,
    @Param('orderCode') orderCode: string,
    @Param('templateId') templateId: ID,
    @Param('emailAddress') emailAddress: string
  ) {
    if (!this.config.allowPublicDownload) {
      throw new BadRequestException('PDF downloads not allowed');
    }
    console.log(
      'channelToken',
      channelToken,
      orderCode,
      templateId,
      emailAddress
    );
    if (!channelToken) {
      throw new BadRequestException('No channel token given');
    }
    const ctx = await this.requestContextService.create({
      apiType: 'admin',
      channelOrToken: channelToken,
    });
    console.log('ctx', ctx.channel.token);
    // Return single as inline PDF
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    console.log('order', order);
    if (!order) {
      throw new ForbiddenError();
    }
    await this.entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
    console.log('order.customer', order.customer?.emailAddress);
    if (!order.customer || order.customer.emailAddress !== emailAddress) {
      throw new ForbiddenError();
    }
    const stream = await this.pdfTemplateService.downloadPDF(
      ctx,
      templateId,
      undefined,
      order
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="download.pdf"`,
    });
    return stream.pipe(res);
  }
}
