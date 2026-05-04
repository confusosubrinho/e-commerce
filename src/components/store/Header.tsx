import { useState, useEffect, useRef, useCallback } from 'react';
import { formatPrice } from '@/lib/formatters';
import { Link, useNavigate } from 'react-router-dom';
import { User, ShoppingBag, Menu, MessageCircle, ChevronDown, Trash2, Plus, Minus, HelpCircle, Percent, Truck, Heart, Star, Sparkles, Gift, Tag, Flame, Zap, Crown, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

import { useCategories, useProducts } from '@/hooks/useProducts';
import { ShopifyCartDrawer } from '@/components/shopify/ShopifyCartDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStoreSettingsPublic } from '@/hooks/useStoreContact';
import defaultLogo from '@/assets/logo.png';
import { ShippingCalculator } from './ShippingCalculator';
import { CouponInput } from './CouponInput';
import { SearchPreview } from './SearchPreview';
import { CartProductSuggestions } from './CartProductSuggestions';
import { prefetchCategoryPage, prefetchSearchPage, prefetchCartPage, prefetchCheckoutStartPage } from '@/lib/prefetch';
import { FeedbackPreferencesDialog } from './FeedbackPreferencesDialog';
import { resolveImageUrl } from '@/lib/imageUrl';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Percent, Star, Sparkles, Heart, Gift, Tag, Flame, Zap, Crown, ShoppingBag,
};

const DROPDOWN_CLOSE_DELAY = 200; // ms

const CHECKOUT_START_HREF = '/checkout/start';

function useDropdown() {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), DROPDOWN_CLOSE_DELAY);
  }, []);

  const close = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return { open, handleEnter, handleLeave, close };
}

