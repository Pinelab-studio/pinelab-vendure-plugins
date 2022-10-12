import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { InvoiceService } from './invoice.service';
import { invoicePermission, InvoicePluginConfig } from '../index';
import {
  InvoiceConfigInput,
  InvoiceList,
  InvoicesListInput,
} from '../ui/generated/graphql';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { PLUGIN_INIT_OPTIONS, PLUGIN_NAME } from '../constants';
import { isValidForPlugin } from '../../../util/src/license';

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
    return this.service.upsertConfig(ctx.channelId as string, input);
  }

  @Query()
  @Allow(invoicePermission.Permission)
  async invoiceConfig(
    @Ctx() ctx: RequestContext
  ): Promise<InvoiceConfigEntity | undefined> {
    return this.service.getConfig(ctx.channelId as string);
  }

  @Query()
  @Allow(invoicePermission.Permission)
  async invoices(
    @Ctx() ctx: RequestContext,
    @Args('input') input?: InvoicesListInput
  ): Promise<InvoiceList> {
    return this.service.getAllInvoices(ctx.channel, input);
  }

  @Query()
  @Allow(invoicePermission.Permission)
  isInvoicePluginLicenseValid(): boolean {
    return isValidForPlugin(this.config.licenseKey, PLUGIN_NAME);
  }
}
