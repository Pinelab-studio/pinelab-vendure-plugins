import { Inject } from '@nestjs/common';
import { Args, ResolveField, Query, Resolver, Parent } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Order,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoicePluginConfig } from '../index';
import {
  Invoice,
  InvoiceConfigInput,
} from '../ui/generated/graphql';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceService } from '../services/invoice.service';

export const invoicePermission = new PermissionDefinition({
  name: 'AllowInvoicesPermission',
  description: 'Allow this user to enable invoice generation',
});

@Resolver()
export class InvoiceCommonResolver {
  constructor(
    private service: InvoiceService,
  ) {}

  @ResolveField('invoices')
  @Resolver('Order')
  @Allow(invoicePermission.Permission)
  async invoices(
    @Ctx() ctx: RequestContext,
    @Parent() order: Order
  ): Promise<Invoice> {
    return this.service.getInvoices(ctx, order.id);
  }
}
