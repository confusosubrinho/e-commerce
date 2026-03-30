export type CouponLineItem = {
  product_id: string;
  category_id: string | null;
  brand: string | null;
  line_total: number;
  is_promotional?: boolean;
};

export type CouponValidationContext = {
  subtotal: number;
  shipping_cost: number;
  shipping_country?: string | null;
  shipping_state?: string | null;
  shipping_city?: string | null;
  shipping_zip?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_is_new?: boolean | null;
  now?: Date;
  line_items: CouponLineItem[];
  has_automatic_discount?: boolean;
};

export type CouponValidationErrorCode =
  | "COUPON_NOT_FOUND"
  | "COUPON_NOT_ACTIVE"
  | "COUPON_PAUSED"
  | "COUPON_EXPIRED"
  | "COUPON_NOT_STARTED"
  | "COUPON_USAGE_LIMIT_REACHED"
  | "COUPON_CUSTOMER_LIMIT_REACHED"
  | "COUPON_NOT_AVAILABLE_FOR_CUSTOMER"
  | "COUPON_MIN_SUBTOTAL"
  | "COUPON_MAX_SUBTOTAL"
  | "COUPON_REGION_NOT_ELIGIBLE"
  | "COUPON_PRODUCT_NOT_ELIGIBLE"
  | "COUPON_NOT_COMBINABLE"
  | "COUPON_INVALID_SCHEDULE"
  | "COUPON_INVALID";

export type CouponValidationResult = {
  ok: boolean;
  error_code: CouponValidationErrorCode | null;
  error_message: string | null;
  discount_amount: number;
  free_shipping: boolean;
  applicable_subtotal: number;
  applied_rules: string[];
};

const DEFAULT_MESSAGES: Record<CouponValidationErrorCode, string> = {
  COUPON_NOT_FOUND: "cupom não encontrado",
  COUPON_NOT_ACTIVE: "cupom não está ativo",
  COUPON_PAUSED: "cupom pausado",
  COUPON_EXPIRED: "cupom expirado",
  COUPON_NOT_STARTED: "cupom ainda não iniciou",
  COUPON_USAGE_LIMIT_REACHED: "limite de uso atingido",
  COUPON_CUSTOMER_LIMIT_REACHED: "limite de uso por cliente atingido",
  COUPON_NOT_AVAILABLE_FOR_CUSTOMER: "cupom não disponível para este cliente",
  COUPON_MIN_SUBTOTAL: "subtotal abaixo do mínimo",
  COUPON_MAX_SUBTOTAL: "subtotal acima do máximo",
  COUPON_REGION_NOT_ELIGIBLE: "região não elegível",
  COUPON_PRODUCT_NOT_ELIGIBLE: "produto não elegível",
  COUPON_NOT_COMBINABLE: "cupom não cumulativo",
  COUPON_INVALID_SCHEDULE: "cupom fora da janela de horário",
  COUPON_INVALID: "cupom inválido",
};

function fail(code: CouponValidationErrorCode): CouponValidationResult {
  return {
    ok: false,
    error_code: code,
    error_message: DEFAULT_MESSAGES[code],
    discount_amount: 0,
    free_shipping: false,
    applicable_subtotal: 0,
    applied_rules: [],
  };
}

function toArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function parseZip(zip: string | null | undefined): string {
  return String(zip || "").replace(/\D/g, "");
}

