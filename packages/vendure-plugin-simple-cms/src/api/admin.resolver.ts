import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  Permission,
  RequestContext,
  Transaction,
} from '@vendure/core';
import {
  DeletionResponse,
  DeletionResult,
} from '@vendure/common/lib/generated-types';
import { ContentEntryService } from '../services/content-entry.service';
import {
  MutationCreateContentEntryArgs,
  MutationUpdateContentEntryArgs,
  MutationDeleteContentEntryArgs,
} from './generated/graphql';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { SimpleCmsPluginOptions } from '../types';
import { flattenEntry } from './flatten-entry';

@Resolver()
export class AdminResolver {
  constructor(
    private readonly contentEntryService: ContentEntryService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: SimpleCmsPluginOptions
  ) {}

  @Transaction()
  @Mutation()
  @Allow(Permission.CreateCatalog)
  async createContentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationCreateContentEntryArgs
  ) {
    const entry = await this.contentEntryService.create(ctx, args.input);
    return flattenEntry(ctx, entry, this.options);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async updateContentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationUpdateContentEntryArgs
  ) {
    const entry = await this.contentEntryService.update(
      ctx,
      args.id,
      args.input
    );
    return flattenEntry(ctx, entry, this.options);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.DeleteCatalog)
  async deleteContentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationDeleteContentEntryArgs
  ): Promise<DeletionResponse> {
    await this.contentEntryService.delete(ctx, args.id);
    return { result: DeletionResult.DELETED };
  }
}
