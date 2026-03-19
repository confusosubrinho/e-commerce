import type { ReactNode } from 'react';

export interface ShippingRegion {
  id: string;
  name: string;
  states: string[];
  price: number;
  min_days: number;
  max_days: number;
  enabled: boolean;
}

export interface SimpleIntegration {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  status: 'available' | 'coming_soon' | 'connected';
  category: 'erp' | 'payment' | 'shipping';
  configFields?: { key: string; label: string; placeholder: string; type?: string }[];
}
