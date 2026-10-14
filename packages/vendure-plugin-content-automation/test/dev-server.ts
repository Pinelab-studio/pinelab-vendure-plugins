import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
} from '@vendure/testing';
import { Injector, Logger, VendureConfig } from '@vendure/core';
import { ModuleRef } from '@nestjs/core';
import { initialData } from '../../test/src/initial-data';
import { contentAutomationTask, runContentAutomationPopulation } from '../src';
import { config } from './vendure-config';

/**
 * The dev-server is just for development. Feel free to break anything here.
 */
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  registerInitializer('sqljs', new SqljsInitializer('__data__'));
  // Override cors after merge, because testConfig sets cors: true (boolean)
  // which mergeConfig can't properly replace with an object
  config.apiOptions.cors = {
    origin: 'http://localhost:5173',
    credentials: true,
  };

  const { server } = createTestEnvironment(config as Required<VendureConfig>);
  await server.init({
    initialData,
    productsCsvPath: '../test/src/products-import.csv',
  });
  // Populate some demo updates for the dashboard
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
        Logger.error(error.message, 'ContentAutomationDemo', error.stack)
      )
      .finally(() => {
        running = false;
      });
  }
  setInterval(runDemoTask, 10_000);
})();
