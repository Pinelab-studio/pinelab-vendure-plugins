/**
 * FlexSearch-based search engine. Indexes product name, slug and description
 * per variant (in the request language) and returns one BetterSearchResult per product.
 * Uses tolerant tokenizer with LatinAdvanced encoding for diacritic normalization,
 * phonetic matching and typo tolerance. Includes English stemming via language pack.
 */
import {
  ProductVariant,
  RequestContext,
  LanguageCode,
  ID,
} from '@vendure/core';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Index, Encoder, Charset } =
  require('flexsearch') as typeof import('flexsearch');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EnglishPreset =
  require('flexsearch/lang/en') as import('flexsearch').EncoderOptions;
import { BetterSearchResult } from '../api/generated/graphql';
import { SearchEngine } from '../types';

interface FlexSearchDoc {
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
    product.translations?.find((tr) => tr.languageCode === languageCode) ??
    product;
  return {
    productName: t.name ?? '',
    slug: t.slug ?? '',
    description: t.description ?? '',
  };
}

/** Maps a ProductVariant (with product + collections) to a flat document for FlexSearch. */
function variantToDocument(
  ctx: RequestContext,
  variant: ProductVariant
): FlexSearchDoc {
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

/** Field weights for scoring: productName and slug are more important than description. */
const FIELD_WEIGHTS: Record<string, number> = {
  productName: 2.0,
  slug: 1.5,
  description: 1.0,
};

/**
 * Stores one FlexSearch Index per field (productName, slug, description),
 * plus a map of all documents by ID.
 */
interface FlexSearchStore {
  indexes: Record<string, InstanceType<typeof Index>>;
  docs: Map<string, FlexSearchDoc>;
}

export class FlexSearchEngine implements SearchEngine {
  async createIndex(
    ctx: RequestContext,
    documents: ProductVariant[]
  ): Promise<unknown> {
    const encoder = new Encoder(
      Charset.LatinExtra,
      // @ts-ignore - EnglishPreset is missing type definitions in flexsearch package
      EnglishPreset
    );
    // Create one index per searchable field for independent boosting
    const fields = ['productName', 'slug', 'description'] as const;
    const indexes: Record<string, InstanceType<typeof Index>> = {};
    for (const field of fields) {
      indexes[field] = new Index({
        tokenize: 'tolerant',
        encoder,
        resolution: 9,
        fastupdate: false,
      });
    }

    const docs = new Map<string, FlexSearchDoc>();
    for (const variant of documents) {
      const doc = variantToDocument(ctx, variant);
      docs.set(doc.id, doc);
      const numericId = Number(doc.id);
      indexes['productName'].add(numericId, doc.productName);
      indexes['slug'].add(numericId, doc.slug.replace(/-/g, ' '));
      indexes['description'].add(numericId, doc.description);
    }

    return { indexes, docs } satisfies FlexSearchStore;
  }

  async search(
    ctx: RequestContext,
    searchIndex: unknown,
    term: string
  ): Promise<BetterSearchResult[]> {
    const { indexes, docs } = searchIndex as FlexSearchStore;
    if (!indexes) {
      throw new Error('Invalid search index');
    }

    // Normalize query: strip diacritics, lowercase, and collapse repeated trailing chars per word
    const normalizedTerm = term
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    const queryTerms = normalizedTerm
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.replace(/(.)\1+$/, '$1'));

    // Score each document by: how many query terms it matches (across all fields),
    // weighted by field importance. This ensures docs matching more terms rank higher.
    const scoreMap = new Map<string, number>();
    const termMatchCount = new Map<string, Set<string>>();

    for (const [field, index] of Object.entries(indexes)) {
      const weight = FIELD_WEIGHTS[field] ?? 1;
      // Search each term individually to track per-term matches
      for (const queryTerm of queryTerms) {
        const results = index.search(queryTerm, {
          limit: 9999,
          suggest: true,
        }) as number[]; // FlexSearch returns numeric IDs, which we convert back to strings below
        for (let i = 0; i < results.length; i++) {
          const id = String(results[i]);
          const positionScore = (results.length - i) / results.length;
          const current = scoreMap.get(id) ?? 0;
          scoreMap.set(id, current + positionScore * weight);
          // Track which query terms this doc matched
          if (!termMatchCount.has(id)) termMatchCount.set(id, new Set());
          termMatchCount.get(id)!.add(queryTerm);
        }
      }
    }

    // Boost documents that match more unique query terms (rewards matching all terms)
    for (const [id, matchedTerms] of termMatchCount.entries()) {
      const termCoverage = matchedTerms.size / queryTerms.length;
      const current = scoreMap.get(id) ?? 0;
      // Use term coverage as exponential multiplier to heavily favor full matches
      scoreMap.set(id, current * Math.pow(termCoverage, 2));
    }

    // Sort by aggregated score descending
    const sorted = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]);

    return sorted
      .map(([id, score]) => {
        const x = docs.get(id);
        if (!x) return null;
        return {
          id: x.id,
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
          score: Math.round(score * 100) / 100,
          lowestPrice: Number(x.price ?? 0),
          lowestPriceWithTax: Number(x.priceWithTax ?? 0),
          highestPrice: Number(x.price ?? 0),
          highestPriceWithTax: Number(x.priceWithTax ?? 0),
          skus: typeof x.sku === 'string' ? [x.sku] : [],
        };
      })
      .filter((r) => r !== null);
  }
}
