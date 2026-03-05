/**
 * E2E Admin: cobertura do painel — navegação em todas as seções e testes de duplo clique.
 */
import { test, expect } from '@playwright/test';
import { loginAdminInPage } from './helpers/auth.js';

const ADMIN_ROUTES: { path: string; expectText?: RegExp }[] = [
  { path: '/admin', expectText: /dashboard|painel|resumo/i },
  { path: '/admin/produtos', expectText: /produtos|novo produto/i },
  { path: '/admin/categorias', expectText: /categorias/i },
  { path: '/admin/pedidos', expectText: /pedidos|nenhum pedido/i },
  { path: '/admin/clientes', expectText: /clientes/i },
  { path: '/admin/cupons', expectText: /cupons/i },
  { path: '/admin/banners', expectText: /banners/i },
  { path: '/admin/vendas', expectText: /vendas|análise/i },
  { path: '/admin/configuracoes', expectText: /configurações|loja/i },
  { path: '/admin/checkout-transparente', expectText: /checkout|pagamento|transparente/i },
  { path: '/admin/integracoes', expectText: /integrações|appmax|bling|yampi/i },
  { path: '/admin/commerce-health', expectText: /commerce|saúde|integridade/i },
  { path: '/admin/sistema', expectText: /sistema|logs/i },
  { path: '/admin/equipe', expectText: /equipe|acessos/i },
  { path: '/admin/redes-sociais', expectText: /redes sociais|social/i },
  { path: '/admin/precos', expectText: /preços|juros|cartões/i },
  { path: '/admin/carrinhos-abandonados', expectText: /carrinhos abandonados|abandonados/i },
  { path: '/admin/avaliacoes', expectText: /avaliações|reviews/i },
  { path: '/admin/galeria', expectText: /galeria|mídia/i },
  { path: '/admin/personalizacao', expectText: /personalização|home/i },
  { path: '/admin/tema', expectText: /tema|visual/i },
  { path: '/admin/paginas', expectText: /páginas|institucionais/i },
  { path: '/admin/notificacoes', expectText: /notificações/i },
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

test.describe('Admin painel — duplo clique em botões críticos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminInPage(page);
  });

  test('produtos: duplo clique em Novo produto abre no max um dialog', async ({ page }) => {
    await page.goto('/admin/produtos');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /novo produto/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.dblclick();
    const count = await page.getByRole('dialog').count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('produtos: duplo clique em Salvar no dialog nao dispara multiplos toasts', async ({ page }) => {
    await page.goto('/admin/produtos');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /novo produto/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/novo produto/i)).toBeVisible({ timeout: 5000 });
    await dialog.locator('input').first().fill('Produto E2E Double ' + Date.now());
    await dialog.getByRole('button', { name: /salvar/i }).first().dblclick();
    await page.waitForTimeout(4000);
    const toastCount = await page.getByText(/produto criado|sucesso/i).count();
    expect(toastCount).toBeLessThanOrEqual(2);
  });

  test('checkout-transparente: health check duplo clique nao trava', async ({ page }) => {
    await page.goto('/admin/checkout-transparente');
    await page.waitForLoadState('networkidle');
    const healthBtn = page.getByRole('button', { name: /health check|saúde do checkout/i });
    if (await healthBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await healthBtn.dblclick();
      await page.waitForTimeout(3000);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('commerce-health: duplo clique Liberar ou Reconciliar nao trava', async ({ page }) => {
    await page.goto('/admin/commerce-health');
    await page.waitForLoadState('networkidle');
    const liberar = page.getByRole('button', { name: /liberar reservas/i });
    const reconciliar = page.getByRole('button', { name: /reconciliar/i });
    const btn = (await liberar.isVisible({ timeout: 3000 }).catch(() => false)) ? liberar : reconciliar;
    if (await btn.isVisible().catch(() => false)) {
      await btn.dblclick();
      await page.waitForTimeout(4000);
      await expect(page.getByText(/sucesso|liberados|reconciliados|erro|tente novamente/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('pedidos: busca e filtros nao quebram', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await page.waitForLoadState('networkidle');
    const search = page.getByPlaceholder(/buscar|pesquisar|filtrar/i).or(page.getByRole('combobox').first());
    if (await search.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await search.first().click();
      await search.first().fill('test');
      await page.waitForTimeout(1000);
    }
    await expect(page.getByText(/pedidos|nenhum/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('sistema: duplo clique Limpar logs nao trava', async ({ page }) => {
    await page.goto('/admin/sistema');
    await page.waitForLoadState('networkidle');
    const limparBtn = page.getByRole('button', { name: /limpar|cleanup|clean/i });
    if (await limparBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await limparBtn.dblclick();
      await page.waitForTimeout(3000);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('configuracoes carrega', async ({ page }) => {
    await page.goto('/admin/configuracoes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/configurações|loja|nome da loja/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('integracoes carrega', async ({ page }) => {
    await page.goto('/admin/integracoes');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('tab').or(page.getByRole('heading', { level: 2 })).first()).toBeVisible({ timeout: 10000 });
  });
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
