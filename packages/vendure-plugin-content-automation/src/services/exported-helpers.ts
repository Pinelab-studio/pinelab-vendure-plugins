import { INestApplicationContext } from '@nestjs/common';
import { ContentAutomationService } from './content-automation.service';

/**
 * Runs the initial population: does the same as the nightly run, but processes
 * all changed inputs sequentially, without creating jobs.
 * Call this from a script, before the first nightly run, to prevent a burst of jobs.
 *
 * @param app - A bootstrapped Vendure application, e.g. from `bootstrapWorker()` or `bootstrap()`
 * @returns The number of processed and failed inputs
 */
export async function runContentAutomationPopulation(
  app: INestApplicationContext,
): Promise<{ processed: number; failed: number }> {
  return app.get(ContentAutomationService).runInitialPopulation();
}
