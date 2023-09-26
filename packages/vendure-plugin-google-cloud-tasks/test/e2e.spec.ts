import {
  DefaultLogger,
  DefaultSearchPlugin,
  InitialData,
  LogLevel,
} from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { CloudTasksPlugin } from '../src/cloud-tasks.plugin';

let task: { url: string; body: string };
const mockClient = {
  createTask: vi
    .fn()
    .mockImplementation((request) => (task = request.task.httpRequest)),
  createQueue: vi.fn(),
  locationPath: vi.fn(),
  queuePath: vi.fn(),
};

vi.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: vi.fn().mockImplementation(() => mockClient),
}));

describe('CloudTasks job queue e2e', () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  testConfig.plugins.push(
    CloudTasksPlugin.init({
      taskHandlerHost: 'https://localhost',
      projectId: 'test-project',
      location: 'europe-west1',
      authSecret: 'some-secret',
      queueSuffix: 'plugin-test',
      defaultJobRetries: 50,
      errorHandler: async (error) => {
        console.log('Custom error handler', error);
      },
    })
  );
  testConfig.plugins.push(DefaultSearchPlugin);
  // Enable this line to see debug logs
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  testConfig.apiOptions.port = 3103;
  const { server, adminClient } = createTestEnvironment(testConfig);
  let started = false;

  beforeAll(async () => {
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    started = true;
  }, 60000);

  afterAll(async () => {
    await server.destroy();
  });

  it('Should start successfully', async () => {
    expect(started).toBe(true);
  });

  let reindexId: string;

  it('Should create a Queue and Task', async () => {
    await adminClient.asSuperAdmin();
    ({
      reindex: { id: reindexId },
    } = await adminClient.query(
      gql`
        mutation {
          reindex {
            id
          }
        }
      `
    ));
    expect(reindexId).toBeDefined();
    expect(mockClient.locationPath).lastCalledWith(
      'test-project',
      'europe-west1'
    );
    expect(mockClient.queuePath).lastCalledWith(
      'test-project',
      'europe-west1',
      'update-search-index-plugin-test'
    );
    expect(mockClient.createQueue).toHaveBeenCalled();
    expect(mockClient.createTask).toHaveBeenCalled();
    expect(task.url).toBe('https://localhost/cloud-tasks/handler');
    const body = JSON.parse(Buffer.from(task.body, 'base64').toString('utf8'));
    expect(body.maxRetries).toBe(50);
  });

  it('Should fail unauthorized webhook', async () => {
    const buff = new Buffer(task.body, 'base64');
    const res = await adminClient.fetch(
      `http://localhost:3103/cloud-tasks/handler`,
      {
        method: 'post',
        body: buff.toString(),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer malicious-attempt',
        },
      }
    );
    expect(res.status).toBe(401);
  });

  it('Should handle incoming task', async () => {
    const buff = new Buffer(task.body, 'base64');
    const res = await adminClient.fetch(
      `http://localhost:3103/cloud-tasks/handler`,
      {
        method: 'post',
        body: buff.toString(),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer some-secret',
        },
      }
    );
    expect(res.status).toBe(200);
  });

  it('Should have successful jobs in database', async () => {
    await adminClient.asSuperAdmin();
    const data: any = await adminClient.query(
      gql`
        query {
          jobs(options: { filter: { isSettled: { eq: true } } }) {
            totalItems
          }
        }
      `
    );
    expect(data.jobs?.totalItems).toBeGreaterThan(0);
  });

  it('Should clear settled jobs', async () => {
    const res = await adminClient.fetch(
      `http://localhost:3103/cloud-tasks/clear-jobs/1`,
      {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer some-secret',
        },
      }
    );
    expect(res.status).toBe(200);
  });
});
