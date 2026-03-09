

# Enrich Customer Detail Panel

## Current State
The customer detail dialog (`Customers.tsx` lines 622-661) shows only: name, email, phone, total orders, and total spent. No address, no purchase history, no action buttons.

The `customers` table has: `id`, `email`, `full_name`, `phone`, `birthday`, `total_orders`, `total_spent`, `user_id`.

Address data lives on `orders` (shipping_address, shipping_city, shipping_state, shipping_zip). Products purchased live on `order_items` joined via `orders.customer_id`.

## Plan

### 1. Fetch related data when customer dialog opens
When `selectedCustomer` is set, run two additional queries:
- **Orders**: `orders` where `customer_id = selectedCustomer.id`, select key fields + `order_items(product_name, quantity, unit_price, image_snapshot, variant_info)`. Limited to last 20 orders, ordered by date desc.
- **Address**: Extract from the most recent order's shipping fields (no separate address table exists).

Use a `useQuery` with `enabled: !!selectedCustomer` so it only fires when the dialog opens.

### 2. Expand the detail dialog to a larger sheet/dialog with sections

**Customer Info Section** (editable):
- Name, email, phone, birthday (with inline edit capability via a pencil/edit button)
- Last known address (from most recent order)

**Stats Section**:
- Total orders, total spent, average ticket (total_spent / total_orders)
- First and last purchase dates

**Action Buttons Row**:
- **WhatsApp**: green button → `wa.me/{phone}?text=Olá {name}!` (using `getWhatsAppNumber`)
- **Email**: button → `mailto:{email}`
- **Edit**: toggle inline editing of name/phone/birthday

**Purchase History Section**:
- Scrollable list of recent orders with: date, order number, status badge, total, and nested product names with quantities
- Each order links to `/admin/pedidos` (or opens order detail)

### 3. Edit functionality
- `useMutation` to update `customers` table (name, phone, birthday)
- Save button appears when editing, with `disabled={mutation.isPending}` for double-click protection

### 4. Update Customer type
Add `birthday` to the `Customer` interface in `types/database.ts` (it exists in the DB but is missing from the type).

## Files Modified
- `src/types/database.ts` — add `birthday` field to Customer interface
- `src/pages/admin/Customers.tsx` — expand detail dialog with orders query, address, action buttons, edit form, purchase history

