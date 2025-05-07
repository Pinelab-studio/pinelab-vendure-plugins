import { Args, Query, Resolver } from '@nestjs/graphql';
import { OrderAddress, Permission } from '@vendure/common/lib/generated-types';
import { ID } from '@vendure/common/lib/shared-types';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { AddressLookupService } from '../services/address-lookup.service';

@Resolver()
export class AddressLookupResolver {
  constructor(private addressLookupService: AddressLookupService) {}

  @Query()
  @Allow(Permission.SuperAdmin)
  async lookupAddress(
    @Ctx() ctx: RequestContext,
    @Args() args: { id: ID }
  ): Promise<OrderAddress[]> {
    return this.addressLookupService.lookupAddress(ctx, args.id);
  }
}
