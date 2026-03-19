# Exemplos — Lovable + Stripe (chat-driven)

## Exemplo A — Setup base (pré-requisitos)

Use este “check” antes de pedir qualquer coisa ao Lovable:

- Supabase conectado ao projeto
- Stripe Secret Key adicionada via **Add API Key** (não no chat)
- Você está em **Stripe Test Mode**
- Você vai testar em **deploy** (não preview)

## Exemplo B — One-time checkout (pagamento avulso)

Prompt sugerido:

> “Conecte Stripe ao meu projeto Lovable usando Supabase. Quero um checkout de pagamento único para o produto ‘Curso Digital’ por R$ 29. Gere o necessário (Edge Functions, tabelas com RLS e botões na UI).”

Variações úteis:

- “Preciso que a compra seja associada ao usuário autenticado do Supabase.”
- “Meu carrinho já está pronto, só preciso do passo de pagamento.”

## Exemplo C — Assinaturas com tiers (mensal/anual)

Prompt sugerido:

> “Configure assinaturas Stripe no Lovable com 3 planos (Básico, Pro, Enterprise). Vincule o Stripe customer ao `id` do usuário do Supabase. Gere o portal do cliente e os controles de upgrade/downgrade/cancelamento.”

Se quiser webhooks:

> “Ative webhooks (opt-in) para `customer.subscription.*` e `payment_intent.*`. Quero confirmação como fonte de verdade e atualização do estado no banco.”

## Exemplo D — Troubleshooting (Stripe não funciona / nada acontece)

Prompt sugerido (para diagnóstico rápido):

> “Estou usando Lovable + Stripe. Meu checkout não funciona no preview. Liste exatamente o que devo verificar (deploy, Test Mode, Add API Key, logs do Supabase Edge Functions e logs do Stripe).”

## Exemplo E — Teste de pagamento (cartão de teste)

Use em Test Mode:

- Card number: `4242 4242 4242 4242`
- CVC: qualquer 3 dígitos
- Expiração: qualquer data futura

## Exemplo F — Checklist de validação pós-setup

- [ ] Consigo clicar no botão e abrir o checkout (redirect)
- [ ] Ao concluir pagamento, a UI mostra sucesso (UX) e estado correto (fonte de verdade no backend)
- [ ] Tabelas criadas no Supabase têm **RLS**
- [ ] (Se webhooks) logs mostram eventos recebidos e processados sem duplicar (idempotência)
