import { Inject } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RelationPaths, Relations, RequestContext } from '@vendure/core';
import { ContentEntry } from '../entities/content-entry.entity';
import { ContentEntryService } from '../services/content-entry.service';
import {
  QueryContentEntriesArgs,
  QueryContentEntryArgs,
  QueryContentEntryByCodeArgs,
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
    const items = await this.contentEntryService.findByContentTypeCode(
      ctx,
      args.contentTypeCode
    );
    return items.map((e) => flattenEntry(ctx, e, this.options));
  }

  @Query()
  async contentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntryArgs,
    @Relations({ entity: ContentEntry }) relations: RelationPaths<ContentEntry>
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
