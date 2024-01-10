import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import { InvoiceConfigInput } from '../ui/generated/graphql';
import { InvoiceConfigEntity } from './invoice-config.entity';
import { PinelabPluginAdminComponentsService } from './pinelab-plugin-admin-components.service';

export const pinelabPluginComponetsPermission = new PermissionDefinition({
  name: 'AllowPinelabPluginAdminPermission',
  description: 'Allow this user to enable pinelab plugin admin components',
});

@Resolver()
export class PinelabPluginAdminComponentsResolver {
  constructor(private readonly service: PinelabPluginAdminComponentsService) {}

  @Mutation()
  @Allow(pinelabPluginComponetsPermission.Permission)
  async upsertInvoiceConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    return await this.service.upsertConfig(ctx, input);
  }

  @Query()
  @Allow(pinelabPluginComponetsPermission.Permission)
  async invoiceConfig(
    @Ctx() ctx: RequestContext
  ): Promise<InvoiceConfigEntity | undefined> {
    return await this.service.getConfig(ctx);
  }
}
