import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ForbiddenError, RequestContext } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { KlaviyoPluginOptions } from '../klaviyo.plugin';
import { KlaviyoService } from '../service/klaviyo.service';

@Resolver()
export class KlaviyoShopResolver {
  constructor(
    private readonly klaviyoService: KlaviyoService,
    @Inject(PLUGIN_INIT_OPTIONS) private readonly options: KlaviyoPluginOptions
  ) {}

  @Mutation()
  async klaviyoCheckoutStarted(@Ctx() ctx: RequestContext): Promise<boolean> {
    return await this.klaviyoService.handleCheckoutStarted(ctx);
  }

  @Mutation()
  async subscribeToKlaviyoList(
    @Ctx() ctx: RequestContext,
    @Args('emailAddress') emailAddress: string,
    @Args('listId') list: string
  ): Promise<boolean> {
    this.checkForSessionExistance(ctx);
    await this.klaviyoService.subscribeToList(ctx, emailAddress, list);
    return true;
  }

  @Mutation()
  async subscribeToKlaviyoBackInStock(
    @Ctx() ctx: RequestContext,
    @Args('emailAddress') emailAddress: string,
    @Args('catalogItemId') catalogItemId: string
  ): Promise<boolean> {
    this.checkForSessionExistance(ctx);
    await this.klaviyoService.subscribeToBackInStock(
      ctx,
      emailAddress,
      catalogItemId
    );
    return true;
  }

  @Query()
  async klaviyoProductFeed(
    @Ctx() ctx: RequestContext,
    @Args('password') password: string
  ): Promise<string> {
    // Basic protection - check if password is configured and matches
    const configuredPassword = this.options.feed?.password;
    if (!configuredPassword || configuredPassword !== password) {
      throw new ForbiddenError();
    }
    const productFeed = await this.klaviyoService.getProductFeed(ctx);
    return JSON.stringify(productFeed);
  }

  /**
   * Prevent bot access by checking if token exists. This means a user has at least done a mutation before, like add to cart.
   * Throws ForbiddenError if no session exists.
   */
  private checkForSessionExistance(ctx: RequestContext): void {
    if (!ctx.session?.token) {
      throw new ForbiddenError();
    }
  }
}
