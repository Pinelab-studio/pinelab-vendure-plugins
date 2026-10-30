import { Inject, Injectable, Type } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  Logger,
  RequestContext,
  TransactionalConnection,
  TranslatorService,
} from '@vendure/core';
import { In } from 'typeorm';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { ContentEntryService } from '../services/content-entry.service';
import { RelationFieldDefinition, SimpleCmsPluginOptions } from '../types';
import { toGraphQLTypeName } from './api-extensions';
import { flattenEntry } from './flatten-entry';

/**
 * Resolves the concrete `__typename` for the `ContentEntry` interface
 * in the Shop API, based on the entry's `contentTypeCode`.
 */
@Resolver('ContentEntry')
export class ContentEntryInterfaceResolver {
  __resolveType(value: { contentTypeCode?: string; __typename?: string }) {
    if (value.__typename) {
      return value.__typename;
    }
    if (value.contentTypeCode) {
      return toGraphQLTypeName(value.contentTypeCode);
    }
    return null;
  }
}

/**
 * Builds a NestJS resolver class with one Query method per content type.
 *
 * - `allowMultiple: true`  → list query (`<key>s`) and by-id query (`<key>(id)`).
 * - `allowMultiple: false` → singleton query (`<key>`) returning the
 *   first entry of that type for the channel.
 *
 * Method names on the class are prefixed (`list_`, `find_`, `single_`) to
 * avoid collisions with reserved JS identifiers; the GraphQL field name
 * passed to `@Query()` is the actual schema name.
 */
