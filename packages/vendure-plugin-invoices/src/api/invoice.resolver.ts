import { Args, Mutation, Resolver, Query } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { InvoiceService } from './invoice.service';
import { invoicePermission } from '../index';
import {
  Invoice,
  InvoiceConfig,
  InvoiceConfigInput,
} from '../ui/generated/graphql';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';

@Resolver()
export class InvoiceResolver {
  constructor(private service: InvoiceService) {}

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
  async allInvoices(
    @Ctx() ctx: RequestContext,
    @Args('page') page?: number
  ): Promise<Invoice[]> {
    return this.service.getAllInvoices(ctx.channel, page);
  }
}
