import { expect, test } from '@playwright/test';

test('homepage presents Pinelab Engineering branding', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Pinelab Engineering/);
  await expect(
    page
      .locator('header')
      .getByRole('link', { name: 'Pinelab Engineering', exact: true }),
  ).toBeVisible();
});

test('search is case-insensitive, trims whitespace, and supports clearing without fuzzy matching', async ({
  page,
}) => {
  await page.goto('/');
  const cards = page.locator('.plugin-card:visible');
  const originalCount = await cards.count();
  const search = page.getByRole('searchbox', {
    name: 'Search plugins and recipes',
  });
  await search.fill('  aCcEpT bLuE  ');
  await expect(cards).toHaveCount(1);
  await search.fill('Acceot Blue');
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(
    'No plugins or recipes found.',
  );
  await search.fill('');
  await expect(cards).toHaveCount(originalCount);
  await expect(page.locator('#catalog-no-results')).toBeHidden();
});

test('recipe descriptions are searchable without searching body content', async ({
  page,
}) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', {
    name: 'Search plugins and recipes',
  });
  await search.fill('custom cookie banner');
  await expect(page.locator('.plugin-card:visible')).toHaveCount(1);
  await expect(page.locator('.plugin-card:visible a')).toHaveAttribute(
    'href',
    '/recipes/marketing-consent/',
  );
  await search.fill('Initialization – All Pages');
  await expect(page.locator('.plugin-card:visible')).toHaveCount(0);
});

test('catalog grids use three desktop, two tablet and one mobile columns', async ({
  page,
}) => {
  await page.goto('/');
  for (const [width, columns] of [
    [1440, 3],
    [800, 2],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    for (const grid of await page.locator('.card-grid').all()) {
      await expect
        .poll(() =>
          grid.evaluate(
            (element) =>
              getComputedStyle(element).gridTemplateColumns.split(' ').length,
          ),
        )
        .toBe(columns);
    }
  }
});

test('plugin package keywords are searchable', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('searchbox', { name: 'Search plugins and recipes' })
    .fill('diagrams');
  await expect(page.locator('.plugin-card:visible')).toHaveCount(1);
  await expect(page.locator('.plugin-card:visible a')).toHaveAttribute(
    'href',
    '/plugin/vendure-plugin-metrics/',
  );
});

test('searching by plugin name filters homepage cards', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('searchbox', { name: 'Search plugins and recipes' })
    .fill('Accept Blue');
  await expect(page.locator('.plugin-card:visible')).toHaveCount(1);
  await expect(page.locator('.plugin-card:visible')).toContainText(
    'Accept Blue',
  );
});
