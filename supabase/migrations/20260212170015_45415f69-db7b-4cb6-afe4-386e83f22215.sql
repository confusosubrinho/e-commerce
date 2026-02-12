
-- Product change log for audit/history
CREATE TABLE public.product_change_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  change_type text NOT NULL DEFAULT 'update', -- 'update', 'bulk_update', 'create', 'delete', 'activate', 'deactivate'
  bulk_edit_id uuid, -- groups changes from same bulk operation
  fields_changed text[] NOT NULL DEFAULT '{}',
  before_data jsonb,
  after_data jsonb,
  notes text
);

ALTER TABLE public.product_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage change log" ON public.product_change_log FOR ALL USING (is_admin());

CREATE INDEX idx_product_change_log_product ON public.product_change_log(product_id);
CREATE INDEX idx_product_change_log_bulk ON public.product_change_log(bulk_edit_id) WHERE bulk_edit_id IS NOT NULL;
CREATE INDEX idx_product_change_log_date ON public.product_change_log(changed_at DESC);

-- Add bling sync status fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bling_last_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS bling_sync_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS bling_last_error text;
