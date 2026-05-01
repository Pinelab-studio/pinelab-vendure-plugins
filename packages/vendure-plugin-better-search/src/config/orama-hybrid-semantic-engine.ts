/**
 * Orama-based hybrid (BM25 + vector) search engine.
 *
 * Indexes product name, slug and description per variant (in the request language)
 * and returns one BetterSearchResult per product. Combines BM25 full-text search
 * with semantic vector search powered by the Universal Sentence Encoder
 * (TensorFlow.js, 512-dim vectors).
 *
 * Hybrid mode merges full-text relevance with semantic similarity, weighted via
 * `hybridWeights`. Text is given more weight than vectors here, because for
 * product catalog search exact/lexical matches are typically the best signal,
 * while embeddings serve as a fallback for synonyms/intent.
 *
 * NOTE: We deliberately do NOT use `@orama/plugin-embeddings` because its CJS
 * build is SWC-transpiled, so its async `beforeSearch` hook is not detected as
 * async by Orama's `isAsyncFunction` check and is therefore not awaited. That
 * causes `params.vector` to be undefined when hybrid search runs. Instead we
 * generate the embedding ourselves with the underlying USE model and pass
 * `vector` explicitly to both insert and search.
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
import * as use from '@tensorflow-models/universal-sentence-encoder';
import '@tensorflow/tfjs-node';
import { BetterSearchResult } from '../api/generated/graphql';
import { SearchEngine } from '../types';

const ORAMA_SCHEMA = {
  productId: 'string',
  productName: 'string',
  slug: 'string',
  description: 'string',
  // Universal Sentence Encoder produces 512-dim vectors.
  embeddings: 'vector[512]',
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
  embeddings: number[];
  price: number;
  priceWithTax: number;
  sku: string;
  facetValueIds: string[];
  collectionIds: string[];
  collectionNames: string[];
};

/** Lazy-loaded singleton USE model (loading is expensive: downloads weights). */
let useModelPromise: Promise<use.UniversalSentenceEncoder> | undefined;
function getUseModel(): Promise<use.UniversalSentenceEncoder> {
  if (!useModelPromise) {
    useModelPromise = use.load();
  }
  return useModelPromise;
}

/** L2-normalizes a vector so cosine similarity becomes a dot product. */
function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) {
    return vec;
  }
  return vec.map((v) => v / norm);
}

/**
 * Embed a list of texts into 512-dim L2-normalized vectors using USE.
 * Batches all texts into a single model call for efficiency.
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const model = await getUseModel();
  const embeddings = await model.embed(texts);
  const data = await embeddings.array();
  embeddings.dispose();
  return data.map((row) => l2Normalize(row));
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

/** Maps a ProductVariant to the textual basis for embedding + a partial document (without embeddings). */
function variantToTextAndDoc(
  ctx: RequestContext,
  variant: ProductVariant
): { embeddingText: string; doc: Omit<OramaDocument, 'embeddings'> } {
  const { productName, slug, description } = getProductText(
    variant,
    ctx.languageCode
  );
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

  // Use slug-as-words + name + description as the basis for the semantic embedding.
  const slugAsWords = slug.replace(/-/g, ' ');
  const embeddingText =
    [productName, slugAsWords, description].filter(Boolean).join('. ') ||
    productName ||
    'unknown';

  return {
    embeddingText,
    doc: {
      id: String(variant.id),
      productId: String(variant.productId ?? product?.id ?? ''),
      productName,
      slug,
      description,
      price: variant.price,
      priceWithTax: variant.priceWithTax,
      sku: variant.sku ?? '',
      facetValueIds,
      collectionIds,
      collectionNames,
    },
  };
}

export class OramaHybridSemanticEngine implements SearchEngine {
  constructor() {
    // `@tensorflow/tfjs-node` is built against Node 22's native ABI and depends
    // on `util.isNullOrUndefined`, which was removed in Node 24. Fail fast with
    // a clear message instead of letting the user hit a cryptic runtime error.
    const major = Number(process.versions.node.split('.')[0]);
    if (major !== 22) {
      throw new Error(
        `OramaHybridSemanticEngine requires Node.js 22 (current: ${process.versions.node}). `
      );
    }
  }

  /**
   * Loads the USE model and runs a dummy inference so the first real search
   * query doesn't pay the JIT-compilation cost (which on pure-JS TFJS can take
   * several seconds and blow past per-test timeouts).
   *
   * Call this once during your test's `beforeAll` (or app bootstrap) to keep
   * the first search fast. Safe to call multiple times.
   */
  static async warmup(): Promise<void> {
    await embedTexts(['warmup']);
  }

  async createIndex(
    ctx: RequestContext,
    documents: ProductVariant[]
  ): Promise<unknown> {
    const db = create({
      schema: ORAMA_SCHEMA,
      components: {
        tokenizer: {
          // English stemming handles plurals/singulars; diacritic normalization is built-in
          language: 'english',
          stemming: true,
        },
      },
    });

    const prepared = documents.map((v) => variantToTextAndDoc(ctx, v));
    const vectors = await embedTexts(prepared.map((p) => p.embeddingText));
    const docs: OramaDocument[] = prepared.map((p, i) => ({
      ...p.doc,
      embeddings: vectors[i],
    }));
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

    // Normalize query: strip diacritics and lowercase. Orama normalizes indexed
    // tokens but not the incoming query term.
    const normalizedTerm = term
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    const [queryVector] = await embedTexts([normalizedTerm || 'query']);

    const results = await oramaSearch(db, {
      mode: 'hybrid',
      term: normalizedTerm,
      vector: { property: 'embeddings', value: queryVector },
      // Only run text search on the meaningful textual fields.
      properties: ['productName', 'slug', 'description'],
      // Field-level boost: name and slug rank higher than description.
      boost: { productName: 2, slug: 1.5, description: 1 },
      // Levenshtein distance for typo tolerance (handles single-char typos).
      tolerance: 1,
      // Heavily favour text relevance; vectors act as a semantic fallback for
      // synonyms/intent. Pure-vector matches alone should not dominate over
      // strong lexical matches (which is what the relevance tests assert).
      hybridWeights: {
        text: 0.95,
        vector: 0.05,
      },
      // Include all matching documents (not just top 10).
      limit: 9999,
      // Don't ship 512-dim vectors back over the wire.
      includeVectors: false,
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
