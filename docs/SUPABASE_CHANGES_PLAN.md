# Plano Oficial de Mudanças no Supabase

Este é o **arquivo de referência obrigatório** para qualquer IA (Lovable, Cursor, etc.) ao propor ou realizar mudanças no banco de dados Supabase deste projeto.

> Antes de alterar qualquer schema, migration, tabela, view, função SQL ou política RLS, a IA deve ler e seguir as regras deste documento.

---

## Regras fundamentais (NUNCA violar)

1. **Toda mudança de banco é feita via migration** em `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`. Nunca editar schema direto no painel Supabase.
2. **Nunca apagar dados de negócio** sem backup e aprovação explícita do dono do projeto. Dados de negócio incluem: pedidos, itens de pedido, pagamentos, clientes, carrinhos abandonados, produtos, estoque.
3. **Nunca regredir status de pedidos** (ex.: de `paid` para `pending`).
4. **Toda migration deve ter rollback** documentado (script de reversão ou comentário explicando como reverter manualmente).
5. **Testar em staging primeiro** quando a mudança for de maior risco (ex.: remover coluna, alterar tipo, migrar dados).
6. **Dados sensíveis (LGPD):** não logar e não expor desnecessariamente campos como `customer_name`, `customer_email`, `customer_phone`, `shipping_address`.

---

## Convenções de nomenclatura

| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Tabelas | `snake_case` plural | `product_variants`, `order_items` |
| Colunas | `snake_case` | `created_at`, `tenant_id` |
| Índices | `idx_tabela_coluna` | `idx_orders_status` |
| Foreign keys | `fk_tabela_coluna` | `fk_order_items_order_id` |
| Funções SQL | `snake_case` verbo_substantivo | `decrement_stock`, `get_tenant_id` |
| Views | `snake_case` descritivo | `checkout_settings`, `active_products` |
| Migrations | `YYYYMMDDHHMMSS_descricao_curta.sql` | `20260305120000_add_tenant_id.sql` |

---

## Template de pedido de mudança

Quando solicitar uma mudança ao banco, forneça o máximo de contexto possível usando este formato:

```markdown
## Pedido de mudança no banco

**Data:** YYYY-MM-DD
**Solicitante:** [seu nome ou "IA"]
**Prioridade:** Baixa / Média / Alta

### Contexto
[Por que essa mudança é necessária? Qual problema resolve?]

### Objetivo
[O que deve ser alcançado ao final?]

### Esquema atual
```sql
-- Cole o schema atual das tabelas afetadas, se souber
```

### Esquema desejado
```sql
-- Descreva o que deve mudar
-- Ex.: adicionar coluna, criar tabela, criar índice
```

### Regras de migração de dados
[Como tratar dados existentes? Valor padrão para nova coluna? Backfill necessário?]

### Validação esperada
[Como confirmar que a mudança foi aplicada corretamente? Quais queries testar?]

### Rollback
[Como reverter se der problema?]

### Impacto estimado
- Tabelas afetadas:
- Edge Functions afetadas:
- Páginas/componentes afetados:
- Risco de downtime: Sim/Não
```

---

## Check-list para toda migration

Antes de criar/aplicar uma migration, verificar:

- [ ] Nome do arquivo no padrão `YYYYMMDDHHMMSS_descricao.sql`
- [ ] Colunas novas têm tipo correto e `NOT NULL` ou `DEFAULT` definido
- [ ] Foreign keys têm `ON DELETE` definido (`RESTRICT`, `SET NULL`, `CASCADE`)
- [ ] Há índice nas novas colunas que serão usadas em `WHERE` ou `JOIN`
- [ ] RLS está configurado se a tabela expõe dados sensíveis
- [ ] Dados existentes não quebram após a mudança
- [ ] Rollback documentado
- [ ] `SUPABASE_CHANGELOG.md` foi atualizado após aplicar em produção

---

## Regras de limpeza e retenção (Housekeeping)

### Tabelas que podem ter retenção limitada (logs técnicos)
A IA pode propor políticas de retenção para as seguintes tabelas, **desde que não sejam dados de negócio**:

| Tabela | Retenção sugerida | Regra |
|--------|------------------|-------|
| `stripe_webhook_events` | 180 dias | Manter eventos com `error_message` por mais tempo para auditoria |
| Logs de webhook Yampi/Appmax | 90 dias | Apenas entradas processadas com sucesso |
| Logs de erro/debug das Edge Functions | 30 dias | – |

### Tabelas que NUNCA devem ser limpas sem aprovação
- `orders` e `order_items`
- `payments`
- `inventory_movements`
- `product_variants` (histórico de SKUs)
- Qualquer dado de cliente

### Como implementar limpeza
Limpeza deve ser feita via:
1. Edge Function agendada (cron) que deleta registros antigos com `WHERE created_at < NOW() - INTERVAL 'X days'`.
2. Nunca via DELETE manual sem script aprovado.
3. Sempre logar quantos registros foram removidos.

---

## Análise periódica de saúde do banco

Quando solicitado, a IA deve analisar e reportar:

1. **Tabelas sem índices em colunas de busca** frequente.
2. **Colunas obsoletas** (não usadas em código há muito tempo).
3. **Tabelas crescendo sem controle** (ex.: logs sem política de retenção).
4. **Políticas RLS ausentes** em tabelas com dados sensíveis.
5. **Sequências ou PKs próximos do limite** (raro, mas relevante em alto volume).

Toda análise resulta em **proposta de mudança não-destrutiva primeiro** (ex.: adicionar índice, criar view, adicionar coluna) antes de qualquer remoção.
