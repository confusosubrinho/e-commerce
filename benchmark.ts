import { test, expect } from "bun:test";

const mockOrderList = Array.from({ length: 50 }, (_, i) => ({
  id: `order_${i}`,
  provider: "stripe",
  transaction_id: `txn_${i}`
}));

const mockItems = mockOrderList.flatMap(o => [
  { order_id: o.id, product_variant_id: "v1", quantity: 1 },
  { order_id: o.id, product_variant_id: "v2", quantity: 2 },
]);

const supabase = {
  from: (table: string) => ({
    select: (fields: string) => ({
      eq: async (field: string, val: string) => {
        // simulate 10ms network latency
        await new Promise(r => setTimeout(r, 10));
        return { data: mockItems.filter(i => i.order_id === val) };
      },
      in: async (field: string, vals: string[]) => {
        // simulate 15ms network latency
        await new Promise(r => setTimeout(r, 15));
        return { data: mockItems.filter(i => vals.includes(i.order_id)) };
      }
    })
  })
};

async function beforeOptimization() {
  const start = performance.now();
  for (const order of mockOrderList) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_variant_id, quantity")
      .eq("order_id", order.id);
  }
  return performance.now() - start;
}

async function afterOptimization() {
  const start = performance.now();
  const orderIds = mockOrderList.map(o => o.id);
  let allOrderItems: any[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, product_variant_id, quantity")
      .in("order_id", orderIds);
    allOrderItems = items || [];
  }

  for (const order of mockOrderList) {
    const items = allOrderItems.filter(i => i.order_id === order.id);
  }
  return performance.now() - start;
}

async function run() {
  const t1 = await beforeOptimization();
  console.log("Before:", t1, "ms");
  const t2 = await afterOptimization();
  console.log("After:", t2, "ms");
}

run();
