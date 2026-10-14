/**
 * E2E Admin: cobertura do painel — navegação em todas as seções e logout.
 */
import { test, expect } from '@playwright/test';
import { loginAdminInPage } from './helpers/auth.js';

const ADMIN_ROUTES: { path: string; expectText?: RegExp }[] = [
  { path: '/admin', expectText: /administração do site|conteúdo/i },
  { path: '/admin/personalizacao', expectText: /home page|construtor/i },
  { path: '/admin/banners', expectText: /banners/i },
  { path: '/admin/banners-destaque', expectText: /banners de destaque/i },
  { path: '/admin/tema', expectText: /tema|visual/i },
  { path: '/admin/redes-sociais', expectText: /redes sociais|social/i },
  { path: '/admin/paginas', expectText: /páginas|institucionais/i },
  { path: '/admin/blog', expectText: /blog/i },
  { path: '/admin/galeria', expectText: /galeria|mídia/i },
  { path: '/admin/configuracoes', expectText: /configurações|loja/i },
  { path: '/admin/equipe', expectText: /equipe|acessos/i },
  { path: '/admin/configuracoes/codigo', expectText: /código/i },
  { path: '/admin/ajuda', expectText: /ajuda|central/i },
];

test.describe('Admin painel — navegação em todas as seções', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminInPage(page);
  });

  for (const { path, expectText } of ADMIN_ROUTES) {
    test(path + ' carrega sem erro', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '($|\\?)'));
      if (expectText) {
        await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 10000 });
      }
    });
  }
});

test.describe('Admin painel — logout', () => {
  test('logout redireciona para login', async ({ page }) => {
    await loginAdminInPage(page);
    await page.waitForLoadState('networkidle');
    const sairBtn = page.getByRole('button', { name: /sair/i }).or(page.getByText(/sair/i).first());
    await expect(sairBtn).toBeVisible({ timeout: 8000 });
    await sairBtn.click();
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 });
  });
});
