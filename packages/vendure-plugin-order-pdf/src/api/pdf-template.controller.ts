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
} from '@nestjs/common';
import { Response } from 'express';
import {
  Allow,
  Ctx,
  ID,
  OrderService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { pdfDownloadPermission } from './pdf-template.resolver';

@Controller('pdf-templates')
export class PDFTemplateController {
  constructor(
    private readonly pdfTemplateService: PDFTemplateService,
    private readonly orderService: OrderService
  ) {}

  @Allow(pdfDownloadPermission.Permission)
  @Post('/preview/:templateName?')
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
      body.template
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview.pdf"`,
    });
    return stream.pipe(res);
  }

  @Allow(pdfDownloadPermission.Permission)
  @Get('/download/:templateName/:orderCode')
  async download(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
    @Param('orderCode') orderCode: string,
    @Param('templateName') templateName: string
  ) {
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw new UserInputError(`No order with code ${orderCode} found`);
    }
    const stream = await this.pdfTemplateService.downloadPDF(
      ctx,
      templateName,
      order
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="download.pdf"`,
    });
    return stream.pipe(res);
  }

  @Allow(pdfDownloadPermission.Permission)
  @Get('/download/:templateName/')
  async downloadMultiple(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
    @Param('templateName') templateName: string,
    @Query('orderCodes') orderCodes: string
  ) {
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    const orders = (
      await this.orderService.findAll(
        ctx,
        { filter: { code: { in: orderCodes.split(',') } } },
        []
      )
    ).items;
    if (!orders?.length) {
      throw new UserInputError(`No order with codes ${orderCodes} found`);
    }
    const stream = await this.pdfTemplateService.downloadMultiplePDFs(
      ctx,
      templateName,
      orders
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `inline; filename="pdf-${orders.length}.zip"`,
    });
    return stream.pipe(res);
  }
}
