/**
 * MiniSearch-based search engine. Indexes product name, slug and description
 * per variant (in the request language) and returns one BetterSearchResult per product.
 */
import {
  ProductVariant,
  RequestContext,
  LanguageCode,
  ID,
} from '@vendure/core';
import MiniSearch from 'minisearch';
import { BetterSearchResult } from '../api/generated/graphql';
import { SearchEngine } from '../types';

/** One document per variant: searchable text + stored fields for building BetterSearchResult. */
export interface MinisearchDocument {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  description: string;
  price: number;
  priceWithTax: number;
  sku: string;
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
    (product as any).translations?.find(
      (tr: { languageCode: string }) => tr.languageCode === languageCode
    ) ?? product;
  return {
    productName: (t?.name as string) ?? '',
    slug: (t?.slug as string) ?? '',
    description: (t?.description as string) ?? '',
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
  const variantAny = variant as any;
  const price = variantAny.price ?? 0;
  const priceWithTax = variantAny.priceWithTax ?? price;
  const product = variant.product as any;
  const facetValueIds = (
    product?.facetValues ??
    variantAny.facetValues ??
    []
  ).map((fv: { id: ID }) => String(fv.id));
  const collections = variantAny.collections ?? [];
  const collectionIds = collections.map((c: { id: ID }) => String(c.id));
  const collectionNames = collections.map(
    (c: {
      translations?: Array<{ languageCode: string; name: string }>;
      name?: string;
    }) => {
      const t = c.translations?.find(
        (tr) => tr.languageCode === ctx.languageCode
      );
      return t?.name ?? c.name ?? '';
    }
  );

  return {
    id: String(variant.id),
    productId: String(variant.productId ?? product?.id ?? ''),
    productName,
    slug,
    description,
    price,
    priceWithTax,
    sku: variant.sku ?? '',
    facetValueIds,
    collectionIds,
    collectionNames,
  };
}

export class MinisearchEngine implements SearchEngine {
  async createIndex(ctx: RequestContext, documents: ProductVariant[]) {
    const miniSearch = new MiniSearch<MinisearchDocument>({
      fields: ['productName', 'slug', 'description'],
      // Returned with each hit so we can build BetterSearchResult without extra lookups
      storeFields: [
        'productId',
        'productName',
        'slug',
        'price',
        'priceWithTax',
        'sku',
        'facetValueIds',
        'collectionIds',
        'collectionNames',
      ],
      searchOptions: {
        boost: { productName: 2, slug: 1.5, description: 1 }, // name/slug rank higher
        prefix: true, // "app" matches "apple"
        fuzzy: 0.2, // typo tolerance
      },
    });
    const docs = documents.map((v) => variantToDocument(ctx, v));
    miniSearch.addAll(docs);
    return Promise.resolve(miniSearch);
  }

  async search(
    ctx: RequestContext,
    searchIndex: unknown,
    term: string
  ): Promise<BetterSearchResult[]> {
    const miniSearch = searchIndex as MiniSearch<MinisearchDocument>;
    if (!miniSearch?.search) {
      throw new Error('Invalid search index');
    }
    const hits = miniSearch.search(term, {
      prefix: true,
      fuzzy: 0.3,
      boostDocument: (documentId, term, storedFields) => {
        console.log(documentId, term);
        // Boost if name or slug exactly matches the term
        if (
          storedFields?.productName === term ||
          storedFields?.slug === term ||
          storedFields?.variantName === term
        ) {
          return 1.2;
        }
        return 1;
      },
    });
    console.log(JSON.stringify(hits.slice(0, 3), null, 2));
    const docs: BetterSearchResult[] = hits.map((h) => {
      const x = h;
      return {
        id: String(x.id),
        productId: String(x.productId ?? ''),
        productName: String(x.productName ?? ''),
        slug: String(x.slug ?? ''),
        description: String(x.description ?? ''),
        price: Number(x.price ?? 0),
        priceWithTax: Number(x.priceWithTax ?? 0),
        sku: String(x.sku ?? ''),
        facetValueIds: Array.isArray(x.facetValueIds)
          ? (x.facetValueIds as string[])
          : [],
        collectionIds: Array.isArray(x.collectionIds)
          ? (x.collectionIds as string[])
          : [],
        collectionNames: Array.isArray(x.collectionNames)
          ? (x.collectionNames as string[])
          : [],
        score: Math.round((x.score ?? 0) * 100) / 100,
        lowestPrice: Number(x.price ?? 0),
        lowestPriceWithTax: Number(x.priceWithTax ?? 0),
        highestPrice: Number(x.price ?? 0),
        highestPriceWithTax: Number(x.priceWithTax ?? 0),
        skus: Array.isArray(x.sku) ? (x.sku as string[]) : [],
      };
    });
    return docs;
  }
}
