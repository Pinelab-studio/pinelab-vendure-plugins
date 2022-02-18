import { InvoiceService } from './invoice.service';
import { Res, Req, Controller, Query, Param, Get } from '@nestjs/common';
import { Response, Request } from 'express';
import { Logger } from '@vendure/core';
import { loggerCtx } from '../constants';
import { ReadStream } from 'fs';

@Controller('invoices')
export class InvoiceController {
  constructor(private service: InvoiceService) {}

  @Get('/:channelToken/:orderCode')
  async downloadInvoice(
    @Param('channelToken') channelToken: string,
    @Param('orderCode') orderCode: string,
    @Query('email') customerEmail: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
      const streamOrRedirect = await this.service.downloadInvoice({
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
    } catch (error) {
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
