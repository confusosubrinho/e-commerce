import { useQuery } from '@tanstack/react-query';
import { getActivePricingConfig, type PricingConfig } from '@/lib/pricingEngine';

export function usePricingConfig() {
  return useQuery<PricingConfig>({
    queryKey: ['pricing-config'],
    queryFn: getActivePricingConfig,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
