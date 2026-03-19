/**
 * Checkout/estoque invariantes — health check por `order_id`.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-order-invariants.mjs --order_id <uuid>
 *
 * Objetivo:
 *   Validar, para o pedido escolhido, se o estado do `orders.status` está compatível com
 *   os movimentos de estoque em `inventory_movements` (reserve/debit/release/refund).
 *
 * Observação:
 *   Este script faz checagens "operacionais" (alta sinalização), sem depender de informações
 *   externas. Em cenários complexos (ex: múltiplas tentativas), ele reporta avisos e erros.
 */

import { createClient } from "@supabase/supabase-js";

function getArg(name) {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function normalizeNumber(n) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function classifyOrderStatus(status) {
  const s = status ?? "";
  if (s === "paid") return "paid";
  if (s === "pending" || s === "processing") return "in_flight";
  if (s === "failed") return "failed";
  if (s === "cancelled") return "cancelled";
  return "unknown";
}

function ok(condition, msg) {
  return condition ? null : msg;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orderId = getArg("order_id") || process.env.ORDER_ID;

  if (!url || !key) {
    console.error("Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!orderId) {
    console.error("Defina --order_id <uuid> (ou env ORDER_ID).");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id,status,provider,gateway,tenant_id,transaction_id,last_webhook_event")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    console.error("Pedido não encontrado/erro:", orderErr?.message || "unknown");
    process.exit(1);
  }

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("product_variant_id,quantity")
    .eq("order_id", orderId);

  if (itemsErr) {
    console.error("Erro ao buscar order_items:", itemsErr.message);
    process.exit(1);
  }

  const { data: moves, error: movesErr } = await supabase
    .from("inventory_movements")
    .select("variant_id,type,quantity")
    .eq("order_id", orderId);

  if (movesErr) {
    console.error("Erro ao buscar inventory_movements:", movesErr.message);
    process.exit(1);
  }

  const statusClass = classifyOrderStatus(order.status);
  const isStripe = order.provider === "stripe" || order.gateway === "stripe";
  const isYampi = order.provider === "yampi";

  const byVariant = new Map();
  for (const it of items || []) {
    if (!it.product_variant_id) continue;
    byVariant.set(it.product_variant_id, {
      expectedQty: normalizeNumber(it.quantity),
      reserveQty: 0,
      reserveRows: 0,
      debitQty: 0,
      debitRows: 0,
      releaseQty: 0,
      releaseRows: 0,
      refundQty: 0,
      refundRows: 0,
    });
  }

  for (const mv of moves || []) {
    const variantId = mv.variant_id;
    if (!variantId) continue;
    if (!byVariant.has(variantId)) continue; // movimento para variante não esperada (ignora)
    const bucket = byVariant.get(variantId);
    const q = normalizeNumber(mv.quantity);
    const t = mv.type;

    if (t === "reserve") {
      bucket.reserveQty += q;
      bucket.reserveRows += 1;
    } else if (t === "debit") {
      bucket.debitQty += q;
      bucket.debitRows += 1;
    } else if (t === "release") {
      bucket.releaseQty += q;
      bucket.releaseRows += 1;
    } else if (t === "refund") {
      bucket.refundQty += q;
      bucket.refundRows += 1;
    }
  }

  const errors = [];
  const warnings = [];

  for (const [variantId, b] of byVariant.entries()) {
    const qty = b.expectedQty;
    const releasedOrRefundedQty = b.releaseQty + b.refundQty;
    const debitedOrReservedQty = b.debitQty + b.reserveQty;

    if (qty <= 0) continue;

    // 1) Pedido "pago" não deve ter release/refund
    if (statusClass === "paid") {
      const err1 = ok(releasedOrRefundedQty === 0, `variant=${variantId}: esperado 0 (release+refund) em paid, mas release/refund=${releasedOrRefundedQty}`);
      if (err1) errors.push(err1);

      const err2 = ok(b.reserveQty >= qty || b.debitQty >= qty, `variant=${variantId}: esperado reserve>=${qty} (ou debit>=${qty}) em paid. reserve=${b.reserveQty}, debit=${b.debitQty}`);
      if (err2) errors.push(err2);
    }

    // 2) Pedido "em andamento": não deve ter release/refund ainda
    if (statusClass === "in_flight") {
      const err3 = ok(releasedOrRefundedQty === 0, `variant=${variantId}: pedido ${order.status} deveria não ter release/refund, mas release/refund=${releasedOrRefundedQty}`);
      if (err3) errors.push(err3);

      const warn1 = releasedOrRefundedQty > 0 ? true : false;
      if (warn1) warnings.push(`variant=${variantId}: há liberação/refund enquanto status é ${order.status}.`);
    }

    // 3) Pedido "failed/cancelled": deve ter release ou refund >= qty
    if (statusClass === "failed" || statusClass === "cancelled") {
      const err4 = ok(releasedOrRefundedQty >= qty, `variant=${variantId}: pedido ${order.status} deveria liberar estoque (release+refund)>=${qty}, mas foi ${releasedOrRefundedQty}`);
      if (err4) errors.push(err4);
    }

    // 4) Anti-double movements (heurística)
    // Stripe normalmente usa reserve/refund/release (sem debit). Yampi tende a usar reserve->debit e também reserve/debit.
    if (isStripe) {
      if (b.reserveRows > 1) {
        warnings.push(`variant=${variantId}: stripe com reserveRows=${b.reserveRows} (possível re-init/débito duplicado).`);
      }
      if (b.debitQty > 0) {
        warnings.push(`variant=${variantId}: stripe com debitQty=${b.debitQty} (não esperado; ver modelagem do seu estoque).`);
      }
    }

    if (isYampi) {
      if (statusClass === "in_flight" || statusClass === "paid") {
        const err5 = ok(b.debitQty >= qty || b.reserveQty >= qty, `variant=${variantId}: yampi em estado ${order.status} deveria ter debit>=${qty} (ou ao menos reserve). debit=${b.debitQty}, reserve=${b.reserveQty}`);
        if (err5) warnings.push(err5);

        if (b.reserveQty > 0 && b.debitQty > 0) {
          warnings.push(`variant=${variantId}: yampi com reserve e debit ao mesmo tempo (pode ser histórico, mas verifique conversão reserve->debit).`);
        }
      }
    }

    // 5) Quantidade "maior que esperado" (forte sinal de duplicidade)
    if (debitedOrReservedQty > qty * 1.25) {
      warnings.push(`variant=${variantId}: debit+reserve=${debitedOrReservedQty} > esperado*1.25 (${qty * 1.25}).`);
    }
  }

  // Output report
  const summary = {
    order: {
      id: order.id,
      status: order.status,
      provider: order.provider,
      gateway: order.gateway,
      tenant_id: order.tenant_id,
      transaction_id: order.transaction_id,
      last_webhook_event: order.last_webhook_event,
    },
    statusClass,
    checks: {
      errorsCount: errors.length,
      warningsCount: warnings.length,
    },
    errors,
    warnings,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("check-order-invariants falhou:", e);
  process.exit(1);
});

