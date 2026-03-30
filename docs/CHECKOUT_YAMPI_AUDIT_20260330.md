# Auditoria Sênior do Sistema Comercial (Checkout Transparente + Yampi)

Data: **2026-03-30**
Escopo: carrinho, carrinho abandonado, checkout, integração Yampi, pedidos/status, webhooks/eventos, automações e segurança.

> Princípio adotado nesta revisão: **stability-first**. Nenhuma alteração de contrato crítico da Yampi foi feita.

---

## 1) Resumo técnico do fluxo atual (fim a fim)

## 1.1 Vitrine / Produto / Carrinho (frontend)
1. Cliente navega em páginas de produto e adiciona variante ao carrinho (`CartContext`).
2. Carrinho persiste localmente (`cart`, `cart_id`, `appliedCoupon`, `selectedShipping`, `shippingZip`).
3. Alteração de quantidade, remoção e limpeza ocorrem no contexto.
4. Subtotal/desconto/total são calculados localmente para UX imediata.

## 1.2 Início do checkout (`/checkout/start`)
1. `CheckoutStart.tsx` cria payload com `cart_id`, itens e totais visuais.
2. Chama `checkout-router` route `start` via `checkoutClient` (timeout + request_id).
3. `checkout-router` recalcula preços no backend, cria/recupera pedido idempotente, reserva estoque em fluxos externos e delega por provider.

## 1.3 Fluxo Yampi (externo)
1. `checkout-router` delega para `checkout-create-session`.
2. `checkout-create-session` valida credenciais e `yampi_sku_id`, cria payment-link com `metadata.session_id`.
3. Frontend redireciona para URL Yampi.
4. Yampi envia webhook com status/pagamento.
5. `yampi-webhook` reconcilia pedido e atualiza/cria `orders`, `order_items`, `payments`, `inventory_movements`.

## 1.4 Retorno do cliente (`/checkout/obrigado`)
1. Tela busca pedido por `external_reference`.
2. Se não encontrar, fallback para `checkout_session_id`.
3. Faz polling para refletir processamento assíncrono de webhook.

---

## 2) Separação clara de responsabilidades

### Frontend
- UX de carrinho e checkout, persistência de sessão, coleta de dados de cliente/endereço/pagamento.
- Nunca fonte final de verdade de preço/status.

### Backend (edge functions)
- Revalidação de preço/estoque.
- Criação idempotente de pedido.
- Delegação para gateways e reconciliação por webhooks.

### Integrações externas
- Yampi (checkout/payment-link + eventos de status/pagamento).

### Banco de dados
- `orders`, `order_items`, `payments`, `inventory_movements`, `abandoned_carts`, `order_events`.

---

## 3) O que já funciona e não pode quebrar (invariantes)

1. `metadata.session_id` no link Yampi (chave de reconciliação).
2. `cart_id`/`idempotency_key` para evitar duplicidade de pedido.
3. Fallback para checkout nativo quando SKU não está vinculado na Yampi.
4. Reconciliação por `external_reference` e `checkout_session_id`.
5. Status não devem regredir em eventos fora de ordem.

---

## 4) Análise do carrinho

## Pontos bons
- Persistência local robusta e `cart_id` estável por sessão.
- UX de atualização/remoção clara.

## Pontos frágeis
- Totais de carrinho são visuais no client; a verdade vem depois no backend (correto arquiteturalmente), mas exige disciplina de reconciliação no checkout.
- Cupom/frete precisam sempre ser validados no servidor para evitar divergência no pagamento final.

## Recomendação incremental
- Manter cálculo client para UX, mas sempre exibir mensagem de “valor final validado no checkout” quando houver recalculo server-side.

---

## 5) Análise de carrinho abandonado

## Estado atual
- Existe `abandoned_carts` com UTM, dados de carrinho e marcação de recuperação.
- Há automações e logs (`email_automations`, `email_automation_logs`).
- Conversão do carrinho em pedido ocorre via `session_id` no webhook.

## Fragilidades
- Status operacional de abandono/recuperação existe, mas pode evoluir para pipeline mais granular (ex.: active/expired/converted).
- Deduplicação de campanhas depende de regras de aplicação na camada de automação.

## Proposta compatível
- Evoluir com estado operacional sem remover os atuais (`pending/contacted/recovered`).
- Guardar canal de recuperação e último evento de carrinho para disparos futuros com menos falso positivo.

---

## 6) Análise do checkout

## Pontos fortes
- Timeout padronizado, request_id e tratamento amigável de erro no cliente.
- Persistência de etapa/form no checkout para resiliência de UX.
- Proteções de duplo envio e idempotência no backend.

