import AxeBuilder from '@axe-core/playwright';
import { expect, expectNoDocumentOverflow, openApp, openTab, test } from './fixtures';

const auditedTabs = ['Apostila', 'Analisador', 'Simulado', 'Cronômetro Foco', 'Roteiros', 'Questões editoriais'];

test.describe('layout responsivo', () => {
  for (const tab of auditedTabs) {
    test(`${tab} não cria rolagem horizontal na página`, async ({ page }) => {
      await openApp(page);
      if (tab !== 'Apostila') await openTab(page, tab);
      await expectNoDocumentOverflow(page);
    });
  }

  test('alvos principais da navegação têm pelo menos 44px', async ({ page }) => {
    await openApp(page);
    const navigation = (await page.getByRole('navigation', { name: 'Navegação principal' }).isVisible())
      ? page.getByRole('navigation', { name: 'Navegação principal' })
      : page.getByRole('navigation', { name: 'Navegação móvel' });

    const undersized = await navigation.getByRole('button').evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return { name: button.getAttribute('aria-label') || button.textContent?.trim(), width: rect.width, height: rect.height };
        })
    );

    expect(undersized).toEqual([]);
  });

  test('reflow equivalente a zoom de 200% não cria rolagem horizontal', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'Amostra de reflow executada uma vez.');
    await page.setViewportSize({ width: 720, height: 900 });
    await openApp(page);
    await expectNoDocumentOverflow(page);
  });
});

test.describe('teclado e leitores de tela', () => {
  test('Cronômetro Foco renderiza a experiência, sem aba vazia', async ({ page }) => {
    await openApp(page);
    await openTab(page, 'Cronômetro Foco');
    await expect(page.getByRole('heading', { name: /cronômetro de foco/i })).toBeVisible();
  });

  test('questão editorial prende o foco, fecha com Escape e devolve o foco', async ({ page }) => {
    await openApp(page);
    await openTab(page, 'Questões editoriais');
    const opener = page.getByRole('button', { name: 'Estudar questão' }).first();
    await expect(opener).toBeVisible();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: /questão editorial/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Fechar questão' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('atalho de busca abre modal e Escape devolve o foco', async ({ page }) => {
    await openApp(page);
    const searchButton = page.getByRole('button', { name: 'Abrir pesquisa' });
    await searchButton.focus();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(searchButton).toBeFocused();
  });

  test('menu Mais é operável por teclado', async ({ page }) => {
    await openApp(page);
    const desktopNavigation = page.getByRole('navigation', { name: 'Navegação principal' });
    if (await desktopNavigation.isVisible()) {
      const moreButton = desktopNavigation.getByRole('button', { name: 'Mais', exact: true });
      await moreButton.focus();
      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu', { name: 'Outras ferramentas' });
      await expect(menu).toBeVisible();
      const items = menu.getByRole('menuitem');
      await expect(items.first()).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(items.nth(1)).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(moreButton).toBeFocused();
    } else {
      const moreButton = page.getByRole('button', { name: 'Ver mais abas de navegação' });
      await moreButton.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Outras Ferramentas' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Fechar painel' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(moreButton).toBeFocused();
    }
  });

  for (const tab of auditedTabs) {
    test(`${tab} sem violações axe sérias ou críticas`, async ({ page }) => {
      await openApp(page);
      if (tab !== 'Apostila') await openTab(page, tab);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const severeViolations = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
      expect(severeViolations, JSON.stringify(severeViolations, null, 2)).toEqual([]);
    });
  }
});
