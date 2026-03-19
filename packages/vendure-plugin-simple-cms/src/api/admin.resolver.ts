import { Inject } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
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
  ContentFieldDefinition,
  MutationCreateContentEntryArgs,
  MutationUpdateContentEntryArgs,
  MutationDeleteContentEntryArgs,
} from './generated/graphql';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { TypeDefinition, SimpleCmsPluginOptions } from '../types';
import { ContentEntry } from '../entities/content-entry.entity';

function mapFieldDefinition(
  field: TypeDefinition['fields'][number]
): ContentFieldDefinition {
  return {
    name: field.name,
    type: field.type,
    nullable: field.nullable !== false,
    isTranslatable: field.type !== 'relation' ? field.isTranslatable : false,
    uiComponent: 'uiComponent' in field ? field.uiComponent ?? null : null,
    fields:
      field.type === 'struct'
        ? field.fields.map((sub) => ({
            name: sub.name,
            type: sub.type,
            nullable: sub.nullable !== false,
            isTranslatable: sub.isTranslatable,
            uiComponent: sub.uiComponent ?? null,
            fields: null,
          }))
        : null,
  };
}

@Resolver('ContentEntry')
export class AdminResolver {
  constructor(
    private readonly contentEntryService: ContentEntryService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: SimpleCmsPluginOptions
  ) {}

  /**
   * Resolves whether multiple entries are allowed for this content type.
   */
  @ResolveField()
  allowMultiple(@Parent() entry: ContentEntry): boolean {
    const definition = this.options.contentTypes[entry.contentTypeCode];
    return definition?.allowMultiple ?? true;
  }

  /**
   * Resolves the field definitions for this entry's content type.
   */
  @ResolveField()
  fieldDefinitions(@Parent() entry: ContentEntry): ContentFieldDefinition[] {
    const definition = this.options.contentTypes[entry.contentTypeCode];
    if (!definition) {
      return [];
    }
    return definition.fields.map(mapFieldDefinition);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.CreateCatalog)
  async createContentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationCreateContentEntryArgs
  ) {
    return this.contentEntryService.create(ctx, args.input);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async updateContentEntry(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationUpdateContentEntryArgs
  ) {
    return this.contentEntryService.update(ctx, args.id, args.input);
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
