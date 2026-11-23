require('dotenv').config();

import path from 'node:path';
import {
  Administrator,
  DefaultLogger,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  dummyPaymentHandler,
  ID,
  LogLevel,
  mergeConfig,
  ProductService,
  TransactionalConnection,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import {
  ContentAutomationPlugin,
  ContentAutomationStrategy,
  ContentHealthPluginOptions,
  checkMetaDescriptionLength,
  checkMetaTitleLength,
  extractMetaDescription,
  extractTitle,
  validateHreflang,
  validateJsonLd,
} from '../src';
import { MOCK_STOREFRONT_PORT } from './mock-storefront-server';

/**
 * Creates a demo strategy for local development: pretends to generate content for every
 * product without calling an AI provider. The product-description strategy also
 * appends the product name to its description to demonstrate saving content.
 */
function createDemoStrategy(
  name: string,
  getResultMessage: (productName: string) => string,
  linkToEntity = true,
): ContentAutomationStrategy<{ id: ID; name: string }> {
  return {
    name,
    // Run by the "Run content automations" button on the product detail page
    entityType: 'product',
    async loadInputData(ctx, injector) {
      const products = await injector
        .get(ProductService)
        .findAll(ctx, { take: 1000 });
      return products.items.map((p) => ({ id: p.id, name: p.name }));
    },
    async generateAndSaveContent(ctx, injector, input) {
      if (name === 'product-description') {
        const productService = injector.get(ProductService);
        const product = await productService.findOne(ctx, input.id);
        if (!product) {
          throw new Error(`Product '${input.id}' no longer exists`);
        }
        const note = `<br>[${name}] Content automation: name was changed to '${input.name}'`;
        await productService.update(ctx, {
          id: product.id,
          translations: [
            {
              languageCode: ctx.languageCode,
              description: `${product.description}\n${note}`,
            },
          ],
        });
      }
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
    (n) => `Updated meta title of '${n}'`,
  ),
  createDemoStrategy(
    'product-meta-description',
    (n) => `Updated meta description of '${n}'`,
  ),
  createDemoStrategy(
    'product-description',
    (n) => `Rewrote product description of '${n}'`,
  ),
  createDemoStrategy(
    'product-usage-instructions',
    (n) => `Added usage instructions to '${n}'`,
  ),
  createDemoStrategy('product-faq', (n) => `Generated 5 FAQ items for '${n}'`),
  createDemoStrategy(
    'collection-description',
    (n) => `Updated collection description based on '${n}'`,
  ),
  createDemoStrategy(
    'collection-meta-tags',
    (n) => `Updated collection meta tags based on '${n}'`,
  ),
  createDemoStrategy(
    'category-intro',
    (n) => `Wrote category intro featuring '${n}'`,
  ),
  createDemoStrategy(
    'variant-usage',
    (n) => `Added variant usage tips to '${n}'`,
  ),
  createDemoStrategy(
    'variant-specs',
    (n) => `Summarized variant specifications of '${n}'`,
  ),
  createDemoStrategy(
    'seo-alt-texts',
    (n) => `Generated image alt texts for '${n}'`,
  ),
  createDemoStrategy(
    'seo-keywords',
    (n) => `Suggested 8 SEO keywords for '${n}'`,
  ),
  createDemoStrategy(
    'social-media-caption',
    (n) => `Wrote social media caption for '${n}'`,
  ),
  createDemoStrategy(
    'search-synonyms',
    (n) => `Added search synonyms for '${n}'`,
    false,
  ),
  createDemoStrategy(
    'blog-teaser',
    (n) => `Drafted blog teaser about '${n}'`,
    false,
  ),
];

/**
 * Content health demo config, checking the pages of the mock storefront started by dev-server.ts
 */
const contentHealth: ContentHealthPluginOptions = {
  getProductUrl: (_ctx, { product, languageCode }) =>
    `http://localhost:${MOCK_STOREFRONT_PORT}/${languageCode}/products/${product.slug}`,
  getCollectionUrl: (_ctx, { collection, languageCode }) =>
    `http://localhost:${MOCK_STOREFRONT_PORT}/${languageCode}/collections/${collection.slug}`,
  getSitemapUrl: () => `http://localhost:${MOCK_STOREFRONT_PORT}/sitemap.xml`,
  maxRedirects: 5,
  shouldCheckEntity: (_ctx, entity) =>
    'enabled' in entity ? entity.enabled : !entity.isPrivate,
  // The README example: shows the storefront findings of the
  // "Broken SEO Demo Product" seeded in dev-server.ts.
  validateStorefront: async (
    _ctx,
    { entityType, channel, url, html, fetchPage },
  ) => [
    ...checkMetaTitleLength(extractTitle(html)),
    ...checkMetaDescriptionLength(extractMetaDescription(html)),
    ...validateJsonLd(html, entityType),
    ...(await validateHreflang({
      html,
      pageUrl: url,
      enabledLanguageCodes: channel.availableLanguageCodes,
      fetchPage,
    })),
  ],
  checks: {
    product: [
      (_ctx, { product }) => {
        const description = (product.description ?? '') as string;
        if (description.trim().length < 20) {
          return [
            {
              source: 'demo-description-check',
              severity: 'warning',
              code: 'PRODUCT_DESCRIPTION_TOO_SHORT',
              message:
                'Product description should be at least 20 characters long.',
            },
          ];
        }
        return [];
      },
    ],
  },
  additionalChecks: [
    async (ctx, injector) => {
      const connection = injector.get(TransactionalConnection);
      const administrators = await connection
        .getRepository(ctx, Administrator)
        .find();
      return administrators
        .filter((admin) => !admin.emailAddress?.includes('@'))
        .map((admin) => ({
          entityType: 'administrator',
          entityId: admin.id,
          label:
            `${admin.firstName} ${admin.lastName}`.trim() || admin.emailAddress,
          url: `/administrators/${admin.id}`,
          messages: [
            {
              source: 'demo-admin-email-check',
              severity: 'warning' as const,
              code: 'ADMINISTRATOR_EMAIL_INVALID',
              message: "Administrator email address doesn't look valid.",
            },
          ],
        }));
    },
  ],
};

// Both features are enabled by default. Use DEV_FEATURES=automation or DEV_FEATURES=health to test a single feature.
const devFeatures = process.env.DEV_FEATURES ?? 'automation,health';

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
      automationStrategies: devFeatures.includes('automation')
        ? demoStrategies
        : undefined,
      contentHealth: devFeatures.includes('health') ? contentHealth : undefined,
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