export function createShopResolver(
  options: SimpleCmsPluginOptions,
): Type<unknown> {
  @Resolver()
  @Injectable()
  class DynamicShopResolver {
    constructor(
      readonly contentEntryService: ContentEntryService,
      readonly connection: TransactionalConnection,
      readonly translator: TranslatorService,
      @Inject(PLUGIN_INIT_OPTIONS)
      readonly opts: SimpleCmsPluginOptions,
    ) {}

    /**
     * Resolves relation fields by loading the related entities from the database.
     *
     * Single relations use `findOne`; list relations use `findBy` with `In(ids)`
     * and preserve the order of the input array.
     *
     * If the loaded entity is `Translatable` (i.e. has a `translations` relation
     * with a `languageCode`), it is run through {@link TranslatorService.translate}
     * so that translated fields (e.g. `name`, `slug`) resolve correctly via the
     * standard Vendure field resolvers.
     */
    async resolveRelationFields(
      entry: Record<string, unknown>,
      typeDef: SimpleCmsPluginOptions['contentTypes'][string],
      ctx: RequestContext,
    ): Promise<Record<string, unknown>> {
      const result = { ...entry };
      for (const field of typeDef.fields) {
        if (field.type !== 'relation') {
          continue;
        }

        try {
          const resolved = await this.resolveRelationValue(
            entry[field.name],
            field,
            ctx,
          );
          if (resolved !== undefined) result[field.name] = resolved;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          Logger.error(
            `Failed to load relation field '${field.name}' for content type '${typeDef.displayName}': ${err.message}`,
            loggerCtx,
            err.stack,
          );
          result[field.name] = entry[field.name];
        }
      }
      return result;
    }

    /** Dispatches relation resolution according to the configured cardinality. */
    async resolveRelationValue(
      value: unknown,
      field: RelationFieldDefinition,
      ctx: RequestContext,
    ): Promise<unknown> {
      return field.list
        ? this.resolveRelationList(value, field, ctx)
        : this.resolveSingleRelation(value, field, ctx);
    }

    /** Loads relation lists in input order, retaining only entities that still exist. */
    async resolveRelationList(
      value: unknown,
      field: RelationFieldDefinition,
      ctx: RequestContext,
    ): Promise<unknown[] | undefined> {
      if (!Array.isArray(value) || value.length === 0) return;
      const ids = value.map((v) => v.id).filter((id) => id != null);
      if (ids.length === 0) return;
      const repository = this.connection.getRepository(ctx, field.entity);
      const hasTranslations = repository.metadata.relations.some(
        (r) => r.propertyName === 'translations',
      );
      const loaded = (await repository.find({
        where: { id: In(ids as never) },
        ...(hasTranslations ? { relations: ['translations'] } : {}),
      })) as unknown[];
      const idMap = new Map(
        loaded.map((entity) => [(entity as { id: unknown }).id, entity]),
      );
      const ordered: unknown[] = [];
      for (const id of ids) {
        const entity = idMap.get(id);
        if (entity) ordered.push(this.translateRelation(entity, ctx));
      }
      return ordered;
    }

    /** Loads one relation while leaving unresolved references unchanged. */
    async resolveSingleRelation(
      value: unknown,
      field: RelationFieldDefinition,
      ctx: RequestContext,
    ): Promise<unknown> {
      const relation = value as Record<string, unknown> | undefined;
      if (!relation || relation.id == null) return;
      const repository = this.connection.getRepository(ctx, field.entity);
      const hasTranslations = repository.metadata.relations.some(
        (r) => r.propertyName === 'translations',
      );
      const loaded = await repository.findOne({
        where: { id: relation.id as never },
        ...(hasTranslations ? { relations: ['translations'] } : {}),
      });
      if (loaded) return this.translateRelation(loaded, ctx);
    }

    /** Translates only entities with a nonempty translations relation. */
    translateRelation(entity: unknown, ctx: RequestContext): unknown {
      const translations = (entity as { translations?: unknown[] })
        .translations;
      return Array.isArray(translations) && translations.length > 0
        ? this.translator.translate(entity as never, ctx)
        : entity;
    }
  }

  const proto = DynamicShopResolver.prototype as unknown as Record<
    string,
    unknown
  >;

  for (const [contentTypeKey, def] of Object.entries(
    options.contentTypes ?? {},
  )) {
    if (def.allowMultiple) {
      const listMethodName = `list_${contentTypeKey}`;
      const byIdMethodName = `find_${contentTypeKey}`;
      const listFieldName = `${contentTypeKey}s`;
      const byIdFieldName = contentTypeKey;

      // List query: returns all entries of this content type
      const listResolver = async function (
        this: DynamicShopResolver,
        ctx: RequestContext,
      ) {
        const items = await this.contentEntryService.findByContentTypeCode(
          ctx,
          contentTypeKey,
        );
        const flattened = items.map((e) => flattenEntry(ctx, e, this.opts));
        return Promise.all(
          flattened.map((entry) => this.resolveRelationFields(entry, def, ctx)),
        );
      };
      proto[listMethodName] = listResolver;
      Query(listFieldName)(proto, listMethodName, {
        value: listResolver,
      } as PropertyDescriptor);
      Ctx()(proto, listMethodName, 0);

      // By-id query: returns a single entry by its `id`, scoped to this content type
      const byIdResolver = async function (
        this: DynamicShopResolver,
        ctx: RequestContext,
        args: { id: string },
      ) {
        const entry = await this.contentEntryService.findOne(ctx, args.id);
        if (!entry || entry.contentTypeCode !== contentTypeKey) {
          return null;
        }
        const flattened = flattenEntry(ctx, entry, this.opts);
        return this.resolveRelationFields(flattened, def, ctx);
      };
      proto[byIdMethodName] = byIdResolver;
      Query(byIdFieldName)(proto, byIdMethodName, {
        value: byIdResolver,
      } as PropertyDescriptor);
      Ctx()(proto, byIdMethodName, 0);
      Args()(proto, byIdMethodName, 1);
    } else {
      const singletonMethodName = `single_${contentTypeKey}`;
      const singletonFieldName = contentTypeKey;

      const singletonResolver = async function (
        this: DynamicShopResolver,
        ctx: RequestContext,
      ) {
        const items = await this.contentEntryService.findByContentTypeCode(
          ctx,
          contentTypeKey,
        );
        const entry = items[0];
        if (!entry) {
          return null;
        }
        const flattened = flattenEntry(ctx, entry, this.opts);
        return this.resolveRelationFields(flattened, def, ctx);
      };
      proto[singletonMethodName] = singletonResolver;
      Query(singletonFieldName)(proto, singletonMethodName, {
        value: singletonResolver,
      } as PropertyDescriptor);
      Ctx()(proto, singletonMethodName, 0);
    }
  }

  return DynamicShopResolver;
}
