import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ShopOrderResolver } from '@vendure/core/dist/api/resolvers/shop/shop-order.resolver';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  Logger,
  Transaction,
} from '@vendure/core';
import { ErrorResultUnion } from '@vendure/core/dist/common/error/error-result';
import { Order } from '@vendure/core/dist/entity/order/order.entity';
import {
  UpdateOrderItemsResult,
  MutationAddItemToOrderArgs,
} from '@vendure/common/lib/generated-shop-types';
import { ApolloError } from 'apollo-server-core';

const loggerCtx = 'LimitVariantPerOrderPlugin';
const maxItemsErrorCode = 'MAX_ITEMS_PER_ORDER_ERROR';

/**
 * Resolver that overrides the default addItemToOrder mutation
 */
@Resolver()
export class AddItemOverrideResolver extends ShopOrderResolver {
  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateOrder, Permission.Owner)
  async addItemToOrder(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationAddItemToOrderArgs
  ): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
    const result = await super.addItemToOrder(ctx, args);
    if (!(result as Order).code) {
      return result;
    }
    const order = result as Order;
    const orderLine = order.lines.find(
      (line) => line.productVariant.id == args.productVariantId
    )!;
    const maxPerOrder = (orderLine.productVariant.customFields as any)
      .maxPerOrder;
    if (maxPerOrder && orderLine.quantity > maxPerOrder) {
      Logger.warn(
        `There can be only max ${maxPerOrder} of ${orderLine.productVariant.name} per order, throwing error to prevent this item from being added.`
      );
      throw new ApolloError(
        `You are only allowed to order max ${maxPerOrder} of ${orderLine.productVariant.name}`,
        maxItemsErrorCode
      );
      // Throwing an error is sufficient, because it prevents the transaction form being committed, so no items are added
    }
    return result;
  }
}
