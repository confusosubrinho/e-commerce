---
status: concluída
removable: false
description: "Mapa de módulos e arquivos da auditoria arquitetural. Manter como referência (não remover)."
---

# Auditoria de Módulos – E-commerce

> **Encerramento:** Auditoria concluída. Débitos técnicos identificados foram resolvidos (tipos Product/StoreSettings, Integrations/SystemAndLogs extrações, RPC commerce_health tipado). **Este arquivo deve ser mantido como referência** — não remover.

## 0. Visão geral

Objetivo: ter um **inventário explícito** de arquivos por módulo/domínio para:

- Auditar aderência às `Regras-Gerais` e `Regras-Projeto`.
- Guiar refatorações e melhorias com as skills configuradas.
- Evitar “pedaços órfãos” de código sem dono de domínio.

---

## 1. Storefront / Loja (páginas e UX do cliente final)

**Páginas (`src/pages`)**

- `src/pages/Index.tsx`
- `src/pages/ProductListingPage.tsx`
- `src/pages/ProductDetail.tsx`
- `src/pages/Cart.tsx`
- `src/pages/SearchPage.tsx`
- `src/pages/FavoritesPage.tsx`
- `src/pages/CategoryPage.tsx`
- `src/pages/BlogPostPage.tsx`
- `src/pages/SizePage.tsx`
- `src/pages/RastreioPage.tsx`
- `src/pages/ComoComprarPage.tsx`
- `src/pages/FormasPagamentoPage.tsx`
- `src/pages/AtendimentoPage.tsx`

**Componentes de Storefront (`src/components/store`)**

- `src/components/store/ProductGrid.tsx`
- `src/components/store/ProductReviews.tsx`
- `src/components/store/BuyTogether.tsx`
- `src/components/store/CartProductSuggestions.tsx`
- `src/components/store/Skeletons.tsx`
- `src/components/store/InstitutionalPage.tsx`
- `src/components/store/FeaturesBar.tsx`
- `src/components/store/AppmaxScriptLoader.tsx`
- `src/components/store/AnnouncementBar.tsx`
- `src/components/store/HelpHint.tsx`
- `src/components/store/FeedbackPreferencesDialog.tsx`
- `src/components/store/ProductImageLightbox.tsx`
- `src/components/store/InstagramFeed.tsx`
- `src/components/store/SocialIcons.tsx`
- `src/components/store/WhatsAppFloat.tsx`
- `src/components/store/ContactForm.tsx`
- `src/components/store/StockNotifyModal.tsx`
- `src/components/store/FadeInOnScroll.tsx`
- `src/components/store/FadeIn.tsx`
- `src/components/store/BannerCarousel.tsx`
- `src/components/store/DynamicSection.tsx`

**Contextos / Providers**

- `src/contexts/CartContext.tsx`
- `src/components/store/ThemeProvider.tsx`

**Hooks relacionados à UX da loja**

- `src/hooks/useHomePageSections.ts`
- `src/hooks/useHomeSections.ts`
- `src/hooks/useStoreContact.ts`
- `src/hooks/useInView.ts`
- `src/hooks/useBrowserNotificationPermission.ts`
- `src/hooks/useDarkMode.ts`
- `src/hooks/useHaptics.ts`
- `src/hooks/use-mobile.tsx`

### Resultado da auditoria – Storefront ✅ Concluído

Critérios: Regras-Gerais, Regras-Projeto, reaproveitamento de UI, estados loading/empty/error/success, uso de libs de domínio (productSort, pricingEngine, couponDiscount).

**Páginas**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **Index.tsx** | OK | Loading (skeleton) e empty (nenhuma seção); StoreLayout + lazy + Suspense; sem lógica de negócio na UI. |
| **ProductListingPage.tsx** | Corrigido | Usa `sortProductList` (`@/lib/productSort`); prioridade “com estoque primeiro”; loading + empty. |
| **ProductDetail.tsx** | OK | `pricingEngine` (getInstallmentOptions, getPixDiscountAmount, getInstallmentDisplay); skeleton + error (refetch); ProductCard/StickyAddToCart reutilizados. |
| **Cart.tsx** | OK | `pricingEngine` + `cartPricing`; empty (carrinho vazio + sugestões); CouponInput; estados claros. |
| **SearchPage.tsx** | Corrigido | Usa `sortProductList`; loading + empty (sem query / zero resultados). |
| **FavoritesPage.tsx** | OK | Loading (skeleton), empty (não logado / nenhum favorito), success (grid); reaproveita ProductCard. |
| **CategoryPage.tsx** | Corrigido | Passou a usar `sortProductList`; loading + error (refetch) + empty; CategoryFilters + ProductGrid reutilizados. |
| **SizePage.tsx** | OK | Já usava `sortProductList` + ProductSortSelect; loading + empty; ProductGrid reutilizado. |
| **BlogPostPage.tsx** | OK | Conteúdo dinâmico; layout/store reutilizados. |
| **RastreioPage, ComoComprarPage, FormasPagamentoPage, AtendimentoPage** | OK | Páginas institucionais; StoreLayout; useStoreContact onde aplicável; sem ordenação/filtros duplicados. |

