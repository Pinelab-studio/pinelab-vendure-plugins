import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ActiveOrderService,
  Allow,
  Ctx,
  ID,
  Order,
  Permission,
  ProductVariant,
  RequestContext,
  Transaction,
  UserInputError,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { GiftService } from '../api/gift.service';

export const shopApiExtensions = gql`
  extend type Query {
    eligibleGifts: [ProductVariant!]!
  }

  extend type Mutation {
    addSelectedGiftToOrder(productVariantId: ID!): UpdateOrderItemsResult!
  }
`;

@Resolver()
export class GiftResolver {
  constructor(
    private giftService: GiftService,
    private activeOrderService: ActiveOrderService
  ) {}

  @Query()
  @Allow(Permission.Public)
  async eligibleGifts(@Ctx() ctx: RequestContext): Promise<ProductVariant[]> {
    const activeOrder = await this.getActiveOrder(ctx);
    return this.giftService.getEligibleGiftsForOrder(ctx, activeOrder.id);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateOrder, Permission.Owner)
  async addSelectedGiftToOrder(
    @Ctx() ctx: RequestContext,
    @Args('productVariantId') productVariantId: ID
  ): Promise<Order> {
    const activeOrder = await this.getActiveOrder(ctx);
    return this.giftService.addGiftToOrder(
      ctx,
      activeOrder.id,
      productVariantId
    );
  }

  async getActiveOrder(ctx: RequestContext): Promise<Order> {
    const order = await this.activeOrderService.getActiveOrder(
      ctx,
      undefined,
      true
    );
    if (!order) {
      throw new UserInputError('No active order found');
    }
    return order;
  }
}
