import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
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
  QueryContentEntriesArgs,
  QueryContentEntryArgs,
  QueryContentEntryByCodeArgs,
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

  @Query()
  async contentEntries(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntriesArgs
  ) {
    const items = await this.contentEntryService.findByContentTypeCode(
      ctx,
      args.contentTypeCode
    );
    return items.map((e) => flattenEntry(ctx, e, this.options));
  }

  @Query()
  async contentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntryArgs
  ) {
    const entry = await this.contentEntryService.findOne(ctx, args.id);
    return entry ? flattenEntry(ctx, entry, this.options) : undefined;
  }

  @Query()
  async contentEntryByCode(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntryByCodeArgs
  ) {
    const entry = await this.contentEntryService.findByCode(ctx, args.code);
    return entry ? flattenEntry(ctx, entry, this.options) : undefined;
  }
}
