import { Inject } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
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
  AdminContentEntry,
  MutationCreateContentEntryArgs,
  MutationUpdateContentEntryArgs,
  MutationDeleteContentEntryArgs,
  QueryContentEntriesArgs,
  QueryContentEntryArgs,
  SimpleCmsContentType,
  SimpleCmsField,
} from './generated/graphql';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import {
  PrimitiveFieldDefinition,
  SimpleCmsPluginOptions,
  TypeDefinition,
} from '../types';
import { flattenEntry } from './flatten-entry';
import { deriveDisplayName } from './derive-display-name';
import { ContentEntry } from '../entities/content-entry.entity';

/**
 * Maps a primitive field definition (used both at top-level and as
 * a nested field of a struct) to its DTO representation.
 */
function mapPrimitiveField(field: PrimitiveFieldDefinition): SimpleCmsField {
  return {
    name: field.name,
    type: field.type,
    nullable: field.nullable === true,
    isTranslatable: field.isTranslatable,
    graphQLType: null,
    fields: null,
    ui: field.ui ?? null,
  };
}

/**
 * Maps a top-level field definition (primitive | struct | relation)
 * to its DTO representation.
 */
function mapField(field: TypeDefinition['fields'][number]): SimpleCmsField {
  if (field.type === 'struct') {
    return {
      name: field.name,
      type: 'struct',
      nullable: field.nullable === true,
      isTranslatable: field.isTranslatable,
      graphQLType: null,
      fields: field.fields.map(mapPrimitiveField),
      ui: null,
    };
  }
  if (field.type === 'relation') {
    return {
      name: field.name,
      type: 'relation',
      nullable: field.nullable === true,
      isTranslatable: null,
      graphQLType: field.graphQLType,
      fields: null,
      ui: field.ui ?? null,
    };
  }
  return mapPrimitiveField(field);
}

/**
 * Maps a content-type definition to its DTO representation.
 */
function toContentTypeDto(
  code: string,
  def: TypeDefinition
): SimpleCmsContentType {
  return {
    code,
    displayName: def.displayName,
    allowMultiple: def.allowMultiple,
    fields: def.fields.map(mapField),
  };
}

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
    const result = await this.contentEntryService.findAll(
      ctx,
      args.options ?? undefined
    );
    return {
      items: result.items.map((e) => flattenEntry(ctx, e, this.options)),
      totalItems: result.totalItems,
    };
  }

  @Query()
  async contentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryContentEntryArgs
  ) {
    const entry = await this.contentEntryService.findOne(ctx, args.id);
    return entry ? flattenEntry(ctx, entry, this.options) : undefined;
  }

  /**
   * Returns metadata for all configured content types, including UI
   * configuration so the React Dashboard can render the correct form
   * inputs for each field.
   */
  @Query()
  @Allow(Permission.ReadCatalog)
  simpleCmsContentTypes(): SimpleCmsContentType[] {
    return Object.entries(this.options.contentTypes ?? {}).map(([code, def]) =>
      toContentTypeDto(code, def)
    );
  }

  /**
   * Returns metadata for a single content type by its code, or null if
   * no such content type is configured.
   */
  @Query()
  @Allow(Permission.ReadCatalog)
  simpleCmsContentType(
    @Args() args: { code: string }
  ): SimpleCmsContentType | null {
    const def = this.options.contentTypes?.[args.code];
    return def ? toContentTypeDto(args.code, def) : null;
  }

  @ResolveField('displayName')
  @Resolver('AdminContentEntry')
  displayName(
    @Ctx() ctx: RequestContext,
    @Parent() entry: AdminContentEntry & ContentEntry
  ): string | null {
    const def = this.options.contentTypes?.[entry.contentTypeCode];
    return deriveDisplayName(entry, def, ctx.languageCode);
  }
}
