import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  use: { baseURL: 'http://127.0.0.1:4337' },
  webServer: {
    command: 'yarn dev --host 127.0.0.1 --port 4337 --ignore-lock',
    cwd: new URL('.', import.meta.url).pathname,
    url: 'http://127.0.0.1:4337',
    timeout: 120_000,
  },
});