**Componentes store**

| Componente | Status | Observação |
|------------|--------|------------|
| **ProductGrid** | OK | isLoading (ProductGridSkeleton), empty (null); reaproveita ProductCard. |
| **ProductCard** | OK | Usa `pricingEngine` (getPixPriceForDisplay, getInstallmentDisplay, etc.); UI apenas; VariantSelectorModal reutilizado. |
| **CategoryFilters** | OK | FilterState.sortBy compatível com ProductSortKey; usado em PLP, Search, CategoryPage. |
| **DynamicSection** | OK | isLoading + empty (null); delega para ProductGrid / ProductCarousel. |
| **Skeletons** | OK | ProductGridSkeleton, ProductDetailSkeleton, CartItemSkeleton reutilizados. |
| **CartProductSuggestions** | OK | Usa useCart + useProducts; sugestões por regra (frete grátis / featured); VariantSelectorModal. |
| **CartContext** | OK | Usa `computeCouponDiscount` (`@/lib/couponDiscount`); cartPricing; sem regra de preço duplicada. |
| **BannerCarousel, FeaturesBar, FadeInOnScroll, FadeIn, ThemeProvider** | OK | Presentacionais; reutilizados na Index e layouts. |
| **BuyTogether, ProductReviews, StockNotifyModal, ContactForm, etc.** | OK | Comportamento específico; sem ordenação/filtros próprios fora das libs. |

**Hooks**

| Hook | Status | Observação |
|------|--------|------------|
| **useHomeSections** | OK | Usa `sortProductList` e `homeSectionSortToProductSortKey` para seções da home. |
| **useHomePageSections** | OK | Config de seções da página inicial; usado na Index. |
| **useStoreContact** | OK | Dados de contato; usado em páginas institucionais. |

**Resumo:** Todas as listagens que ordenam produtos (ProductListingPage, SearchPage, CategoryPage) passaram a usar `sortProductList`. SizePage e useHomeSections já utilizavam productSort. Preço/parcelamento centralizados em pricingEngine; cupom em couponDiscount via CartContext/CouponInput.

---

## 2. Admin / Backoffice

**Páginas de Admin (`src/pages/admin`)**

- `src/pages/admin/AdminLayout.tsx`
- `src/pages/admin/Products.tsx`
- `src/pages/admin/Categories.tsx`
- `src/pages/admin/Banners.tsx`
- `src/pages/admin/PagesAdmin.tsx`
- `src/pages/admin/CheckoutSettings.tsx`
- `src/pages/admin/PricingSettings.tsx`
- `src/pages/admin/Notifications.tsx`
- `src/pages/admin/Integrations.tsx`
- `src/pages/admin/Team.tsx`
- `src/pages/admin/Settings.tsx`
- `src/pages/admin/SystemAndLogs.tsx`
- `src/pages/admin/CodeSettings.tsx`
- `src/pages/admin/HelpEditor.tsx`
- `src/pages/admin/Personalization.tsx`
- `src/pages/admin/CommerceHealth.tsx`
- `src/pages/admin/ConversionManual.tsx`
- `src/pages/admin/SocialLinks.tsx`

**Componentes de Admin (`src/components/admin`)**

- `src/components/admin/HomePageBuilder.tsx`
- `src/components/admin/FeaturesBarManager.tsx`
- `src/components/admin/HeaderCustomizer.tsx`
- `src/components/admin/FooterCustomizer.tsx`
- `src/components/admin/BannerImageOptionsDialog.tsx`
- `src/components/admin/GlobalSearch.tsx`
- `src/components/admin/ColorWheelPicker.tsx`

**Hooks de permissão/admin**

- `src/hooks/useAdminRole.ts`
- `src/hooks/useRequireSuperAdmin.ts`

### Resultado da auditoria – Admin ✅ Concluído

Critérios: Regras-Gerais, Regras-Projeto, reaproveitamento de UI e libs de domínio, separação responsabilidades, estados loading/empty/error, permissões/auth.

