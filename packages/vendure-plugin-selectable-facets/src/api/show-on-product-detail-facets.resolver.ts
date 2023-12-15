import { Query, Resolver, Args } from '@nestjs/graphql';
import {
  Ctx,
  RequestContext,
  ProductService,
  FacetService,
} from '@vendure/core';
import { ShowOnProductDetailFacetsService } from './show-on-product-detail-facets.service';
import { QueryShowOnProductDetailForFacetArgs } from '../ui/generated/graphql';

@Resolver()
export class ShowOnProductDetailFacetsResolver {
  constructor(
    private readonly requiedFactesService: ShowOnProductDetailFacetsService
  ) {}

  @Query()
  async showOnProductDetailFacets(@Ctx() ctx: RequestContext) {
    return await this.requiedFactesService.showOnProductDetailFacets(ctx);
  }

  @Query()
  async showOnProductDetailForFacets(
    @Ctx() ctx: RequestContext,
    @Args() { facetValueIds }: QueryShowOnProductDetailForFacetArgs
  ) {
    return await this.requiedFactesService.showOnProductDetailForFacets(
      ctx,
      facetValueIds
    );
  }
}
