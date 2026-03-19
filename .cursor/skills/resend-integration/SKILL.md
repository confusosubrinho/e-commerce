---
name: resend-integration
description: Integra Resend em projetos Lovable para envio de e-mails transacionais (contato, confirmação, auth), newsletters e fluxos de CRM usando Supabase como backend. Use quando o usuário mencionar Resend, e-mail transactional, newsletter, confirmação de contato, Supabase + Resend, substituir e-mails padrão do Supabase, double opt-in ou problemas de entrega de e-mail.
---

# Lovable + Resend (E-mails e CRM)

## Objetivo

Aplicar a integração **Resend** em projetos Lovable para:

- coleta de leads (formulário de contato / landing page)
- confirmação automática por e-mail
- newsletters (Audiences + Broadcast)
- CRM leve com dashboard admin (Supabase)
- opcionalmente substituir os e-mails padrão de autenticação do Supabase

Fonte primária: guia oficial Lovable **“Resend integration”** (`https://docs.lovable.dev/tips-tricks/resend`).

## Princípios (obrigatórios)

- **Nunca expor API Key do Resend no chat**:
  - sempre usar configurações de ambiente do Lovable ou secrets seguros (API Keys).
- **Supabase é o backend padrão**:
  - tabelas com RLS habilitado
  - nada de dados sensíveis expostos direto no front.
- **Domínio verificado no Resend** antes de produção:
  - usar subdomínios (`updates.seudominio.com`) para isolar reputação.
- **Testar sempre em ambiente deployado**, não só no preview do Lovable.
- **Marketing vs Transacional**:
  - transacional → via API/SDK
  - marketing/newsletter → via Audiences + Broadcast (Resend Dashboard).

## Checklist principal (faça nessa ordem)

- [ ] **Entender o caso de uso**:
  - formulário de contato / lead?
  - newsletter?
  - substituir e-mails de auth do Supabase?
- [ ] **Configurar Supabase** (se ainda não existir):
  - tabela `contacts` com colunas mínimas:
    - `id` (uuid, pk)
    - `name` (text)
    - `email` (text)
    - `message` (text opcional)
    - `created_at` (timestamp)
  - habilitar **RLS** e policies corretas.
- [ ] **Conectar projeto Lovable ao Supabase** (API key / URL).
- [ ] **Criar/validar formulário no front**:
  - campos `name`, `email`, `message?`
  - validação (e-mail obrigatório e bem formatado).
  - onSubmit:
    - inserir no Supabase (`contacts`)
    - disparar ação server-side que chama Resend (SDK/API).
- [ ] **Configurar Resend**:
  - criar conta e **verificar domínio** (TXT / MX no DNS).
  - criar **API Key** e registrar como secret no Lovable (nunca em `.env` exposto).
- [ ] **Implementar envio de e-mail**:
  - usar SDK do Resend ou chamada HTTP server-side:
    - remetente no domínio verificado (`contato@updates.seudominio.com`)
    - incluir versão **HTML + texto simples**.
- [ ] **Testar fluxo end-to-end**:
  - enviar formulário → registro no Supabase + e-mail recebido.
  - validar falhas (e.g. e-mail inválido, Resend retornando erro).

## Newsletter com Resend Audiences

Quando o usuário mencionar newsletter, mailing, lista de e-mails, broadcast:

- [ ] Adicionar **formulário de newsletter** separado do contato:
  - campo mínimo: `email`
  - opcional: `name`
- [ ] Ao enviar:
  - criar contato no **Resend Audience** via API
  - opcional: também salvar localmente em Supabase (`newsletter_subscribers`).
- [ ] Orientar usuário a:
  - criar e-mails de broadcast no painel do Resend
  - sempre incluir **link de descadastramento**.
- [ ] Se pedirem **double opt-in**:
  - primeiro submit → grava estado "pending" em Supabase
  - enviar e-mail com link de confirmação
  - endpoint de confirmação:
    - marca como "confirmed" em Supabase
    - adiciona ao Audience no Resend.

## Dashboard Admin (CRM leve)

Quando o usuário quiser visualizar e gerenciar leads:

- [ ] Criar rota protegida (`/admin` ou `/crm`) com Supabase Auth.
- [ ] Listar tabela `contacts`:
  - colunas: nome, e-mail, preview da mensagem, data.
- [ ] Ao clicar em uma linha:
  - abrir painel de detalhe com mensagem completa + histórico.
- [ ] Para respostas manuais:
  - campo de texto + templates rápidos
  - botão “Enviar” que usa Resend server-side
  - registrar em tabela `sent_emails`:
    - `contact_id`
    - `subject`
    - `body`
    - `sent_at`.

## Substituir e-mails de Auth do Supabase (opcional)

Quando o usuário falar em **melhorar e-mails de autenticação Supabase**:

- [ ] Apontar para integração oficial Resend + Supabase:
  - `https://resend.com/integrations/supabase`
- [ ] Passos:
  - autenticar com projeto Supabase
  - escolher domínio e remetente
  - deixar o Resend configurar SMTP automaticamente.
- [ ] Lembrar que:
  - isso remove o limite baixo de e-mails/hora padrão
  - templates de auth passam a ser customizáveis no Supabase.

## Debug e entregabilidade

Em caso de erro ou e-mails indo para spam, verificar:

- **Painel do Resend**:
  - Logs de entrega / erros
  - Deliverability Insights.
- **Supabase**:
  - logs de Edge Functions / rotas server-side que chamam Resend.
- **Aplicação**:
  - console / Network no navegador
  - tratar estados `loading/error/success` na UI.

Boas práticas:

- usar sempre remetente com domínio próprio verificado
- incluir versão texto simples + HTML
- em marketing, sempre incluir link de opt-out / unsubscribe.