**Páginas**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **AdminLayout.tsx** | OK | Sidebar + Collapsible + SidebarProvider reutilizados; permissões via `hasPermission`; lazy + Suspense para SetupWizard; auth via `AdminAuthContext`. |
| **Products.tsx** | OK | Usa `sortProductList` + `ProductSortSelect` de `@/lib/productSort`; `formatPrice` de `@/lib/formatters`; Table/Badge/Dialog reutilizados do design system; loading (skeleton) + empty (`AdminEmptyState`) + error (refetch); bulk actions, export CSV, paginação. |
| **Categories.tsx** | OK | CRUD com drag-reorder via `useDragReorder`; upload via Supabase Storage; AlertDialog para confirmação de exclusão; estados loading + empty + error tratados; componentes UI reutilizados. |
| **Banners.tsx** | OK | Drag-reorder; upload via `processBannerImage`; `BannerImageOptionsDialog` + `MediaPickerDialog` reutilizados; AlertDialog para exclusão; loading + empty tratados. |
| **PagesAdmin.tsx** | OK | Thin wrapper que delega para `PagesEditor`; responsabilidade única. |
| **CheckoutSettings.tsx** | OK | Configuração de integrações de checkout; usa `generateRequestId` / `invokeCheckoutFunction` de `@/lib/checkoutClient`; Tabs + Card + Table do design system; loading + estados de health check. |
| **PricingSettings.tsx** | OK | Usa `pricingEngine` (getInstallmentOptions, getGatewayCost, getTransparentCheckoutFee, invalidatePricingCache); preview em tempo real; loading tratado. |
| **Notifications.tsx** | OK | Paginação server-side; bulk actions (marcar lida/excluir); `useBrowserNotificationPermission`; Skeleton de loading; filtros por tipo/status. |
| **Integrations.tsx** | OK | Múltiplas integrações (Appmax, Bling, frete, etc.); componentes UI reutilizados; estados de loading/error/sucesso por seção; progress de sincronização. |
| **Team.tsx** | OK | CRUD de membros admin; `logAudit` para auditoria; `ROLE_LABELS/ROLE_COLORS` de `@/lib/permissions`; AlertDialog para remoção; loading + empty tratados. |
| **Settings.tsx** | OK | Configurações da loja; upload logo/favicon via Supabase Storage; `TwoFactorSetup` reutilizado; Tabs + Card + Switch do design system. |
| **SystemAndLogs.tsx** | OK | Health checks; logs de erro/auditoria/app; exportação CSV via `@/lib/csv`; `APP_VERSION` de `@/lib/appVersion`; `ErrorLogsPanel` reutilizado; Tabs + Table + ScrollArea. |
| **CodeSettings.tsx** | OK | Scripts e pixels (GTM, GA4, Facebook, TikTok); Textarea + Card + Alert; salva na tabela `store_settings`; loading tratado. |
| **CommerceHealth.tsx** | OK | Dashboard de integridade; `logAudit` + `generateCorrelationId`; AbortController para cancelamento; `onSessionExpired` para 401/403; Card + Button do design system. |
| **ConversionManual.tsx** | OK | Página estática de documentação; Card + Tabs + Alert do design system; sem lógica de negócio. |
| **Personalization.tsx** | OK | Builder da home + gerenciador de seções + drag-reorder; lazy para HighlightBannersAdmin; componentes de admin reutilizados (HomeSectionsManager, HomePageBuilder, etc.). |
| **HelpEditor.tsx / SocialLinks.tsx** | OK | Configurações simples; Card + Input + Switch do design system; loading + save tratados. |

**Componentes admin**

| Componente | Status | Observação |
|------------|--------|------------|
| **HomePageBuilder** | OK | Drag-reorder via `useDragReorder`; Sheet + Dialog + Badge reutilizados; ícones por tipo de seção centralizados no `SECTION_META`. |
| **FeaturesBarManager** | OK | CRUD de itens; drag-reorder; Switch + Input reutilizados. |
| **HeaderCustomizer / FooterCustomizer** | OK | Formulários de customização; componentes UI reutilizados. |
| **BannerImageOptionsDialog** | OK | Dialog reutilizável para escolha de imagem (upload ou galeria). |
| **GlobalSearch** | OK | Busca global no admin; usa Command do design system. |
| **ColorWheelPicker** | OK | Componente específico de seleção de cor; encapsulado. |

**Hooks**

| Hook | Status | Observação |
|------|--------|------------|
| **useAdminRole** | OK | Consulta `admin_members` e `user_roles`; retorna role + função `can(permission)` via `hasPermission`; staleTime 5min. |
| **useRequireSuperAdmin** | OK | Redireciona para /admin se não for super_admin/owner; encapsula guard de rota. |

**Observações e débitos técnicos identificados**

