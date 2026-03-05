import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ProductSortKey,
  PRODUCT_SORT_OPTIONS_STORE,
  PRODUCT_SORT_OPTIONS_ADMIN,
} from '@/lib/productSort';

export type ProductSortVariant = 'store' | 'admin';

interface ProductSortSelectProps {
  value: ProductSortKey;
  onValueChange: (value: ProductSortKey) => void;
  variant?: ProductSortVariant;
  placeholder?: string;
  triggerClassName?: string;
}

const OPTIONS_BY_VARIANT = {
  store: PRODUCT_SORT_OPTIONS_STORE,
  admin: PRODUCT_SORT_OPTIONS_ADMIN,
};

/**
 * Select reutilizável para ordenação de produtos.
 * Use em qualquer listagem (loja, admin) para manter um único lugar
 * com as opções e o mesmo comportamento.
 */
export function ProductSortSelect({
  value,
  onValueChange,
  variant = 'store',
  placeholder = 'Ordenar por',
  triggerClassName = 'w-48',
}: ProductSortSelectProps) {
  const options = OPTIONS_BY_VARIANT[variant];

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as ProductSortKey)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
