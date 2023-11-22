import gql from 'graphql-tag';
import { Resolver, Query } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  ProductVariant,
} from '@vendure/core';
import { GiftService } from '../api/gift.service';

export const shopApiExtensions = gql`
  extend type Query {
    eligibleGifts: [ProductVariant!]!
  }
`;

@Resolver()
export class GiftResolver {
  constructor(private service: GiftService) {}

  @Query()
  @Allow(Permission.Public)
  async eligibleGifts(@Ctx() ctx: RequestContext): Promise<ProductVariant[]> {
    return this.service.getEligibleGiftsForActiveOrder(ctx);
  }
}
