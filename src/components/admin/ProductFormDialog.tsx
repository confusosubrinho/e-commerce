import { useState, useEffect, useRef, useMemo } from 'react';
import { z } from 'zod';
import { ProductChangeLog } from './ProductChangeLog';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateNetProfit } from '@/lib/pricingEngine';
import { logAudit, generateCorrelationId } from '@/lib/auditLogger';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Search, ChevronLeft, ChevronRight, Check, Save, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { ProductMediaUpload } from './ProductMediaUpload';
import { ProductSEOFields } from './ProductSEOFields';
import { ProductVariantsManager, VariantItem } from './ProductVariantsManager';
import { Category } from '@/types/database';
import { PerfProfiler } from '@/components/dev/PerfProfiler';
const MAX_VARIANTS_FOR_SAFE_EDITOR = 1200;

interface MediaItem {
  id: string;
  url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  media_type: string;
}

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  base_price: string;
  sale_price: string;
  cost: string;
  category_id: string;
  sku: string;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  weight: string;
  width: string;
  height: string;
  depth: string;
  gtin: string;
  mpn: string;
  brand: string;
  condition: string;
  google_product_category: string;
  age_group: string;
  gender: string;
  material: string;
  pattern: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct?: any | null;
}

function generateProductSku(name: string): string {
  const words = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 3);
  const base = words.map(w => w.substring(0, 3)).join('');
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `VLS-${base}-${num}`;
}

const initialFormData: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  base_price: '',
  sale_price: '',
  cost: '',
  category_id: '',
  sku: '',
  is_active: true,
  is_featured: false,
  is_new: false,
  weight: '',
  width: '',
  height: '',
  depth: '',
  gtin: '',
  mpn: '',
  brand: '',
  condition: 'new',
  google_product_category: 'Vestuário e acessórios > Sapatos',
  age_group: 'adult',
  gender: 'female',
  material: '',
  pattern: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
};

/** Validação Zod para o formulário de produto (FASE 4). */
const productFormSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  slug: z.string().optional(),
  description: z.string().optional(),
  base_price: z.string().min(1, 'Preço base é obrigatório').refine(
    (v) => !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0,
    'Preço base deve ser um número maior ou igual a zero'
  ),
  sale_price: z.string().optional(),
  cost: z.string().optional(),
  category_id: z.string().optional(),
  sku: z.string().optional(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  is_new: z.boolean(),
  weight: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  depth: z.string().optional(),
  gtin: z.string().optional(),
  mpn: z.string().optional(),
  brand: z.string().optional(),
  condition: z.string().optional(),
  google_product_category: z.string().optional(),
  age_group: z.string().optional(),
  gender: z.string().optional(),
  material: z.string().optional(),
  pattern: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  seo_keywords: z.string().optional(),
});

const STEPS_BASE = [
  { key: 'basic', label: 'Básico' },
  { key: 'media', label: 'Mídia' },
  { key: 'variants', label: 'Variantes' },
  { key: 'characteristics', label: 'Caract.' },
  { key: 'buy-together', label: 'Compre Junto' },
  { key: 'shipping', label: 'Frete & GMC' },
  { key: 'seo', label: 'SEO' },
  { key: 'history', label: 'Histórico' },
];

