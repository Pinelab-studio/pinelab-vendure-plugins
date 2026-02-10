import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  ProductVariant,
} from '@vendure/core';
import {
  SqljsInitializer,
  createTestEnvironment,
  registerInitializer,
} from '@vendure/testing';
import { initialData } from '../../../test/src/initial-data';
import dotenv from 'dotenv';
import { BetterSearchPlugin } from '../../src';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import gql from 'graphql-tag';
import { DummyEngine } from './dummy-engine';

/**
 * Script to test relevance and performance of the different search algorithms.
 *
 * To test:
 * Flexsearch, because it is the most performant, but needs custom algorithms for better relevance
 * MiniSearch, because it uses BM25 algorithm, but is not as performant as Flexsearch
 * Orama, similar to MiniSearch, but allows custom algorithm settings
 *
 * We test inside the Vendure dev server, to get more production like performance metrics.
 */

(async () => {
  dotenv.config();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { testConfig } = require('@vendure/testing');
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Debug }),
    apiOptions: {
      adminApiPlayground: {},
      shopApiPlayground: {},
    },
    plugins: [
      BetterSearchPlugin.init({
        searchStrategy: new DummyEngine(),
      }),
      DefaultSearchPlugin,
      AdminUiPlugin.init({
        port: 3002,
        route: 'admin',
      }),
    ],
  });
  const { server, shopClient } = createTestEnvironment(config);
  await server.init({
    initialData,
    productsCsvPath: './test/search-products.csv',
  });

  // Benchmark: concurrent betterSearch calls
  const searchTerms = ['laptop', 'shirt', 'camera', 'shoe', 'phone'];
  const concurrency = 10;
  const iterations = 50;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const term = searchTerms[i % searchTerms.length];
    const start = performance.now();
    // Fire `concurrency` requests in parallel
    await Promise.all(
      Array.from({ length: concurrency }, () =>
        shopClient.query(BETTER_SEARCH, { term })
      )
    );
    const elapsed = performance.now() - start;
    times.push(elapsed / concurrency); // avg per request in this batch
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(`--- betterSearch benchmark ---`);
  console.log(`Iterations: ${iterations}, Concurrency: ${concurrency}`);
  console.log(
    `Avg: ${avg.toFixed(2)} ms | Min: ${min.toFixed(2)} ms | Max: ${max.toFixed(
      2
    )} ms`
  );
})();

const BETTER_SEARCH = gql`
  query BetterSearch($term: String!) {
    betterSearch(term: $term) {
      productId
      slug
      productName
      lowestPrice
      lowestPriceWithTax
      highestPrice
      highestPriceWithTax
      facetValueIds
      collectionIds
    }
  }
`;
