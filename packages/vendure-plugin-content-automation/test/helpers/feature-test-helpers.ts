import {
  DefaultLogger,
  DefaultSchedulerPlugin,
  EventBus,
  LogLevel,
  mergeConfig,
  ProductEvent,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  TestServer,
  testConfig,
} from '@vendure/testing';
import gql from 'graphql-tag';
import { initialData } from '../../../test/src/initial-data';
import { waitFor } from '../../../test/src/test-helpers';
import {
  ContentAutomationPlugin,
  ContentAutomationPluginOptions,
} from '../../src';

// Helpers for the e2e files that test which features are enabled.
// Each configuration has its own file: a test process can only bootstrap one plugin configuration.

/**
 * Minimal content health options. The URLs are never fetched in this file.
 */
export const storefrontUrls = {
  getProductUrl: () => 'https://storefront.test/product',
  getCollectionUrl: () => 'https://storefront.test/collection',
};

/**
 * Starts a test server with the given plugin options. Each e2e file uses its own port, so files can run in parallel.
 */
export async function startServer(
  options: ContentAutomationPluginOptions,
  port: number,
) {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  const config = mergeConfig(testConfig, {
    logger: new DefaultLogger({ level: LogLevel.Info }),
    apiOptions: { port },
    plugins: [
      ContentAutomationPlugin.init(options),
      DefaultSchedulerPlugin.init(),
    ],
  });
  const { server, adminClient } = createTestEnvironment(config);
  await server.init({ initialData, productsCsvPath: undefined });
  await adminClient.asSuperAdmin();
  return { server, adminClient };
}

/**
 * Returns the names of all Admin API queries
 */
export async function getQueryNames(
  adminClient: SimpleGraphQLClient,
): Promise<string[]> {
  const { __schema } = await adminClient.query(GET_QUERY_NAMES);
  return __schema.queryType.fields.map((f: { name: string }) => f.name);
}

/**
 * Returns the ids of this plugin's registered scheduled tasks
 */
export async function getContentTaskIds(
  adminClient: SimpleGraphQLClient,
): Promise<string[]> {
  return (await getContentTasks(adminClient)).map((t) => t.id);
}

/**
 * Returns the ids and cron schedules of this plugin's registered scheduled tasks, sorted by id
 */
export async function getContentTasks(
  adminClient: SimpleGraphQLClient,
): Promise<Array<{ id: string; schedule: string }>> {
  const { scheduledTasks } = await adminClient.query(GET_SCHEDULED_TASKS);
  return scheduledTasks
    .filter((t: { id: string }) => t.id.startsWith('content-'))
    .map((t: { id: string; schedule: string }) => ({
      id: t.id,
      schedule: t.schedule,
    }))
    .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
}

/**
 * Returns this plugin's Dashboard permissions that the logged-in administrator holds in the default channel, sorted
 */
export async function getContentPermissions(
  adminClient: SimpleGraphQLClient,
): Promise<string[]> {
  const { me } = await adminClient.query(GET_ME_PERMISSIONS);
  return me.channels[0].permissions
    .filter((p: string) => ['ContentAutomation', 'ContentHealth'].includes(p))
    .sort();
}

/**
 * Creates and updates a product, and waits until the update event has been published to all subscribers
 */
export async function updateProductAndWaitForEvent(
  server: TestServer,
  adminClient: SimpleGraphQLClient,
): Promise<void> {
  let updateEventPublished = false;
  // Subscribed after the plugin's own subscribers, so they have received the event when this one has
  const subscription = server.app
    .get(EventBus)
    .ofType(ProductEvent)
    .subscribe((event) => {
      if (event.type === 'updated') {
        updateEventPublished = true;
      }
    });
  const { createProduct } = await adminClient.query(CREATE_PRODUCT, {
    input: {
      translations: [
        { languageCode: 'en', name: 'Test', slug: 'test', description: '' },
      ],
    },
  });
  await adminClient.query(UPDATE_PRODUCT, {
    input: { id: createProduct.id, enabled: false },
  });
  await waitFor(() => updateEventPublished);
  subscription.unsubscribe();
}

const GET_QUERY_NAMES = gql`
  query GetQueryNames {
    __schema {
      queryType {
        fields {
          name
        }
      }
    }
  }
`;

const GET_SCHEDULED_TASKS = gql`
  query GetScheduledTasks {
    scheduledTasks {
      id
      schedule
    }
  }
`;

const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
    }
  }
`;

const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      id
    }
  }
`;

const GET_ME_PERMISSIONS = gql`
  query GetMePermissions {
    me {
      channels {
        permissions
      }
    }
  }
`;
