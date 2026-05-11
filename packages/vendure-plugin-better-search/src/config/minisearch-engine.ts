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
import { BetterSearchDocument, SearchEngine } from '../types';

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
        .map((fv) => String((fv as any).facetId ?? ''))
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

export class MinisearchEngine implements SearchEngine {
  async createIndex(ctx: RequestContext, documents: ProductVariant[]) {
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

  getDocuments(
    searchIndex: unknown,
    skip: number,
    take: number
  ): Promise<Record<string, unknown>[]> {
    const ms = searchIndex as MiniSearch<MinisearchDocument>;
    const json = ms.toJSON();
    const storedFields = json.storedFields as Record<
      string,
      Record<string, unknown>
    >;
    const documentIds = json.documentIds as Record<string, string>;
    const entries = Object.entries(storedFields);
    return Promise.resolve(
      entries.slice(skip, skip + take).map(([shortId, doc]) => ({
        id: documentIds[shortId] ?? shortId,
        ...doc,
      }))
    );
  }

  search(
    ctx: RequestContext,
    searchIndex: unknown,
    term: string
  ): Promise<BetterSearchDocument[]> {
    const miniSearch = searchIndex as MiniSearch<MinisearchDocument>;
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
            facetIds: Array.isArray(h.facetIds) ? h.facetIds : [],
            facetValueIds: Array.isArray(h.facetValueIds)
              ? h.facetValueIds
              : [],
            collectionIds: Array.isArray(h.collectionIds)
              ? h.collectionIds
              : [],
            collectionNames: Array.isArray(h.collectionNames)
              ? h.collectionNames
              : [],
            score: Math.round((h.score ?? 0) * 100) / 100,
          } satisfies BetterSearchDocument)
      )
    );
  }

  serializeIndex(searchIndex: unknown): string {
    return JSON.stringify(searchIndex as MiniSearch<MinisearchDocument>);
  }

  deserializeIndex(serialized: string): unknown {
    return MiniSearch.loadJSON(serialized, {
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
}
