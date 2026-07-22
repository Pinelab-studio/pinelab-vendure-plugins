/**
 * Concurrency benchmark – single file.
 *
 * Starts the Vendure server inline in the main process, then forks itself
 * with a `--client` flag to run the concurrent benchmark client.
 *
 * Usage:
 *   npx tsx test/benchmark-concurrency/concurrency-benchmark.ts --concurrency=20 --duration=30
 */

import { fork } from 'child_process';
import {
  DefaultLogger,
  EventBus,
  InitialData,
  LanguageCode,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import gql from 'graphql-tag';
import { BetterSearchPlugin } from '../src';
import { BetterSearchIndexEvent } from '../src/events/better-search-index.event';

// ---- Inlined from packages/test/src/initial-data.ts ----

const initialData: InitialData = {
  defaultLanguage: LanguageCode.en,
  defaultZone: 'Europe',
  taxRates: [
    { name: 'Standard Tax', percentage: 20 },
    { name: 'Reduced Tax', percentage: 10 },
    { name: 'Zero Tax', percentage: 0 },
  ],
  shippingMethods: [
    { name: 'Standard Shipping', price: 500 },
    { name: 'Express Shipping', price: 1000 },
  ],
  countries: [
    { name: 'Australia', code: 'AU', zone: 'Oceania' },
    { name: 'Austria', code: 'AT', zone: 'Europe' },
    { name: 'Canada', code: 'CA', zone: 'Americas' },
    { name: 'China', code: 'CN', zone: 'Asia' },
    { name: 'South Africa', code: 'ZA', zone: 'Africa' },
    { name: 'United Kingdom', code: 'GB', zone: 'Europe' },
    { name: 'United States of America', code: 'US', zone: 'Americas' },
    { name: 'Nederland', code: 'NL', zone: 'Europe' },
    { name: 'Belgie', code: 'BE', zone: 'Europe' },
  ],
  collections: [
    {
      name: 'Computers',
      filters: [
        {
          code: 'facet-value-filter',
          args: { facetValueNames: ['computers'], containsAny: false },
        },
      ],
    },
    {
      name: 'Electronics',
      filters: [
        {
          code: 'facet-value-filter',
          args: { facetValueNames: ['electronics'], containsAny: false },
        },
      ],
    },
  ],
  paymentMethods: [],
};

// ---- Inlined from packages/test/src/test-helpers.ts ----

async function waitFor<T>(
  conditionFn: () => Promise<T | undefined> | T | undefined,
  interval = 100,
  timeout = 10000
): Promise<T> {
  const startTime = Date.now();
  let result: T | undefined;
  let elapsedTime = 0;
  while (elapsedTime < timeout) {
    result = await conditionFn();
    if (result) {
      return result;
    }
    elapsedTime = Date.now() - startTime;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`'waitFor()' Failed to resolve a value after ${timeout}ms`);
}

// ---- Shared GraphQL queries ----

const GET_PRODUCTS = gql`
  query GetProducts {
    products {
      items {
        id
        slug
        name
      }
    }
  }
`;

const WARMUP_QUERY = `
  query {
    products {
      items {
        id
        name
      }
    }
  }
`;

const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      id
      slug
      name
    }
  }
`;

// ---- Client constants ----

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

const SEARCH_QUERY = `
  query Search($term: String!) {
    search(input: { term: $term }) {
      totalItems
      items {
        productId
        slug
        productName
        score
      }
    }
  }
`;

const PRODUCT_QUERY = `
  query Product($id: ID!) {
    product(id: $id) {
      id
      name
      slug
      description
      variants {
        id
        sku
        name
        price
        priceWithTax
        facetValues {
          id
          code
          name
        }
      }
      facetValues {
        id
        code
        name
      }
      collections {
        id
        name
        slug
      }
    }
  }
`;

interface CliArgs {
  concurrency: number;
  duration: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  const concurrency = args.concurrency ? Number(args.concurrency) : 10;
  const duration = args.duration ? Number(args.duration) : 20;
  return { concurrency, duration };
}

async function makeGraphQLRequest(
  query: string,
  variables: Record<string, unknown>
): Promise<any> {
  const res = await (globalThis as any).fetch(
    `http://localhost:3050/shop-api`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function runBenchmark(
  concurrency: number,
  durationMs: number
): Promise<{
  searchTotal: number;
  searchSuccess: number;
  searchError: number;
  productTotal: number;
  productSuccess: number;
  productError: number;
}> {
  const stats = {
    searchTotal: 0,
    searchSuccess: 0,
    searchError: 0,
    productTotal: 0,
    productSuccess: 0,
    productError: 0,
  };

  const stopTime = Date.now() + durationMs;
  const startTime = Date.now();

  const logInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const total = stats.searchTotal + stats.productTotal;
    console.log(
      `  [${elapsed.toFixed(1)}s] total=${total} ` +
        `(search=${stats.searchTotal} ok=${stats.searchSuccess} err=${stats.searchError}, ` +
        `product=${stats.productTotal} ok=${stats.productSuccess} err=${stats.productError}) ` +
        `@ ${(total / elapsed).toFixed(1)} req/s`
    );
  }, 5000);

  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (Date.now() < stopTime) {
          const isSearch = Math.random() < 0.5;
          if (isSearch) {
            const term = QUERIES[Math.floor(Math.random() * QUERIES.length)];
            stats.searchTotal++;
            try {
              await makeGraphQLRequest(SEARCH_QUERY, { term });
              stats.searchSuccess++;
            } catch {
              stats.searchError++;
            }
          } else {
            stats.productTotal++;
            try {
              await makeGraphQLRequest(PRODUCT_QUERY, {
                id: 'T_1',
              });
              stats.productSuccess++;
            } catch {
              stats.productError++;
            }
          }
        }
      })()
    );
  }

  await Promise.all(workers);
  clearInterval(logInterval);

  const elapsed = (Date.now() - startTime) / 1000;
  const total = stats.searchTotal + stats.productTotal;
  console.log(
    `  [${elapsed.toFixed(1)}s] total=${total} ` +
      `(search=${stats.searchTotal} ok=${stats.searchSuccess} err=${stats.searchError}, ` +
      `product=${stats.productTotal} ok=${stats.productSuccess} err=${stats.productError}) ` +
      `@ ${(total / elapsed).toFixed(1)} req/s (final)`
  );

  return stats;
}

