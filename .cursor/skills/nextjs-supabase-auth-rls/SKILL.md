---
name: nextjs-supabase-auth-rls
description: Implementa autenticação Supabase e Row Level Security (RLS) com exemplos práticos. Prioriza Vite+React (React Router) usando @supabase/supabase-js e variáveis VITE_SUPABASE_*, e também cobre Next.js com @supabase/ssr quando aplicável. Use quando o usuário mencionar Supabase Auth, RLS, policies, sessão, proteção de rotas ou acesso por usuário.
---

# Supabase Auth + RLS (Vite/React e Next.js)

## Objetivo

Entregar Auth + autorização por dados via **RLS no Postgres** (Supabase) com um exemplo completo e seguro. No seu projeto atual, o stack é **Vite + React + React Router**; a parte de Next.js só entra se o projeto for migrado.

## Princípios (curto e obrigatório)

- **RLS é a autorização**: não confie no client nem em “if (userId === …)” como única barreira.
- **Políticas primeiro**: o código deve funcionar mesmo que alguém chame o banco diretamente.
- **Server Components por padrão**: evite `use client` sem necessidade.
- **Sem segredos no client**: `SUPABASE_SERVICE_ROLE_KEY` nunca vai para browser.

## Fluxo recomendado (checklist)

- [ ] Criar tabela(s) com `user_id` referenciando `auth.users(id)`
- [ ] Habilitar RLS e negar por padrão
- [ ] Criar policies (SELECT/INSERT/UPDATE/DELETE) com `auth.uid()`
- [ ] (Vite/React) Centralizar o client Supabase (um único `createClient`)
- [ ] (Vite/React) Proteger rotas com guard no React Router e/ou checagens em páginas
- [ ] (Next.js) Configurar `middleware.ts` para refresh de sessão (cookies) e helpers server/client com `@supabase/ssr`
- [ ] Consultar dados sem filtrar por `user_id` no código (opcional), porque a RLS já filtra

## Padrão de exemplo (recomendado)

Use o exemplo “profiles”:

- tabela `public.profiles` com `id uuid` (igual ao `auth.users.id`)
- RLS: usuário só lê/edita o próprio perfil
- leitura no Server Component
- atualização via Server Action

Veja os arquivos de referência e exemplos:

- [reference.md](reference.md) (RLS + decisões de arquitetura)
- [examples.md](examples.md) (SQL + Vite/React Router + (opcional) Next.js)

