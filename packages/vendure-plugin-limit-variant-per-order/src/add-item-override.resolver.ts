import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ShopOrderResolver } from '@vendure/core/dist/api/resolvers/shop/shop-order.resolver';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  Logger,
  Transaction,
  ID,
  idsAreEqual,
} from '@vendure/core';
import { ErrorResultUnion } from '@vendure/core/dist/common/error/error-result';
import { Order } from '@vendure/core/dist/entity/order/order.entity';
import {
  UpdateOrderItemsResult,
  MutationAddItemToOrderArgs,
  MutationAdjustOrderLineArgs,
} from '@vendure/common/lib/generated-shop-types';
import { GraphQLError } from 'graphql';
import { ChannelAwareIntValue } from './types';
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
    this.validate(order, args.productVariantId, ctx.channelId);
    return result;
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateOrder, Permission.Owner)
  async adjustOrderLine(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationAdjustOrderLineArgs
  ): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
    const result = await super.adjustOrderLine(ctx, args);
    if (!(result as Order).code) {
      return result;
    }
    const order = result as Order;
    const orderLine = order.lines.find((line) => line.id == args.orderLineId);
    if (orderLine) {
      this.validate(order, orderLine.productVariant.id, ctx.channelId);
    }
    return result;
  }

  /**
   * Throw an error if quantity is over maxPerOrder
   */
  private validate(
    order: Order,
    variantId: string | number,
    channelId: ID
  ): void {
    const orderLine = order.lines.find(
      (line) => line.productVariant.id == variantId
    )!;
    const maxPerOrder = orderLine.productVariant.customFields.maxPerOrder;
    const onlyAllowPersList =
      orderLine.productVariant.customFields.onlyAllowPer;
    const onlyAllowPer =
      onlyAllowPersList
        .map((v) => JSON.parse(v) as ChannelAwareIntValue)
        .find((channelValue) => idsAreEqual(channelValue.channelId, channelId))
        ?.value ?? 0;
    if (maxPerOrder && orderLine.quantity > maxPerOrder) {
      Logger.warn(
        `There can be only max ${maxPerOrder} of ${orderLine.productVariant.name}s per order, throwing error to prevent this item from being added.`,
        loggerCtx
      );
      throw new GraphQLError(
        `You are only allowed to order max ${maxPerOrder} ${orderLine.productVariant.name}s`,
        { extensions: { code: maxItemsErrorCode } }
      );
    }
    if (onlyAllowPer && orderLine.quantity % onlyAllowPer !== 0) {
      Logger.warn(
        `There can be only a multiple of ${onlyAllowPer} of ${orderLine.productVariant.name}s per order, throwing error to prevent this item from being added.`,
        loggerCtx
      );
      throw new GraphQLError(
        `You are only allowed to order a multiple of ${onlyAllowPer} ${orderLine.productVariant.name}s`,
        { extensions: { code: maxItemsErrorCode } }
      );
    }
    // Throwing an error is sufficient, because it prevents the transaction form being committed, so no items are added
  }
}