| Item | Tipo | Recomendação |
|------|------|--------------|
| Interface `Product` duplicada em `Products.tsx` | Débito técnico | Extrair para `@/types/database` ou `@/types/catalog` |
| `(settings as any)` em Settings.tsx e CodeSettings.tsx | Débito técnico | Adicionar campos `show_variants_on_grid`, `favicon_url`, `head_code`, etc. ao tipo `StoreSettings` |
| `supabase.rpc('commerce_health' as any)` em CommerceHealth.tsx | Débito técnico | Adicionar tipagem do RPC ao schema Supabase ou criar wrapper tipado |
| Integrations.tsx com mais de 2500 linhas | Débito técnico | Dividir em componentes por integração (AppmaxSettings, BlingSettings, ShippingSettings, etc.) |
| SystemAndLogs.tsx com mais de 450 linhas | Débito técnico | Considerar dividir em tabs/componentes independentes por área (HealthPanel, ErrorLogsPanel, AuditPanel) |

**Resumo:** Todas as páginas de admin usam corretamente os componentes UI do design system (sem mini-design-system paralelo). Ordenação de produtos via `sortProductList`. Preço/parcelamento via `pricingEngine`. Permissões via `hasPermission` + `useAdminRole`. Estados de loading/empty/error presentes na maioria. Principais débitos são tipagens fracas (`as any`) e arquivos muito longos que devem ser divididos em etapas futuras.

---

## 3. Catálogo / Produtos / Preços / Estoque

**Bibliotecas de domínio**

- `src/lib/productSort.ts`
- `src/lib/couponDiscount.ts`
- `src/lib/pricingEngine.ts`
- `src/lib/cartPricing.ts`

**Possíveis auxiliares de catálogo**

- `src/lib/formatters.ts`
- `src/lib/csv.ts`

**Hooks de dados de catálogo**

- `src/hooks/useProducts.ts` (useProducts, useSearchProducts, useSearchPreviewProducts, useCategories, useStoreSettings, etc.)
- `src/hooks/usePricingConfig.ts`
- `src/hooks/useHomeSections.ts` (usa productSort)

**Testes relacionados ao catálogo**

- `src/test/pricingEngine.test.ts`
- `src/test/cartPricing.test.ts`
- `src/test/checkout-installment-total.test.ts`
- `src/test/decrement-stock-concurrency.test.ts`
- `src/test/anti-fraud-price.test.ts`
- `src/test/product-detail.test.tsx`

### Resultado da auditoria – Catálogo ✅ Concluído

Critérios: Regras-Gerais, Regras-Projeto, single source of truth para ordenação/preço/cupom/carrinho, sem lógica de negócio duplicada, testes cobrindo libs críticas.

**Libs de domínio**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **productSort.ts** | OK | Única fonte de ordenação: `SortableProduct`, `ProductSortKey`, `sortProductList`, `homeSectionSortToProductSortKey`. Usado em PLP, SearchPage, CategoryPage, SizePage, admin/Products, useHomeSections, ProductSortSelect. |
| **pricingEngine.ts** | OK | Única fonte para preço/parcelamento/PIX/gateway: `getActivePricingConfig`, cache 5min, `getInstallmentOptions`, `getInstallmentDisplay`, `getPixPriceForDisplay`, `getPixDiscountAmount`, `getGatewayCost`, `getTransparentCheckoutFee`, `calculateNetProfit`. Usado em ProductCard, ProductDetail, Cart, Checkout, PricingSettings, ProductFormDialog, VariantSelectorModal, ProductCarousel, usePricingConfig. |
| **couponDiscount.ts** | OK | Regras de cupom: `getApplicableSubtotal`, `hasEligibleItems`, `computeCouponDiscount`, `isCouponValidForLocation`. Usa `getCartItemUnitPrice` de cartPricing. Usado em CartContext (computeCouponDiscount), CouponInput (hasEligibleItems), Checkout (isCouponValidForLocation). |
| **cartPricing.ts** | OK | Única fonte para preço unitário do item no carrinho: `getCartItemUnitPrice`, `getCartItemTotalPrice`, `hasSaleDiscount`. Usado em CartContext, Cart, Checkout, CheckoutStart, Header, couponDiscount. |
| **formatters.ts** | OK | `formatPrice`/`formatCurrency`, labels e cores de status de pedido; importado por pricingEngine e várias páginas. |
| **csv.ts** | OK | `exportToCSV`, `parseCSV`, `readFileAsText`; usado em admin (Products export/import). Utilitário genérico. |

**Hooks**

