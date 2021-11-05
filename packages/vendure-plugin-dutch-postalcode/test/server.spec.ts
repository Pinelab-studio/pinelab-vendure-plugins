import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { initialData } from '../../test/src/initial-data';
import {
  DefaultLogger,
  InitialData,
  LogLevel,
  mergeConfig,
} from '@vendure/core';
import { TestServer } from '@vendure/testing/lib/test-server';
import { DutchPostalCodePlugin } from '../src/dutch-postal-code.plugin';

jest.setTimeout(20000);
describe('Dutch PostalCode plugin', () => {
  let testServer: TestServer;

  it('Server should start', async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      apiOptions: {
        port: 3101,
      },
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [DutchPostalCodePlugin.init('your-apikey')],
    });
    const { server } = createTestEnvironment(config);
    testServer = server;
    const serverStart = server.init({
      initialData: initialData as InitialData,
      productsCsvPath: '../test/src/products-import.csv',
    });
    await expect(serverStart).resolves.toEqual(undefined);
  });

  afterAll(() => {
    return testServer.destroy();
  });
});
