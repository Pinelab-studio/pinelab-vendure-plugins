import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import gql from 'graphql-tag';
import { InitialData } from '@vendure/core';
import { initialData } from '../../test/initialData';
import { CloudTasksPlugin } from '../src/cloud-tasks.plugin';

describe('CloudTasks job queue e2e', () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  testConfig.plugins.push(
    CloudTasksPlugin.init({
      taskHandlerHost: 'https://localhost',
      projectId: 'test-project',
      location: 'europe-west1',
      authSecret: 'some-secret-to-authenticate-cloud-tasks',
      queueSuffix: 'plugin-test',
    })
  );
  const { server, adminClient, shopClient } = createTestEnvironment(testConfig);

  beforeAll(async () => {
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/products-import.csv',
    });
  }, 1800 * 1000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Test', async () => {
    const { reindex } = await adminClient.query(
      gql`
        mutation {
          reindex {
            id
          }
        }
      `
    );
    console.log(reindex);
    expect(reindex).toBeDefined();
  });
});