| Hook | Status | Observação |
|------|--------|------------|
| **useProducts** | OK | Query Supabase com tipos `Product` de `@/types/database`; escape de busca contra injeção; logApiError em erro; staleTime 5min. |
| **useSearchProducts** | OK | Escape de caracteres especiais em `searchTerm`; limit 100; staleTime 2min. |
| **usePricingConfig** | OK | Encapsula `getActivePricingConfig`; queryKey `['pricing-config']`. |
| **useHomeSections** | OK | Usa `sortProductList` + `homeSectionSortToProductSortKey` para ordenar produtos das seções. |

**Testes**

| Teste | Status | Observação |
|-------|--------|------------|
| **pricingEngine.test.ts** | OK | Cobrem getPixPrice, shouldApplyPixDiscount, getPixPriceForDisplay, getPixDiscountAmount, getTransparentCheckoutFee, getGatewayCost, getInstallmentDisplay, calculateInstallments. |
| **cartPricing.test.ts** | OK | Cobrem getCartItemUnitPrice (variant sale/base, product + modifier), getCartItemTotalPrice, hasSaleDiscount. |
| **checkout-installment-total.test.ts** | OK | Garante totais de parcelamento consistentes com pricingEngine. |

**Resumo:** Catálogo está aderente às regras. Ordenação centralizada em productSort; preço/parcelamento/PIX em pricingEngine; cupom em couponDiscount; preço do item no carrinho em cartPricing. Nenhuma lógica duplicada encontrada. Tipos vêm de `@/types/database` (Product, CartItem, Coupon). Débito já registrado: interface Product duplicada em admin/Products.tsx — extrair para tipo compartilhado.

---

## 4. Checkout / Pagamentos (Stripe / Fluxo de compra)

**Páginas**

- `src/pages/Checkout.tsx`
- `src/pages/CheckoutStart.tsx`

**Componentes de checkout**

- `src/components/store/StripePaymentForm.tsx`
- `src/components/store/CouponInput.tsx` (usa `hasEligibleItems` de couponDiscount)
- `src/components/store/ShippingCalculator.tsx`

**Clientes / libs de checkout**

- `src/lib/checkoutClient.ts`

**Tipos**

- `src/types/checkoutStart.ts` (CheckoutStartRequest, CheckoutStartResponse)

**Testes de checkout**

- `src/test/checkout-two-tabs-concurrency.test.ts`
- `src/test/purchase-flow.test.tsx`

### Resultado da auditoria – Checkout / Pagamentos ✅ Concluído

Critérios: Regras-Gerais, Regras-Projeto, uso de libs de domínio (pricingEngine, cartPricing, couponDiscount), request_id/timeout/multi-tenant, idempotência, estados loading/error/success.

**Lib / cliente**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **checkoutClient.ts** | OK | `generateRequestId()`, `invokeCheckoutFunction()`, `invokeCheckoutRouter(route, payload, requestId, timeoutMs, tenantId)`. Timeout 20s; request_id e x-request-id em todas as chamadas; multi-tenant via `tenantId`/`x-tenant-id`; mensagens amigáveis para timeout/CORS/função não deployada; retorno unificado `{ data, error }`. |

**Páginas**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **CheckoutStart.tsx** | OK | Usa `invokeCheckoutRouter("start", payload)` com `requestId`, `tenantId`; payload com `getCartItemUnitPrice(i)` (cartPricing); redirect para gateway ou `/checkout`; `CheckoutStartResponse` tipado; carrinho vazio → redirect `/carrinho`. |
| **Checkout.tsx** | OK | Usa `usePricingConfig`, `getInstallmentOptions(total, pc, hasAnySaleItem)` (pricingEngine); `getCartItemUnitPrice`/`hasSaleDiscount` (cartPricing); `isCouponValidForLocation` (couponDiscount); `generateRequestId`/`invokeCheckoutFunction` (checkoutClient); idempotência via `cartId`; reutiliza ordem existente quando status pending/processing; validação de cartão (Luhn) para fluxo não-Stripe; steps identification → shipping → payment com sessionStorage; Stripe: 3DS via return_url, StripePaymentForm com confirmCardPayment. |

**Componentes**

| Componente | Status | Observação |
|------------|--------|------------|
| **StripePaymentForm** | OK | loadStripe singleton; Elements + CardNumber/Expiry/Cvc; `confirmCardPayment` com return_url; tratamento de retorno 3DS via hash; `useStripeConfig` lê `integrations_checkout_providers` (Stripe); `formatPrice` de formatters; estados loading/error/success. |
| **CouponInput** | OK | Usa `hasEligibleItems(coupon, items)` de `@/lib/couponDiscount` antes de aplicar; busca cupom em `coupons`; valida expiração e elegibilidade; toast + haptics em erro. |

**Testes**

