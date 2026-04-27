import { Inject, Injectable, Type } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  Logger,
  RequestContext,
  TransactionalConnection,
  TranslatorService,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { SimpleCmsPluginOptions } from '../types';
import { ContentEntryService } from '../services/content-entry.service';
import { flattenEntry } from './flatten-entry';
import { toGraphQLTypeName } from './api-extensions';

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
  options: SimpleCmsPluginOptions
): Type<unknown> {
  @Resolver()
  @Injectable()
  class DynamicShopResolver {
    constructor(
      readonly contentEntryService: ContentEntryService,
      readonly connection: TransactionalConnection,
      readonly translator: TranslatorService,
      @Inject(PLUGIN_INIT_OPTIONS)
      readonly opts: SimpleCmsPluginOptions
    ) {}

    /**
     * Resolves relation fields by loading the related entities from the database
     * using the proper TypeORM 0.3 `findOne({ where: { id } })` signature.
     *
     * If the loaded entity is `Translatable` (i.e. has a `translations` relation
     * with a `languageCode`), it is run through {@link TranslatorService.translate}
     * so that translated fields (e.g. `name`, `slug`) resolve correctly via the
     * standard Vendure field resolvers.
     */
    async resolveRelationFields(
      entry: Record<string, unknown>,
      typeDef: SimpleCmsPluginOptions['contentTypes'][string],
      ctx: RequestContext
    ): Promise<Record<string, unknown>> {
      const result = { ...entry };
      for (const field of typeDef.fields) {
        if (field.type !== 'relation') {
          continue;
        }
        const relationValue = entry[field.name] as
          | Record<string, unknown>
          | undefined;
        if (!relationValue || relationValue.id == null) {
          continue;
        }
        try {
          const repository = this.connection.getRepository(ctx, field.entity);
          // Translatable entities expose a `translations` relation; load it so
          // the TranslatorService can pick the correct language.
          const loaded = (await repository.findOne({
            where: { id: relationValue.id as never },
            relations: ['translations'],
          })) as unknown;
          if (!loaded) {
            continue;
          }
          const hasTranslations =
            Array.isArray(
              (loaded as { translations?: unknown[] }).translations
            ) &&
            (loaded as { translations: unknown[] }).translations.length > 0;
          result[field.name] = hasTranslations
            ? this.translator.translate(loaded as never, ctx)
            : loaded;
        } catch (error) {
          Logger.error(
            `Failed to load relation field '${field.name}' for content type '${
              typeDef.displayName
            }': ${(error as any)?.message}`,
            loggerCtx,
            (error as any).stack
          );

          // If loading fails for any reason, keep the original `{ id }` value
          // so the consumer still receives the relation reference.
          result[field.name] = relationValue;
        }
      }
      return result;
    }
  }

  const proto = DynamicShopResolver.prototype as unknown as Record<
    string,
    unknown
  >;

  for (const [contentTypeKey, def] of Object.entries(
    options.contentTypes ?? {}
  )) {
    if (def.allowMultiple) {
      const listMethodName = `list_${contentTypeKey}`;
      const byIdMethodName = `find_${contentTypeKey}`;
      const listFieldName = `${contentTypeKey}s`;
      const byIdFieldName = contentTypeKey;

      // List query: returns all entries of this content type
      async function listResolver(
        this: DynamicShopResolver,
        ctx: RequestContext
      ) {
        const items = await this.contentEntryService.findByContentTypeCode(
          ctx,
          contentTypeKey
        );
        const flattened = items.map((e) => flattenEntry(ctx, e, this.opts));
        return Promise.all(
          flattened.map((entry) => this.resolveRelationFields(entry, def, ctx))
        );
      }
      proto[listMethodName] = listResolver;
      Query(listFieldName)(proto, listMethodName, {
        value: listResolver,
      } as PropertyDescriptor);
      Ctx()(proto, listMethodName, 0);

      // By-id query: returns a single entry by its `id`, scoped to this content type
      async function byIdResolver(
        this: DynamicShopResolver,
        ctx: RequestContext,
        args: { id: string }
      ) {
        const entry = await this.contentEntryService.findOne(ctx, args.id);
        if (!entry || entry.contentTypeCode !== contentTypeKey) {
          return null;
        }
        const flattened = flattenEntry(ctx, entry, this.opts);
        return this.resolveRelationFields(flattened, def, ctx);
      }
      proto[byIdMethodName] = byIdResolver;
      Query(byIdFieldName)(proto, byIdMethodName, {
        value: byIdResolver,
      } as PropertyDescriptor);
      Ctx()(proto, byIdMethodName, 0);
      Args()(proto, byIdMethodName, 1);
    } else {
      const singletonMethodName = `single_${contentTypeKey}`;
      const singletonFieldName = contentTypeKey;

      async function singletonResolver(
        this: DynamicShopResolver,
        ctx: RequestContext
      ) {
        const items = await this.contentEntryService.findByContentTypeCode(
          ctx,
          contentTypeKey
        );
        const entry = items[0];
        if (!entry) {
          return null;
        }
        const flattened = flattenEntry(ctx, entry, this.opts);
        return this.resolveRelationFields(flattened, def, ctx);
      }
      proto[singletonMethodName] = singletonResolver;
      Query(singletonFieldName)(proto, singletonMethodName, {
        value: singletonResolver,
      } as PropertyDescriptor);
      Ctx()(proto, singletonMethodName, 0);
    }
  }

  return DynamicShopResolver;
}
