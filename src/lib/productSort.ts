/**
 * Ordenação de produtos — um único lugar para regras e opções.
 * Use em qualquer listagem (loja, admin, seções da home) para manter
 * o código DRY e fácil de alterar.
 */

/** Item mínimo para ordenação (compatível com Product e tipos similares). */
export interface SortableProduct {
  id: string;
  name: string;
  created_at: string;
  base_price: number;
  sale_price?: number | null;
}

/** Chaves de ordenação suportadas. */
export type ProductSortKey =
  | 'newest'
  | 'oldest'
  | 'price-asc'
  | 'price-desc'
  | 'name-asc'
  | 'name-desc'
  | 'discount-desc';

/** Opção para uso em <Select> (value + label). */
export interface ProductSortOption {
  value: ProductSortKey;
  label: string;
}

/** Opções para a loja (menos opções, labels amigáveis). */
export const PRODUCT_SORT_OPTIONS_STORE: ProductSortOption[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name-asc', label: 'A-Z' },
  { value: 'name-desc', label: 'Z-A' },
];

/** Opções para o admin (inclui mais critérios). */
export const PRODUCT_SORT_OPTIONS_ADMIN: ProductSortOption[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name-asc', label: 'Nome A-Z' },
  { value: 'name-desc', label: 'Nome Z-A' },
  { value: 'discount-desc', label: 'Maior desconto' },
];

/** Valor padrão recomendado para ordenação. */
export const DEFAULT_PRODUCT_SORT: ProductSortKey = 'newest';

function priceOf(p: SortableProduct): number {
  return Number(p.sale_price ?? p.base_price);
}

/**
 * Ordena um array de produtos (ou itens compatíveis) conforme a chave.
 * Não altera o array original; retorna uma cópia ordenada.
 */
export function sortProductList<T extends SortableProduct>(
  items: T[],
  sortBy: ProductSortKey
): T[] {
  const result = [...items];
  switch (sortBy) {
    case 'newest':
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'oldest':
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case 'price-asc':
      result.sort((a, b) => priceOf(a) - priceOf(b));
      break;
    case 'price-desc':
      result.sort((a, b) => priceOf(b) - priceOf(a));
      break;
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'discount-desc':
      result.sort((a, b) => {
        const discA = a.sale_price != null && a.base_price > 0
          ? (a.base_price - a.sale_price) / a.base_price
          : 0;
        const discB = b.sale_price != null && b.base_price > 0
          ? (b.base_price - b.sale_price) / b.base_price
          : 0;
        return discB - discA;
      });
      break;
    default:
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return result;
}

/**
 * Converte sort_order das seções da home (underscore) para ProductSortKey (hífen).
 * Ex.: 'price_asc' -> 'price-asc', 'alpha_asc' -> 'name-asc'
 */
export function homeSectionSortToProductSortKey(sortOrder: string): ProductSortKey {
  const map: Record<string, ProductSortKey> = {
    newest: 'newest',
    oldest: 'oldest',
    price_asc: 'price-asc',
    price_desc: 'price-desc',
    alpha_asc: 'name-asc',
    alpha_desc: 'name-desc',
    discount_desc: 'discount-desc',
  };
  return map[sortOrder] ?? 'newest';
}
