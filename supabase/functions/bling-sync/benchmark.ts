const products = Array.from({length: 1000}, (_, i) => ({
    id: `prod_${i}`,
    name: "Tamanho: M",
    bling_product_id: `bling_${i}`
}));

let calls = 0;

const mockSupabase = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => { calls++; return { data: { id: "test" } }; }
      }),
      in: (column, list) => {
        calls++;
        // Mock returning all requested ids as matched
        return { data: list.map(id => ({ [column]: id })) };
      }
    }),
    delete: () => ({
      eq: async () => { calls++; return { data: null }; },
      in: async () => { calls++; return { data: null }; }
    })
  })
};

async function testOld(variationProducts) {
  calls = 0;
  let cleanedCount = 0;
  for (const prod of (variationProducts || [])) {
    const { data: existsAsVariant } = await mockSupabase.from("product_variants").select("id").eq("bling_variant_id", prod.bling_product_id).maybeSingle();
    if (existsAsVariant) {
      await mockSupabase.from("product_images").delete().eq("product_id", prod.id);
      await mockSupabase.from("product_variants").delete().eq("product_id", prod.id);
      await mockSupabase.from("product_characteristics").delete().eq("product_id", prod.id);
      await mockSupabase.from("buy_together_products").delete().eq("product_id", prod.id);
      await mockSupabase.from("buy_together_products").delete().eq("related_product_id", prod.id);
      await mockSupabase.from("products").delete().eq("id", prod.id);
      cleanedCount++;
    }
  }
  return calls;
}

async function testNew(variationProducts) {
  calls = 0;
  let cleanedCount = 0;
  const productIdsToDelete: string[] = [];

  if (variationProducts && variationProducts.length > 0) {
      const CHUNK_SIZE = 100;

      for (let i = 0; i < variationProducts.length; i += CHUNK_SIZE) {
        const chunk = variationProducts.slice(i, i + CHUNK_SIZE);
        const blingIds = chunk.map(p => p.bling_product_id).filter(Boolean);

        let existingBlingIds = new Set<string>();
        if (blingIds.length > 0) {
          const { data: existingVariants } = await mockSupabase
            .from("product_variants")
            .select("bling_variant_id")
            .in("bling_variant_id", blingIds);

          if (existingVariants) {
            existingBlingIds = new Set(existingVariants.map(v => v.bling_variant_id));
          }
        }

        const chunkIdsToDelete = chunk
          .filter(p => existingBlingIds.has(p.bling_product_id))
          .map(p => p.id);

        if (chunkIdsToDelete.length > 0) {
          productIdsToDelete.push(...chunkIdsToDelete);
        }
      }

      for (let i = 0; i < productIdsToDelete.length; i += CHUNK_SIZE) {
        const chunkIds = productIdsToDelete.slice(i, i + CHUNK_SIZE);

        await Promise.all([
          mockSupabase.from("product_images").delete().in("product_id", chunkIds),
          mockSupabase.from("product_variants").delete().in("product_id", chunkIds),
          mockSupabase.from("product_characteristics").delete().in("product_id", chunkIds),
          mockSupabase.from("buy_together_products").delete().in("product_id", chunkIds),
          mockSupabase.from("buy_together_products").delete().in("related_product_id", chunkIds),
        ]);
        await mockSupabase.from("products").delete().in("id", chunkIds);

        cleanedCount += chunkIds.length;
      }
  }

  return calls;
}

async function run() {
  console.log("Benchmarking 1000 items:");

  console.time('Old Method (Individual loops)');
  const oldCalls = await testOld(products);
  console.timeEnd('Old Method (Individual loops)');

  console.time('New Method (Batched queries)');
  const newCalls = await testNew(products);
  console.timeEnd('New Method (Batched queries)');

  console.log(`\nResults:`);
  console.log(`Old method queries: ${oldCalls}`);
  console.log(`New method queries: ${newCalls}`);
  console.log(`Reduction in database queries: ${((oldCalls - newCalls) / oldCalls * 100).toFixed(2)}%`);
}

run();
