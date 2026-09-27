import { expect, test } from '@playwright/test';

test('library loads and opens the demo deck with 3 nodes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'All decks' })).toBeVisible();

  await page.getByRole('button', { name: /^Samples/ }).click();
  await page.getByRole('link', { name: 'Open demo deck' }).click();
  await expect(page).toHaveURL(/\/deck\/demo$/);

  const nodes = page.getByTestId('deck-node');
  await expect(nodes).toHaveCount(3);
  for (const node of await nodes.all()) await expect(node).toBeVisible();
});

test('editor shell renders all panels', async ({ page }) => {
  await page.goto('/deck/demo'); // deep link → SPA fallback
  await expect(page.getByRole('complementary', { name: 'Outline' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
  await expect(page.getByLabel('Diagram canvas')).toBeVisible();

  // Monaco JSON panel (bundled locally, read-only) shows the deck.
  const json = page.getByRole('region', { name: 'JSON' });
  await expect(json.locator('.monaco-editor')).toBeVisible();
  await expect(json).toContainText('https://sododeck.com/schema/v1.json');
  await expect(json).toContainText('"web-app"'); // Monaco virtualizes: only visible lines are in the DOM
});

test('selecting a node updates the inspector', async ({ page }) => {
  await page.goto('/deck/demo');
  await page.getByTestId('deck-node').filter({ hasText: 'Order Service' }).click();
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector.getByRole('heading', { name: 'Order Service' })).toBeVisible();
});

test('makes no third-party network requests', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== baseURL)
      external.push(url.href);
  });
  await page.goto('/deck/demo');
  await expect(page.getByRole('region', { name: 'JSON' }).locator('.monaco-editor')).toBeVisible();
  expect(external).toEqual([]);
});
