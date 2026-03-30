 import { useState, useRef } from 'react';
 import { Tag, Loader2, X, Check } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/integrations/supabase/client';
import { Coupon } from '@/types/database';
 
 interface CouponInputProps {
   compact?: boolean;
 }
 
 export function CouponInput({ compact = false }: CouponInputProps) {
    const { appliedCoupon, applyCoupon, removeCoupon, subtotal, items, selectedShipping, setServerQuote } = useCart();
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
 
   const handleApplyCoupon = async () => {
     if (!code.trim()) return;
 
     setIsLoading(true);
     
     try {
       const payloadItems = items.map((item) => ({
         product_id: item.product.id,
         category_id: item.product.category_id,
         brand: item.product.brand,
         line_total: ((item.variant.sale_price ?? item.variant.base_price ?? item.product.sale_price ?? item.product.base_price) || 0) * item.quantity,
         is_promotional: !!item.variant.sale_price || !!item.product.sale_price,
       }));

       const { data: validation, error } = await supabase.functions.invoke('checkout-validate-coupon', {
         body: {
           coupon_code: code.toUpperCase(),
           subtotal,
           items: payloadItems,
         },
       });

       if (error || !validation?.valid) {
         setShakeError(true); haptics.error();
         setTimeout(() => setShakeError(false), 500);
         toast({
           title: 'Cupom não aplicado',
           description: validation?.error_message || 'O cupom informado é inválido para este carrinho.',
           variant: 'destructive',
         });
         return;
       }

       const { data: coupon, error: couponError } = await supabase
         .from('coupons')
         .select('*')
         .eq('code', code.toUpperCase())
         .single();

       if (couponError || !coupon) {
         toast({ title: 'Cupom inválido', description: 'Não foi possível carregar o cupom.', variant: 'destructive' });
         return;
       }

       haptics.success();
       applyCoupon(coupon as Coupon);
       setServerQuote({
         subtotal,
         discount: Number(validation.discount_amount || 0),
         shipping: Number(selectedShipping?.price || 0),
         total: Math.max(0, subtotal - Number(validation.discount_amount || 0) + Number(selectedShipping?.price || 0)),
         couponCode: coupon.code,
       });
       setCode('');
       toast({
         title: 'Cupom aplicado!',
         description: `Economia de ${formatPrice(Number(validation.discount_amount || 0))}.`,
       });
     } finally {
       setIsLoading(false);
     }
   };
 
   if (appliedCoupon) {
     const discountText = appliedCoupon.discount_type === 'percentage'
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
