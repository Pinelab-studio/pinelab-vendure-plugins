import { PuppeteerLaunchOptions } from 'puppeteer';

/**
 * Builds the final Puppeteer launch options by merging plugin defaults,
 * user-supplied config, and the `PUPPETEER_EXECUTABLE_PATH` env var.
 */
export function buildLaunchOptions(
  configOptions: PuppeteerLaunchOptions | undefined
): PuppeteerLaunchOptions {
  const defaults: PuppeteerLaunchOptions = {
    headless: true,
    args: ['--no-sandbox'],
  };
  return {
    ...defaults,
    ...configOptions,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  };
}
