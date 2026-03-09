

# Redesign do Popup de Detalhes do Pedido (Mobile)

## Problema
O dialog de detalhes do pedido (linhas 704-950) usa `DialogContent` com `max-w-2xl` em todas as telas. No mobile:
- O conteúdo fica apertado e confuso
- A grade de 4 colunas (pagamento/gateway/parcelas) não cabe
- A tabela de itens com 5 colunas é ilegível
- Muita informação sem hierarquia visual clara
- Botões de ação (Sincronizar, Conciliar, Excluir) ficam perdidos no final

## Solução
Usar **Drawer** (vaul) no mobile e manter **Dialog** no desktop. Reorganizar o layout mobile com seções colapsáveis e cards empilhados.

## Mudanças no `src/pages/admin/Orders.tsx`

### 1. Criar componente `OrderDetailContent`
Extrair todo o conteúdo do dialog (linhas 710-947) para um componente reutilizável que recebe `selectedOrder`, `orderItems`, etc.

### 2. Layout mobile otimizado dentro do `OrderDetailContent`
- **Header**: número do pedido + badges de status/pagamento lado a lado
- **Cards empilhados** em vez de grid 4 colunas: valor, método, gateway, parcelas em 2x2
- **Tabela de itens simplificada no mobile**: remover colunas "Unit." e "Total", mostrar como lista de cards com foto + nome + qtd × preço
- **Endereço e Resumo**: empilhados (já são 1 col no mobile, mas melhorar espaçamento)
- **Ações**: botões full-width no final com melhor destaque visual

### 3. Wrapper condicional
```tsx
{isMobile ? (
  <Drawer open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
    <DrawerContent className="max-h-[85vh]">
      <DrawerHeader>
        <DrawerTitle>Pedido {selectedOrder?.order_number}</DrawerTitle>
      </DrawerHeader>
      <ScrollArea className="px-4 pb-6 overflow-y-auto">
        <OrderDetailContent ... />
      </ScrollArea>
    </DrawerContent>
  </Drawer>
) : (
  <Dialog ...> {/* manter como está */}
)}
```

### 4. Itens do pedido no mobile — layout card
Em vez da Table de 5 colunas, mostrar cada item como:
```
[IMG] Nome do Produto
      Variante: P / Azul
      2x R$ 49,90 = R$ 99,80
```

### 5. Seção de pagamento no mobile — grid 2x2
Em vez de 4 colunas, usar `grid-cols-2` com labels menores e valores mais legíveis.

## Arquivo modificado
- `src/pages/admin/Orders.tsx` — refatorar dialog de detalhes para usar Drawer no mobile

