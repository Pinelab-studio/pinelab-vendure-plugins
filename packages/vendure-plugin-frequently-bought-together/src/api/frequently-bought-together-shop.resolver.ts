import { Inject } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, Product, RequestContext } from '@vendure/core';
import { FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS } from '../constants';
import { FrequentlyBoughtTogetherService } from '../services/frequently-bought-together.service';
import { PluginInitOptions } from '../types';

@Resolver()
export class FrequentlyBoughtTogetherShopResolver {
  constructor(
    @Inject(FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS)
    private options: PluginInitOptions,
    private frequentlyBoughtTogetherService: FrequentlyBoughtTogetherService
  ) {}

  @ResolveField('frequentlyBoughtWith')
  @Resolver('Product')
  async frequentlyBoughtWith(
    @Ctx() ctx: RequestContext,
    @Parent() product: Product
  ): Promise<Product[]> {
    const products =
      await this.frequentlyBoughtTogetherService.getSortedProducts(
        ctx,
        product
      );
    return products;
  }
}
