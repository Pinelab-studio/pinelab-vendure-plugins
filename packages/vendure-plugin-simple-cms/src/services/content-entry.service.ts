import { Inject, Injectable } from '@nestjs/common';
import { unique } from '@vendure/common/lib/unique';
import {
  ChannelService,
  ID,
  LanguageCode,
  ListQueryBuilder,
  ListQueryOptions,
  PaginatedList,
  RelationPaths,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { ContentEntry } from '../entities/content-entry.entity';
import { ContentEntryTranslation } from '../entities/content-entry-translation.entity';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { TypeDefinition, SimpleCmsPluginOptions } from '../types';
import {
  ContentEntryTranslationInput,
  ContentEntryInput,
} from '../api/generated/graphql';

@Injectable()
export class ContentEntryService {
  private readonly relations = ['channels', 'translatableFields'];

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
    input: ContentEntryInput
  ): Promise<ContentEntry> {
    const contentType = this.getContentType(input.contentTypeCode);
    await this.validateAllowMultiple(ctx, input.contentTypeCode);
    this.validateFields(contentType, input);
    const entry = new ContentEntry({
      code: input.code,
      name: input.name,
      contentTypeCode: input.contentTypeCode,
      fields: input.fields,
    });
    const savedEntry = await this.connection
      .getRepository(ctx, ContentEntry)
      .save(entry);
    await this.saveTranslations(ctx, savedEntry, input.translations);
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
    input: ContentEntryInput
  ): Promise<ContentEntry> {
    const contentType = this.getContentType(input.contentTypeCode);
    const existing = await this.connection.findOneInChannel(
      ctx,
      ContentEntry,
      id,
      ctx.channelId,
      { relations: ['translatableFields'] }
    );
    if (!existing) {
      throw new UserInputError(
        `ContentEntry with id '${String(id)}' not found`
      );
    }
    this.validateFields(contentType, input);
    existing.code = input.code;
    existing.name = input.name;
    existing.contentTypeCode = input.contentTypeCode;
    existing.fields = input.fields;
    await this.connection.getRepository(ctx, ContentEntry).save(existing);
    // Remove old translations and save new ones
    if (existing.translatableFields?.length) {
      await this.connection
        .getRepository(ctx, ContentEntryTranslation)
        .remove(existing.translatableFields);
    }
    await this.saveTranslations(ctx, existing, input.translations);
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

  /**
   * Persist translation rows for translatable fields.
   */
  private async saveTranslations(
    ctx: RequestContext,
    entry: ContentEntry,
    translations?: ContentEntryTranslationInput[] | null
  ): Promise<void> {
    if (!translations?.length) {
      return;
    }
    const repo = this.connection.getRepository(ctx, ContentEntryTranslation);
    for (const t of translations) {
      const translation = new ContentEntryTranslation({
        languageCode: t.languageCode,
        fields: t.fields,
        base: entry,
      });
      await repo.save(translation);
    }
  }

  /**
   * Returns the content type definition, or throws if not found.
   */
  private getContentType(contentTypeCode: string): TypeDefinition {
    const contentType =
      this.options.contentTypes[
        contentTypeCode as keyof typeof this.options.contentTypes
      ];
    if (!contentType) {
      throw new UserInputError(
        `Unknown content type '${contentTypeCode}'. Available types: ${Object.keys(
          this.options.contentTypes
        ).join(', ')}`
      );
    }
    return contentType;
  }

  /**
   * Validates that the supplied fields match the content type definition.
   * Non-translatable fields must be in `input.fields`, translatable fields
   * must be in `input.translations[].fields`.
   */
  private validateFields(
    contentType: TypeDefinition,
    input: ContentEntryInput
  ): void {
    for (const fieldDef of contentType.fields) {
      const isTranslatable =
        fieldDef.type !== 'relation' && fieldDef.isTranslatable;
      if (isTranslatable) {
        // Translatable fields should exist in translations, not in top-level fields
        if (fieldDef.name in (input.fields ?? {})) {
          throw new UserInputError(
            `Field '${fieldDef.name}' is translatable and should be provided in 'translations', not in 'fields'`
          );
        }
      } else {
        // Non-translatable and relation fields live in top-level fields
        const isNullable = fieldDef.nullable !== false;
        if (!isNullable && !(fieldDef.name in (input.fields ?? {}))) {
          throw new UserInputError(
            `Required field '${fieldDef.name}' is missing from input fields`
          );
        }
      }
    }
  }

  /**
   * Validates that a new entry can be created for single-instance content types.
   */
  private async validateAllowMultiple(
    ctx: RequestContext,
    contentTypeCode: string
  ): Promise<void> {
    const contentType =
      this.options.contentTypes[
        contentTypeCode as keyof typeof this.options.contentTypes
      ];
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
