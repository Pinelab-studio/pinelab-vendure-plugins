import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import { PicklistConfigEntity } from './picklist-config.entity';
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
  async upsertPicklistConfig(
    @Ctx() ctx: RequestContext,
    @Args('templateString') templateString: string
  ): Promise<PicklistConfigEntity> {
    return await this.service.upsertConfig(ctx, templateString);
  }

  @Query()
  @Allow(picklistPermission.Permission)
  async picklistConfig(
    @Ctx() ctx: RequestContext
  ): Promise<PicklistConfigEntity | undefined> {
    return await this.service.getConfig(ctx);
  }
}
