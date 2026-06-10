import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';
import {
  useShopifyProduct,
  useShopifyProductRecommendations,
} from '@/hooks/useShopifyProducts';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatCurrency,
  getPixPriceForDisplay,
  getPixDiscountAmount,
  shouldApplyPixDiscount,
  getInstallmentDisplay,
} from '@/lib/pricingEngine';
import { ChevronLeft, Loader2, ShoppingBag } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { PageSEO } from '@/components/seo/PageSEO';
import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { FadeInOnScroll } from '@/components/store/FadeInOnScroll';


const ProductDetail = () => {
  const { handle, slug } = useParams<{ handle?: string; slug?: string }>();
  const productHandle = handle ?? slug;
  const { data: product, isLoading, isError } = useShopifyProduct(productHandle);
  const addItem = useShopifyCartStore((s) => s.addItem);
  const isAdding = useShopifyCartStore((s) => s.isLoading);
  const { data: pricingConfig } = usePricingConfig();
  const { data: relatedProducts, isLoading: isLoadingRelated } =
    useShopifyProductRecommendations(product?.id);


  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const allVariants = useMemo(
    () => product?.variants.edges.map((v) => v.node) ?? [],
    [product]
  );

  /** Verifica se existe alguma variante disponível com (option = value) + outras opções já escolhidas. */
  const isOptionValueAvailable = (optionName: string, value: string) => {
    return allVariants.some((v) => {
      if (!v.availableForSale) return false;
      return v.selectedOptions.every((o) => {
        if (o.name === optionName) return o.value === value;
        const chosen = selectedOptions[o.name];
        return !chosen || chosen === o.value;
      });
    });
  };

  // Variante selecionada conforme opções; default = primeira disponível
  const selectedVariant = useMemo(() => {
    if (!product) return null;
    const variants = product.variants.edges.map((v) => v.node);
    if (Object.keys(selectedOptions).length === 0) {
      return variants.find((v) => v.availableForSale) || variants[0];
    }
    return (
      variants.find((v) =>
        v.selectedOptions.every((o) => selectedOptions[o.name] === o.value)
      ) || null
    );
  }, [product, selectedOptions]);

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="container-custom py-8 grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (isError || !product) {
    return (
      <StoreLayout>
        <div className="container-custom py-16 text-center">
          <h1 className="text-2xl font-bold">Produto não encontrado</h1>
          <p className="text-muted-foreground mt-2">
            Esse produto pode ter sido removido ou ainda não foi cadastrado.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar para a loja</Link>
          </Button>
        </div>
      </StoreLayout>
    );
  }

  const images = product.images.edges.map((e) => e.node);
  const activeImage = images[activeImageIdx] ?? images[0];

  const price = selectedVariant ? parseFloat(selectedVariant.price.amount) : 0;
  const compareAt = selectedVariant?.compareAtPrice
    ? parseFloat(selectedVariant.compareAtPrice.amount)
    : 0;
  const hasDiscount = compareAt > price;

  const applyPix = pricingConfig ? shouldApplyPixDiscount(pricingConfig, hasDiscount) : true;
  const pixPrice = pricingConfig ? getPixPriceForDisplay(price, pricingConfig, hasDiscount) : price;
  const pixDiscountAmount = pricingConfig ? getPixDiscountAmount(price, pricingConfig, hasDiscount) : 0;
  const installmentDisplay = pricingConfig ? getInstallmentDisplay(price, pricingConfig, hasDiscount) : null;


  const handleAdd = async () => {
    if (!selectedVariant) return;
    await addItem({
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        image: images[0] ?? null,
      },
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity: 1,
      selectedOptions: selectedVariant.selectedOptions,
    });
  };

  const plainDescription = (product.descriptionHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  return (
    <StoreLayout>
      <PageSEO
        title={`${product.title} | Vanessa Lima Shoes`}
        description={plainDescription || `${product.title} — disponível na Vanessa Lima Shoes.`}
        image={images[0]?.url ?? null}
        type="product"
        path={`/produto/${product.handle}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.title,
          description: plainDescription || undefined,
          image: images.map((i) => i.url),
          brand: product.vendor || undefined,
          offers: selectedVariant
            ? {
                '@type': 'Offer',
                price: selectedVariant.price.amount,
                priceCurrency: selectedVariant.price.currencyCode,
                availability: selectedVariant.availableForSale
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
              }
            : undefined,
        }}
      />
      <div className="container-custom py-4">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
      </div>


      <div className="container-custom pb-12 grid md:grid-cols-2 gap-8">
        {/* Galeria */}
        <div>
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {activeImage ? (
              <img
                src={activeImage.url}
                alt={activeImage.altText || product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setActiveImageIdx(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${
                    i === activeImageIdx ? 'border-primary' : 'border-border'
                  }`}
                  aria-label={`Imagem ${i + 1}`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + opções */}
        <div className="space-y-5">
          <div>
            {product.vendor && (
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {product.vendor}
              </p>
            )}
            <h1 className="text-2xl md:text-3xl font-bold mt-1">{product.title}</h1>
          </div>

          <div className="space-y-1">
            {hasDiscount && (
              <div className="flex items-center gap-2">
                <p className="line-through text-sm text-muted-foreground">
                  {formatCurrency(compareAt)}
                </p>
                <Badge className="badge-sale text-[10px]">
                  -{Math.round((1 - price / compareAt) * 100)}%
                </Badge>
              </div>
            )}
            <p className="text-3xl font-bold text-primary">{formatCurrency(price)}</p>
            {applyPix && pixDiscountAmount > 0 && (
              <p className="text-sm font-semibold text-primary">
                ou {formatCurrency(pixPrice)} no PIX
                <span className="text-muted-foreground font-normal">
                  {' '}
                  (economize {formatCurrency(pixDiscountAmount)})
                </span>
              </p>
            )}
            {installmentDisplay && (
              <p className="text-sm text-foreground/80">{installmentDisplay.primaryText}</p>
            )}
            {selectedVariant && !selectedVariant.availableForSale && (
              <Badge variant="secondary" className="mt-2 bg-muted-foreground text-background">
                Sem estoque
              </Badge>
            )}
          </div>


          {product.options.map((option) => {
            // Opções "Title" único (default Shopify para produtos sem variantes reais) → não mostra
            if (option.values.length === 1 && option.values[0] === 'Default Title') return null;
            return (
              <div key={option.name}>
                <p className="text-sm font-medium mb-2">{option.name}</p>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((val) => {
                    const isActive = selectedOptions[option.name] === val;
                    const available = isOptionValueAvailable(option.name, val);
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() =>
                          setSelectedOptions((prev) => ({ ...prev, [option.name]: val }))
                        }
                        title={available ? val : `${val} — esgotado`}
                        aria-label={available ? val : `${val} esgotado`}
                        className={`relative min-w-[44px] px-3 h-10 rounded-md border text-sm transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary'
                            : available
                            ? 'bg-background hover:bg-muted border-border'
                            : 'bg-muted/40 text-muted-foreground border-dashed border-border line-through opacity-70'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Button
            onClick={handleAdd}
            disabled={!selectedVariant || !selectedVariant.availableForSale || isAdding}
            size="lg"
            className="w-full"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : !selectedVariant ? (
              'Escolha as opções'
            ) : !selectedVariant.availableForSale ? (
              'Esgotado'
            ) : (
              <>
                <ShoppingBag className="w-4 h-4 mr-2" />
                Adicionar ao carrinho
              </>
            )}
          </Button>

          {product.descriptionHtml && (
            <div className="prose prose-sm max-w-none pt-4 border-t">
              <h2 className="text-base font-semibold mb-2">Descrição</h2>
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.descriptionHtml) }}
              />
            </div>
          )}
        </div>
      </div>


      {(isLoadingRelated || (relatedProducts && relatedProducts.length > 0)) && (
        <FadeInOnScroll>
          <ShopifyProductGrid
            title="Você também pode gostar"
            subtitle="Produtos relacionados selecionados para você"
            products={relatedProducts ?? []}
            isLoading={isLoadingRelated}
          />
        </FadeInOnScroll>
      )}
    </StoreLayout>
  );
};

export default ProductDetail;
