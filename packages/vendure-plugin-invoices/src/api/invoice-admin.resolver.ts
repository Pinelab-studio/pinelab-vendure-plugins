import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  OrderService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoicePluginConfig } from '../index';
import { InvoiceService } from '../services/invoice.service';
import { Invoice, InvoiceConfigInput } from '../ui/generated/graphql';
import { InvoiceConfigEntity } from '../entities/invoice-config.entity';
import { invoicePermission } from './invoice-common.resolver';

@Resolver()
export class InvoiceAdminResolver {
  constructor(
    private invoiceService: InvoiceService,
    private orderService: OrderService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: InvoicePluginConfig,
  ) {}

  @Mutation()
  @Allow(invoicePermission.Permission)
  async upsertInvoiceConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: InvoiceConfigInput,
  ): Promise<InvoiceConfigEntity> {
    return this.invoiceService.upsertConfig(ctx, input);
  }

  @Mutation()
  @Allow(invoicePermission.Permission)
  async createInvoice(
    @Ctx() ctx: RequestContext,
    @Args('orderId') orderId: ID,
  ): Promise<Invoice> {
    const order = await this.orderService.findOne(ctx, orderId, ['customer']);
    if (!order?.customer?.emailAddress) {
      throw new UserInputError(
        `Can not generate invoice for an order without 'customer.emailAddress'`,
      );
    }
    const invoice = await this.invoiceService.createAndSaveInvoice(
      ctx.channel.token,
      order.code,
    );
    return {
      ...invoice,
      isCreditInvoice: invoice.isCreditInvoice,
      downloadUrl: this.invoiceService.getDownloadUrl(
        ctx,
        invoice,
        order.code,
        order.customer.emailAddress,
      ),
    };
  }

  @Query()
  @Allow(invoicePermission.Permission)
  async invoiceConfig(
    @Ctx() ctx: RequestContext,
  ): Promise<InvoiceConfigEntity | undefined> {
    return this.invoiceService.getConfig(ctx);
  }
}
