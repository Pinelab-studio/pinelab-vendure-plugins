import { Injectable, Inject } from '@nestjs/common';
import {
  VendureConfig,
  ProductVariant,
  ProductVariantService,
  Promotion,
  PromotionService,
  RequestContext,
  SearchService,
  TransactionalConnection,
  FacetValueService,
  EntityHydrator,
} from '@vendure/core';
import { freeGiftPromotionAction } from './free-gift.promotion-action';
import { ConfigurableOperation } from '../../test/src/generated/admin-graphql';

@Injectable()
export class GiftService {
  constructor(
    private promotionService: PromotionService,
    private config: VendureConfig,
    private variantService: ProductVariantService,
    private facetValueService: FacetValueService,
    private entityHydrator: EntityHydrator
  ) {}

  async getEligibleGifts(ctx: RequestContext): Promise<ProductVariant[]> {
    const promotions = await this.getAllEnabledPromotions(ctx);
    const freeGiftPromotions = this.getFreeGiftPromotions(promotions);
    // Get variants based on the actions of the free gift promotions
    const freeGiftActions = this.getFreeGiftActions(freeGiftPromotions);
    const variants: ProductVariant[] = [];
    await Promise.all(
      freeGiftActions.map(async (action) => {
        const facetIds =
          action.args.find((arg) => arg.name === 'facets')?.value || [];
        if (!facetIds) {
          return;
        }

        // Get the variants that have the facets
      })
    );
    console.log(JSON.stringify(freeGiftActions));

    throw Error();
  }

  async getVariantsWithFacets(
    ctx: RequestContext,
    facetIds: string[]
  ): Promise<ProductVariant[]> {
    // TODO find all variants with facetValue
    const facetValues = await this.facetValueService.findAllList(
      ctx,
      {
        filter: {
          id: {
            in: facetIds,
          },
        },
      },
      ['variants']
    );
    this.entityHydrator.hydrate(ctx, facetValues, {
      languageCode: ctx.languageCode,
    });

    return [];
  }

  /**
   * Only return promotions that have a free gift action configured
   */
  getFreeGiftPromotions(promotions: Promotion[]): Promotion[] {
    return promotions.filter((promotion) =>
      promotion.actions.some(
        (action) => action.code === freeGiftPromotionAction.code
      )
    );
  }

  getFreeGiftActions(promotions: Promotion[]): ConfigurableOperation[] {
    const actions: ConfigurableOperation[] = [];
    promotions.forEach((promotion) => {
      promotion.actions.forEach((action) => {
        if (action.code === freeGiftPromotionAction.code) {
          actions.push(action);
        }
      });
    });
    return actions;
  }

  async getAllEnabledPromotions(ctx: RequestContext): Promise<Promotion[]> {
    const promotions: Promotion[] = [];
    let skip = 0;
    const take = 100;
    let hasMore = true;
    while (hasMore) {
      const promoList = await this.promotionService.findAll(ctx, {
        filter: {
          enabled: {
            eq: true,
          },
        },
        skip,
        take,
      });
      promotions.push(...promoList.items);
      hasMore = promotions.length < promoList.totalItems;
      skip += take;
    }
    return promotions;
  }
}
