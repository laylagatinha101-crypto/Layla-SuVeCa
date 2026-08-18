import { expect, test as base, type Page } from '@playwright/test';

const FIXED_NOW = new Date('2026-08-12T12:00:00-03:00').valueOf();

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(({ now }) => {
      const NativeDate = Date;
      class FixedDate extends NativeDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          super(...(args.length ? args : [now]));
        }

        static now() {
          return now;
        }
      }

      Object.setPrototypeOf(FixedDate, NativeDate);
      window.Date = FixedDate as DateConstructor;
      window.localStorage.clear();
      window.sessionStorage.clear();
    }, { now: FIXED_NOW });

    await use(page);
  },
});

export { expect };

export async function openApp(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Ir para a Apostila' })).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText('Carregando ferramenta de estudo…')).toBeHidden();
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready;
  });
  await page.waitForTimeout(350);
}

export async function openTab(page: Page, name: string) {
  const desktopNavigation = page.getByRole('navigation', { name: 'Navegação principal' });
  if (await desktopNavigation.isVisible()) {
    const directTab = desktopNavigation.getByRole('button').filter({ hasText: name }).first();
    if (await directTab.count() && await directTab.isVisible()) {
      await directTab.click();
    } else {
      await desktopNavigation.getByRole('button', { name: 'Mais', exact: true }).click();
      await page.getByRole('menu', { name: 'Outras ferramentas' }).getByRole('menuitem').filter({ hasText: name }).click();
    }
  } else {
    const mobileNavigation = page.getByRole('navigation', { name: 'Navegação móvel' });
    const directTab = mobileNavigation.getByRole('button').filter({ hasText: name }).first();
    if (await directTab.count() && await directTab.isVisible()) {
      await directTab.click();
    } else {
      await mobileNavigation.getByRole('button', { name: 'Ver mais abas de navegação' }).click();
      await page.getByRole('dialog', { name: 'Outras Ferramentas' }).getByRole('button').filter({ hasText: name }).click();
    }
  }

  await expect(page.locator('main .tab-content-enter')).toBeVisible();
  await page.waitForTimeout(350);
}

export async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const offenders = [...document.body.querySelectorAll<HTMLElement>('*')]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || (rect.left >= -1 && rect.right <= viewportWidth + 1)) return false;

        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body && ancestor !== root) {
          const ancestorStyle = getComputedStyle(ancestor);
          if (['auto', 'scroll', 'hidden', 'clip'].includes(ancestorStyle.overflowX)) return false;
          ancestor = ancestor.parentElement;
        }

        return true;
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: String(element.className).slice(0, 120),
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
        rect: element.getBoundingClientRect().toJSON(),
      }));

    return {
      documentWidth: root.scrollWidth,
      viewportWidth,
      offenders,
    };
  });

  expect(overflow, JSON.stringify(overflow.offenders, null, 2)).toMatchObject({
    documentWidth: overflow.viewportWidth,
    offenders: [],
  });
}