| Teste | Status | Observação |
|-------|--------|------------|
| **checkout-two-tabs-concurrency.test.ts** | OK | Garante que duas inserções paralelas com mesmo `cart_id` resultam em 1 ordem (constraint/idempotência); usa SUPABASE_SERVICE_ROLE_KEY. |
| **purchase-flow.test.tsx** | OK | Mock de supabase e hooks; testa fluxo Cart → CheckoutStart; redirecionamento e estados. |

**Resumo:** Checkout aderente às regras. Chamadas à Edge Function passam por `checkoutClient` com request_id e timeout. Preço do carrinho via cartPricing; parcelamento via pricingEngine; cupom via couponDiscount (validação de local em Checkout, elegibilidade em CouponInput). Idempotência por cart_id; multi-tenant com tenantId. Tipos de início de checkout em `@/types/checkoutStart.ts`.

---

## 5. Auth / Conta / Tenant / Notificações

**Páginas**

- `src/pages/MyAccount.tsx`
- `src/pages/Auth.tsx` (login/signup loja)
- `src/pages/admin/AdminLogin.tsx` (login admin)

**Contexto de auth admin**

- `src/contexts/AdminAuthContext.tsx`

**Lib de tenant**

- `src/lib/tenant.ts`

**Hooks**

- `src/hooks/useTenant.ts`
- `src/hooks/useNotifications.ts`
- `src/hooks/useHelpArticle.ts`
- `src/hooks/useBlog.ts`

### Resultado da auditoria – Auth / Conta / Tenant / Notificações ✅ Concluído

Critérios: Regras-Gerais, Regras-Projeto, Supabase Auth sem vazamento entre usuários, proteção de rotas, estados loading/error/empty, uso de libs (formatters, validators).

**Páginas**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **MyAccount.tsx** | OK | `getSession` + `onAuthStateChange`; redirect para `/auth` com `state.from=/conta` se não houver sessão; queries `profiles` e `orders` por `user_id` (RLS garante isolamento); `formatPrice`, `ORDER_STATUS_LABELS`, `ORDER_STATUS_BADGE_COLORS` de formatters; `lookupCEP`, `formatPhone`, `formatCEP` de validators; loading (skeleton), empty (sem pedidos), error (toast); logout → signOut + navigate `/`. |
| **Auth.tsx** | OK | Login/signup com Zod + react-hook-form; `signInWithPassword` / `signUp`; redirect após login via `onAuthStateChange` ou `getSession`; recuperação de senha em dialog; logo dinâmica via useStoreSettingsPublic; estados loading + erro em toast. |
| **AdminLogin.tsx** | OK | Zod + react-hook-form; lockout após 5 tentativas (15 min); MFA/TOTP quando inscrito; verificação de sessão + `user_roles` para admin; redirect se já logado; loading + lockout countdown + erro. |

**Contexto e lib**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **AdminAuthContext** | OK | Watchdog em `window.fetch`: 401/403 em requests Supabase (exceto `/auth/v1/`) disparam `onSessionExpired`; provider usado no AdminLayout; `useAdminAuthProviderValue` faz clear cache + signOut + navigate `/admin/login`. |
| **tenant.ts** | OK | `DEFAULT_TENANT_ID`, `getTenantIdByDomain`, `getTenantIdBySlug`, `getSlugFromPath`, `resolveTenantIdAsync` (ordem: domínio → path /loja/:slug → default); usado por useTenant; sem lógica de auth, apenas resolução de tenant. |

**Hooks**

| Hook | Status | Observação |
|------|--------|------------|
| **useTenant** | OK | QueryKey inclui hostname e pathname; `resolveTenantIdAsync(supabase)`; staleTime 5min; retorna `tenantId` e `isLoading`; placeholderData DEFAULT_TENANT_ID. |
| **useNotifications** | OK | Lista e contagem de `admin_notifications`; useMarkAsRead/useMarkAllAsRead com invalidateQueries; refetchInterval 30s; tipo AdminNotification exportado. |
| **useHelpArticle** | OK | Query por `key` em `help_articles`; useHelpArticles lista todos; staleTime 10min/5min; enabled por key. |
| **useBlog** | OK | useBlogSettings, useBlogPosts(onlyPublished), useBlogPost(slug); tipos BlogPost e BlogSettings; staleTime 2–5min. |

**Resumo:** Auth da loja (Auth.tsx) e da conta (MyAccount) usam Supabase Auth; dados por `user_id` compatíveis com RLS. Admin: AdminLogin com lockout e MFA; AdminAuthContext trata 401/403 globalmente. Tenant: resolução centralizada em `lib/tenant.ts` e consumida por useTenant (checkout e admin passam tenantId onde necessário). Notificações e help/blog são hooks de dados sem regra de negócio sensível.

