import { PicklistService } from './picklist.service';
import {
  Controller,
  Post,
  Get,
  Res,
  Param,
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
import { picklistPermission } from './picklist.resolver';

@Controller('picklists')
export class PicklistController {
  constructor(
    private readonly invoiceService: PicklistService,
    private readonly orderService: OrderService
  ) {}

  @Allow(picklistPermission.Permission)
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

  @Allow(picklistPermission.Permission)
  @Get('/download/:customerId')
  async download(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
    @Param('customerId') customerId: string
  ) {
    if (customerId.startsWith('T_')) {
      const parts = customerId.split('_');
      customerId = parts[parts.length - 1];
    }
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    const orders = (
      await this.orderService.findByCustomerId(ctx, customerId, undefined, [
        'channels',
        'customer',
        'customer.user',
        'lines',
        'lines.productVariant',
        'lines.productVariant.taxCategory',
        'lines.productVariant.productVariantPrices',
        'lines.productVariant.translations',
        'lines.featuredAsset',
        'lines.taxCategory',
        'shippingLines',
        'surcharges',
      ])
    ).items;
    if (!orders?.length) {
      throw new UserInputError(
        `No orders for customer with id ${customerId} found`
      );
    }
    const stream = await this.invoiceService.downloadPicklist(ctx, orders);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview-invoice.pdf"`,
    });
    return stream.pipe(res);
  }
}
