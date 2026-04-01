import { useState, useRef } from 'react';
import { Tag, Loader2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/integrations/supabase/client';
import { Coupon } from '@/types/database';
import { hasEligibleItems, validateCouponDates } from '@/lib/couponDiscount';
import { useTenant } from '@/hooks/useTenant';

interface CouponInputProps {
  compact?: boolean;
}

export function CouponInput({ compact = false }: CouponInputProps) {
  const { appliedCoupon, applyCoupon, removeCoupon, subtotal, items } = useCart();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const haptics = useHaptics();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const triggerError = (title: string, description: string) => {
    setShakeError(true);
    haptics.error();
    setTimeout(() => setShakeError(false), 500);
    toast({ title, description, variant: 'destructive' });
  };

  const handleApplyCoupon = async () => {
    if (!code.trim()) return;

    setIsLoading(true);
    
    try {
      // Query filtered by tenant_id for multi-tenant isolation
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        triggerError('Cupom inválido', 'O código inserido não existe ou está inativo.');
        return;
      }

      const coupon = data as Coupon;

      // Validate date range (start_date + expiry_date)
      const dateError = validateCouponDates(coupon);
      if (dateError) {
        triggerError('Cupom indisponível', dateError);
        return;
      }

      // Check max uses
      if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
        triggerError('Cupom esgotado', 'Este cupom atingiu o limite máximo de uso.');
        return;
      }

      // Check minimum purchase
      if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
        triggerError(
          'Valor mínimo não atingido',
          `Este cupom requer compras acima de ${formatPrice(coupon.min_purchase_amount)}.`
        );
        return;
      }

      // Check exclude_sale_products: if all items are on sale, coupon can't apply
      // Check category/product restriction: cart must have at least one eligible item
      if (!hasEligibleItems(coupon, items)) {
        const msg = coupon.exclude_sale_products
          ? 'Este cupom não pode ser usado com itens em promoção.'
          : 'Este cupom não se aplica aos produtos do seu carrinho.';
        triggerError('Cupom não aplicável', msg);
        return;
      }

      haptics.success();
      applyCoupon(coupon);
      setCode('');
      toast({
        title: 'Cupom aplicado!',
        description: coupon.type === 'free_shipping'
          ? 'Frete grátis aplicado ao pedido.'
          : coupon.discount_type === 'percentage' 
            ? `Desconto de ${coupon.discount_value}% aplicado.`
            : `Desconto de ${formatPrice(coupon.discount_value)} aplicado.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (appliedCoupon) {
    const discountText = appliedCoupon.type === 'free_shipping'
      ? 'Frete Grátis'
      : appliedCoupon.discount_type === 'percentage'
        ? `${appliedCoupon.discount_value}% OFF`
        : formatPrice(appliedCoupon.discount_value);

    return (
      <div className={`flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-lg ${compact ? 'text-sm' : ''}`}>
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          <span>
            <span className="font-medium">{appliedCoupon.code}</span>
            <span className="text-muted-foreground ml-2">({discountText})</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={removeCoupon}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-3'}`}>
      {!compact && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4 text-primary" />
          <span>Cupom de Desconto</span>
        </div>
      )}
      
      <div className={`flex gap-2 ${shakeError ? 'animate-shake' : ''}`}>
        <Input
          ref={inputRef}
          placeholder="Código do cupom"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className={compact ? 'h-9 text-sm' : ''}
          onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
        />
        <Button 
          onClick={handleApplyCoupon} 
          disabled={isLoading || !code.trim()}
          size={compact ? 'sm' : 'default'}
          variant="outline"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
        </Button>
      </div>
    </div>
  );
}
