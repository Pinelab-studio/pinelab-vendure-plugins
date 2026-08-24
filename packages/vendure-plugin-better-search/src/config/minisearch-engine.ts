/**
 * MiniSearch-based search engine. Indexes product name, slug and description
 * per variant (in the request language) and returns one BetterSearchDocument per variant.
 */
import {
  ProductVariant,
  RequestContext,
  LanguageCode,
  ID,
} from '@vendure/core';
import MiniSearch from 'minisearch';
import { BetterSearchDocument, SearchEngine, SearchSuggestion } from '../types';

/** One document per variant: searchable text + stored fields for building BetterSearchDocument. */
export interface MinisearchDocument {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  description: string;
  price: number;
  priceWithTax: number;
  sku: string;
  facetIds: string[];
  facetValueIds: string[];
  collectionIds: string[];
  collectionNames: string[];
}

/** Picks product name, slug and description for the given language (from product translations). */
function getProductText(
  variant: ProductVariant,
  languageCode: LanguageCode
): { productName: string; slug: string; description: string } {
  const product = variant.product;
  if (!product) {
    return { productName: '', slug: '', description: '' };
  }
  const t =
    product.translations?.find(
      (tr: { languageCode: string }) => tr.languageCode === String(languageCode)
    ) ?? product;
  return {
    productName: t.name ?? '',
    slug: t.slug ?? '',
    description: t.description ?? '',
  };
}

/** Maps a ProductVariant (with product + collections) to a flat document for MiniSearch. */
function variantToDocument(
  ctx: RequestContext,
  variant: ProductVariant
): MinisearchDocument {
  const { productName, slug, description } = getProductText(
    variant,
    ctx.languageCode
  );
  const price = variant.price;
  const priceWithTax = variant.priceWithTax;
  const product = variant.product;
  const facetValueIds = (product?.facetValues ?? variant.facetValues ?? []).map(
    (fv) => String(fv.id)
  );
  const facetIds = [
    ...new Set(
      (product?.facetValues ?? variant.facetValues ?? [])
        .map((fv) => String(fv.facetId ?? ''))
        .filter(Boolean)
    ),
  ];
  const collections =
    (
      variant as unknown as {
        collections: Array<{
          id: ID;
          translations?: Array<{ languageCode: string; name: string }>;
          name?: string;
        }>;
      }
    ).collections ?? [];
  const collectionIds = collections.map((c) => String(c.id));
  const collectionNames = collections.map((c) => {
    const t = c.translations?.find(
      (tr: { languageCode: string }) =>
        tr.languageCode === String(ctx.languageCode)
    );
    return t?.name ?? c.name ?? '';
  });

  return {
    id: String(variant.id),
    productId: String(variant.productId ?? product?.id ?? ''),
    productName,
    slug,
    description,
    price,
    priceWithTax,
    sku: variant.sku ?? '',
    facetIds,
    facetValueIds,
    collectionIds,
    collectionNames,
  };
}

