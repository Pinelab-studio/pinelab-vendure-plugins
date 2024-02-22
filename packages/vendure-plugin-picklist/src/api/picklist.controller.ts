import { PicklistService } from './picklist.service';
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
import { picklistPermission } from './picklist.resolver';

@Controller('picklists')
export class PicklistController {
  constructor(
    private readonly picklistService: PicklistService,
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
    const stream = await this.picklistService.previewPicklistWithTemplate(
      ctx,
      body.template,
      orderCode
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview-picklist.pdf"`,
    });
    return stream.pipe(res);
  }

  @Allow(picklistPermission.Permission)
  @Get('/download/:orderCode')
  async download(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
    @Param('orderCode') orderCode: string
  ) {
    if (!ctx.channel?.token) {
      throw new BadRequestException('No channel set for request');
    }
    const order = await this.orderService.findOneByCode(ctx, orderCode, ['shippingLines.shippingMethod']);
    if (!order) {
      throw new UserInputError(`No order with code ${orderCode} found`);
    }
    const stream = await this.picklistService.downloadPicklist(ctx, order);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview-picklist.pdf"`,
    });
    return stream.pipe(res);
  }

  @Allow(picklistPermission.Permission)
  @Get('/download')
  async downloadMultiple(
    @Ctx() ctx: RequestContext,
    @Res() res: Response,
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
    const stream = await this.picklistService.downloadMultiplePicklists(
      ctx,
      orders
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `inline; filename="picklists-${orders.length}.zip"`,
    });
    return stream.pipe(res);
  }
}
