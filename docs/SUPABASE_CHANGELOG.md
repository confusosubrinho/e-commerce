# Changelog do Banco de Dados (Supabase)

Histórico de todas as mudanças de schema aplicadas em produção.

> Toda vez que uma migration for aplicada em produção, adicionar uma entrada aqui seguindo o formato abaixo.
> Mudanças ainda em planejamento NÃO devem constar aqui – use [`SUPABASE_CHANGES_PLAN.md`](SUPABASE_CHANGES_PLAN.md).

---

## Formato de entrada

```markdown
## YYYY-MM-DD – [Descrição curta]

**Migration:** `YYYYMMDDHHMMSS_nome_do_arquivo.sql`
**Autor:** [nome ou "IA"]
**Ambiente:** staging → produção / apenas produção

### O que mudou
- Bullet com cada mudança

### Impacto
- Tabelas afetadas:
- Edge Functions afetadas:
- Notas de compatibilidade (se quebrou algo, se exige passo manual):

### Rollback
[Como reverter, se necessário]
```

---

## Histórico

> Entradas serão adicionadas aqui conforme as migrations forem sendo aplicadas em produção.
> As migrations existentes antes desta documentação estão listadas em `supabase/migrations/` mas não foram retroativamente documentadas aqui.

---

*Documento criado em 2026-03-05 como parte do plano de melhorias enterprise.*
*A partir desta data, toda nova migration deve ter entrada neste arquivo.*
