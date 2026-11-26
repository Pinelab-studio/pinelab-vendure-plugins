import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import {
  Browser,
  chromium,
  expect as expectBrowser,
  Page,
} from '@playwright/test';
import gql from 'graphql-tag';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import { CREATE_CONTENT_ENTRY } from './simple-cms-helpers';
import { createCmsTestEnvironment, getUnusedPort } from './test-environment';

let environment: Awaited<ReturnType<typeof createCmsTestEnvironment>>;
let vite: ChildProcess;
let browser: Browser;
let page: Page;
let dashboardUrl: string;
let entryId: string;
let output = '';

beforeAll(async () => {
  environment = await createCmsTestEnvironment();
  await environment.server.init({
    initialData: {
      ...initialData,
      collections: [
        { name: 'Garden tools', filters: [] },
        { name: 'Seeds', filters: [] },
        { name: 'Plants', filters: [] },
      ],
    },
  });
  await environment.adminClient.asSuperAdmin();
  const { createContentEntry } = await environment.adminClient.query(
    CREATE_CONTENT_ENTRY,
    {
      input: {
        contentTypeCode: 'quickFilter',
        fields: { key: 'home', collections: [] },
      },
    },
  );
  entryId = createContentEntry.id;
  const dashboardPort = await getUnusedPort();
  vite = spawn(
    process.execPath,
    [
      join(__dirname, '../../../node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(dashboardPort),
      '--strictPort',
    ],
    {
      cwd: join(__dirname, '..'),
      env: {
        ...process.env,
        SIMPLE_CMS_PORT: String(environment.port),
        SIMPLE_CMS_GQL_OUTPUT_PATH: join(environment.directory, 'gql'),
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  vite.stdout?.on('data', (chunk) => {
    output += chunk.toString();
  });
  vite.stderr?.on('data', (chunk) => {
    output += chunk.toString();
  });
  await vi.waitFor(
    () => {
      if (vite.exitCode !== null)
        throw new Error(`Dashboard exited: ${output}`);
      if (!output.includes(`http://127.0.0.1:${dashboardPort}/dashboard`)) {
        throw new Error(`Dashboard not ready: ${output}`);
      }
    },
    { timeout: 60000 },
  );
  dashboardUrl = `http://localhost:${dashboardPort}/dashboard`;
  browser = await chromium.launch();
  page = await browser.newPage();
}, 90000);

afterAll(async () => {
  await browser?.close();
  if (vite && vite.exitCode === null) {
    const stopped = once(vite, 'exit');
    vite.kill('SIGTERM');
    await stopped;
  }
  await environment?.destroy();
}, 30000);

it('adds, removes, reorders and reopens Collection selections using the Dashboard', async () => {
  await page.goto(`${dashboardUrl}/content/${entryId}`);
  await page.getByPlaceholder('Email', { exact: true }).fill('superadmin');
  await page.getByPlaceholder('Password', { exact: true }).fill('superadmin');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/content\/T_\d+/);
  await expectBrowser(page.getByLabel('key', { exact: true })).toHaveValue(
    'home',
  );

  const list = page.getByRole('group', { name: 'collections', exact: true });
  for (const name of ['Garden tools', 'Seeds', 'Plants']) {
    await list
      .getByRole('button', { name: 'Add collections', exact: true })
      .click();
    await list
      .getByRole('button', { name: 'Select collection', exact: true })
      .click();
    await page.getByRole('option', { name: new RegExp(name) }).click();
    await expectBrowser(page.getByRole('dialog')).toBeHidden();
  }
  await list
    .getByRole('button', { name: 'Move item 3 up', exact: true })
    .click();
  await list
    .getByRole('button', { name: 'Remove item 1', exact: true })
    .click();
  await expectBrowser(list.locator('li')).toContainText(['Plants', 'Seeds']);
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expectBrowser(
    page.getByText('Content entry updated', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expectBrowser(list.locator('li')).toContainText(['Plants', 'Seeds']);
  await expectBrowser(page.getByLabel('key', { exact: true })).toHaveValue(
    'home',
  );
  expect(
    (await environment.shopClient.query(GET_FILTERS)).quickFilters,
  ).toEqual([
    {
      key: 'home',
      collections: [
        { name: 'Plants', slug: 'plants' },
        { name: 'Seeds', slug: 'seeds' },
      ],
    },
  ]);

  await list
    .getByRole('button', { name: 'Move item 2 up', exact: true })
    .click();
  await expectBrowser(list.locator('li')).toContainText(['Seeds', 'Plants']);
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expectBrowser(
    page.getByText('Content entry updated', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expectBrowser(list.locator('li')).toContainText(['Seeds', 'Plants']);

  await list
    .getByRole('button', { name: 'Remove item 1', exact: true })
    .click();
  await list
    .getByRole('button', { name: 'Remove item 1', exact: true })
    .click();
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expectBrowser(
    page.getByText('Content entry updated', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expectBrowser(list).toBeVisible();
  await expectBrowser(list.locator('li')).toHaveCount(0);
  expect(
    (await environment.shopClient.query(GET_FILTERS)).quickFilters,
  ).toEqual([{ key: 'home', collections: [] }]);

  await page.goto(`${dashboardUrl}/content/new?contentType=quickFilter`);
  await page.getByLabel('key', { exact: true }).fill('new-filter');
  await list
    .getByRole('button', { name: 'Add collections', exact: true })
    .click();
  await list
    .getByRole('button', { name: 'Select collection', exact: true })
    .click();
  await page.getByRole('option', { name: /Garden tools/ }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/\/content\/T_\d+/);
  await expectBrowser(
    page.getByRole('dialog', { name: 'Confirm navigation' }),
  ).toBeHidden();
  await page.reload();
  await expectBrowser(list.locator('li')).toContainText(['Garden tools']);
  await expectBrowser(page.getByLabel('key', { exact: true })).toHaveValue(
    'new-filter',
  );
}, 90000);

const GET_FILTERS = gql`
  query { quickFilters { key collections { name slug } } }
`;
