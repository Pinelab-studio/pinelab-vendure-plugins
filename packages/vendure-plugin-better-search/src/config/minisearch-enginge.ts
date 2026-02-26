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

/**
 * Search returns one hit per variant. We merge by product: one BetterSearchResult
 * per product with min/max prices, combined facet/collection ids and all skus.
 */
function groupByProduct(hits: MinisearchDocument[]): BetterSearchResult[] {
  const byProduct = new Map<string, MinisearchDocument[]>();
  for (const doc of hits) {
    const list = byProduct.get(doc.productId) ?? [];
    list.push(doc);
    byProduct.set(doc.productId, list);
  }
  return Array.from(byProduct.entries()).map(([productId, docs]) => {
    const allPrices = docs.map((d) => d.price);
    const allPricesWithTax = docs.map((d) => d.priceWithTax);
    const facetIds = Array.from(new Set(docs.flatMap((d) => d.facetValueIds)));
    const collIds = Array.from(new Set(docs.flatMap((d) => d.collectionIds)));
    const collNames = Array.from(
      new Set(docs.flatMap((d) => d.collectionNames).filter(Boolean))
    );
    return {
      productId,
      slug: docs[0].slug,
      productName: docs[0].productName,
      lowestPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
      lowestPriceWithTax:
        allPricesWithTax.length > 0 ? Math.min(...allPricesWithTax) : 0,
      highestPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
      highestPriceWithTax:
        allPricesWithTax.length > 0 ? Math.max(...allPricesWithTax) : 0,
      facetValueIds: facetIds,
      collectionIds: collIds,
      collectionNames: collNames,
      skus: docs.map((d) => d.sku).filter(Boolean),
    };
  });
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
    if (!miniSearch?.search) return [];
    const hits = miniSearch.search(term, { prefix: true, fuzzy: 0.2 });
    // MiniSearch returns id + score + stored fields; normalize to MinisearchDocument
    const docs: MinisearchDocument[] = hits.map((h) => {
      const x = h as unknown as Record<string, unknown>;
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
      };
    });
    return groupByProduct(docs);
  }
}
