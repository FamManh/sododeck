import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test.describe('Language Switching', () => {
    test('should switch language from English to French using dropdown and verify text on the homepage', async ({
      page,
    }) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: 'Boilerplate Code for Your Next.js Project with Tailwind CSS',
        }),
      ).toBeVisible();

      await page.getByLabel('Change language').selectOption('fr');

      await expect(
        page.getByRole('heading', {
          name: 'Code de démarrage pour Next.js avec Tailwind CSS',
        }),
      ).toBeVisible();
    });

    test('should switch language from English to French using URL and verify text on the about page', async ({
      page,
    }) => {
      await page.goto('/about');

      await expect(page.getByText('Welcome to our About page!')).toBeVisible();

      await page.goto('/fr/about');

      await expect(page.getByText('Bienvenue sur notre page À propos')).toBeVisible();
    });
  });
});
