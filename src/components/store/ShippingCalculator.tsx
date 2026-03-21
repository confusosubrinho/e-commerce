import { useState, useEffect, useCallback } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/contexts/CartContext';
import { ShippingOption } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/formatters';
import {
  buildShippingQuoteKey,
  getCachedShippingQuote,
  setCachedShippingQuote,
} from '@/lib/shippingQuoteCache';

interface ShippingCalculatorProps {
  compact?: boolean;
  products?: Array<{ weight?: number; width?: number; height?: number; depth?: number; quantity: number }>;
}

function formatCepDisplay(value: string) {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}

export function ShippingCalculator({ compact = false, products: _products }: ShippingCalculatorProps) {
  const { shippingZip, setShippingZip, selectedShipping, setSelectedShipping, subtotal, items } = useCart();
  const [localCep, setLocalCep] = useState(shippingZip);
  const [isLoading, setIsLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(399);

  const applyFreeShippingAutoSelect = useCallback(
    (options: ShippingOption[], threshold: number) => {
      if (threshold && subtotal >= threshold) {
        const cheapest = [...options].sort((a, b) => a.price - b.price)[0];
        if (cheapest) {
          setSelectedShipping({
            id: cheapest.id || cheapest.name || 'free-shipping',
            name: cheapest.name,
            price: 0,
            deadline: cheapest.deadline,
            company: cheapest.company,
          });
        }
      }
    },
    [subtotal, setSelectedShipping]
  );

  const calculateShipping = useCallback(async (cleanCep: string) => {
    const cacheKey = buildShippingQuoteKey(cleanCep, items);
    const cached = getCachedShippingQuote(cacheKey);
    if (cached) {
      setShippingOptions(cached.options);
      setFreeShippingThreshold(cached.freeShippingThreshold);
      setShippingZip(formatCepDisplay(cleanCep));
      setHasCalculated(true);
      applyFreeShippingAutoSelect(cached.options, cached.freeShippingThreshold);
      return;
    }

    setIsLoading(true);
    try {
      // Build products payload from cart items
      const productsList = items.map(item => ({
        weight: item.product.weight || 0.3,
        width: item.product.width || 11,
        height: item.product.height || 2,
        depth: item.product.depth || 16,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.functions.invoke('checkout-calculate-shipping', {
        body: {
          postal_code_to: cleanCep,
          products: productsList,
        },
      });

      if (error) throw error;

      let resolvedOptions: ShippingOption[];
      let resolvedThreshold = 399;

      if (data?.error) {
        console.error('Shipping API error:', data.error);
        resolvedOptions = [
          { id: 'fallback-standard', name: 'Envio padrão', price: 18, deadline: '8 a 12 dias úteis', company: 'Correios' },
        ];
        setShippingOptions(resolvedOptions);
        setFreeShippingThreshold(399);
      } else {
        resolvedOptions = (data?.options || []).map((opt: any, idx: number) => ({
          id: opt.id || opt.name || `shipping-${idx}`,
          name: opt.name,
          price: opt.price,
          deadline: opt.deadline,
          company: opt.company,
        }));
        resolvedThreshold = data?.free_shipping_threshold || 399;
        setShippingOptions(resolvedOptions);
        setFreeShippingThreshold(resolvedThreshold);
        // Não cachear lista vazia: evita 90s sem opções se a API falhou silenciosamente ou CEP sem cobertura transitória
        if (resolvedOptions.length > 0) {
          setCachedShippingQuote(cacheKey, resolvedOptions, resolvedThreshold);
        }
      }

      setShippingZip(formatCepDisplay(cleanCep));
      setHasCalculated(true);
      applyFreeShippingAutoSelect(resolvedOptions, resolvedThreshold);
    } catch (err: any) {
      console.error('Shipping calculation error:', err);
      const fallback: ShippingOption[] = [
        { id: 'fallback-standard', name: 'Envio padrão', price: 18, deadline: '8 a 12 dias úteis', company: 'Correios' },
      ];
      setShippingOptions(fallback);
      setHasCalculated(true);
      applyFreeShippingAutoSelect(fallback, 399);
    } finally {
      setIsLoading(false);
    }
  }, [items, subtotal, setShippingZip, setSelectedShipping, applyFreeShippingAutoSelect]);

  // Recálculo intencional na mudança de CEP; debounce reduz bursts se o CEP vier digitando.
  useEffect(() => {
    if (!shippingZip || shippingZip.replace(/\D/g, '').length !== 8 || hasCalculated) return;
    const clean = shippingZip.replace(/\D/g, '');
    const t = window.setTimeout(() => {
      void calculateShipping(clean);
    }, 450);
    return () => clearTimeout(t);
  }, [shippingZip, hasCalculated, calculateShipping]);

  const formatCep = formatCepDisplay;

  const handleCalculate = async () => {
    const cleanCep = localCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    await calculateShipping(cleanCep);
  };

  const freeShippingEligible = subtotal >= freeShippingThreshold && freeShippingThreshold > 0;

  // Compact design for cart sidebar
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Truck className="h-4 w-4 text-primary" />
          <span>Calcular Frete</span>
        </div>
        
        <div className="flex gap-2">
          <Input
            placeholder="00000-000"
            value={localCep}
            onChange={(e) => setLocalCep(formatCep(e.target.value))}
            maxLength={9}
            className="h-9 text-sm bg-background"
          />
          <Button 
            onClick={handleCalculate} 
            disabled={isLoading || localCep.replace(/\D/g, '').length !== 8}
            size="sm"
            variant="outline"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
          </Button>
        </div>

        {hasCalculated && shippingOptions.length > 0 && (
          <div className="space-y-2">
            {freeShippingEligible && (
              <div className="text-sm text-primary font-medium bg-primary/10 p-2 rounded">
                🎉 Você ganhou frete grátis!
              </div>
            )}
            
            {shippingOptions.map((option) => {
              const finalPrice = freeShippingEligible && option.price > 0
                ? 0
                : option.price;
              const isSelected = selectedShipping?.name === option.name;
              
              return (
                <button
                  key={option.name}
                  onClick={() => setSelectedShipping({ id: option.id || option.name, ...option, price: finalPrice })}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">
                        {option.name} - {option.company}
                      </p>
                      <p className="text-xs text-muted-foreground">{option.deadline}</p>
                    </div>
                    <div className="text-right">
                      {finalPrice === 0 ? (
                        <span className="text-primary font-bold">Grátis</span>
                      ) : (
                        <span className="font-medium">{formatPrice(finalPrice)}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Full design for product page
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-background">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="font-medium text-sm">Frete e prazo de</p>
            <p className="font-medium text-sm">entrega</p>
          </div>
        </div>
        
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Informe seu CEP"
            value={localCep}
            onChange={(e) => setLocalCep(formatCep(e.target.value))}
            maxLength={9}
            className="bg-background border text-sm"
          />
          <Button 
            onClick={handleCalculate} 
            disabled={isLoading || localCep.replace(/\D/g, '').length !== 8}
            variant="link"
            className="font-semibold text-primary"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'CALCULAR'}
          </Button>
        </div>
      </div>

      {hasCalculated && shippingOptions.length > 0 && (
        <div className="space-y-2">
          {freeShippingEligible && (
            <div className="text-sm text-primary font-medium bg-primary/10 p-3 rounded-lg text-center">
              🎉 Parabéns! Você ganhou frete grátis!
            </div>
          )}
          
          {shippingOptions.map((option) => {
            const finalPrice = freeShippingEligible && option.price > 0 ? 0 : option.price;
            const isSelected = selectedShipping?.name === option.name;
            
            return (
              <button
                key={option.name}
                onClick={() => setSelectedShipping({ id: option.id || option.name, ...option, price: finalPrice })}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-primary' : 'border-muted-foreground'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="font-medium">{option.name}</p>
                      <p className="text-sm text-muted-foreground">{option.company} • {option.deadline}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {finalPrice === 0 ? (
                      <span className="text-primary font-bold text-lg">Grátis</span>
                    ) : (
                      <span className="font-bold text-lg">{formatPrice(finalPrice)}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!hasCalculated && (
        <a 
          href="https://buscacepinter.correios.com.br/app/endereco/index.php" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Não sei meu CEP
        </a>
      )}
    </div>
  );
}
