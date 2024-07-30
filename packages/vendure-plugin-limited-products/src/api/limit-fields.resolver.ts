import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, Product, RequestContext } from '@vendure/core';
import { getChannelAwareValue } from '../util';

/**
 * Resolves the channel specific setting for maxPerOrder and onlyAllowPer
 */
@Resolver()
export class LimitFieldsResolver {
  @ResolveField('maxQuantityPerOrder')
  @Resolver('Product')
  maxQuantityPerOrder(
    @Ctx() ctx: RequestContext,
    @Parent() product: Product
  ): number | undefined {
    return (
      getChannelAwareValue(ctx, product.customFields.maxPerOrder) || undefined
    );
  }

  @ResolveField('limitPurchasePerMultipleOf')
  @Resolver('Product')
  limitPurchasePerMultipleOf(
    @Ctx() ctx: RequestContext,
    @Parent() product: Product
  ): number | undefined {
    return (
      getChannelAwareValue(ctx, product.customFields.onlyAllowPer) || undefined
    );
  }
}