---

## 6. Infra / Integrações / Observabilidade

**Supabase / Lovable**

- `src/integrations/supabase/client.ts`
- `src/integrations/lovable/index.ts`

**Utilitários de infra / tracking / logging**

- `src/lib/appLogger.ts`
- `src/lib/utmTracker.ts`
- `src/lib/attribution.ts`
- `src/lib/feedback.ts`
- `src/lib/browserNotifications.ts`
- `src/lib/imageCompressor.ts`
- `src/lib/imageUrl.ts`
- `src/lib/appVersion.ts`
- `src/lib/sanitizeHtml.ts`
- `src/lib/errorLogger.ts` (logError, logApiError, logAuthError, initGlobalErrorHandlers)

### Resultado da auditoria – Infra / Integrações / Observabilidade ✅ Concluído

Critérios: Regras-Gerais, Regras-Projeto, variáveis de ambiente não hardcoded em produção, logging estruturado/centralizado, segurança (sanitizeHtml, imageUrl), uso consistente dos utilitários.

**Integrações**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **supabase/client.ts** | OK | URL e key de `import.meta.env.VITE_SUPABASE_*`; fallback para placeholder quando não configurado (evita tela branca); tipagem com `Database`; auth com persistSession e autoRefreshToken. |
| **lovable/index.ts** | OK | Auto-gerado Lovable; `createLovableAuth` para OAuth (Google/Apple); setSession no Supabase após sucesso; sem secrets no código. |

**Logging e erros**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **appLogger.ts** | OK | PREFIX `[App]`; info só em DEV; warn/error sempre; permite trocar por serviço externo depois. |
| **errorLogger.ts** | OK | `logError` com tipo, severity, context; rate limit por chave (5s); persiste em `error_logs` (fire-and-forget); usa appLogger; `logApiError`/`logAuthError` para useProducts/sessionRecovery; `initGlobalErrorHandlers` em main.tsx. |

**Tracking e atribuição**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **utmTracker.ts** | OK | `getSessionId`, `captureUTMData`, `getStoredUTM`; `trackSession` grava em `traffic_sessions` (não tracka admin por user_roles); `saveAbandonedCart` em `abandoned_carts`; sessionStorage para sessão e UTM. |
| **attribution.ts** | OK | `captureAttribution`/`getAttribution` para checkout (TTL 7 dias em localStorage); usado em CheckoutStart para payload do router. |

**UX e mídia**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **feedback.ts** | OK | Haptics (Vibration API); respeita `prefers-reduced-motion` e `prefers-reduced-transparency`; padrões light/selection/success/error; SSR-safe. |
| **browserNotifications.ts** | OK | Notification API; permission request; show com tag/body/link; usado no admin. |
| **imageCompressor.ts** | OK | `getImageDimensions`, `processBannerImage`, compressão WebP; usado em admin (banners, categorias). |
| **imageUrl.ts** | OK | `resolveImageUrl`, strip de assinaturas expiradas; suporte Tray CDN com wsrv.nl para redimensionar; placeholder; usado em ProductCard e páginas. |
| **sanitizeHtml.ts** | OK | DOMPurify com ALLOWED_TAGS/ALLOWED_ATTR restritos; evita XSS em conteúdo editável (descrição produto, páginas institucionais). |

**Outros**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **appVersion.ts** | OK | `VITE_APP_VERSION` ou timestamp; usado em SystemAndLogs e deploy. |

**Resumo:** Infra aderente às regras. Supabase client com env vars; Lovable OAuth encapsulado. Logging centralizado (appLogger + errorLogger com persistência e rate limit). UTM e attribution separados (utmTracker para sessão/abandoned cart, attribution para checkout). Imagens com resolver seguro e compressão; HTML sanitizado para conteúdo editável. Nenhum secret em código; variáveis via `import.meta.env`.

---

## 7. Design System / UI Base

**Componentes genéricos de UI (`src/components/ui`)**

- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/accordion.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/use-toast.ts`
- `src/components/ui/toaster.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/toggle-group.tsx`
- E ainda: `alert.tsx`, `alert-dialog.tsx`, `aspect-ratio.tsx`, `calendar.tsx`, `carousel.tsx`, `dropdown-menu.tsx`, `hover-card.tsx`, `input-otp.tsx`, `label.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `sheet.tsx`, `sonner.tsx`, `toast.tsx`, `toggle.tsx`, `Pressable.tsx`, `ProductSortSelect.tsx` (híbrido domínio/UI).

**Estilos globais**

- `src/index.css`

### Resultado da auditoria – Design System / UI Base ✅ Concluído

