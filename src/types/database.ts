 // Custom types for our e-commerce
 export interface Category {
   id: string;
   name: string;
   slug: string;
   description: string | null;
   image_url: string | null;
   display_order: number;
   is_active: boolean;
   created_at: string;
   updated_at: string;
 }
 
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  sale_price: number | null;
  cost: number | null;
  sku: string | null;
  category_id: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  created_at: string;
  updated_at: string;
  // Google Merchant Center & Shipping fields
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  gtin: string | null;
  mpn: string | null;
  brand: string | null;
  condition: string | null;
  google_product_category: string | null;
  age_group: string | null;
  gender: string | null;
  material: string | null;
  pattern: string | null;
  // SEO fields
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  // Bling integration (admin)
  bling_product_id?: number | null;
  bling_sync_status?: string | null;
  bling_last_synced_at?: string | null;
  bling_last_error?: string | null;
  // Relations
  category?: Category | { id: string; name: string; slug?: string };
  images?: ProductImage[];
  variants?: ProductVariant[];
}
 
 export interface ProductImage {
   id: string;
   product_id: string;
   url: string;
   alt_text: string | null;
   display_order: number;
   is_primary: boolean;
   product_variant_id?: string | null;
   created_at: string;
   media_type?: string;
 }
 
 export interface ProductVariant {
   id: string;
   product_id: string;
   size: string;
   color: string | null;
   color_hex: string | null;
   stock_quantity: number;
   price_modifier: number;
   base_price: number | null;
   sale_price: number | null;
   sku: string | null;
   is_active: boolean;
   created_at: string;
   custom_attribute_name?: string | null;
   custom_attribute_value?: string | null;
   bling_variant_id?: number | null;
 }
 
export interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  mobile_image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
 
 export interface Coupon {
   id: string;
   code: string;
   name?: string | null;
   status?: 'draft' | 'active' | 'paused' | 'expired' | 'exhausted' | null;
   discount_kind?: 'order_discount' | 'free_shipping' | 'hybrid' | null;
   discount_type: 'percentage' | 'fixed';
   discount_value: number;
   min_purchase_amount: number;
   max_purchase_amount?: number | null;
   max_uses: number | null;
   usage_per_customer?: number | null;
   uses_count: number;
   expiry_date: string | null;
   start_at?: string | null;
   end_at?: string | null;
   is_active: boolean;
   type?: 'standard' | 'free_shipping' | 'first_purchase' | null;
   campaign_tag?: string | null;
   internal_note?: string | null;
   applicable_category_id?: string | null;
   applicable_category_ids?: string[] | null;
   applicable_product_ids?: string[] | null;
   excluded_product_ids?: string[] | null;
   excluded_category_ids?: string[] | null;
   applicable_brand_names?: string[] | null;
   applicable_states?: string[] | null;
   applicable_cities?: string[] | null;
   applicable_zip_prefixes?: string[] | null;
   allow_coupon_stack?: boolean;
   allow_auto_promotions?: boolean;
   created_at: string;
   updated_at: string;
 }
 
  export interface Customer {
    id: string;
    user_id: string | null;
    email: string;
    full_name: string;
    phone: string | null;
    birthday: string | null;
    total_orders: number;
    total_spent: number;
    created_at: string;
    updated_at: string;
  }
 
 export interface Order {
   id: string;
   order_number: string;
   customer_id: string | null;
   user_id: string | null;
   subtotal: number;
   shipping_cost: number;
   discount_amount: number;
   total_amount: number;
   status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
   shipping_name: string;
   shipping_address: string;
   shipping_city: string;
   shipping_state: string;
   shipping_zip: string;
   shipping_phone: string | null;
   shipping_method?: string | null;
   tracking_code: string | null;
   coupon_code: string | null;
   notes: string | null;
  payment_method?: string | null;
  gateway?: string | null;
  payment_status?: string | null;
  installments?: number | null;
  created_at: string;
  updated_at: string;
  yampi_created_at?: string | null;
  yampi_order_number?: string | null;
  items?: OrderItem[];
  customer?: Customer;
}
 
 export interface OrderItem {
   id: string;
   order_id: string;
   product_id: string | null;
   product_variant_id: string | null;
   product_name: string;
   variant_info: string | null;
   quantity: number;
   unit_price: number;
   total_price: number;
   title_snapshot?: string | null;
   image_snapshot?: string | null;
   sku_snapshot?: string | null;
   created_at: string;
 }
 
  export interface StoreSettings {
    id: string;
    store_name: string | null;
    logo_url: string | null;
    header_logo_url?: string | null;
    favicon_url?: string | null;
    show_variants_on_grid?: boolean;
    contact_email: string | null;
    contact_phone: string | null;
    contact_whatsapp: string | null;
    address: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    free_shipping_threshold: number | null;
    max_installments?: number | null;
    pix_discount: number | null;
    installments_without_interest: number | null;
    installment_interest_rate: number | null;
    min_installment_value: number | null;
    head_code?: string | null;
    body_code?: string | null;
    google_analytics_id?: string | null;
    facebook_pixel_id?: string | null;
    tiktok_pixel_id?: string | null;
    public_base_url?: string | null;
    appmax_callback_path?: string | null;
    bling_access_token?: string | null;
    app_version?: string | null;
    melhor_envio_token?: string | null;
    melhor_envio_sandbox?: boolean | null;
    shipping_store_pickup_enabled?: boolean | null;
    shipping_store_pickup_label?: string | null;
    shipping_store_pickup_address?: string | null;
    shipping_free_enabled?: boolean | null;
    shipping_free_label?: string | null;
    shipping_free_min_value?: number | null;
    shipping_regions?: unknown;
    shipping_allowed_services?: unknown;
    created_at?: string;
    updated_at?: string;
  }
 
 export interface CartItem {
   product: Product;
   variant: ProductVariant;
   quantity: number;
 }
 
export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string | null;
  customer_name: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}
 
 export interface ShippingOption {
   id: string;
   name: string;
   price: number;
   deadline: string;
   company: string;
 }