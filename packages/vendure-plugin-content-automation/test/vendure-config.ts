require('dotenv').config();

import {
  DefaultLogger,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  dummyPaymentHandler,
  LogLevel,
  mergeConfig,
  ProductService,
  VendureConfig,
} from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import path from 'path';
import { ContentAutomationPlugin, ContentAutomationStrategy } from '../src';

/**
 * Creates a demo strategy for local development: pretends to generate content for every
 * product, without calling an AI provider or saving anything.
 */
function createDemoStrategy(
  name: string,
  getResultMessage: (productName: string) => string,
  linkToEntity = true
): ContentAutomationStrategy<{ id: string; name: string }> {
  return {
    name,
    async loadInputData(ctx, injector) {
      const products = await injector
        .get(ProductService)
        .findAll(ctx, { take: 1000 });
      return products.items.map((p) => ({ id: String(p.id), name: p.name }));
    },
    generateAndSaveContent(ctx, injector, input) {
      return Promise.resolve({
        resultMessage: getResultMessage(input.name),
        entityUrl: linkToEntity ? `/products/${input.id}` : undefined,
      });
    },
  };
}

// Demo strategies with shared prefixes, to show searching and sorting in the dashboard
const demoStrategies = [
  createDemoStrategy(
    'product-meta-title',
    (n) => `Updated meta title of '${n}'`
  ),
  createDemoStrategy(
    'product-meta-description',
    (n) => `Updated meta description of '${n}'`
  ),
  createDemoStrategy(
    'product-description',
    (n) => `Rewrote product description of '${n}'`
  ),
  createDemoStrategy(
    'product-usage-instructions',
    (n) => `Added usage instructions to '${n}'`
  ),
  createDemoStrategy('product-faq', (n) => `Generated 5 FAQ items for '${n}'`),
  createDemoStrategy(
    'collection-description',
    (n) => `Updated collection description based on '${n}'`
  ),
  createDemoStrategy(
    'collection-meta-tags',
    (n) => `Updated collection meta tags based on '${n}'`
  ),
  createDemoStrategy(
    'category-intro',
    (n) => `Wrote category intro featuring '${n}'`
  ),
  createDemoStrategy(
    'variant-usage',
    (n) => `Added variant usage tips to '${n}'`
  ),
  createDemoStrategy(
    'variant-specs',
    (n) => `Summarized variant specifications of '${n}'`
  ),
  createDemoStrategy(
    'seo-alt-texts',
    (n) => `Generated image alt texts for '${n}'`
  ),
  createDemoStrategy(
    'seo-keywords',
    (n) => `Suggested 8 SEO keywords for '${n}'`
  ),
  createDemoStrategy(
    'social-media-caption',
    (n) => `Wrote social media caption for '${n}'`
  ),
  createDemoStrategy(
    'search-synonyms',
    (n) => `Added search synonyms for '${n}'`,
    false
  ),
  createDemoStrategy(
    'blog-teaser',
    (n) => `Drafted blog teaser about '${n}'`,
    false
  ),
];

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Debug }),
  apiOptions: {
    adminApiPlayground: true,
    shopApiPlayground: true,
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  paymentOptions: {
    paymentMethodHandlers: [dummyPaymentHandler],
  },
  plugins: [
    ContentAutomationPlugin.init({
      automationStrategies: demoStrategies,
    }),
    DefaultSearchPlugin,
    DefaultSchedulerPlugin.init(),
    DashboardPlugin.init({
      // The route should correspond to the `base` setting
      // in the vite.config.mts file
      route: 'dashboard',
      // This appDir should correspond to the `build.outDir`
      // setting in the vite.config.mts file
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