Critérios: Regras-Gerais, Regras-Projeto, Tailwind + shadcn/Radix, tokens centralizados, reaproveitamento (sem mini-design-system paralelo nas páginas), acessibilidade (focus-visible, disabled).

**Padrão dos componentes**

| Aspecto | Status | Observação |
|---------|--------|------------|
| **Stack** | OK | Radix UI primitives + Tailwind CSS + `cn()` de `@/lib/utils`; class-variance-authority (cva) onde há variantes (ex.: Button). |
| **Tokens** | OK | CSS variables em `index.css`: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`; tema light/dark; sidebar e tokens custom (`--header-height`, `--promo-bar-height`). |
| **Consistência** | OK | Componentes usam `forwardRef`, `displayName`; estilos via classes Tailwind que referenciam os tokens (bg-primary, text-muted-foreground, ring-ring, border-input, etc.). |
| **Acessibilidade** | OK | focus-visible:ring-2, disabled:pointer-events-none, disabled:opacity-50; componentes Radix trazem acessibilidade (ARIA, teclado). |

**index.css**

| Aspecto | Status | Observação |
|---------|--------|------------|
| **Base** | OK | @layer base: :root e .dark com paleta completa; body com bg-background, text-foreground, font-base; headings com font-heading; * com border-border. |
| **Components** | OK | @layer components: container-custom, btn-primary/btn-secondary, card-product, badge-new/badge-sale, input-search, nav-link, price-original/price-sale/price-current, btn-press, pressable (com fallback reduced-motion), card-lift. |
| **Identidade** | OK | Primary #33cc99 (turquoise/mint); dark #1a1a1a; comentário no topo documenta o design system. |

**Componente de domínio em /ui**

| Arquivo | Status | Observação |
|---------|--------|------------|
| **ProductSortSelect** | OK | Select que consome `PRODUCT_SORT_OPTIONS_STORE` e `ProductSortKey` de `@/lib/productSort`; único componente “de domínio” em ui; poderia ser movido para `components/store` em refatoração futura. |

**Resumo:** Design system único em `src/components/ui` com ~50 componentes; todos seguem o padrão shadcn/Radix + Tailwind + tokens de `index.css`. Nenhum componente de página redefine cores ou tipografia de forma paralela; store e admin importam de `@/components/ui`. Regra de reaproveitamento (Regras-Projeto) é atendida pelo uso consistente desses componentes. Estilos utilitários (container-custom, pressable, card-lift) ficam em @layer components, evitando duplicação.

---

## 8. Testes Gerais e Utilitários

**Testes diversos**

- `src/test/formatters.test.ts`
- `src/test/colorUtils.test.ts`
- `src/test/validators.test.ts`
- `src/test/simple-bench.js`

---

## 9. Encerramento e referência

**Status:** Auditoria concluída. Débitos técnicos resolvidos:

- Interface `Product` unificada em `@/types/database`; uso em `Products.tsx`.
- Tipo `StoreSettings` estendido; removidos `(settings as any)` em Settings, CodeSettings e Integrations.
- `Integrations.tsx`: tipos em `@/components/admin/integrations/types`, painel Stripe em `StripeGatewayPanel.tsx`.
- `SystemAndLogs.tsx`: painel Saúde em `@/components/admin/HealthPanel`; `store_settings` tipado.
- RPC `commerce_health` / `commerce_health_lists`: wrapper tipado em `@/lib/commerceHealth.ts`; uso em CommerceHealth.tsx.

**Checklist de encerramento:** Testes executados; `docs/checklist-frontend-prs.md` mantido para PRs de frontend. Este documento permanece como **referência** do mapeamento e resultados da auditoria.

---

## 10. Próximos passos (histórico)

Ordem da auditoria (já executada):

1. **Storefront** (`#1`) — páginas e componentes da loja (Index, PLP, PDP, Cart, Search, etc.)
2. **Admin** (`#2`) — backoffice (Products, Categories, Banners, Settings, etc.)
3. **Catálogo** (`#3`) — produtos, preços, estoque (libs + uso nas telas)
4. **Checkout/Pagamentos** (`#4`) — Stripe, fluxo de compra, cupom
5. **Auth/Tenant** (`#5`) — conta, multi-tenant, notificações
6. **Infra/Integrações** (`#6`) — Supabase, logging, tracking
7. **Design System** (`#7`) — componentes UI base, estilos

Para cada módulo:

- Verificar aderência às `Regras-Gerais.mdc` e `Regras-Projeto.mdc`.
- Usar as skills relevantes (ex.: catálogo, multi-tenant, checkout-stripe, upload-midia, etc.).
- Abrir TODOs específicos (refatorações, testes, melhorias de segurança/observabilidade).

