import fs from 'node:fs';
function edit(file, transform) { const old=fs.readFileSync(file,'utf8'); fs.writeFileSync(file,transform(old)); }
edit('src/pages/MyAccount.tsx', code=>code
  .replace(/  const \{ data: orders \} = useQuery\(\{[\s\S]*?\r?\n  \}\);\r?\n/, '')
  .replace(/\s*<TabsTrigger value="orders"[\s\S]*?<\/TabsTrigger>/, '')
  .replace(/\s*<TabsContent value="orders">[\s\S]*?<\/TabsContent>/, '')
  .replace('grid-cols-3 mb-6','grid-cols-2 mb-6'));
edit('src/pages/ProductDetail.tsx',code=>code
  .replace(/import \{ ProductReviews \}[^\n]*\n/, '')
  .replace(/\s*<FadeInOnScroll>\s*<div className="container-custom pb-12">\s*<ProductReviews[^\n]*\s*<\/div>\s*<\/FadeInOnScroll>/, ''));
edit('src/App.tsx',code=>code
  .replace(/const OrderConfirmation =[^\n]*\n/, '')
  .replaceAll('element={<OrderConfirmation />}','element={<Navigate to="/rastreio" replace />}'));
