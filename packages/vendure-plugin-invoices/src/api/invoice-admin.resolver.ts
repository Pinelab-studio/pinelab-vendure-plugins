import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx, RequestContext
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoicePluginConfig } from '../index';
import { InvoiceService } from '../services/invoice.service';
import {
  InvoiceConfigInput
} from '../ui/generated/graphql';
import { InvoiceConfigEntity } from '../entities/invoice-config.entity';
import { invoicePermission } from './invoice-common.resolver';

@Resolver()
export class InvoiceAdminResolver {
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
}
