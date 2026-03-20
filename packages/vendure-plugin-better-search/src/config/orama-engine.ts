/**
 * Orama-based search engine. Indexes product name, slug and description
 * per variant (in the request language) and returns one BetterSearchResult per product.
 * Uses BM25 ranking with length normalization, IDF weighting, stemming, typo tolerance,
 * diacritic normalization and prefix matching — all built into Orama.
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
import { BetterSearchResult } from '../api/generated/graphql';
import { SearchEngine } from '../types';

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
    product.translations?.find((tr) => tr.languageCode === languageCode) ??
    product;
  return {
    productName: t.name ?? '',
    slug: t.slug ?? '',
    description: t.description ?? '',
  };
}

/** Maps a ProductVariant (with product + collections) to a flat document for Orama. */
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

export class OramaEngine implements SearchEngine {
  async createIndex(
    ctx: RequestContext,
    documents: ProductVariant[]
  ): Promise<unknown> {
    const db = await create({
      schema: ORAMA_SCHEMA,
      components: {
        tokenizer: {
          // English stemming handles plurals/singulars; diacritic normalization is built-in
          language: 'english',
          stemming: true,
        },
      },
    });

    const docs = documents.map((v) => variantToDocument(ctx, v));
    await insertMultiple(db, docs);
    return db;
  }

  async search(
    ctx: RequestContext,
    searchIndex: unknown,
    term: string
  ): Promise<BetterSearchResult[]> {
    const db = searchIndex as Orama<typeof ORAMA_SCHEMA>;
    if (!db) {
      throw new Error('Invalid search index');
    }

    // Normalize the query term: strip diacritics (e.g. "Äpple" → "apple") and lowercase.
    // Orama normalizes indexed tokens but not the incoming query term.
    const normalizedTerm = term
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    const results = await oramaSearch(db, {
      term: normalizedTerm,
      // Only search the text fields; numeric/array fields are for filtering/retrieval
      properties: ['productName', 'slug', 'description'],
      // Field-level boost: name and slug rank higher than description
      boost: { productName: 2, slug: 1.5, description: 1 },
      // Levenshtein distance for typo tolerance (handles single-char typos)
      tolerance: 1,
      // Return all matching documents (not just top 10)
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
        facetValueIds: Array.isArray(x.facetValueIds)
          ? (x.facetValueIds as string[])
          : [],
        collectionIds: Array.isArray(x.collectionIds)
          ? (x.collectionIds as string[])
          : [],
        collectionNames: Array.isArray(x.collectionNames)
          ? (x.collectionNames as string[])
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
