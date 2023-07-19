import { InvoiceService } from './invoice.service';
import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Allow, Ctx, Logger, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import { ReadStream } from 'fs';
import { invoicePermission } from './invoice.resolver';

@Controller('invoices')
export class InvoiceController {
  constructor(private service: InvoiceService) {}

  @Allow(invoicePermission.Permission)
  @Get('/download')
  async downloadMultipleInvoices(
    @Ctx() ctx: RequestContext,
    @Query('nrs') numbers: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!ctx.channelId) {
      throw Error(`Channel id is needed to download invoices`);
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const stream = await this.service.downloadMultiple(
      ctx,
      numbers.split(','),
      res
    );
    Logger.info(`Invoices ${numbers} downloaded from ${ip}`, loggerCtx);
    stream.pipe(res);
  }

  @Allow(invoicePermission.Permission)
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

  @Get('/:channelToken/:orderCode')
  async downloadInvoice(
    @Param('channelToken') channelToken: string,
    @Param('orderCode') orderCode: string,
    @Query('email') customerEmail: string,
    @Req() req: Request,
    @Res() res: Response,
    @Ctx() ctx: RequestContext
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
      const streamOrRedirect = await this.service.downloadInvoice(ctx, {
        channelToken,
        orderCode,
        customerEmail,
        res,
      });
      Logger.info(`Invoice downloaded from ${ip} for ${req.path}`, loggerCtx);
      if (
        typeof streamOrRedirect === 'string' ||
        streamOrRedirect instanceof String
      ) {
        return res.redirect(302, streamOrRedirect as string);
      } else {
        return (streamOrRedirect as ReadStream).pipe(res);
      }
    } catch (error: any) {
      Logger.warn(
        `Failed invoice download attempt from ${ip} for ${req.path}: ${error.message}`,
        loggerCtx
      );
      res.statusCode = 400;
      return res.json({
        message:
          'This invoice does not exist or you are not authorized to download it',
      });
    }
  }
}
