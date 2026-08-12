/**
 * Standalone benchmark script for comparing search engines.
 *
 * Reports two numbers per engine:
 *   - Total time to run all queries (12 queries × N loops)
 *   - Total memory usage (RSS) after running them
 *
 * Usage (system-independent, Node flags only):
 *
 *   1. Build the package once:
 *      yarn build
 *      tsc -p tsconfig.benchmark.json
 *
 *   2. Run one engine at a time (memory cap via Node flag):
 *      node --expose-gc --predictable --max-old-space-size=512 \
 *        dist-benchmark/test/benchmark-engines.js --engine=bm25
 *      ... --engine=flexsearch | semantic | minisearch | orama-qps
 *
 *   Override the loop count with --loops=<N> (default 50).
 */
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { LanguageCode, ProductVariant, RequestContext } from '@vendure/core';
import { OramaBM25Engine } from '../src/config/orama-bm25-engine';
import { FlexSearchEngine } from '../src/config/flexsearch-engine';
import { OramaHybridSemanticEngine } from '../src/config/orama-hybrid-semantic-engine';
import { MinisearchEngine } from '../src/config/minisearch-engine';
import { OramaQPSEngine } from '../src/config/orama-qps-engine';
import { SearchEngine } from '../src/types';

/** The 12 fixed benchmark queries: lexical, semantic, and edge cases. */
const QUERIES = [
  'wireless mouse',
  'red leather shoes',
  'quasar telescope',
  'nike running',
  'fruit',
  'footwear',
  'sneakers',
  'astronomy',
  'pointing device',
  'shoes running',
  'appel',
  'telesc',
];

interface CliArgs {
  engine: 'bm25' | 'flexsearch' | 'semantic' | 'minisearch' | 'orama-qps';
  loops: number;
}

/** Parse CLI args. Throws if --engine is missing/invalid. */
function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  const engine = args.engine as CliArgs['engine'];
  const valid: CliArgs['engine'][] = [
    'bm25',
    'flexsearch',
    'semantic',
    'minisearch',
    'orama-qps',
  ];
  if (!valid.includes(engine)) {
    throw new Error(
      `Missing or invalid --engine (got "${engine}"). Use ${valid.join(' | ')}.`
    );
  }
  const loops = args.loops ? Number(args.loops) : 50;
  return { engine, loops };
}

interface CsvProduct {
  name: string;
  slug: string;
  description: string;
  facets: string;
  sku: string;
  price: number;
}

/**
 * Minimal CSV parser tailored to test/search-products.csv. Handles quoted
 * fields containing commas (e.g. the telescope description).
 */
function parseCsv(content: string): CsvProduct[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      cur.push(field);
      field = '';
    } else if (c === '\n') {
      cur.push(field);
      lines.push(cur);
      cur = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    lines.push(cur);
  }
  const header = lines[0];
  const idx = (col: string) => header.indexOf(col);
  return lines
    .slice(1)
    .filter((row) => row[idx('name')])
    .map((row) => ({
      name: row[idx('name')] ?? '',
      slug: row[idx('slug')] ?? '',
      description: row[idx('description')] ?? '',
      facets: row[idx('facets')] ?? '',
      sku: row[idx('sku')] ?? '',
      price: Number(row[idx('price')] ?? 0),
    }));
}

/**
 * Build a minimal ProductVariant-like object with just the fields the engines
 * actually read. Casting through `unknown` avoids constructing the full TypeORM
 * entity graph.
 */
function buildVariant(p: CsvProduct, i: number): ProductVariant {
  const id = String(i + 1);
  const facetValues = p.facets
    .split('|')
    .filter(Boolean)
    .map((f, fi) => ({ id: `${id}-fv${fi}`, code: f }));
  const priceMinor = Math.round(p.price * 100);
  const variant = {
    id,
    productId: id,
    sku: p.sku,
    price: priceMinor,
    priceWithTax: Math.round(priceMinor * 1.2),
    facetValues,
    collections: [],
    product: {
      id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      facetValues,
      translations: [
        {
          languageCode: LanguageCode.en,
          name: p.name,
          slug: p.slug,
          description: p.description,
        },
      ],
    },
  };
  return variant as unknown as ProductVariant;
}

/** Minimal RequestContext stub: engines only read `languageCode`. */
function buildCtx(): RequestContext {
  return { languageCode: LanguageCode.en } as unknown as RequestContext;
}

/** Instantiate the chosen engine. */
function makeEngine(name: CliArgs['engine']): SearchEngine {
  if (name === 'bm25') return new OramaBM25Engine();
  if (name === 'flexsearch') return new FlexSearchEngine();
  if (name === 'minisearch') return new MinisearchEngine();
  if (name === 'orama-qps') return new OramaQPSEngine();
  return new OramaHybridSemanticEngine();
}

/** Run gc() if exposed; otherwise no-op. */
function gc(): void {
  if (typeof (global as { gc?: () => void }).gc === 'function') {
    (global as { gc: () => void }).gc();
  }
}

const MB = 1024 * 1024;

async function main(): Promise<void> {
  const { engine: engineName, loops } = parseArgs(process.argv);

  const candidates = [
    path.join(__dirname, 'search-products.csv'),
    path.join(__dirname, '..', '..', 'test', 'search-products.csv'),
  ];
  const csvPath = candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
  const products = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const ctx = buildCtx();
  const variants = products.map((p, i) => buildVariant(p, i));

  // For semantic: load the model up front so it doesn't pollute the timing.
  if (engineName === 'semantic') {
    await OramaHybridSemanticEngine.warmup();
  }

  // Build the index up front so timing reflects search cost, not indexing.
  const engine = makeEngine(engineName);
  const index = await engine.createIndex(ctx, variants);

  // Run all queries, looped, and time the whole thing.
  const totalQueries = QUERIES.length * loops;
  const tStart = performance.now();
  for (let i = 0; i < loops; i++) {
    for (const query of QUERIES) {
      await engine.search(ctx, index, query);
    }
  }
  const totalMs = performance.now() - tStart;

  // Memory after running all queries.
  gc();
  const mem = process.memoryUsage();

  console.log(`Engine:        ${engineName}`);
  console.log(
    `Queries:       ${totalQueries} (${QUERIES.length} × ${loops} loops)`
  );
  console.log(`Total time:    ${totalMs.toFixed(0)} ms`);
  console.log(`RSS:           ${(mem.rss / MB).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