export function ProductFormDialog({ open, onOpenChange, editingProduct }: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [characteristics, setCharacteristics] = useState<{ name: string; value: string }[]>([]);
  const [buyTogetherItems, setBuyTogetherItems] = useState<{ product_id: string; discount_percent: number }[]>([]);
  const [buyTogetherSearch, setBuyTogetherSearch] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState('basic');
  const [variantEditorProtected, setVariantEditorProtected] = useState(false);
  const [variantTotalCount, setVariantTotalCount] = useState(0);
  const submitLockRef = useRef(false);

  const { data: allProducts } = useQuery({
    queryKey: ['admin-all-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, base_price, sale_price, slug').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: storeSettings } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const { data } = await supabase.from('payment_pricing_config').select('*').eq('is_active', true).limit(1).maybeSingle();
      if (!data) return null;
      return {
        pix_discount: Number((data as any).pix_discount) || 5,
        cash_discount: Number((data as any).cash_discount) || 5,
        installments_without_interest: (data as any).interest_free_installments || 3,
        max_installments: (data as any).max_installments || 6,
        card_cash_rate: Number((data as any).card_cash_rate) || 0,
        interest_mode: (data as any).interest_mode || 'fixed',
        monthly_rate_fixed: Number((data as any).monthly_rate_fixed) || 0,
        monthly_rate_by_installment: (data as any).monthly_rate_by_installment || {},
        min_installment_value: Number((data as any).min_installment_value) || 25,
        transparent_checkout_fee_enabled: (data as any).transparent_checkout_fee_enabled ?? false,
        transparent_checkout_fee_percent: Number((data as any).transparent_checkout_fee_percent) || 0,
      };
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data as Category[];
    },
  });

  const selectedCategory = categories?.find(c => c.id === formData.category_id);
  const variantProductImages = useMemo(() => (
    media
      .filter(m => m.media_type === 'image')
      .map(m => ({
        id: m.id,
        url: m.url,
        alt_text: m.alt_text,
        is_primary: m.is_primary,
      }))
  ), [media]);
  const selectedBuyTogetherIds = useMemo(() => {
    return new Set(buyTogetherItems.map(bt => bt.product_id));
  }, [buyTogetherItems]);
  const buyTogetherSearchResults = useMemo(() => {
    const normalizedQuery = buyTogetherSearch.trim().toLowerCase();
    if (!allProducts || normalizedQuery.length <= 1) return [];

    return allProducts
      .filter(p =>
        p.id !== editingProduct?.id &&
        !selectedBuyTogetherIds.has(p.id) &&
        p.name.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 5);
  }, [allProducts, buyTogetherSearch, editingProduct?.id, selectedBuyTogetherIds]);
  const allProductsById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; base_price: number | null; sale_price: number | null; slug: string | null }>();
    for (const product of allProducts || []) {
      map.set(product.id, product);
    }
    return map;
  }, [allProducts]);

  // Reset step when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setActiveTab('basic');
    }
  }, [open]);

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name || '',
        slug: editingProduct.slug || '',
        description: editingProduct.description || '',
        base_price: String(editingProduct.base_price || ''),
        sale_price: editingProduct.sale_price ? String(editingProduct.sale_price) : '',
        cost: editingProduct.cost ? String(editingProduct.cost) : '',
        category_id: editingProduct.category_id || '',
        sku: editingProduct.sku || '',
        is_active: editingProduct.is_active ?? true,
        is_featured: editingProduct.is_featured ?? false,
        is_new: editingProduct.is_new ?? false,
        weight: editingProduct.weight ? String(editingProduct.weight) : '',
        width: editingProduct.width ? String(editingProduct.width) : '',
        height: editingProduct.height ? String(editingProduct.height) : '',
        depth: editingProduct.depth ? String(editingProduct.depth) : '',
        gtin: editingProduct.gtin || '',
        mpn: editingProduct.mpn || '',
        brand: editingProduct.brand || '',
        condition: editingProduct.condition || 'new',
        google_product_category: editingProduct.google_product_category || 'Vestuário e acessórios > Sapatos',
        age_group: editingProduct.age_group || 'adult',
        gender: editingProduct.gender || 'female',
        material: editingProduct.material || '',
        pattern: editingProduct.pattern || '',
        seo_title: editingProduct.seo_title || '',
        seo_description: editingProduct.seo_description || '',
        seo_keywords: editingProduct.seo_keywords || '',
      });
      if (editingProduct.images) {
        setMedia(editingProduct.images.map((img: any) => ({
          id: img.id,
          url: img.url,
          alt_text: img.alt_text,
          display_order: img.display_order || 0,
          is_primary: img.is_primary || false,
          media_type: img.media_type || 'image',
        })));
      }
      if (editingProduct.variants) {
        const rawVariants = editingProduct.variants as any[];
        const shouldProtectVariantEditor = rawVariants.length > MAX_VARIANTS_FOR_SAFE_EDITOR;
        const sourceVariants = shouldProtectVariantEditor
          ? rawVariants.slice(0, MAX_VARIANTS_FOR_SAFE_EDITOR)
          : rawVariants;
        setVariantEditorProtected(shouldProtectVariantEditor);
        setVariantTotalCount(rawVariants.length);

        const imageByVariantId = new Map<string, string>();
        for (const img of editingProduct.images || []) {
          const variantId = (img as { product_variant_id?: string | null }).product_variant_id;
          if (variantId && img.url) {
            imageByVariantId.set(variantId, img.url);
          }
        }

        setVariants(sourceVariants.map((v: any) => {
          return {
            id: v.id,
            size: v.size || '',
            color: v.color || '',
            color_hex: v.color_hex || '',
            stock_quantity: v.stock_quantity || 0,
            price_modifier: v.price_modifier || 0,
            sku: v.sku || '',
            is_active: v.is_active ?? true,
            image_url: imageByVariantId.get(v.id),
            custom_attribute_name: v.custom_attribute_name || '',
            custom_attribute_value: v.custom_attribute_value || '',
          };
        }));
      } else {
        setVariantEditorProtected(false);
        setVariantTotalCount(0);
      }
      if (editingProduct.id) {
        supabase
          .from('product_characteristics')
          .select('*')
          .eq('product_id', editingProduct.id)
          .order('display_order')
          .then(({ data: chars }) => {
            if (chars) {
              setCharacteristics((chars as any[]).map((c: any) => ({ name: c.name, value: c.value })));
            }
          });
        supabase
          .from('buy_together_products')
          .select('*')
          .eq('product_id', editingProduct.id)
          .then(({ data: btItems }) => {
            if (btItems) {
              setBuyTogetherItems((btItems as any[]).map((bt: any) => ({
                product_id: bt.related_product_id,
                discount_percent: bt.discount_percent || 5,
              })));
            }
          });
      }
    } else {
      setFormData(initialFormData);
      setMedia([]);
      setVariants([]);
      setVariantEditorProtected(false);
      setVariantTotalCount(0);
      setCharacteristics([]);
      setBuyTogetherItems([]);
    }
  }, [editingProduct, open]);

  const saveMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const correlationId = generateCorrelationId();
      const productData = {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: data.description || null,
        base_price: parseFloat(data.base_price),
        sale_price: data.sale_price ? parseFloat(data.sale_price) : null,
        cost: data.cost ? parseFloat(data.cost) : null,
        category_id: data.category_id || null,
        sku: data.sku || null,
        is_active: data.is_active,
        is_featured: data.is_featured,
        is_new: data.is_new,
        weight: data.weight ? parseFloat(data.weight) : null,
        width: data.width ? parseFloat(data.width) : null,
        height: data.height ? parseFloat(data.height) : null,
        depth: data.depth ? parseFloat(data.depth) : null,
        gtin: data.gtin || null,
        mpn: data.mpn || null,
        brand: data.brand || null,
        condition: data.condition || 'new',
        google_product_category: data.google_product_category || null,
        age_group: data.age_group || null,
        gender: data.gender || null,
        material: data.material || null,
        pattern: data.pattern || null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        seo_keywords: data.seo_keywords || null,
      };

      let productId = editingProduct?.id;

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert(productData)
          .select('id')
          .single();
        if (error) throw error;
        productId = newProduct.id;
      }

      if (productId) {
        await supabase.from('product_images').delete().eq('product_id', productId);
        if (media.length > 0) {
          const mediaInserts = media.map((m, index) => ({
            product_id: productId,
            url: m.url,
            alt_text: m.alt_text,
            display_order: index,
            is_primary: m.is_primary,
            media_type: m.media_type,
          }));
          const { error: mediaError } = await supabase.from('product_images').insert(mediaInserts);
          if (mediaError) throw mediaError;
        }

        // Conservador: nunca apagar variantes em massa para não perder vínculo externo (Bling/Yampi/Stripe).
        // Modo protegido: não persistir alterações de variantes quando o payload veio truncado por segurança.
        if (variantEditorProtected) {
          console.warn('[product-form] Variant persistence skipped due protected editor mode', {
            product_id: productId,
            preview_variant_count: variants.length,
            total_variant_count: variantTotalCount,
          });
        } else {
        const { data: existingVariantRows, error: existingVariantError } = await supabase
          .from('product_variants')
          .select('id, stock_quantity')
          .eq('product_id', productId);
        if (existingVariantError) throw existingVariantError;

        const existingVariantMap = new Map<string, { id: string; stock_quantity: number | null }>();
        for (const row of (existingVariantRows || [])) {
          existingVariantMap.set(row.id, row);
        }

        const persistedVariantIdsByIndex = new Map<number, string>();
        const retainedVariantIds = new Set<string>();

        const isUnsafeEmptyVariantSave =
          Boolean(editingProduct) &&
          variants.length === 0 &&
          existingVariantMap.size > 0;

        if (isUnsafeEmptyVariantSave) {
          console.warn('[product-form] Variants payload empty on edit; preserving existing variants to avoid stock reset', {
            product_id: productId,
            existing_variant_count: existingVariantMap.size,
          });
        } else if (variants.length > 0) {
          for (let index = 0; index < variants.length; index++) {
            const v = variants[index];
            const normalizedSize = (v.size || '').trim();
            if (!normalizedSize) continue;

            const existingVariant = v.id ? existingVariantMap.get(v.id) : undefined;
            const parsedStock = Number(v.stock_quantity);
            const safeStock = Number.isFinite(parsedStock) && parsedStock >= 0
              ? Math.trunc(parsedStock)
              : Math.max(0, Math.trunc(existingVariant?.stock_quantity ?? 0));
            const parsedModifier = Number(v.price_modifier);
            const safeModifier = Number.isFinite(parsedModifier) ? parsedModifier : 0;

            const variantPayload = {
              product_id: productId,
              size: normalizedSize,
              color: v.color?.trim() ? v.color.trim() : null,
              color_hex: v.color_hex?.trim() ? v.color_hex.trim() : null,
              stock_quantity: safeStock,
              price_modifier: safeModifier,
              sku: v.sku?.trim() ? v.sku.trim() : null,
              is_active: v.is_active ?? true,
              custom_attribute_name: v.custom_attribute_name?.trim() ? v.custom_attribute_name.trim() : null,
              custom_attribute_value: v.custom_attribute_value?.trim() ? v.custom_attribute_value.trim() : null,
            };

            if (existingVariant) {
              const { error: updateVariantError } = await supabase
                .from('product_variants')
                .update(variantPayload)
                .eq('id', existingVariant.id)
                .eq('product_id', productId);
              if (updateVariantError) throw updateVariantError;
              retainedVariantIds.add(existingVariant.id);
              persistedVariantIdsByIndex.set(index, existingVariant.id);
              continue;
            }

            const { data: insertedVariant, error: insertVariantError } = await supabase
              .from('product_variants')
              .insert(variantPayload)
              .select('id')
              .single();
            if (insertVariantError) throw insertVariantError;
            if (insertedVariant?.id) {
              retainedVariantIds.add(insertedVariant.id);
              persistedVariantIdsByIndex.set(index, insertedVariant.id);
            }
          }

          const removedVariantIds = (existingVariantRows || [])
            .map((row) => row.id)
            .filter((id) => !retainedVariantIds.has(id));

          if (removedVariantIds.length > 0) {
            const existingCount = (existingVariantRows || []).length;
            const removedRatio = existingCount > 0 ? removedVariantIds.length / existingCount : 0;
            const shouldSkipBulkDeactivate = Boolean(editingProduct) && removedRatio > 0.5;
            if (shouldSkipBulkDeactivate) {
              console.warn('[product-form] High variant removal ratio detected; skipping auto-deactivation to prevent accidental stock loss', {
                product_id: productId,
                existing_variant_count: existingCount,
                incoming_variant_count: variants.length,
                would_remove_count: removedVariantIds.length,
              });
            } else {
              const { error: deactivateVariantsError } = await supabase
                .from('product_variants')
                .update({ is_active: false })
                .in('id', removedVariantIds)
                .eq('product_id', productId);
              if (deactivateVariantsError) throw deactivateVariantsError;
            }
          }
        }

        // Link variant images by persisted variant IDs.
        if (media.length > 0) {
          const { error: clearVariantImageLinksError } = await supabase
            .from('product_images')
            .update({ product_variant_id: null })
            .eq('product_id', productId);
          if (clearVariantImageLinksError) throw clearVariantImageLinksError;
        }
        for (let i = 0; i < variants.length; i++) {
          const imageUrl = variants[i].image_url;
          const variantId = persistedVariantIdsByIndex.get(i);
          if (!imageUrl || !variantId) continue;
          const { error: linkVariantImageError } = await supabase
            .from('product_images')
            .update({ product_variant_id: variantId })
            .eq('product_id', productId)
            .eq('url', imageUrl);
          if (linkVariantImageError) throw linkVariantImageError;
        }
        }

        const { error: deleteCharacteristicsError } = await supabase
          .from('product_characteristics')
          .delete()
          .eq('product_id', productId);
        if (deleteCharacteristicsError) throw deleteCharacteristicsError;
        if (characteristics.length > 0) {
          const charInserts = characteristics
            .filter(c => c.name && c.value)
            .map((c, i) => ({
              product_id: productId,
              name: c.name,
              value: c.value,
              display_order: i,
            }));
          if (charInserts.length > 0) {
            const { error: insertCharacteristicsError } = await supabase
              .from('product_characteristics')
              .insert(charInserts);
            if (insertCharacteristicsError) throw insertCharacteristicsError;
          }
        }

        const { error: deleteBuyTogetherError } = await supabase
          .from('buy_together_products')
          .delete()
          .eq('product_id', productId);
        if (deleteBuyTogetherError) throw deleteBuyTogetherError;
        if (buyTogetherItems.length > 0) {
          const btInserts = buyTogetherItems.map((bt, i) => ({
            product_id: productId,
            related_product_id: bt.product_id,
            discount_percent: bt.discount_percent,
            display_order: i,
            is_active: true,
          }));
          const { error: insertBuyTogetherError } = await supabase
            .from('buy_together_products')
            .insert(btInserts);
          if (insertBuyTogetherError) throw insertBuyTogetherError;
        }
      }

      await logAudit({
        action: editingProduct ? 'update' : 'create',
        resourceType: 'product',
        resourceId: String(productId),
        resourceName: data.name,
        correlationId,
      });

      return productId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      onOpenChange(false);
      toast({ title: editingProduct ? 'Produto atualizado!' : 'Produto criado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      submitLockRef.current = false;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    const parsed = productFormSchema.safeParse(formData);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = first.name?.[0] ?? first.base_price?.[0] ?? parsed.error.message;
      toast({ title: 'Verifique o formulário', description: msg, variant: 'destructive' });
      submitLockRef.current = false;
      return;
    }
    saveMutation.mutate(formData);
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setActiveTab(STEPS[next].key);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      setActiveTab(STEPS[prev].key);
    }
  };

  // --- Shared tab content ---
  const renderBasicContent = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Nome *</Label>
          <Input
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              setFormData(prev => ({ ...prev, name, slug }));
            }}
            required
          />
        </div>
        <div>
          <Label>Slug</Label>
          <Input
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="gerado-automaticamente"
          />
        </div>
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label>Preço Base *</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.base_price}
            onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Preço Promo</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.sale_price}
            onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
          />
        </div>
        <div>
          <Label>Custo</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>SKU</Label>
          <div className="flex gap-1">
            <Input
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-9 w-9"
              title="Gerar SKU"
              onClick={() => {
                if (formData.name.length > 2) {
                  setFormData(prev => ({ ...prev, sku: generateProductSku(prev.name) }));
                  toast({ title: 'SKU sugerido!' });
                } else {
                  toast({ title: 'Preencha o nome primeiro', variant: 'destructive' });
                }
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {formData.cost && parseFloat(formData.cost) > 0 && (
        <div className="rounded-lg border p-3 sm:p-4 bg-muted/50 space-y-2">
          <Label className="text-sm font-semibold">📊 Margem de Lucro</Label>
          {(() => {
            const cost = parseFloat(formData.cost);
            const sellPrice = formData.sale_price ? parseFloat(formData.sale_price) : (formData.base_price ? parseFloat(formData.base_price) : 0);
            if (!sellPrice || sellPrice <= 0) return <p className="text-sm text-muted-foreground">Preencha o preço para ver a margem.</p>;
            if (!storeSettings) return <p className="text-sm text-muted-foreground">Carregando config financeira...</p>;

            // Use Pricing Engine for all calculations
            const pricingConfig: import('@/lib/pricingEngine').PricingConfig = {
              id: '', is_active: true,
              max_installments: storeSettings.max_installments,
              interest_free_installments: storeSettings.installments_without_interest,
              card_cash_rate: storeSettings.card_cash_rate || 0,
              pix_discount: storeSettings.pix_discount,
              cash_discount: storeSettings.cash_discount,
              interest_mode: storeSettings.interest_mode || 'fixed',
              monthly_rate_fixed: storeSettings.monthly_rate_fixed || 0,
              monthly_rate_by_installment: storeSettings.monthly_rate_by_installment || {},
              min_installment_value: storeSettings.min_installment_value || 25,
              rounding_mode: 'adjust_last',
              transparent_checkout_fee_enabled: storeSettings.transparent_checkout_fee_enabled || false,
              transparent_checkout_fee_percent: storeSettings.transparent_checkout_fee_percent || 0,
              gateway_fee_1x_percent: (storeSettings as any).gateway_fee_1x_percent ?? 4.99,
              gateway_fee_additional_per_installment_percent: (storeSettings as any).gateway_fee_additional_per_installment_percent ?? 2.49,
              gateway_fee_starts_at_installment: (storeSettings as any).gateway_fee_starts_at_installment ?? 2,
              gateway_fee_mode: (storeSettings as any).gateway_fee_mode || 'linear_per_installment',
              pix_discount_applies_to_sale_products: (storeSettings as any).pix_discount_applies_to_sale_products ?? true,
            };

            const pixPrice = sellPrice * (1 - pricingConfig.pix_discount / 100);
            const pixResult = calculateNetProfit(pixPrice, cost, pricingConfig, 'pix');
            const cardResult = calculateNetProfit(sellPrice, cost, pricingConfig, 'card', 1);

            const feeLabel = pricingConfig.transparent_checkout_fee_enabled 
              ? `+ ${pricingConfig.transparent_checkout_fee_percent}% checkout` : '';
            const cardFeeLabel = pricingConfig.card_cash_rate > 0 
              ? `${pricingConfig.card_cash_rate}% gateway` : '0% gateway';

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">PIX ({pricingConfig.pix_discount}% desc. {feeLabel})</p>
                  <p className="text-sm">Venda: <strong>R$ {pixPrice.toFixed(2)}</strong></p>
                  <p className={`text-sm font-bold ${pixResult.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Lucro: R$ {pixResult.netProfit.toFixed(2)} ({pixResult.marginPercent.toFixed(1)}%)
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cartão 1x ({cardFeeLabel} {feeLabel})</p>
                  <p className="text-sm">Venda: <strong>R$ {sellPrice.toFixed(2)}</strong></p>
                  <p className={`text-sm font-bold ${cardResult.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Lucro: R$ {cardResult.netProfit.toFixed(2)} ({cardResult.marginPercent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Categoria</Label>
          <Select
            value={formData.category_id}
            onValueChange={(value) => setFormData({ ...formData, category_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Marca</Label>
          <Input
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            placeholder="Ex: Nike, Adidas"
          />
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label>Ativo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_featured}
            onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
          />
          <Label>Destaque</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_new}
            onCheckedChange={(checked) => setFormData({ ...formData, is_new: checked })}
          />
          <Label>Lançamento</Label>
        </div>
      </div>
    </div>
  );

  const renderMediaContent = () => (
    <ProductMediaUpload
      productId={editingProduct?.id}
      media={media}
      onChange={setMedia}
    />
  );

  const renderVariantsContent = () => (
    <PerfProfiler id="admin.product-form.variants" slowThresholdMs={12}>
      {variantEditorProtected ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Modo de proteção ativado para variantes</p>
          <p className="text-sm text-amber-900">
            Este produto possui {variantTotalCount} variantes. Para evitar travamento da página, o editor completo de variantes foi desativado nesta tela.
          </p>
          <p className="text-xs text-amber-800">
            Você ainda pode editar dados gerais do produto e salvar. Alterações de variantes ficam bloqueadas até reduzir o volume de variantes.
          </p>
        </div>
      ) : (
        <ProductVariantsManager
          variants={variants}
          onChange={setVariants}
          productId={editingProduct?.id}
          parentSku={formData.sku}
          parentWeight={formData.weight}
          parentWidth={formData.width}
          parentHeight={formData.height}
          parentDepth={formData.depth}
          parentBasePrice={formData.base_price}
          parentSalePrice={formData.sale_price}
          productImages={variantProductImages}
        />
      )}
    </PerfProfiler>
  );

  const renderShippingContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Dimensões & Peso</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label>Peso (kg)</Label>
            <Input type="number" step="0.01" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} placeholder="0.5" />
          </div>
          <div>
            <Label>Largura (cm)</Label>
            <Input type="number" step="0.1" value={formData.width} onChange={(e) => setFormData({ ...formData, width: e.target.value })} placeholder="20" />
          </div>
          <div>
            <Label>Altura (cm)</Label>
            <Input type="number" step="0.1" value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} placeholder="10" />
          </div>
          <div>
            <Label>Profund. (cm)</Label>
            <Input type="number" step="0.1" value={formData.depth} onChange={(e) => setFormData({ ...formData, depth: e.target.value })} placeholder="30" />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="font-medium mb-3">Google Merchant Center</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>GTIN / EAN</Label>
            <Input value={formData.gtin} onChange={(e) => setFormData({ ...formData, gtin: e.target.value })} placeholder="7891234567890" />
          </div>
          <div>
            <Label>MPN</Label>
            <Input value={formData.mpn} onChange={(e) => setFormData({ ...formData, mpn: e.target.value })} placeholder="ABC123" />
          </div>
          <div>
            <Label>Condição</Label>
            <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="refurbished">Recondicionado</SelectItem>
                <SelectItem value="used">Usado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria Google</Label>
            <Input value={formData.google_product_category} onChange={(e) => setFormData({ ...formData, google_product_category: e.target.value })} placeholder="Vestuário e acessórios > Sapatos" />
          </div>
          <div>
            <Label>Faixa Etária</Label>
            <Select value={formData.age_group} onValueChange={(value) => setFormData({ ...formData, age_group: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="adult">Adulto</SelectItem>
                <SelectItem value="kids">Infantil</SelectItem>
                <SelectItem value="toddler">Bebê</SelectItem>
                <SelectItem value="infant">Recém-nascido</SelectItem>
                <SelectItem value="newborn">Neonato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gênero</Label>
            <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Feminino</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="unisex">Unissex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Material</Label>
            <Input value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} placeholder="Couro, Camurça" />
          </div>
          <div>
            <Label>Padrão / Estampa</Label>
            <Input value={formData.pattern} onChange={(e) => setFormData({ ...formData, pattern: e.target.value })} placeholder="Liso, Listrado" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSEOContent = () => (
    <ProductSEOFields
      productData={{
        name: formData.name,
        description: formData.description,
        base_price: formData.base_price,
        sale_price: formData.sale_price,
        brand: formData.brand,
        category_name: selectedCategory?.name || '',
        material: formData.material,
      }}
      seoData={{
        seo_title: formData.seo_title,
        seo_description: formData.seo_description,
        seo_keywords: formData.seo_keywords,
      }}
      onChange={(seo) => setFormData({ ...formData, ...seo })}
    />
  );

  const renderCharacteristicsContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Características</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCharacteristics([...characteristics, { name: '', value: '' }])}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>
      {characteristics.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma característica. Clique em "Adicionar" para incluir Material, Solado, etc.
        </p>
      ) : (
        <div className="space-y-3">
          {characteristics.map((char, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  placeholder="Ex: Material"
                  value={char.name}
                  onChange={(e) => {
                    const updated = [...characteristics];
                    updated[index].name = e.target.value;
                    setCharacteristics(updated);
                  }}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Ex: Couro"
                  value={char.value}
                  onChange={(e) => {
                    const updated = [...characteristics];
                    updated[index].value = e.target.value;
                    setCharacteristics(updated);
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive flex-shrink-0"
                onClick={() => setCharacteristics(characteristics.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderBuyTogetherContent = () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium mb-2">Compre Junto</h3>
        <p className="text-sm text-muted-foreground mb-4">Selecione produtos para oferecer com desconto.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={buyTogetherSearch}
          onChange={(e) => setBuyTogetherSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      {buyTogetherSearch.length > 1 && (
        <div className="border rounded-lg max-h-40 overflow-y-auto">
          {buyTogetherSearchResults
            .map(p => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                onClick={() => {
                  setBuyTogetherItems([...buyTogetherItems, { product_id: p.id, discount_percent: 5 }]);
                  setBuyTogetherSearch('');
                }}
              >
                <span className="truncate mr-2">{p.name}</span>
                <Plus className="h-4 w-4 text-primary flex-shrink-0" />
              </button>
            ))}
        </div>
      )}
      {buyTogetherItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum produto adicionado ao "Compre Junto".
        </p>
      ) : (
        <div className="space-y-3">
          {buyTogetherItems.map((bt, index) => {
            const prod = allProductsById.get(bt.product_id);
            return (
              <div key={bt.product_id} className="flex gap-2 items-center border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{prod?.name || 'Não encontrado'}</p>
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={bt.discount_percent}
                    onChange={(e) => {
                      const updated = [...buyTogetherItems];
                      updated[index].discount_percent = Number(e.target.value);
                      setBuyTogetherItems(updated);
                    }}
                    className="text-center"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">% desc.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive flex-shrink-0"
                  onClick={() => setBuyTogetherItems(buyTogetherItems.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Only show history tab when editing
  const STEPS = editingProduct ? STEPS_BASE : STEPS_BASE.filter(s => s.key !== 'history');
  const activeStep = STEPS.find(s => s.key === activeTab) ?? STEPS[currentStep] ?? STEPS[0];
  const activeStepKey = activeStep?.key ?? 'basic';

  const renderStepContent = (stepKey: string) => {
    switch (stepKey) {
      case 'basic': return renderBasicContent();
      case 'media': return renderMediaContent();
      case 'variants': return renderVariantsContent();
      case 'characteristics': return renderCharacteristicsContent();
      case 'buy-together': return renderBuyTogetherContent();
      case 'shipping': return renderShippingContent();
      case 'seo': return renderSEOContent();
      case 'history': return editingProduct ? <ProductChangeLog productId={editingProduct.id} /> : null;
      default: return null;
    }
  };

  // --- Mobile stepper indicator ---
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={goPrev}
        disabled={currentStep === 0}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => { setCurrentStep(idx); setActiveTab(STEPS[idx].key); }}
              className={`h-2 rounded-full transition-all ${
                idx === currentStep
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {currentStep + 1}/{STEPS.length} — {STEPS[currentStep]?.label ?? activeStep.label}
        </span>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={goNext}
        disabled={currentStep === STEPS.length - 1}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  // --- Mobile footer with prev/next/save ---
  const renderMobileFooter = () => (
    <div className="flex items-center gap-2 p-3 border-t bg-background">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={goPrev}
        disabled={currentStep === 0}
        className="flex-1"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Anterior
      </Button>

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={saveMutation.isPending}
        className="shrink-0 px-3"
      >
        <Save className="h-4 w-4" />
      </Button>

      {currentStep < STEPS.length - 1 ? (
        <Button
          type="button"
          size="sm"
          onClick={goNext}
          className="flex-1"
        >
          Próximo
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="sm"
          disabled={saveMutation.isPending}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-1" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`p-0 flex flex-col ${isMobile ? 'max-w-[100vw] w-full h-[100dvh] max-h-[100dvh] rounded-none border-0 !left-0 !top-0 !translate-x-0 !translate-y-0 data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0' : 'max-w-4xl max-h-[95vh]'}`}>
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={`flex flex-col min-h-0 overflow-hidden ${isMobile ? 'flex-1' : ''}`}>
          {isMobile ? (
            <>
              {renderStepIndicator()}
              <div
                className="flex-1 overflow-y-auto overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="p-4 pb-6">
                  {renderStepContent(STEPS[currentStep]?.key ?? STEPS[0].key)}
                </div>
              </div>
              {renderMobileFooter()}
            </>
          ) : (
            <>
              <Tabs
                value={activeStepKey}
                onValueChange={(v) => {
                  setActiveTab(v);
                  const nextIndex = STEPS.findIndex(s => s.key === v);
                  if (nextIndex >= 0) {
                    setCurrentStep(nextIndex);
                  }
                }}
                className="w-full flex flex-col min-h-0"
              >
                <div className="px-6 flex-shrink-0">
                  <TabsList className={`grid w-full ${STEPS.length === 8 ? 'grid-cols-8' : 'grid-cols-7'}`}>
                    {STEPS.map(s => (
                      <TabsTrigger key={s.key} value={s.key} className="text-xs">{s.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div
                  className="flex-1 min-h-0 px-6 overflow-y-auto overscroll-contain touch-pan-y"
                  style={{ maxHeight: '60vh', WebkitOverflowScrolling: 'touch' }}
                >
                  <TabsContent key={activeStepKey} value={activeStepKey} forceMount className="mt-4 pb-6 focus-visible:outline-none">
                    {renderStepContent(activeStepKey)}
                  </TabsContent>
                </div>

              </Tabs>
              <div className="flex justify-end gap-2 p-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