async function waitForServer(maxWaitMs: number = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      await makeGraphQLRequest(WARMUP_QUERY, {});
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Server on localhost:3050 did not become ready in time');
}

// ---- Client entry point ----

async function runClient() {
  const { concurrency, duration } = parseArgs(process.argv);

  if (typeof (globalThis as any).fetch !== 'function') {
    console.error('Error: fetch is not available. Please use Node.js 18+.');
    process.exit(1);
  }

  console.log('Waiting for server on localhost:3050...');
  await waitForServer();

  console.log(
    `Running benchmark with concurrency=${concurrency}, duration=${duration}s`
  );

  try {
    const result = await makeGraphQLRequest(WARMUP_QUERY, {});
    const firstProduct = result?.data?.products?.items?.[0];
    if (firstProduct) {
      console.log(
        `Warm-up OK. First product: ${firstProduct.name} (id: ${firstProduct.id})`
      );
    } else {
      console.log('Warm-up query returned no products');
    }
  } catch (err: any) {
    console.error('Warm-up query failed:', err.message);
  }

  const durationMs = duration * 1000;
  const startTime = Date.now();
  const stats = await runBenchmark(concurrency, durationMs);
  const elapsedMs = Date.now() - startTime;

  const elapsedSeconds = elapsedMs / 1000;
  console.log('');
  console.log('=== Concurrent Benchmark Results ===');
  console.log(`Concurrency:       ${concurrency} workers`);
  console.log(`Duration:          ${elapsedSeconds.toFixed(1)}s`);
  console.log('');
  console.log(`Search queries:`);
  console.log(`  Total:           ${stats.searchTotal}`);
  console.log(`  Success:         ${stats.searchSuccess}`);
  console.log(`  Error:           ${stats.searchError}`);
  console.log(
    `  Per second:      ${(stats.searchTotal / elapsedSeconds).toFixed(1)}`
  );
  console.log('');
  console.log(`Product queries:`);
  console.log(`  Total:           ${stats.productTotal}`);
  console.log(`  Success:         ${stats.productSuccess}`);
  console.log(`  Error:           ${stats.productError}`);
  console.log(
    `  Per second:      ${(stats.productTotal / elapsedSeconds).toFixed(1)}`
  );
  console.log('');
  console.log(`Total requests:    ${stats.searchTotal + stats.productTotal}`);
  console.log(
    `Total per second:  ${(
      (stats.searchTotal + stats.productTotal) /
      elapsedSeconds
    ).toFixed(1)}`
  );
}

// ---- Server entry point ----

async function runServer() {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));

  const config = mergeConfig(testConfig, {
    apiOptions: {
      port: 3050,
    },
    logger: new DefaultLogger({ level: LogLevel.Error }),
    plugins: [BetterSearchPlugin.init({})],
  });

  console.log('Starting server...');
  const { server, adminClient } = createTestEnvironment(config);

  await server.init({
    initialData,
    productsCsvPath: './test/search-products.csv',
  });

  let indexBuilt = false;
  const subscription = server.app
    .get(EventBus)
    .ofType(BetterSearchIndexEvent)
    .subscribe((e) => {
      if (
        e.ctx.channel.token === 'e2e-default-channel' &&
        e.numberOfProductsIndexed > 0
      ) {
        indexBuilt = true;
      }
    });

  await adminClient.asSuperAdmin();
  const result = (await adminClient.query(GET_PRODUCTS as any)) as {
    products: { items: Array<{ id: string }> };
  };
  if (result.products.items.length > 0) {
    await adminClient.query(UPDATE_PRODUCT as any, {
      input: {
        id: result.products.items[0].id,
        enabled: true,
      },
    });
  }

  await waitFor(() => indexBuilt, 100, 30000);
  subscription.unsubscribe();

  console.log('Server ready on port 3050');
  return server;
}

// ---- Main orchestration ----

async function main() {
  const server = await runServer();

  const userArgs = process.argv.slice(3); // skip node + script path
  const client = fork(__filename, ['--client', ...userArgs], {
    stdio: 'inherit',
  });

  await new Promise<void>((resolve, reject) => {
    client.on('exit', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Client exited with code ${code}`));
      }
    });
  });

  console.log('Benchmark finished.');
  await server.destroy();
  process.exit(0);
}

// ---- Entry point ----

if (process.argv.includes('--client')) {
  runClient().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
