import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import { InvoiceConfigInput } from '../ui/generated/graphql';
import { InvoiceConfigEntity } from './invoice-config.entity';
import { PicklistService } from './picklist.service';

export const picklistPermission = new PermissionDefinition({
  name: 'AllowPicklistPermission',
  description: 'Allow this user to use picklists',
});

@Resolver()
export class PicklistResolver {
  constructor(private readonly service: PicklistService) {}

  @Mutation()
  @Allow(picklistPermission.Permission)
  async upsertInvoiceConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    return await this.service.upsertConfig(ctx, input);
  }

  @Query()
  @Allow(picklistPermission.Permission)
  async invoiceConfig(
    @Ctx() ctx: RequestContext
  ): Promise<InvoiceConfigEntity | undefined> {
    return await this.service.getConfig(ctx);
  }
}
