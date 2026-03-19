import { Inject } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RelationPaths, Relations, RequestContext } from '@vendure/core';
import { ContentEntry } from '../entities/content-entry.entity';
import { ContentEntryService } from '../services/content-entry.service';
import {
  QueryContentEntriesArgs,
  QueryContentEntryArgs,
} from './generated/graphql';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { SimpleCmsPluginOptions } from '../types';
import { flattenEntry } from './flatten-entry';

@Resolver()
export class CommonResolver {
  constructor(
    private readonly contentEntryService: ContentEntryService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: SimpleCmsPluginOptions
  ) {}

  @Query()
  async contentEntries(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntriesArgs,
    @Relations({ entity: ContentEntry }) relations: RelationPaths<ContentEntry>
  ) {
    const result = await this.contentEntryService.findAll(
      ctx,
      args.options ?? undefined,
      relations
    );
    return {
      items: result.items.map((e) => flattenEntry(ctx, e, this.options)),
      totalItems: result.totalItems,
    };
  }

  @Query()
  async contentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntryArgs,
    @Relations({ entity: ContentEntry }) relations: RelationPaths<ContentEntry>
  ) {
    const entry = await this.contentEntryService.findOne(
      ctx,
      args.id,
      relations
    );
    return entry ? flattenEntry(ctx, entry, this.options) : undefined;
  }
}
