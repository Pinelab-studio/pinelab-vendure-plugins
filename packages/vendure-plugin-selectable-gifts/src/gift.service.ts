import { Injectable } from '@nestjs/common';
import { ConfigurableOperation } from '@vendure/common/lib/generated-types';
import {
  ConfigArgService,
  ForbiddenError,
  ID,
  OrderService,
  ProductVariant,
  ProductVariantService,
  Promotion,
  PromotionService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { freeGiftPromotionAction } from './free-gift.promotion-action';

@Injectable()
export class GiftService {
  constructor(
    private promotionService: PromotionService,
    private orderService: OrderService,
    private connection: TransactionalConnection,
    private variantService: ProductVariantService
  ) {}

  async getEligibleGiftsForActiveOrder(
    ctx: RequestContext
  ): Promise<ProductVariant[]> {
    if (!ctx.activeUserId) {
      throw new ForbiddenError();
    }
    const order = await this.orderService.getActiveOrderForUser(
      ctx,
      ctx.activeUserId
    );
    if (!order) {
      throw new UserInputError('No active order found');
    }
    return this.getEligibleGiftsForOrder(ctx, order.id);
  }

  async getEligibleGiftsForOrder(
    ctx: RequestContext,
    orderId: ID
  ): Promise<ProductVariant[]> {
    const appliedPromotions =
      await this.promotionService.getActivePromotionsOnOrder(ctx, orderId);
    const freeGiftPromotions = this.findFreeGiftPromotions(appliedPromotions);
    if (!freeGiftPromotions.length) {
      return [];
    }
    const variantIds = this.getVariantIds(freeGiftPromotions);
    if (!variantIds.length) {
      return [];
    }
    return await this.variantService.findByIds(ctx, variantIds);
  }

  /**
   * Only return promotions that have a free gift action configured
   */
  findFreeGiftPromotions(promotions: Promotion[]): Promotion[] {
    return promotions.filter((promotion) =>
      promotion.actions.some(
        (action) => action.code === freeGiftPromotionAction.code
      )
    );
  }

  /**
   * Get the configured variant ID's from the free gift promotion actions
   */
  getVariantIds(promotions: Promotion[]): ID[] {
    const actions: ConfigurableOperation[] = [];
    promotions.forEach((promotion) => {
      promotion.actions.forEach((action) => {
        if (action.code === freeGiftPromotionAction.code) {
          actions.push(action);
        }
      });
    });
    const allVariantIds: ID[] = [];
    actions.forEach(async (action) => {
      const variantsArg = action.args.find(
        (arg) => arg.name === 'variants'
      )?.value;
      if (!variantsArg) {
        return [];
      }
      const variantIds = this.parseConfigArg(variantsArg);
      if (!variantIds.length) {
        return [];
      }
      allVariantIds.push(...variantIds);
    });
    return allVariantIds;
  }

  /**
   * Turns the string '[1,2]' into an actual array of ID's
   */
  parseConfigArg(facetValueIdsArg: string): ID[] {
    return JSON.parse(facetValueIdsArg);
  }
}