export function Header() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const megaMenuRef = useRef<HTMLDivElement>(null);

  // Dropdown controllers with delay
  const atendimentoDD = useDropdown();
  const allCategoriesDD = useDropdown();
  const [activeCatSlug, setActiveCatSlug] = useState<string | null>(null);
  const catTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCatEnter = useCallback((slug: string) => {
    if (catTimeoutRef.current) clearTimeout(catTimeoutRef.current);
    setActiveCatSlug(slug);
  }, []);

  const handleCatLeave = useCallback(() => {
    catTimeoutRef.current = setTimeout(() => setActiveCatSlug(null), DROPDOWN_CLOSE_DELAY);
  }, []);

  useEffect(() => {
    return () => { if (catTimeoutRef.current) clearTimeout(catTimeoutRef.current); };
  }, []);

  // Fetch header settings from public view (cache compartilhado com footer etc.)
  const { data: headerSettings } = useStoreSettingsPublic();

  // Logo do painel (header_logo_url ou logo_url); fallback para asset local. Cache-bust com updated_at para não mostrar logo antigo no navegador.
  const logoFromSettings = headerSettings?.header_logo_url || headerSettings?.logo_url;
  const logo =
    logoFromSettings && logoFromSettings.trim() !== ''
      ? `${logoFromSettings}${headerSettings?.updated_at ? `?v=${encodeURIComponent(headerSettings.updated_at)}` : ''}`
      : defaultLogo;
  const subheadText = headerSettings?.header_subhead_text || 'Frete grátis para compras acima de R$ 399*';
  const highlightText = headerSettings?.header_highlight_text || 'Bijuterias';
  const highlightUrl = headerSettings?.header_highlight_url || '/bijuterias';
  const highlightIconName = headerSettings?.header_highlight_icon || 'Percent';
  const HighlightIcon = ICON_MAP[highlightIconName] || Percent;
  const menuOrder: string[] = (headerSettings?.header_menu_order as string[]) || [];

  // Fetch products for each category for mega menu
  const { data: allProducts } = useProducts();

  const handleSearch = (query: string) => {
    navigate(`/busca?q=${encodeURIComponent(query)}`);
  };

  // formatPrice imported at module level from @/lib/formatters

  // Close mega menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target as Node)) {
        setActiveCatSlug(null);
        allCategoriesDD.close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [allCategoriesDD]);

  // Order categories by header_menu_order if set
  const orderedCategories = (() => {
    const cats = categories || [];
    if (!menuOrder || menuOrder.length === 0) return cats;
    const ordered = menuOrder.map(id => cats.find(c => c.id === id)).filter(Boolean) as typeof cats;
    const remaining = cats.filter(c => !menuOrder.includes(c.id));
    return [...ordered, ...remaining];
  })();
  const mainCategories = orderedCategories.slice(0, 7);

  // Get products for a category
  const getProductsForCategory = (categoryId: string) => {
    return allProducts?.filter(p => p.category_id === categoryId)?.slice(0, 4) || [];
  };




  return (
    <header className="sticky top-0 z-50 bg-background shadow-sm">
      {/* Top bar - Promo */}
      <div className="bg-primary text-primary-foreground text-xs sm:text-sm py-1.5 sm:py-2">
        <div className="container-custom flex items-center justify-center">
          <span className="font-medium text-center">{subheadText}</span>
        </div>
      </div>

      {/* Main header - 3-zone layout */}
      <div className="container-custom py-2 sm:py-3">
        <div className="flex items-center gap-3">
          {/* LEFT ZONE: Hamburger (mobile) + Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile hamburger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden flex-shrink-0"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0 flex flex-col">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <img key={logo} src={logo} alt="Vanessa Lima Shoes" className="h-8 w-auto object-contain" decoding="async" />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-2">
                  <div className="space-y-0.5 px-2">
                    {mainCategories.map((category) => (
                      <Link
                        key={category.id}
                        to={`/categoria/${category.slug}`}
                        className="flex items-center gap-3 py-3 px-3 hover:bg-muted rounded-lg transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {category.image_url && (
                          <img src={resolveImageUrl(category.image_url, { width: 96 })} alt={category.name} className="w-8 h-8 rounded-full object-cover" />
                        )}
                        <span className="font-medium text-sm">{category.name}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="px-2 mt-2">
                    <Link
                      to={highlightUrl}
                      className="flex items-center gap-3 py-3 px-4 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <HighlightIcon className="h-4 w-4" />
                      {highlightText}
                    </Link>
                  </div>
                  <div className="border-t mt-4 pt-3 px-2 space-y-0.5">
                    <Link to="/favoritos" className="flex items-center gap-3 py-3 px-3 hover:bg-muted rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Favoritos</span>
                    </Link>
                    <Link to="/conta" className="flex items-center gap-3 py-3 px-3 hover:bg-muted rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Minha Conta</span>
                    </Link>
                    <Link to="/atendimento" className="flex items-center gap-3 py-3 px-3 hover:bg-muted rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Atendimento</span>
                    </Link>
                    <Link to="/rastreio" className="flex items-center gap-3 py-3 px-3 hover:bg-muted rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Rastrear Pedido</span>
                    </Link>
                    <Link to="/faq" className="flex items-center gap-3 py-3 px-3 hover:bg-muted rounded-lg transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Perguntas Frequentes</span>
                    </Link>
                    <FeedbackPreferencesDialog
                      trigger={
                        <button
                          type="button"
                          className="flex items-center gap-3 py-3 px-3 hover:bg-muted rounded-lg transition-colors w-full text-left text-sm"
                        >
                          <Settings2 className="h-4 w-4 text-muted-foreground" />
                          Preferências
                        </button>
                      }
                    />
                  </div>
                </div>
                <div className="border-t p-4">
                  {headerSettings?.contact_whatsapp && (
                    <a
                      href={`https://wa.me/${(headerSettings.contact_whatsapp as string).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-full font-medium text-sm"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Fale pelo WhatsApp
                    </a>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link to="/" className="flex-shrink-0">
              <img key={logo} src={logo} alt="Vanessa Lima Shoes" className="h-10 md:h-12 w-auto object-contain" decoding="async" />
            </Link>
          </div>

          {/* CENTER ZONE: Search (desktop) */}
          <div className="hidden md:flex flex-1 justify-center max-w-xl mx-auto">
            <SearchPreview onSearch={handleSearch} onFocus={prefetchSearchPage} className="w-full" />
          </div>

          {/* RIGHT ZONE: Icons */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0 ml-auto">
            <Link to="/favoritos" className="hidden md:flex items-center justify-center w-10 h-10 hover:text-primary transition-colors rounded-full hover:bg-muted" title="Favoritos">
              <Heart className="h-5 w-5" />
            </Link>

            {/* Atendimento dropdown with delay */}
            <div
              className="hidden md:flex relative"
              onMouseEnter={atendimentoDD.handleEnter}
              onMouseLeave={atendimentoDD.handleLeave}
            >
              <Link
                to="/atendimento"
                className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
              >
                <HelpCircle className="h-5 w-5" />
                <span className="font-medium hidden lg:inline">Ajuda</span>
                <ChevronDown className="h-3 w-3" />
              </Link>
              {atendimentoDD.open && (
                <div
                  className="absolute top-full right-0 pt-1 z-50"
                  onMouseEnter={atendimentoDD.handleEnter}
                  onMouseLeave={atendimentoDD.handleLeave}
                >
                  <div className="bg-background border rounded-lg shadow-xl py-2 w-52 animate-fade-in">
                    <Link to="/rastreio" className="block px-4 py-2.5 text-sm hover:bg-muted transition-colors" onClick={atendimentoDD.close}>
                      📦 Rastrear Pedido
                    </Link>
                    <Link to="/atendimento" className="block px-4 py-2.5 text-sm hover:bg-muted transition-colors" onClick={atendimentoDD.close}>
                      💬 Fale Conosco
                    </Link>
                    <Link to="/faq" className="block px-4 py-2.5 text-sm hover:bg-muted transition-colors" onClick={atendimentoDD.close}>
                      ❓ Perguntas Frequentes
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link to="/conta" className="hidden md:flex items-center gap-1.5 text-sm hover:text-primary transition-colors px-2 py-1.5 rounded-md hover:bg-muted" title="Minha Conta">
              <User className="h-5 w-5" />
              <span className="font-medium hidden lg:inline">Conta</span>
            </Link>

            {/* Mobile icons */}
            <Link to="/conta" className="md:hidden flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px]">
              <User className="h-5 w-5" />
            </Link>

            {/* Cart - Shopify */}
            <ShopifyCartDrawer />
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden mt-2">
          <SearchPreview onSearch={handleSearch} />
        </div>
      </div>

      {/* Navigation with Mega Menu */}
      <nav className="border-t bg-background relative" ref={megaMenuRef}>
        <div className="container-custom">
          <div className="hidden md:flex items-center w-full">
            {/* All Categories - with delay */}
            <div
              className="relative flex-shrink-0"
              onMouseEnter={() => { allCategoriesDD.handleEnter(); prefetchCategoryPage(); }}
              onMouseLeave={allCategoriesDD.handleLeave}
            >
              <button className="nav-link flex items-center gap-2 py-4 px-4 hover:bg-muted transition-colors">
                <Menu className="h-4 w-4" />
                Todas Categorias
                <ChevronDown className="h-3 w-3" />
              </button>
              
              {allCategoriesDD.open && (
                <div
                  className="absolute top-full left-0 pt-1 z-50"
                  onMouseEnter={allCategoriesDD.handleEnter}
                  onMouseLeave={allCategoriesDD.handleLeave}
                >
                  <div
                    className="bg-background border rounded-lg shadow-xl p-6 grid grid-cols-3 sm:grid-cols-4 gap-4 animate-fade-in"
                    style={{ width: 'min(900px, 90vw)', maxHeight: '70vh', overflowY: 'auto' }}
                    ref={(el) => {
                      if (el) {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > window.innerWidth - 16) {
                          el.style.left = 'auto';
                          el.style.right = '0';
                        }
                      }
                    }}
                  >
                    {categories?.map((category) => (
                      <Link
                        key={category.id}
                        to={`/categoria/${category.slug}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
                        onClick={allCategoriesDD.close}
                      >
                        {category.image_url && (
                          <img src={resolveImageUrl(category.image_url, { width: 96 })} alt={category.name} className="w-10 h-10 rounded-md object-cover" />
                        )}
                        <span className="font-medium group-hover:text-primary transition-colors">{category.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Individual category links - centered */}
            <div className="flex-1 flex items-center justify-center">
              {mainCategories.map((category) => {
                const categoryProducts = getProductsForCategory(category.id);
                
                return (
                  <div
                    key={category.id}
                    className="relative flex-shrink-0"
                    onMouseEnter={() => handleCatEnter(category.slug)}
                    onMouseLeave={handleCatLeave}
                  >
                    <Link
                      to={`/categoria/${category.slug}`}
                      className="nav-link flex items-center gap-1 py-4 px-3 hover:bg-muted transition-colors whitespace-nowrap"
                      onMouseEnter={prefetchCategoryPage}
                    >
                      {category.name}
                    </Link>
                    
                    {activeCatSlug === category.slug && (
                      <div
                        className="absolute top-full pt-1 z-50"
                        style={{
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }}
                        onMouseEnter={() => handleCatEnter(category.slug)}
                        onMouseLeave={handleCatLeave}
                      >
                        <div
                          className="bg-background border rounded-lg shadow-xl p-6 animate-fade-in w-[min(800px,80vw)]"
                          style={{ maxWidth: 'calc(100vw - 2rem)' }}
                          ref={(el) => {
                            if (el) {
                              const rect = el.getBoundingClientRect();
                              if (rect.right > window.innerWidth - 16) {
                                el.style.left = 'auto';
                                el.style.right = '0';
                                el.style.transform = 'none';
                              }
                              if (rect.left < 16) {
                                el.style.left = '0';
                                el.style.transform = 'none';
                              }
                            }
                          }}
                        >
                          <div className="flex gap-6">
                            <div className="w-1/3">
                              <h3 className="font-bold text-lg mb-3">{category.name}</h3>
                              {(() => {
                                const childCategories = (categories || []).filter(
                                  (c: any) => c.parent_category_id === category.id
                                ).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
                                if (childCategories.length > 0) {
                                  return (
                                    <>
                                      <ul className="space-y-1.5 mb-4">
                                        {childCategories.map((child: { id: string; name: string; slug: string; image_url?: string | null }) => (
                                          <li key={child.id}>
                                            <Link
                                              to={`/categoria/${child.slug}`}
                                              className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted text-sm font-medium text-foreground hover:text-primary transition-colors"
                                              onClick={() => setActiveCatSlug(null)}
                                            >
                                              {child.image_url && (
                                                <img src={resolveImageUrl(child.image_url, { width: 64 })} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                                              )}
                                              {child.name}
                                            </Link>
                                          </li>
                                        ))}
                                      </ul>
                                      <Link
                                        to={`/categoria/${category.slug}`}
                                        className="inline-flex items-center text-primary font-medium hover:underline text-sm"
                                        onClick={() => setActiveCatSlug(null)}
                                      >
                                        Ver todos os produtos →
                                      </Link>
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                                    <Link
                                      to={`/categoria/${category.slug}`}
                                      className="inline-flex items-center text-primary font-medium hover:underline"
                                      onClick={() => { setActiveCatSlug(null); }}
                                    >
                                      Ver todos os produtos →
                                    </Link>
                                  </>
                                );
                              })()}
                            </div>
                            
                            {/* Products grid in mega menu */}
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              {categoryProducts.length > 0 ? (
                                categoryProducts.map((product) => {
                                  const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0];
                                  return (
                                    <Link
                                      key={product.id}
                                      to={`/produto/${product.slug}`}
                                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                                      onClick={() => setActiveCatSlug(null)}
                                    >
                                      <img
                                        src={resolveImageUrl(primaryImage?.url, { width: 96 }) || '/placeholder.svg'}
                                        alt={product.name}
                                        className="w-12 h-12 rounded-lg object-cover"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium line-clamp-1">{product.name}</p>
                                        <p className="text-sm text-primary font-bold">
                                          {formatPrice(Number(product.sale_price || product.base_price))}
                                        </p>
                                      </div>
                                    </Link>
                                  );
                                })
                              ) : (
                                <div className="col-span-2 text-center text-muted-foreground py-4">
                                  <img
                                    src={resolveImageUrl(category.image_url, { width: 96 }) || '/placeholder.svg'}
                                    alt={category.name}
                                    className="w-24 h-24 rounded-lg object-cover mx-auto"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Highlight button - right side */}
            <Link to={highlightUrl} className="flex-shrink-0 flex items-center gap-1.5 py-2 px-5 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors font-medium text-sm ml-2">
              <HighlightIcon className="h-3.5 w-3.5" />
              {highlightText}
            </Link>
          </div>
        </div>
      </nav>

    </header>
  );
}
