---
status: draft
removable: true
description: "Checklist rápido para PRs de frontend com foco em reaproveitamento de UI e regras de arquitetura."
---

## Checklist rápido para PRs de Frontend (reaproveitamento de UI)

Antes de aprovar qualquer PR que mexa em `src/components/*` ou `src/pages/*`, passe por este checklist:

1. **Reaproveitamento de componentes**
   - [ ] O autor verificou se já existia componente equivalente em `src/components/store`, `src/components/admin` ou `src/components/ui`?
   - [ ] O novo código está **compondo/estendendo** componentes existentes (via props, `variant`, children/slots) em vez de recriar HTML/CSS do zero?

2. **Nada de filtro/estrutura nova “no olho”**
   - [ ] Novos filtros, grids, cards, tabelas, badges ou barras de ferramentas reaproveitam estruturas já existentes (ex.: mesmo `Table`, mesmo `ProductCard`, mesmo `FilterBar`)?
   - [ ] Se foi criado um componente totalmente novo, existe explicação no PR (ou TODO/issue linkada) de por que o que já existe não atendia?

3. **Consistência visual e de comportamento**
   - [ ] O novo componente segue o mesmo padrão de estados (`loading`, `empty`, `error`, `success`) usado no resto do projeto?
   - [ ] O PR não introduz um “mini design system paralelo” (novas cores, espaçamentos, tipografia) sem passar pelo design system oficial?

4. **Arquitetura de domínio**
   - [ ] Não há regra de negócio nova dentro do componente de UI; regras estão em hooks/services/libs de domínio?

