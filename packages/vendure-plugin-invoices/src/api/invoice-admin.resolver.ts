import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  OrderService,
  PaginatedList,
  RequestContext,
  Transaction,
  UserInputError,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoicePluginConfig } from '../index';
import { InvoiceService } from '../services/invoice.service';
import {
  Invoice,
  InvoiceConfigInput,
  QueryInvoicesArgs,
} from '../ui/generated/graphql';
import { InvoiceConfigEntity } from '../entities/invoice-config.entity';
import { invoicePermission } from './invoice-common.resolver';

@Resolver()
export class InvoiceAdminResolver {
  constructor(
    private invoiceService: InvoiceService,
    private orderService: OrderService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: InvoicePluginConfig
  ) {}

  @Mutation()
  @Transaction()
  @Allow(invoicePermission.Permission)
  async upsertInvoiceConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    this.invoiceService.throwIfInvalidLicense();
    return this.invoiceService.upsertConfig(ctx, input);
  }

  @Mutation()
  @Transaction()
  @Allow(invoicePermission.Permission)
  async createInvoice(
    @Ctx() ctx: RequestContext,
    @Args('orderId') orderId: ID
  ): Promise<Invoice> {
    const order = await this.orderService.findOne(ctx, orderId, ['customer']);
    if (!order?.customer?.emailAddress) {
      throw new UserInputError(
        `Can not generate invoice for an order without 'customer.emailAddress'`
      );
    }
    const invoice = await this.invoiceService.createInvoicesForOrder(
      ctx.channel.token,
      order.code,
      false
    );
    if (!invoice) {
      throw new UserInputError(
        `Could not generate invoice for order. Please check the logs for more information.`
      );
    }
    return {
      ...invoice,
      isCreditInvoice: invoice.isCreditInvoice,
      orderId: order.id,
      orderCode: order.code,
      downloadUrl: this.invoiceService.getDownloadUrl(
        ctx,
        invoice.invoiceNumber,
        order.code,
        order.customer.emailAddress
      ),
    };
  }

  @Query()
  @Allow(invoicePermission.Permission)
  async invoiceConfig(
    @Ctx() ctx: RequestContext
  ): Promise<InvoiceConfigEntity | undefined> {
    this.invoiceService.throwIfInvalidLicense();
    return this.invoiceService.getConfig(ctx);
  }

  @Query()
  @Allow(invoicePermission.Permission)
  async invoices(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryInvoicesArgs
  ): Promise<PaginatedList<Invoice>> {
    this.invoiceService.throwIfInvalidLicense();
    return this.invoiceService.findAll(ctx, args.options || undefined);
  }
}
