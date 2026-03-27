/**
 * Orama-based search engine with QPS (Quantum Proximity Scoring).
 * Indexes product name, slug and description per variant (in the request language)
 * and returns one BetterSearchResult per product.
 * Uses QPS ranking which evaluates token proximity within documents for enhanced relevance.
 */
import {
  ProductVariant,
  RequestContext,
  LanguageCode,
  ID,
} from '@vendure/core';
import {
  create,
  insertMultiple,
  search as oramaSearch,
  Orama,
} from '@orama/orama';
import { pluginQPS } from '@orama/plugin-qps';
import { BetterSearchResult } from '../api/generated/graphql';
import { SearchEngine } from '../types';

/**
 * Orama index schema defining the structure of searchable documents.
 * Maps product variant fields to Orama's type system for indexing and searching.
 */
const ORAMA_SCHEMA = {
  productId: 'string',
  productName: 'string',
  slug: 'string',
  description: 'string',
  price: 'number',
  priceWithTax: 'number',
  sku: 'string',
  facetValueIds: 'string[]',
  collectionIds: 'string[]',
  collectionNames: 'string[]',
} as const;

/**
 * TypeScript type representing a document in the Orama index.
 * Corresponds to the ORAMA_SCHEMA definition above.
 */
type OramaDocument = {
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
};

/**
 * Extracts localized product text (name, slug, description) from a variant.
 * @param variant The product variant to extract text from
 * @param languageCode The language code to use for translations
 * @returns Object containing productName, slug, and description
 */
function getProductText(
  variant: ProductVariant,
  languageCode: LanguageCode
): { productName: string; slug: string; description: string } {
  const product = variant.product;
  if (!product) {
    return { productName: '', slug: '', description: '' };
  }
  const t =
    product.translations?.find((tr) => tr.languageCode === languageCode) ??
    product;
  return {
    productName: t.name ?? '',
    slug: t.slug ?? '',
    description: t.description ?? '',
  };
}

/**
 * Transforms a Vendure ProductVariant into a flat Orama document for indexing.
 * @param ctx The request context containing language and other runtime info
 * @param variant The product variant to convert
 * @returns Flattened document ready for Orama indexing
 */
function variantToDocument(
  ctx: RequestContext,
  variant: ProductVariant
): OramaDocument {
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
  const collections = variant.collections ?? [];
  const collectionIds = collections.map((c: { id: ID }) => String(c.id));
  const collectionNames = collections.map(
    (c: {
      translations?: Array<{ languageCode: string; name: string }>;
      name?: string;
    }) => {
      const t = c.translations?.find(
        (tr: { languageCode: string }) =>
          tr.languageCode === String(ctx.languageCode)
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
 * Search engine implementation using Orama with QPS (Quantum Proximity Scoring).
 * QPS enhances relevance by evaluating token proximity within documents,
 * offering improved search accuracy for short, focused queries.
 */
export class OramaQPSEngine implements SearchEngine {
  /**
   * Creates an Orama index with QPS scoring enabled.
   * @param ctx Request context (language code used for localized product data)
   * @param documents Array of product variants to index
   * @returns Orama database instance ready for searching
   */
  async createIndex(
    ctx: RequestContext,
    documents: ProductVariant[]
  ): Promise<unknown> {
    const db = create({
      schema: ORAMA_SCHEMA,
      plugins: [pluginQPS()],
      components: {
        tokenizer: {
          language: 'english',
          stemming: true,
        },
      },
    });

    const docs = documents.map((v) => variantToDocument(ctx, v));
    await insertMultiple(db, docs);
    return db;
  }

  /**
   * Searches the Orama index using QPS scoring algorithm.
   * @param ctx Request context
   * @param searchIndex Orama database instance
   * @param term Search query term
   * @returns Array of BetterSearchResult with relevance scores
   */
  async search(
    ctx: RequestContext,
    searchIndex: unknown,
    term: string
  ): Promise<BetterSearchResult[]> {
    const db = searchIndex as Orama<typeof ORAMA_SCHEMA>;
    if (!db) {
      throw new Error('Invalid search index');
    }

    const normalizedTerm = term
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    const results = await oramaSearch(db, {
      term: normalizedTerm,
      properties: ['productName', 'slug', 'description'],
      boost: { productName: 2, slug: 1.5, description: 1 },
      tolerance: 1,
      limit: 9999,
    });

    return results.hits.map((hit) => {
      const x = hit.document as OramaDocument & { id: string };
      return {
        id: String(hit.id),
        productId: String(x.productId ?? ''),
        productName: String(x.productName ?? ''),
        slug: String(x.slug ?? ''),
        description: String(x.description ?? ''),
        price: Number(x.price ?? 0),
        priceWithTax: Number(x.priceWithTax ?? 0),
        sku: String(x.sku ?? ''),
        facetValueIds: Array.isArray(x.facetValueIds) ? x.facetValueIds : [],
        collectionIds: Array.isArray(x.collectionIds) ? x.collectionIds : [],
        collectionNames: Array.isArray(x.collectionNames)
          ? x.collectionNames
          : [],
        score: Math.round((hit.score ?? 0) * 100) / 100,
        lowestPrice: Number(x.price ?? 0),
        lowestPriceWithTax: Number(x.priceWithTax ?? 0),
        highestPrice: Number(x.price ?? 0),
        highestPriceWithTax: Number(x.priceWithTax ?? 0),
        skus: typeof x.sku === 'string' ? [x.sku] : [],
      };
    });
  }
}
