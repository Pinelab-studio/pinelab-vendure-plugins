import { Inject, Injectable } from '@nestjs/common';
import { unique } from '@vendure/common/lib/unique';
import {
  ChannelService,
  ID,
  ListQueryBuilder,
  ListQueryOptions,
  PaginatedList,
  RelationPaths,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { ContentEntry } from '../entities/content-entry.entity';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { SimpleCmsPluginOptions } from '../types';

@Injectable()
export class ContentEntryService {
  private readonly relations = ['channels'];

  constructor(
    private readonly connection: TransactionalConnection,
    private readonly channelService: ChannelService,
    private readonly listQueryBuilder: ListQueryBuilder,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: SimpleCmsPluginOptions
  ) {}

  findAll(
    ctx: RequestContext,
    options?: ListQueryOptions<ContentEntry>,
    relations?: RelationPaths<ContentEntry>
  ): Promise<PaginatedList<ContentEntry>> {
    return this.listQueryBuilder
      .build(ContentEntry, options, {
        ctx,
        relations: relations ?? this.relations,
        channelId: ctx.channelId,
      })
      .getManyAndCount()
      .then(([items, totalItems]) => ({
        items,
        totalItems,
      }));
  }

  async findOne(
    ctx: RequestContext,
    id: ID,
    relations?: RelationPaths<ContentEntry>
  ): Promise<ContentEntry | undefined> {
    const effectiveRelations = relations ?? this.relations.slice();
    return this.connection.findOneInChannel(
      ctx,
      ContentEntry,
      id,
      ctx.channelId,
      { relations: unique(effectiveRelations) }
    );
  }

  async create(
    ctx: RequestContext,
    input: {
      code: string;
      name: string;
      contentTypeCode: string;
      fields: Record<string, unknown>;
    }
  ): Promise<ContentEntry> {
    this.validateContentType(input.contentTypeCode);
    await this.validateAllowMultiple(ctx, input.contentTypeCode);
    const entry = new ContentEntry({
      code: input.code,
      name: input.name,
      contentTypeCode: input.contentTypeCode,
      fields: input.fields,
    });
    const savedEntry = await this.connection
      .getRepository(ctx, ContentEntry)
      .save(entry);
    const defaultChannel = await this.channelService.getDefaultChannel();
    await this.channelService.assignToChannels(
      ctx,
      ContentEntry,
      savedEntry.id,
      unique([defaultChannel.id, ctx.channel.id])
    );
    const result = await this.findOne(ctx, savedEntry.id);
    if (!result) {
      throw new Error('ContentEntry not found after creation');
    }
    return result;
  }

  async update(
    ctx: RequestContext,
    id: ID,
    input: {
      code: string;
      name: string;
      contentTypeCode: string;
      fields: Record<string, unknown>;
    }
  ): Promise<ContentEntry> {
    this.validateContentType(input.contentTypeCode);
    const existing = await this.connection.findOneInChannel(
      ctx,
      ContentEntry,
      id,
      ctx.channelId
    );
    if (!existing) {
      throw new UserInputError(
        `ContentEntry with id '${String(id)}' not found`
      );
    }
    existing.code = input.code;
    existing.name = input.name;
    existing.contentTypeCode = input.contentTypeCode;
    existing.fields = input.fields;
    await this.connection.getRepository(ctx, ContentEntry).save(existing);
    const result = await this.findOne(ctx, id);
    if (!result) {
      throw new Error('ContentEntry not found after update');
    }
    return result;
  }

  async delete(ctx: RequestContext, id: ID): Promise<void> {
    const existing = await this.connection.findOneInChannel(
      ctx,
      ContentEntry,
      id,
      ctx.channelId
    );
    if (!existing) {
      throw new UserInputError(
        `ContentEntry with id '${String(id)}' not found`
      );
    }
    await this.connection.getRepository(ctx, ContentEntry).remove(existing);
  }

  private validateContentType(contentTypeCode: string): void {
    const contentType = this.options.contentTypes.find(
      (ct) => ct.code === contentTypeCode
    );
    if (!contentType) {
      throw new UserInputError(
        `Unknown content type '${contentTypeCode}'. Available types: ${this.options.contentTypes
          .map((ct) => ct.code)
          .join(', ')}`
      );
    }
  }

  /**
   * Validates that a new entry can be created for single-instance content types.
   */
  private async validateAllowMultiple(
    ctx: RequestContext,
    contentTypeCode: string
  ): Promise<void> {
    const contentType = this.options.contentTypes.find(
      (ct) => ct.code === contentTypeCode
    );
    if (!contentType || contentType.allowMultiple) {
      return;
    }
    const existing = await this.listQueryBuilder
      .build(ContentEntry, undefined, {
        ctx,
        channelId: ctx.channelId,
        where: { contentTypeCode },
      })
      .getCount();
    if (existing > 0) {
      throw new UserInputError(
        `Content type '${contentTypeCode}' only allows a single entry and one already exists`
      );
    }
  }
}
