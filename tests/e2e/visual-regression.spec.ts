import { expect, openApp, openTab, test } from './fixtures';

test.describe('regressão visual das experiências principais', () => {
  test('apostila e navegação', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('heading', { name: 'SuVeCA = Sujeito + Verbo + Complemento + Adjunto + Predicativo' })).toBeVisible();
    await expect(page).toHaveScreenshot('apostila.png', { fullPage: false });
  });

  test('analisador sintático', async ({ page }) => {
    await openApp(page);
    await openTab(page, 'Analisador');
    await expect(page.getByRole('heading', { name: /Desmontagem de Orações/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SuVeCA = Sujeito + Verbo + Complemento + Adjunto + Predicativo' })).toBeVisible();
    await expect(page.getByText(/mapa de análise para reconstruir as relações sintáticas/i)).toBeVisible();
    await expect(page).toHaveScreenshot('analisador.png', { fullPage: false });
  });

  test('simulado', async ({ page }) => {
    await openApp(page);
    await openTab(page, 'Simulado');
    await expect(page.getByRole('heading', { name: /Simulado Geral/i })).toBeVisible();
    await expect(page).toHaveScreenshot('simulado.png', { fullPage: false });
  });

  test('roteiros editoriais de resolução', async ({ page }) => {
    await openApp(page);
    await openTab(page, 'Roteiros');
    await expect(page.getByRole('heading', { name: /Roteiros de resolução/i })).toBeVisible();
    await expect(page.getByLabel(/Buscar nos roteiros/i)).toBeVisible();
    await expect(page).toHaveScreenshot('roteiros.png', { fullPage: false });
  });

  test('menu de ferramentas secundárias', async ({ page }) => {
    await openApp(page);
    const desktopNavigation = page.getByRole('navigation', { name: 'Navegação principal' });
    if (await desktopNavigation.isVisible()) {
      await desktopNavigation.getByRole('button', { name: 'Mais', exact: true }).click();
      await expect(page.getByRole('menu', { name: 'Outras ferramentas' })).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Ver mais abas de navegação' }).click();
      await expect(page.getByRole('dialog', { name: 'Outras Ferramentas' })).toBeVisible();
    }
    await expect(page).toHaveScreenshot('menu-mais.png', { fullPage: false });
  });
});
