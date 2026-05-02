import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';
import { formatCurrency } from '@/lib/pricingEngine';
import type { ShopifyProduct } from '@/lib/shopify/types';

interface Props {
  product: ShopifyProduct;
}

export function ShopifyProductCard({ product }: Props) {
  const node = product.node;
  const addItem = useShopifyCartStore((s) => s.addItem);
  const isLoading = useShopifyCartStore((s) => s.isLoading);

  const primaryImage = node.images.edges[0]?.node;
  const secondaryImage = node.images.edges[1]?.node;

  const minPrice = parseFloat(node.priceRange.minVariantPrice.amount);
  const compareAtMin = node.compareAtPriceRange?.minVariantPrice?.amount
    ? parseFloat(node.compareAtPriceRange.minVariantPrice.amount)
    : 0;
  const hasDiscount = compareAtMin > minPrice;
  const discountPct = hasDiscount ? Math.round((1 - minPrice / compareAtMin) * 100) : 0;

  const isOutOfStock = !node.availableForSale;
  const productUrl = `/product/${node.handle}`;

  const firstAvailableVariant =
    node.variants.edges.find((v) => v.node.availableForSale)?.node || node.variants.edges[0]?.node;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firstAvailableVariant) return;
    await addItem({
      product: {
        id: node.id,
        title: node.title,
        handle: node.handle,
        image: primaryImage ?? null,
      },
      variantId: firstAvailableVariant.id,
      variantTitle: firstAvailableVariant.title,
      price: firstAvailableVariant.price,
      quantity: 1,
      selectedOptions: firstAvailableVariant.selectedOptions || [],
    });
  };

  return (
    <Link
      to={productUrl}
      className={`group card-product card-lift block rounded-lg overflow-hidden shadow-sm hover:shadow-md bg-background border border-border/40 ${
        isOutOfStock ? 'opacity-65' : ''
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.altText || node.title}
            className={`w-full h-full object-cover transition-all duration-500 ${
              secondaryImage ? 'group-hover:opacity-0' : 'group-hover:scale-110'
            }`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sem imagem
          </div>
        )}
        {secondaryImage && (
          <img
            src={secondaryImage.url}
            alt={`${node.title} - foto alternativa`}
            className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            loading="lazy"
            decoding="async"
          />
        )}

        <div className="absolute top-2 left-2 flex flex-col gap-1 max-w-[calc(100%-3rem)]">
          {isOutOfStock && (
            <Badge variant="secondary" className="text-[10px] truncate bg-muted-foreground text-background">
              Sem estoque
            </Badge>
          )}
          {hasDiscount && !isOutOfStock && (
            <Badge className="badge-sale text-[10px] truncate">-{discountPct}%</Badge>
          )}
        </div>

        <button
          type="button"
          aria-label="Favoritar"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-2 right-2 bg-background/80 p-1.5 rounded-full hover:bg-background transition-all shadow-sm"
        >
          <Heart className="h-4 w-4 text-muted-foreground" />
        </button>

        {!isOutOfStock && firstAvailableVariant && (
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isLoading}
            className="absolute bottom-2 right-2 bg-primary text-primary-foreground p-2.5 rounded-full max-md:opacity-100 opacity-0 md:group-hover:opacity-100 transition-all duration-200 hover:bg-primary/90 shadow-lg btn-press disabled:opacity-50"
            aria-label={`Adicionar ${node.title} ao carrinho`}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 text-sm leading-snug min-h-[2.5rem]">
          {node.title}
        </h3>
        <div className="mt-2 space-y-0.5">
          {hasDiscount ? (
            <>
              <p className="price-original text-xs line-through text-muted-foreground">
                {formatCurrency(compareAtMin)}
              </p>
              <p className="text-base font-bold text-primary">{formatCurrency(minPrice)}</p>
            </>
          ) : (
            <p className="price-current text-base font-bold">{formatCurrency(minPrice)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