export function validateCouponAgainstContext(
  coupon: Record<string, unknown> | null,
  context: CouponValidationContext,
): CouponValidationResult {
  if (!coupon) return fail("COUPON_NOT_FOUND");

  const now = context.now ?? new Date();
  const status = String(coupon.status ?? "").toLowerCase();
  const isActive = coupon.is_active !== false;

  if (status === "paused") return fail("COUPON_PAUSED");
  if (!isActive || status === "draft") return fail("COUPON_NOT_ACTIVE");

  const startAt = coupon.start_at ? new Date(String(coupon.start_at)) : null;
  if (startAt && startAt.getTime() > now.getTime()) return fail("COUPON_NOT_STARTED");

  const endAtRaw = coupon.end_at ?? coupon.expiry_date;
  const endAt = endAtRaw ? new Date(String(endAtRaw)) : null;
  if (endAt && endAt.getTime() < now.getTime()) return fail("COUPON_EXPIRED");

  const maxUses = Number(coupon.max_uses ?? 0);
  const usesCount = Number(coupon.uses_count ?? 0);
  if (maxUses > 0 && usesCount >= maxUses) return fail("COUPON_USAGE_LIMIT_REACHED");

  const minSubtotal = Number(coupon.min_purchase_amount ?? 0);
  if (minSubtotal > 0 && context.subtotal < minSubtotal) return fail("COUPON_MIN_SUBTOTAL");

  const maxSubtotal = Number(coupon.max_purchase_amount ?? 0);
  if (maxSubtotal > 0 && context.subtotal > maxSubtotal) return fail("COUPON_MAX_SUBTOTAL");

  if (context.has_automatic_discount && coupon.allow_auto_promotions === false) {
    return fail("COUPON_NOT_COMBINABLE");
  }

  const allowedStates = toArray(coupon.applicable_states);
  if (allowedStates.length > 0) {
    const state = String(context.shipping_state || "").trim().toUpperCase().slice(0, 2);
    const ok = state && allowedStates.some((s) => s.toUpperCase().slice(0, 2) === state);
    if (!ok) return fail("COUPON_REGION_NOT_ELIGIBLE");
  }

  const allowedCities = toArray(coupon.applicable_cities);
  if (allowedCities.length > 0) {
    const city = String(context.shipping_city || "").trim().toLowerCase();
    const ok = city && allowedCities.some((c) => c.trim().toLowerCase() === city);
    if (!ok) return fail("COUPON_REGION_NOT_ELIGIBLE");
  }

  const zip = parseZip(context.shipping_zip);
  const zipPrefixes = toArray(coupon.applicable_zip_prefixes);
  if (zipPrefixes.length > 0) {
    const ok = zip && zipPrefixes.some((prefix) => zip.startsWith(parseZip(prefix)));
    if (!ok) return fail("COUPON_REGION_NOT_ELIGIBLE");
  }

  const zipRanges = (Array.isArray(coupon.applicable_zip_ranges) ? coupon.applicable_zip_ranges : []) as Array<Record<string, unknown>>;
  if (zipRanges.length > 0) {
    const zipNum = Number(zip);
    const ok = Number.isFinite(zipNum) && zipRanges.some((entry) => {
      const from = Number(parseZip(String(entry.from || "")));
      const to = Number(parseZip(String(entry.to || "")));
      return Number.isFinite(from) && Number.isFinite(to) && zipNum >= from && zipNum <= to;
    });
    if (!ok) return fail("COUPON_REGION_NOT_ELIGIBLE");
  }

  const includedProducts = new Set(toArray(coupon.applicable_product_ids));
  const excludedProducts = new Set(toArray(coupon.excluded_product_ids));
  const includedCategoryList = Array.isArray(coupon.applicable_category_ids)
    ? coupon.applicable_category_ids
    : (coupon.applicable_category_id ? [coupon.applicable_category_id] : []);
  const includedCategories = new Set(toArray(includedCategoryList));
  const excludedCategories = new Set(toArray(coupon.excluded_category_ids));
  const includedBrands = new Set(toArray(coupon.applicable_brand_names));

  let applicableSubtotal = 0;
  for (const item of context.line_items) {
    if (excludedProducts.has(item.product_id)) continue;
    if (item.category_id && excludedCategories.has(item.category_id)) continue;

    if (includedProducts.size > 0 && !includedProducts.has(item.product_id)) continue;
    if (includedCategories.size > 0 && (!item.category_id || !includedCategories.has(item.category_id))) continue;
    if (includedBrands.size > 0 && (!item.brand || !includedBrands.has(item.brand))) continue;

    if (coupon.only_promotional_items === true && item.is_promotional !== true) continue;
    if (coupon.only_non_promotional_items === true && item.is_promotional === true) continue;

    applicableSubtotal += Number(item.line_total || 0);
  }

  if (context.line_items.length > 0 && applicableSubtotal <= 0) return fail("COUPON_PRODUCT_NOT_ELIGIBLE");

  const discountKind = String(coupon.discount_kind ?? coupon.type ?? "").toLowerCase();
  const discountType = String(coupon.discount_type ?? "").toLowerCase();
  const discountValue = Number(coupon.discount_value ?? 0);

  let discountAmount = 0;
  const effectiveSubtotal = applicableSubtotal > 0 ? applicableSubtotal : context.subtotal;

  if (discountKind === "free_shipping" || discountKind === "shipping") {
    discountAmount = Math.max(0, Number(context.shipping_cost || 0));
  } else if (discountType === "percentage") {
    discountAmount = (effectiveSubtotal * discountValue) / 100;
  } else {
    discountAmount = discountValue;
  }

  discountAmount = Math.max(0, Math.min(effectiveSubtotal, discountAmount));

  return {
    ok: true,
    error_code: null,
    error_message: null,
    discount_amount: discountAmount,
    free_shipping: discountKind === "free_shipping" || discountKind === "shipping",
    applicable_subtotal: effectiveSubtotal,
    applied_rules: [
      minSubtotal > 0 ? "min_purchase_amount" : "",
      maxSubtotal > 0 ? "max_purchase_amount" : "",
      allowedStates.length > 0 || allowedCities.length > 0 || zipPrefixes.length > 0 || zipRanges.length > 0 ? "region" : "",
      includedProducts.size > 0 || includedCategories.size > 0 || includedBrands.size > 0 ? "catalog_scope" : "",
    ].filter(Boolean),
  };
}
