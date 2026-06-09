import { Inject, Injectable } from '@nestjs/common';
import { unique } from '@vendure/common/lib/unique';
import {
  ChannelService,
  ConfigService,
  EventBus,
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
import { validateContentEntryInput } from './validate-content-entry-input';
import { SimpleCmsContentEntryEvent } from '../events/simple-cms-content-entry-event';

@Injectable()
export class ContentEntryService {
  private readonly relations = ['channels', 'translatableFields'];

  constructor(
    private readonly connection: TransactionalConnection,
    private readonly channelService: ChannelService,
    private readonly listQueryBuilder: ListQueryBuilder,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: SimpleCmsPluginOptions
  ) { }

  /** Returns a paginated list of all content entries in the current channel. */
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

  /** Finds a single content entry by ID, scoped to the current channel. */
  async findOne(
    ctx: RequestContext,
    id: ID
  ): Promise<ContentEntry | undefined> {
    return this.connection.findOneInChannel(
      ctx,
      ContentEntry,
      id,
      ctx.channelId
    );
  }

  /**
   * Find all entries for a given `contentTypeCode`, scoped to the current channel.
   */
  async findByContentTypeCode(
    ctx: RequestContext,
    contentTypeCode: string
  ): Promise<ContentEntry[]> {
    return this.connection
      .getRepository(ctx, ContentEntry)
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.channels', 'channel')
      .leftJoinAndSelect('entry.translatableFields', 'translatableFields')
      .where('entry.contentTypeCode = :contentTypeCode', { contentTypeCode })
      .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
      .getMany();
  }

  /** Creates a new content entry with validation, channel assignment, and event publishing. */
  async create(
    ctx: RequestContext,
    input: ContentEntryInput
  ): Promise<ContentEntry> {
    const contentType = this.getContentType(input.contentTypeCode);
    await this.validateAllowMultiple(ctx, input.contentTypeCode);
    validateContentEntryInput(contentType, input);
    const decodedInput = this.decodeRelationIds(contentType, input);
    const entry = new ContentEntry({
      contentTypeCode: decodedInput.contentTypeCode,
      fields: decodedInput.fields as Record<string, unknown>,
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
    await this.eventBus.publish(
      new SimpleCmsContentEntryEvent(result, 'created', ctx, input)
    );
    return result;
  }

  /** Updates an existing content entry, replacing translations and re-validating constraints. */
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
    if (existing.contentTypeCode !== input.contentTypeCode) {
      await this.validateAllowMultiple(ctx, input.contentTypeCode);
    }
    validateContentEntryInput(contentType, input);
    const decodedInput = this.decodeRelationIds(contentType, input);
    existing.contentTypeCode = decodedInput.contentTypeCode;
    existing.fields = decodedInput.fields as Record<string, unknown>;
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
    await this.eventBus.publish(
      new SimpleCmsContentEntryEvent(result, 'updated', ctx, input)
    );
    return result;
  }

  /** Soft-deletes a content entry and publishes a deletion event. */
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
    await this.connection.getRepository(ctx, ContentEntry).softRemove(existing);
    await this.eventBus.publish(
      new SimpleCmsContentEntryEvent(existing, 'deleted', ctx, id)
    );
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
        languageCode: t.languageCode as LanguageCode,
        fields: t.fields as Record<string, unknown>,
        base: entry,
      });
      await repo.save(translation);
    }
  }

  /**
   * Returns the content type definition, or throws if not found.
   */
  private getContentType(contentTypeCode: string): TypeDefinition {
    const contentType = this.options.contentTypes[contentTypeCode];
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
   * Validates that a new entry can be created for single-instance content types.
   */
  private async validateAllowMultiple(
    ctx: RequestContext,
    contentTypeCode: string
  ): Promise<void> {
    const contentType = this.options.contentTypes[contentTypeCode];
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

  /**
   * Decode any relation-field ids in the input from the public
   * (encoded) form back to the internal database id form, using the
   * configured `EntityIdStrategy`.
   *
   * The Vendure `IdInterceptor` only decodes values typed as `ID` in the
   * GraphQL schema. Our `fields` arg is typed as `JSON`, so nested
   * `{ id: ... }` values inside relation fields are NOT auto-decoded on
   * input. Without this step, the encoded id (e.g. `"T_2"`) would be
   * stored verbatim, and the response encoder would then encode it a
   * second time on read (e.g. `"T_T_2"`).
   */
  private decodeRelationIds(
    contentType: TypeDefinition,
    input: ContentEntryInput
  ): ContentEntryInput {
    const strategy = this.configService.entityOptions.entityIdStrategy!;
    const fields = this.decodeRelationIdsInFields(
      contentType.fields,
      input.fields,
      strategy
    );
    const translations = input.translations?.map((t) => ({
      ...t,
      fields: this.decodeRelationIdsInFields(
        contentType.fields,
        t.fields,
        strategy
      ),
    }));
    return { ...input, fields, translations };
  }

  /**
   * Decodes encoded relation IDs within a flat fields object using the
   * given `EntityIdStrategy`.
   */
  private decodeRelationIdsInFields(
    fieldDefs: TypeDefinition['fields'],
    fieldsInput: unknown,
    strategy: { decodeId: (id: string) => string | number }
  ): Record<string, unknown> {
    const fields = { ...((fieldsInput ?? {}) as Record<string, unknown>) };
    for (const def of fieldDefs) {
      if (def.type !== 'relation') continue;
      const value = fields[def.name];
      if (def.list && Array.isArray(value)) {
        fields[def.name] = (value as unknown[]).map((item: unknown) => {
          if (
            typeof item !== 'object' ||
            item === null ||
            !('id' in item)
          ) {
            return item;
          }
          const obj = item as Record<string, unknown>;
          const raw = obj.id;
          if (typeof raw === 'string') {
            return { ...obj, id: strategy.decodeId(raw) };
          } else if (typeof raw === 'number') {
            return { ...obj, id: raw };
          }
          return item;
        });
        continue;
      }
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'id' in value
      ) {
        const obj = value as Record<string, unknown>;
        const raw = obj.id;
        if (typeof raw === 'string') {
          fields[def.name] = {
            ...obj,
            id: strategy.decodeId(raw),
          };
        } else if (typeof raw === 'number') {
          fields[def.name] = {
            ...obj,
            id: raw,
          };
        }
      }
    }
    return fields;
  }
}
