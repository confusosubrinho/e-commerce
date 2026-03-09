

# Plano: Variantes Personalizáveis (Custom Variants)

## Resumo

Adicionar suporte a variantes personalizáveis além de "Tamanho" e "Cor", permitindo que o admin defina o **nome do tipo de variação** (ex: "Material", "Estampa", "Acabamento") e suas **opções**.

---

## Mudanças Necessárias

### 1. Banco de Dados (Migration)

**Adicionar colunas na tabela `product_variants`:**

```sql
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS custom_attribute_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_attribute_value text DEFAULT NULL;
```

- `custom_attribute_name`: Nome do atributo personalizado (ex: "Material", "Estampa")
- `custom_attribute_value`: Valor selecionado (ex: "Couro", "Listrado")

---

### 2. Admin - ProductVariantsManager

**Modificações:**
- Adicionar campos para **Nome do atributo personalizado** e **Valor do atributo**
- No form de adição em lote: campo opcional "Atributo Personalizado" com nome e valores separados por vírgula
- No dialog de edição individual: campos para nome/valor do atributo
- Atualizar geração de SKU para incluir atributo custom

**Interface:**
```
┌─────────────────────────────────────────┐
│  Adicionar variantes em lote            │
├─────────────────────────────────────────┤
│  Tamanhos: [34, 35, 36___________]      │
│  Cor: [Preto ▼]                         │
│  ─────────────────────────────────      │
│  Atributo Personalizado (opcional)      │
│  Nome: [Material___________________]    │
│  Valores: [Couro, Sintético________]    │
│  ─────────────────────────────────      │
│  Estoque: [10]                          │
│  [ + Adicionar ]                        │
└─────────────────────────────────────────┘
```

---

### 3. Admin - ProductFormDialog

- Passar as novas props para `ProductVariantsManager`
- Salvar `custom_attribute_name` e `custom_attribute_value` junto com as variantes

---

### 4. Interface de Variantes (Admin)

**Lista de variantes exibirá:**
- Tamanho | Cor | Atributo Custom | Estoque | SKU

**Dialog de edição mostrará:**
- Campo texto "Nome do Atributo" 
- Campo texto "Valor do Atributo"

---

### 5. Loja - ProductDetail

**Mudanças na seleção de variantes:**
- Extrair atributos custom únicos das variantes
- Renderizar seletor adicional quando existir atributo personalizado
- Filtrar variantes por: cor → tamanho → atributo custom

**Exemplo visual:**
```
Cor: ⚫ ⚪ 🔵
Tamanho: [34] [35] [36] [37]
Material: [Couro] [Sintético] [Camurça]
```

---

### 6. Carrinho e Pedidos

- `variant_info` já existe e será atualizado para incluir o atributo custom
- Formato: `"Tam. 36 - Preto - Material: Couro"`

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `migration` (novo) | Adicionar colunas custom |
| `ProductVariantsManager.tsx` | Campos de atributo personalizado |
| `ProductFormDialog.tsx` | Passar/salvar atributo custom |
| `ProductDetail.tsx` | Seletor de atributo custom |
| `CartContext.tsx` | Incluir atributo custom no variant_info |

---

## Detalhes Técnicos

### VariantItem (interface)
```typescript
interface VariantItem {
  // ... existentes
  custom_attribute_name?: string;
  custom_attribute_value?: string;
}
```

### Geração de SKU
```typescript
function generateSku(parentSku, size, color, customValue) {
  const parts = [parentSku || 'SKU', size];
  if (color) parts.push(color.substring(0,3).toUpperCase());
  if (customValue) parts.push(customValue.substring(0,3).toUpperCase());
  return parts.join('-');
}
```

### ProductDetail - Extração de atributos custom
```typescript
const customAttributes = useMemo(() => {
  const attrs = variants
    .filter(v => v.custom_attribute_name && v.custom_attribute_value)
    .map(v => ({ name: v.custom_attribute_name, value: v.custom_attribute_value }));
  // Agrupar por nome de atributo
  const grouped = {};
  attrs.forEach(a => {
    if (!grouped[a.name]) grouped[a.name] = new Set();
    grouped[a.name].add(a.value);
  });
  return grouped;
}, [variants]);
```

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| BAIXO | Colunas nullable, compatível com variantes existentes |
| Integrações Yampi/Bling | Ignorar atributo custom na sincronização externa (apenas local) |

