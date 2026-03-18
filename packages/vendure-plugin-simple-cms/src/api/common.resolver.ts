import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RelationPaths, Relations, RequestContext } from '@vendure/core';
import { ContentEntry } from '../entities/content-entry.entity';
import { ContentEntryService } from '../services/content-entry.service';
import {
  QueryContentEntriesArgs,
  QueryContentEntryArgs,
} from './generated/graphql';

@Resolver()
export class CommonResolver {
  constructor(private readonly contentEntryService: ContentEntryService) {}

  @Query()
  async contentEntries(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntriesArgs,
    @Relations({ entity: ContentEntry }) relations: RelationPaths<ContentEntry>
  ) {
    return this.contentEntryService.findAll(
      ctx,
      args.options ?? undefined,
      relations
    );
  }

  @Query()
  async contentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntryArgs,
    @Relations({ entity: ContentEntry }) relations: RelationPaths<ContentEntry>
  ) {
    return this.contentEntryService.findOne(ctx, args.id, relations);
  }
}
