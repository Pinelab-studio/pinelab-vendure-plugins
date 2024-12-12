import { Inject } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, Logger, Product, RequestContext } from '@vendure/core';
import {
  FREQUENTLY_BOUGHT_TOGETHER_PLUGIN_OPTIONS,
  loggerCtx,
} from '../constants';
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
    if (!this.options.hasValidLicense) {
      Logger.error(
        `Invalid license key, only returning the top 2 most frequently bought together products`,
        loggerCtx
      );
      return products.slice(0, 2);
    }
    return products;
  }
}
