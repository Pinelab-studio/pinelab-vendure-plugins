import { InvoiceService } from '../services/invoice.service';
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
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  Allow,
  ChannelService,
  Ctx,
  ForbiddenError,
  Logger,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { ReadStream } from 'fs';
import { invoicePermission } from './invoice-common.resolver';

@Controller('invoices')
export class InvoiceController {
  constructor(
    private invoiceService: InvoiceService,
    private channelService: ChannelService
  ) {}

  @Allow(invoicePermission.Permission)
  @Post('/preview/:orderCode')
  async preview(
    @Ctx() ctx: RequestContext,
    @Param('orderCode') orderCode: string,
    @Res() res: Response,
    @Body() body: { template: string }
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

  // Example: /invoices/default-channel/DJSLHJ238390/123?email=customer%40example.com
  @Get('/:channelToken/:orderCode/:invoiceNumber?')
  async downloadInvoice(
    @Param('channelToken') channelToken: string,
    @Param('orderCode') orderCode: string,
    @Param('invoiceNumber') invoiceNumber: string | number | undefined,
    @Query('email') encodedCustomerEmail: string,
    @Req() req: Request,
    @Res() res: Response,
    @Ctx() _ctx: RequestContext
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!channelToken || !orderCode || !encodedCustomerEmail) {
      Logger.warn(
        `Invalid invoice download attempt from ${ip} for ${req.path}`,
        loggerCtx
      );
      throw new BadRequestException();
    }
    try {
      const customerEmail = decodeURIComponent(encodedCustomerEmail);
      const channel = await this.channelService.getChannelFromToken(
        channelToken
      );
      if (channel.token !== channelToken) {
        throw new UserInputError(
          `No channel found with token '${channelToken}'`
        );
      }
      const ctx = new RequestContext({
        apiType: 'admin',
        authorizedAsOwnerOnly: false,
        isAuthorized: true,
        channel,
      });
      const streamOrRedirect = await this.invoiceService.downloadInvoice(ctx, {
        orderCode,
        customerEmail,
        invoiceNumber,
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
      throw new ForbiddenException(
        'This invoice does not exist or you are not authorized to download it'
      );
    }
  }
}
