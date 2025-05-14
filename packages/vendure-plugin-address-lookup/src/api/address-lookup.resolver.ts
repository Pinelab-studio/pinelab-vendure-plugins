import { Args, Query, Resolver } from '@nestjs/graphql';
import { OrderAddress } from '@vendure/common/lib/generated-types';
import { Ctx, ForbiddenError, RequestContext } from '@vendure/core';
import { QueryLookupAddressArgs } from '../generated/graphql';
import { AddressLookupService } from '../services/address-lookup.service';

@Resolver()
export class AddressLookupResolver {
  constructor(private addressLookupService: AddressLookupService) {}

  @Query()
  async lookupAddress(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryLookupAddressArgs
  ): Promise<OrderAddress[]> {
    if (!ctx.session?.activeOrderId) {
      // Prevent abuse, so only allow calls with an active order
      throw new ForbiddenError();
    }
    return await this.addressLookupService.lookupAddress(ctx, args.input);
  }
}
