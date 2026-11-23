import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, VendureConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import gql from 'graphql-tag';
import { initialData } from '../../test/src/initial-data';
import { contentAutomationTask, runContentAutomationPopulation } from '../src';
import { startMockStorefrontServer } from './mock-storefront-server';
import { config } from './vendure-config';

const CREATE_BROKEN_DEMO_PRODUCT = gql`
  mutation CreateBrokenDemoProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
    }
  }
`;

/**
 * The dev-server is just for development. Feel free to break anything here.
 */
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await startMockStorefrontServer();
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server, adminClient } = createTestEnvironment(
    config as Required<VendureConfig>,
  );
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Seed a deliberately broken demo product, so the content health findings block, overview widget and alert
  // have something to show after a scan: its mock storefront page is missing JSON-LD, hreflang and a meta
  // description, and has a too short title.
  await adminClient.asSuperAdmin();
  await adminClient.query(CREATE_BROKEN_DEMO_PRODUCT, {
    input: {
      translations: [
        {
          languageCode: 'en',
          name: 'Broken SEO Demo Product',
          slug: 'broken-seo-demo',
          description: '',
        },
      ],
    },
  });
  Logger.info(
    'Seeded "Broken SEO Demo Product". Run the "content-health-full-scan" scheduled task, then open this product to see the findings.',
    'ContentHealthDemo',
  );
  if (
    process.env.DEV_FEATURES &&
    !process.env.DEV_FEATURES.includes('automation')
  ) {
    return;
  }
  // Populate some demo updates for the dashboard, and keep running the automation task
  await runContentAutomationPopulation(server.app);

  const injector = new Injector(server.app.get(ModuleRef));
  let running = false;
  /** Runs the task for local testing without overlapping executions. */
  function runDemoTask(): void {
    if (running) return;
    running = true;
    contentAutomationTask
      .execute(injector)
      .catch((error: Error) =>
        Logger.error(error.message, 'ContentAutomationDemo', error.stack),
      )
      .finally(() => {
        running = false;
      });
  }
  setInterval(runDemoTask, 10_000);
})();
