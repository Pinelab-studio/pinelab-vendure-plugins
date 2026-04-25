import { Inject, Injectable, Type } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
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
 * - `allowMultiple: true`  → list query (`<key>s`) and by-code query (`<key>(code)`).
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
      @Inject(PLUGIN_INIT_OPTIONS)
      readonly opts: SimpleCmsPluginOptions
    ) {}
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
      const byCodeMethodName = `find_${contentTypeKey}`;
      const listFieldName = `${contentTypeKey}s`;
      const byCodeFieldName = contentTypeKey;

      // List query: returns all entries of this content type
      async function listResolver(
        this: DynamicShopResolver,
        ctx: RequestContext
      ) {
        const items = await this.contentEntryService.findByContentTypeCode(
          ctx,
          contentTypeKey
        );
        return items.map((e) => flattenEntry(ctx, e, this.opts));
      }
      proto[listMethodName] = listResolver;
      Query(listFieldName)(proto, listMethodName, {
        value: listResolver,
      } as PropertyDescriptor);
      Ctx()(proto, listMethodName, 0);

      // By-code query: returns a single entry by its `code`
      async function byCodeResolver(
        this: DynamicShopResolver,
        ctx: RequestContext,
        args: { code: string }
      ) {
        const entry = await this.contentEntryService.findByCode(ctx, args.code);
        if (!entry || entry.contentTypeCode !== contentTypeKey) {
          return null;
        }
        return flattenEntry(ctx, entry, this.opts);
      }
      proto[byCodeMethodName] = byCodeResolver;
      Query(byCodeFieldName)(proto, byCodeMethodName, {
        value: byCodeResolver,
      } as PropertyDescriptor);
      Ctx()(proto, byCodeMethodName, 0);
      Args()(proto, byCodeMethodName, 1);
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
        return entry ? flattenEntry(ctx, entry, this.opts) : null;
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
