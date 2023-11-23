import { Injectable } from '@nestjs/common';
import {
  ConfigurableOperation,
  UpdateOrderItemsResult,
} from '@vendure/common/lib/generated-types';
import {
  OrderService,
  ProductVariant,
  ProductVariantService,
  Promotion,
  PromotionService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
  Order,
  ID,
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

  /**
   * Get elligible gifts for the order based on the applied promotions
   */
  async getEligibleGiftsForOrder(
    ctx: RequestContext,
    orderId: ID
  ): Promise<ProductVariant[]> {
    const appliedPromotions =
      await this.promotionService.getActivePromotionsOnOrder(ctx, orderId);
    const freeGiftPromotions = appliedPromotions.filter((promotion) =>
      promotion.actions.some(
        (action) => action.code === freeGiftPromotionAction.code
      )
    );
    if (!freeGiftPromotions.length) {
      return [];
    }
    const variantIds = this.getConfiguredGifts(freeGiftPromotions);
    if (!variantIds.length) {
      return [];
    }
    return await this.variantService.findByIds(ctx, variantIds);
  }

  /**
   * Removes any previously selected gifts and adds the new gift to the order
   */
  async addGiftToOrder(
    ctx: RequestContext,
    orderId: ID,
    productVariantId: ID
  ): Promise<Order> {
    const eligibleGifts = await this.getEligibleGiftsForOrder(ctx, orderId);
    if (!eligibleGifts.find((gift) => gift.id === productVariantId)) {
      throw new UserInputError(
        `Variant ${productVariantId} is not eligible as gift for this order`
      );
    }
    const order = await this.orderService.findOne(ctx, orderId, [
      'lines',
      'lines.productVariant',
    ]);
    if (!order) {
      throw new UserInputError(`Order with id ${orderId} not found`);
    }
    // Remove previously selected gifts if any
    const giftLine = order.lines.find(
      (line) => (line.customFields as any)?.isSelectedAsGift
    );
    if (giftLine) {
      await this.orderService.adjustOrderLine(ctx, orderId, giftLine.id, 0, {
        isSelectedAsGift: false,
      });
    }
    return this.orderService.addItemToOrder(ctx, orderId, productVariantId, 1, {
      isSelectedAsGift: true,
    }) as any;
  }

  /**
   * Get the configured variant ID's from the free gift promotion actions
   */
  private getConfiguredGifts(promotions: Promotion[]): ID[] {
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
  private parseConfigArg(facetValueIdsArg: string): ID[] {
    return JSON.parse(facetValueIdsArg);
  }
}
