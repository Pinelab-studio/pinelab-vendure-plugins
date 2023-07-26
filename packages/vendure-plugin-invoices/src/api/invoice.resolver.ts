import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoicePluginConfig } from '../index';
import {
  InvoiceConfigInput,
  InvoiceList,
  InvoicesListInput,
} from '../ui/generated/graphql';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceService } from './invoice.service';

export const invoicePermission = new PermissionDefinition({
  name: 'AllowInvoicesPermission',
  description: 'Allow this user to enable invoice generation',
});

@Resolver()
export class InvoiceResolver {
  constructor(
    private service: InvoiceService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: InvoicePluginConfig
  ) {}

  @Mutation()
  @Allow(invoicePermission.Permission)
  async upsertInvoiceConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    return this.service.upsertConfig(ctx, input);
  }

  @Query()
  @Allow(invoicePermission.Permission)
  async invoiceConfig(
    @Ctx() ctx: RequestContext
  ): Promise<InvoiceConfigEntity | undefined> {
    return this.service.getConfig(ctx);
  }

  @Query()
  @Allow(invoicePermission.Permission)
  async invoices(
    @Ctx() ctx: RequestContext,
    @Args('input') input?: InvoicesListInput
  ): Promise<InvoiceList> {
    return this.service.getAllInvoices(ctx, input);
  }
}
