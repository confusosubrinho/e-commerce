import { lazy, Suspense, useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/store/ErrorBoundary";
import { ScrollToTop } from "@/components/store/ScrollToTop";
import { VersionChecker } from "@/components/store/VersionChecker";
import { ThemeProvider } from "@/components/store/ThemeProvider";
import { useShopifyCartSync } from "@/hooks/useShopifyCartSync";
import { APP_VERSION } from "@/lib/appVersion";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Retry wrapper for lazy imports that may fail due to stale cache
function lazyRetry<T extends { default: React.ComponentType }>(
  factory: () => Promise<T>,
): Promise<T> {
  return factory().catch((err) => {
    const key = `lazy-retry-reloaded-${APP_VERSION}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    }
    throw err;
  });
}

// Lazy load non-critical pages — all wrapped with lazyRetry
const ProductDetail = lazy(() => lazyRetry(() => import("./pages/ProductDetail")));
const CategoryPage = lazy(() => lazyRetry(() => import("./pages/CategoryPage")));
const SizePage = lazy(() => lazyRetry(() => import("./pages/SizePage")));
const Auth = lazy(() => lazyRetry(() => import("./pages/Auth")));
const Cart = lazy(() => lazyRetry(() => import("./pages/Cart")));
const Checkout = lazy(() => lazyRetry(() => import("./pages/Checkout")));
const MyAccount = lazy(() => lazyRetry(() => import("./pages/MyAccount")));
const RastreioPage = lazy(() => lazyRetry(() => import("./pages/RastreioPage")));
const FavoritesPage = lazy(() => lazyRetry(() => import("./pages/FavoritesPage")));
const SearchPage = lazy(() => lazyRetry(() => import("./pages/SearchPage")));

// Consolidated pages
const InstitutionalPageRoute = lazy(() => lazyRetry(() => import("./pages/InstitutionalPageRoute")));
const ProductListingPage = lazy(() => lazyRetry(() => import("./pages/ProductListingPage")));

// Standalone institutional pages
const ComoComprarPage = lazy(() => lazyRetry(() => import("./pages/ComoComprarPage")));
const FormasPagamentoPage = lazy(() => lazyRetry(() => import("./pages/FormasPagamentoPage")));
const AtendimentoPage = lazy(() => lazyRetry(() => import("./pages/AtendimentoPage")));

// Admin routes
const AdminLayout = lazy(() => lazyRetry(() => import("./pages/admin/AdminLayout")));
const AdminLogin = lazy(() => lazyRetry(() => import("./pages/admin/AdminLogin")));
const Dashboard = lazy(() => lazyRetry(() => import("./pages/admin/Dashboard")));
const Banners = lazy(() => lazyRetry(() => import("./pages/admin/Banners")));
const Personalization = lazy(() => lazyRetry(() => import("./pages/admin/Personalization")));
const HighlightBanners = lazy(() => lazyRetry(() => import("./pages/admin/HighlightBanners")));
const Settings = lazy(() => lazyRetry(() => import("./pages/admin/Settings")));
const CodeSettings = lazy(() => lazyRetry(() => import("./pages/admin/CodeSettings")));
const Integrations = lazy(() => lazyRetry(() => import("./pages/admin/Integrations")));
const MediaGallery = lazy(() => lazyRetry(() => import("./pages/admin/MediaGallery")));
const PricingSettings = lazy(() => lazyRetry(() => import("./pages/admin/PricingSettings")));
const HelpEditor = lazy(() => lazyRetry(() => import("./pages/admin/HelpEditor")));
const SocialLinks = lazy(() => lazyRetry(() => import("./pages/admin/SocialLinks")));
const PagesAdmin = lazy(() => lazyRetry(() => import("./pages/admin/PagesAdmin")));
const ThemeEditor = lazy(() => lazyRetry(() => import("./pages/admin/ThemeEditor")));
const Notifications = lazy(() => lazyRetry(() => import("./pages/admin/Notifications")));
const Team = lazy(() => lazyRetry(() => import("./pages/admin/Team")));
const SuperAdmin = lazy(() => lazyRetry(() => import("./pages/admin/SuperAdmin")));
const BlogAdmin = lazy(() => lazyRetry(() => import("./pages/admin/BlogAdmin")));
const CheckoutStart = lazy(() => lazyRetry(() => import("./pages/CheckoutStart")));
const BlogPage = lazy(() => lazyRetry(() => import("./pages/BlogPage")));
const BlogPostPage = lazy(() => lazyRetry(() => import("./pages/BlogPostPage")));
const CheckoutReturn = lazy(() => lazyRetry(() => import("./pages/CheckoutReturn")));

// Lazy load non-critical floating components
const WhatsAppFloat = lazy(() => lazyRetry(() => import("./components/store/WhatsAppFloat").then(m => ({ default: m.WhatsAppFloat }))));
const CookieConsent = lazy(() => lazyRetry(() => import("./components/store/CookieConsent").then(m => ({ default: m.CookieConsent }))));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('JWT expired')) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    },
  },
});

// Versioned persist key — automatically invalidates on new deploys
const PERSIST_CACHE_KEY = `VANESSA_LIMA_QUERY_CACHE_v${APP_VERSION}`;
const STORE_SETTINGS_PUBLIC_KEY = 'store-settings-public';

/** Clean up old persist cache keys from previous versions */
function cleanupOldPersistKeys() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('VANESSA_LIMA_QUERY_CACHE') && key !== PERSIST_CACHE_KEY) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch { /* localStorage unavailable */ }
}

/** Deserialize do cache: remove store-settings-public para não sobrescrever com dados antigos após reidratação. */
function deserializePersistedClient(cacheString: string) {
  const data = JSON.parse(cacheString);
  if (data?.clientState?.queries) {
    data.clientState.queries = data.clientState.queries.filter(
      (q: { queryKey: unknown[] }) => q.queryKey?.[0] !== STORE_SETTINGS_PUBLIC_KEY
    );
  }
  return data;
}

const persister =
  typeof window !== 'undefined'
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: PERSIST_CACHE_KEY,
        throttleTime: 1000,
        deserialize: deserializePersistedClient,
      })
    : undefined;

// Minimal page loading fallback — a11y: role status + aria-live para leitores de tela
function PageFallback() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-20 animate-fade-in-soft"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">Carregando...</span>
    </div>
  );
}

function AppQueryProvider({ children }: { children: React.ReactNode }) {
  if (!persister) return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.queryKey[0] !== 'store-settings-public',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

const App = () => {
  useShopifyCartSync();
  useEffect(() => {
    captureAttribution();
    // Clean up persist cache from old versions & stale retry flags
    cleanupOldPersistKeys();
    // Clean old retry flags (non-versioned legacy)
    try { sessionStorage.removeItem('lazy-retry-reloaded'); } catch { /* Storage indisponível. */ }
  }, []);

  return (
  <AppQueryProvider>
      <TooltipProvider>
        <ThemeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
            <WhatsAppFloat />
            <CookieConsent />
          </Suspense>
          <ScrollToTop />
          <VersionChecker />
          <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/produto/:handle" element={<ProductDetail />} />
              <Route path="/product/:handle" element={<ProductDetail />} />
              <Route path="/categoria/:slug" element={<CategoryPage />} />
              <Route path="/conta" element={<MyAccount />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/carrinho" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/start" element={<CheckoutStart />} />
              <Route path="/checkout/obrigado" element={<CheckoutReturn />} />
              <Route path="/tamanho/:size" element={<SizePage />} />

              {/* Consolidated institutional pages (CMS-driven) */}
              <Route path="/faq" element={<InstitutionalPageRoute />} />
              <Route path="/sobre" element={<InstitutionalPageRoute />} />
              <Route path="/politica-privacidade" element={<InstitutionalPageRoute />} />
              <Route path="/termos" element={<InstitutionalPageRoute />} />
              <Route path="/trocas" element={<InstitutionalPageRoute />} />

              {/* Standalone institutional pages (custom content) */}
              <Route path="/como-comprar" element={<ComoComprarPage />} />
              <Route path="/formas-pagamento" element={<FormasPagamentoPage />} />
              <Route path="/atendimento" element={<AtendimentoPage />} />

              {/* Consolidated product listing pages */}
              <Route path="/mais-vendidos" element={<ProductListingPage />} />
              <Route path="/promocoes" element={<ProductListingPage />} />
              <Route path="/novidades" element={<ProductListingPage />} />

              {/* Blog */}
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />

              <Route path="/rastreio" element={<RastreioPage />} />
              <Route path="/pedido-confirmado/:orderId" element={<Navigate to="/rastreio" replace />} />
              <Route path="/pedido-confirmado" element={<Navigate to="/rastreio" replace />} />
              <Route path="/favoritos" element={<FavoritesPage />} />
              <Route path="/busca" element={<SearchPage />} />
              
              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="banners" element={<Banners />} />
                <Route path="personalizacao" element={<Personalization />} />
                <Route path="banners-destaque" element={<HighlightBanners />} />
                <Route path="integracoes" element={<Integrations />} />
                <Route path="configuracoes" element={<Settings />} />
                <Route path="configuracoes/codigo" element={<CodeSettings />} />
                <Route path="galeria" element={<MediaGallery />} />
                <Route path="precos" element={<PricingSettings />} />
                <Route path="ajuda" element={<HelpEditor />} />
                <Route path="redes-sociais" element={<SocialLinks />} />
                <Route path="paginas" element={<PagesAdmin />} />
                <Route path="tema" element={<ThemeEditor />} />
                <Route path="notificacoes" element={<Notifications />} />
                <Route path="equipe" element={<Team />} />
                <Route path="super" element={<SuperAdmin />} />
                <Route path="blog" element={<BlogAdmin />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
  </AppQueryProvider>
  );
};

export default App;