## Pontos de atenção
- Fluxo assíncrono externo depende de webhook: a tela de retorno precisa polling (já implementado).
- Falhas parciais de gateway exigem observabilidade operacional forte (logs + dashboards admin).

---

## 7) Análise da integração Yampi

## Contrato atual preservado
- `POST /v2/{alias}/checkout/payment-link` (com fallback endpoint)
- `skus[]` + `metadata.session_id`
- processamento de eventos por webhook

## Melhoria de segurança implementada
- Autenticação dual no webhook:
  - compatibilidade: `?token=`
  - oficial: `X-Yampi-Hmac-SHA256`
- Mantida retrocompatibilidade para não quebrar instalações existentes.

---

## 8) Análise de pedidos e status

## Funcionamento atual
- Pedido pode nascer em `pending` no start (pré-criação) e ser confirmado via evento de pagamento.
- Webhooks alteram status conforme evento normalizado.
- Idempotência com `order_events` + busca por chaves de correlação.

## Riscos de inconsistência
- Eventos fora de ordem ou repetidos (já parcialmente mitigados).
- Necessidade de formalizar melhor regras de transição (state flow) em camada única no futuro.

---

## 9) Problemas encontrados

1. Webhook Yampi dependia só de query token (melhorado nesta entrega).
2. Alta complexidade no webhook (muitos branches) aumenta risco de regressão em refactors grandes.
3. Necessidade de ampliar bateria de regressão para cenários Yampi específicos (pendente/recusado/duplo evento).

---

## 10) Riscos de regressão mapeados

- Mudar payload de criação de link Yampi.
- Remover/alterar `session_id` em metadata.
- Alterar regras de reconciliação sem fallback.
- Alterar semantics de status sem camada de compatibilidade.

Mitigação adotada: mudanças cirúrgicas, aditivas e com testes unitários.

---

## 11) Arquitetura proposta (compatível e incremental)

Fases sugeridas (sem quebra):
1. **Fase A (concluída):** segurança webhook + documentação operacional.
2. **Fase B (avançada nesta PR):** transições de status centralizadas em policy única com wrapper compatível, aplicadas no webhook Yampi sem alteração de contrato.
3. **Fase C (avançada nesta PR):** cálculo comercial server-side (`subtotal + desconto + frete`) consolidado em serviço de quote, integrado ao `checkout-router` antes da criação do pedido/sessão.
4. **Fase D (avançada nesta PR):** automações de abandono endurecidas com deduplicação por janela/cart_id e trilha de recuperação (canal + ordem convertida).

---

## 12) Melhorias implementadas nesta entrega

1. Documentação técnica expandida desta auditoria.
2. Autenticação dual do webhook Yampi (token legado + HMAC oficial).
3. Helper compartilhado com comparação em tempo constante.
4. Testes unitários de regressão para autenticação do webhook.
5. Serviço `checkoutQuote` para recalcular total no backend e corrigir divergência de desconto cliente/servidor.
6. Deduplicação de carrinho abandonado no `checkout-create-session` e marcação de recuperação/conversão no webhook Yampi.

---

## 13) Testes criados / revisados

## Criados
- `yampi-webhook-auth.test.ts`
  - aceita token legado
  - aceita HMAC válido
  - rejeita assinatura inválida

## Já existentes e relevantes (revisados)
- testes de idempotência de checkout e validação de rota start.
- testes e2e de fluxos de checkout (incluindo cenário Yampi mockado).

---

## 14) Checklist de validação final (produção)

- [ ] Criar sessão Yampi via checkout start e validar redirect.
- [ ] Validar webhook com token legado.
- [ ] Validar webhook com HMAC oficial.
- [ ] Confirmar que reenvio do mesmo evento não duplica pedido/pagamento/estoque.
- [ ] Confirmar update de status para aprovado/processando sem regressão indevida.
- [ ] Confirmar fallback para checkout interno em item sem `yampi_sku_id`.
- [ ] Confirmar rastreabilidade no admin (pedido + pagamento + movimentos de estoque).

---

## 15) Confirmação de compatibilidade

**Confirmação explícita:** as alterações desta entrega foram desenhadas para **não quebrar o fluxo crítico atual**.
- Não houve mudança de contrato de criação de link Yampi.
- Não houve remoção do método legado de autenticação webhook.
- A validação HMAC foi adicionada de forma retrocompatível.

---

## 16) Próximos passos recomendados (sem risco)

1. Consolidar machine de status em módulo único (com testes de transição válida/inválida).
2. Criar suíte de regressão API para eventos Yampi (approved/pending/refused/cancelled/refunded/out-of-order).
3. Evoluir observabilidade operacional para carrinho abandonado recuperado/convertido por canal.