/** Converts an unknown stored field to a string array. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

export class MinisearchEngine
  implements SearchEngine<MiniSearch<MinisearchDocument>>
{
  async createIndex(
    ctx: RequestContext,
    documents: ProductVariant[]
  ): Promise<MiniSearch<MinisearchDocument>> {
    const miniSearch = new MiniSearch<MinisearchDocument>({
      fields: ['productName', 'slug', 'description'],
      storeFields: [
        'productId',
        'productName',
        'slug',
        'description',
        'price',
        'priceWithTax',
        'sku',
        'facetIds',
        'facetValueIds',
        'collectionIds',
        'collectionNames',
      ],
      searchOptions: {
        boost: { productName: 2, slug: 1.5, description: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
    const docs = documents.map((v) => variantToDocument(ctx, v));
    miniSearch.addAll(docs);
    return Promise.resolve(miniSearch);
  }

  /** Adds new documents and replaces documents already present in the index. */
  updateDocuments(
    ctx: RequestContext,
    searchIndex: MiniSearch<MinisearchDocument>,
    variants: ProductVariant[]
  ): Promise<MiniSearch<MinisearchDocument>> {
    const existingIds = new Set(
      this.getStoredDocuments(searchIndex).map((document) =>
        String(document.id)
      )
    );
    const documents = variants.map((variant) =>
      variantToDocument(ctx, variant)
    );
    searchIndex.discardAll(
      documents
        .map((document) => document.id)
        .filter((id) => existingIds.has(id))
    );
    searchIndex.addAll(documents);
    return Promise.resolve(searchIndex);
  }

  /** Removes documents by variant ID or by their stored parent product ID. */
  removeDocuments(
    _ctx: RequestContext,
    searchIndex: MiniSearch<MinisearchDocument>,
    variantIds: ID[],
    productIds: ID[]
  ): Promise<MiniSearch<MinisearchDocument>> {
    const variantIdSet = new Set(variantIds.map(String));
    const productIdSet = new Set(productIds.map(String));
    const idsToRemove = this.getStoredDocuments(searchIndex)
      .filter(
        (document) =>
          variantIdSet.has(String(document.id)) ||
          productIdSet.has(String(document.productId))
      )
      .map((document) => document.id);
    searchIndex.discardAll(idsToRemove);
    return Promise.resolve(searchIndex);
  }

  getDocuments(
    searchIndex: MiniSearch<MinisearchDocument>,
    skip: number,
    take: number
  ): Promise<Record<string, unknown>[]> {
    return Promise.resolve(
      this.getStoredDocuments(searchIndex).slice(skip, skip + take)
    );
  }

  search(
    ctx: RequestContext,
    searchIndex: MiniSearch<MinisearchDocument>,
    term: string
  ): Promise<BetterSearchDocument[]> {
    const miniSearch = searchIndex;
    if (!miniSearch?.search) {
      throw new Error('Invalid search index');
    }
    const hits = miniSearch.search(term, {
      prefix: true,
      fuzzy: 0.3,
      boostDocument: (documentId, term, storedFields) => {
        if (storedFields?.productName === term || storedFields?.slug === term) {
          return 1.2;
        }
        return 1;
      },
    });
    return Promise.resolve(
      hits.map(
        (h) =>
          ({
            productVariantId: String(h.id),
            productId: String(h.productId ?? ''),
            productName: String(h.productName ?? ''),
            productVariantName: String(h.productName ?? ''), // fallback: use product name
            slug: String(h.slug ?? ''),
            description: String(h.description ?? ''),
            sku: String(h.sku ?? ''),
            lowestPrice: Number(h.price ?? 0),
            lowestPriceWithTax: Number(h.priceWithTax ?? 0),
            highestPrice: Number(h.price ?? 0),
            highestPriceWithTax: Number(h.priceWithTax ?? 0),
            facetIds: toStringArray(h.facetIds),
            facetValueIds: toStringArray(h.facetValueIds),
            collectionIds: toStringArray(h.collectionIds),
            collectionNames: toStringArray(h.collectionNames),
            score: Math.round((h.score ?? 0) * 100) / 100,
          } satisfies BetterSearchDocument)
      )
    );
  }

  /**
   * Suggests search terms based on the current index using MiniSearch's
   * autoSuggest. Returns up to 10 unique suggestions.
   */
  searchSuggestions(
    ctx: RequestContext,
    searchIndex: MiniSearch<MinisearchDocument>,
    term: string
  ): SearchSuggestion[] {
    const miniSearch = searchIndex;
    if (!miniSearch?.autoSuggest) {
      throw new Error('Invalid search index');
    }
    const results = miniSearch.autoSuggest(term, {
      prefix: true,
      fuzzy: 0.2,
    });
    const seen = new Set<string>();
    const suggestions: SearchSuggestion[] = [];
    for (const result of results) {
      if (!seen.has(result.suggestion)) {
        seen.add(result.suggestion);
        suggestions.push({ suggestion: result.suggestion });
        if (suggestions.length >= 10) {
          break;
        }
      }
    }
    return suggestions;
  }

  serializeIndex(searchIndex: MiniSearch<MinisearchDocument>): string {
    return JSON.stringify(searchIndex);
  }

  deserializeIndex(serialized: string): MiniSearch<MinisearchDocument> {
    return MiniSearch.loadJSON<MinisearchDocument>(serialized, {
      fields: ['productName', 'slug', 'description'],
      storeFields: [
        'productId',
        'productName',
        'slug',
        'description',
        'price',
        'priceWithTax',
        'sku',
        'facetIds',
        'facetValueIds',
        'collectionIds',
        'collectionNames',
      ],
    });
  }

  /** Returns all stored documents with their external variant IDs. */
  private getStoredDocuments(
    searchIndex: MiniSearch<MinisearchDocument>
  ): Record<string, unknown>[] {
    const json = searchIndex.toJSON();
    const storedFields = json.storedFields as Record<
      string,
      Record<string, unknown>
    >;
    const documentIds = json.documentIds as Record<string, string>;
    return Object.entries(storedFields).map(([shortId, document]) => ({
      id: documentIds[shortId] ?? shortId,
      ...document,
    }));
  }
}
