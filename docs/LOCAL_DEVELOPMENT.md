# Banco de dados e ambiente local para testes

Este guia explica como subir o **Supabase local** (Postgres + Auth + APIs) na sua máquina para desenvolver e rodar testes sem usar o projeto de produção.

---

## Pré-requisitos

1. **Docker Desktop** (obrigatório)  
   - [Download para Windows](https://www.docker.com/products/docker-desktop/)  
   - **Instale**, abra o Docker Desktop e espere ele iniciar por completo (ícone na bandeja do sistema).  
   - Sem o Docker rodando, `supabase start` falha com erro de conexão ao daemon.  
   - Se aparecer "elevated privileges" no Windows, tente abrir o terminal (PowerShell ou CMD) **como Administrador** e rodar o comando de novo.

2. **Supabase CLI**  
   A instalação global via `npm install -g supabase` **não é suportada**. Use uma das opções abaixo:

   - **Scoop (Windows):**
     ```powershell
     scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
     scoop install supabase
     ```
   - **Binário Windows (recomendado se não usa Scoop):**  
     Baixe o `.exe` na página [Releases do Supabase CLI](https://github.com/supabase/cli/releases) (ex.: `supabase_windows_amd64.exe`), renomeie para `supabase.exe` e coloque em uma pasta que esteja no seu `PATH`, ou use pelo caminho completo.

---

## Passo a passo: subir o banco local

### 1. Iniciar o Supabase local

Na raiz do projeto:

```bash
supabase start
```

Na primeira vez o CLI baixa as imagens Docker; pode levar alguns minutos. Quando terminar, ele mostra as URLs e chaves do ambiente local.

### 2. Copiar as credenciais locais

Após o `supabase start`, rode:

```bash
supabase status
```

Você verá algo como:

```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
anon key: eyJhbGc...
service_role key: eyJhbGc...
```

### 3. Configurar o `.env.local`

Na raiz do projeto, crie ou edite `.env.local` (este arquivo não vai para o Git):

```env
# Supabase local (copie de supabase status)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<cole aqui o "anon key">
SUPABASE_SERVICE_ROLE_KEY=<cole aqui o "service_role key">
```

O frontend usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O script de seed e os testes usam `SUPABASE_URL` (ou `VITE_SUPABASE_URL`) e `SUPABASE_SERVICE_ROLE_KEY`.

**Opcional:** se quiser que o seed e os E2E usem variáveis explícitas:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

### 4. Aplicar migrations e popular dados (seed)

O `supabase start` já aplica as migrations da pasta `supabase/migrations/`. Para **recriar o banco do zero** e reaplicar tudo:

```bash
supabase db reset
```

Para criar um **admin e dados mínimos para E2E** (categoria, produto, usuário admin):

```bash
npm run seed:qa
```

O seed usa as variáveis do `.env.local` (ou `.env`). Credenciais padrão do admin de teste:

- **E-mail:** `qa-admin@example.com`
- **Senha:** `qa-admin-e2e-secure`

(Configuráveis com `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD`.)

### 5. Subir o frontend

```bash
npm run dev
```

O app estará em `http://localhost:8080` e passará a usar o Supabase **local** (API URL e chaves do `.env.local`).

### 6. Studio local (opcional)

O Supabase Studio local fica em:

**http://127.0.0.1:54323**

Lá você pode ver tabelas, dados, Auth e logs.

---

## Comandos úteis

| Comando | Descrição |
|--------|-----------|
| `supabase start` | Sobe o stack local (Postgres, Auth, Studio, etc.) |
| `supabase stop` | Para todos os serviços locais |
| `supabase status` | Mostra URLs e chaves do ambiente local |
| `supabase db reset` | Recria o banco e reaplica todas as migrations (e `seed.sql` se existir) |
| `npm run seed:qa` | Cria admin + categoria + produto para testes E2E (usa `.env.local`) |
| `npm run dev` | Sobe o frontend (use com `.env.local` apontando para o local) |

---

## Rodar testes E2E contra o banco local

1. Supabase local rodando (`supabase start`).
2. `.env.local` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do `supabase status`.
3. Seed aplicado: `npm run seed:qa`.
4. Em outro terminal: `npm run dev` (ou deixe o app rodando).
5. Rodar os testes:

   ```bash
   npm run test:e2e
   ```

O `global-setup` do Playwright carrega `.env`/`.env.local` e roda o seed se as variáveis estiverem definidas.

---

## Parar o ambiente local

```bash
supabase stop
```

Para remover também os volumes (banco zerado na próxima subida):

```bash
supabase stop --no-backup
```

---

## Observações

- **Nunca** use `.env.local` com credenciais de **produção**.
- O projeto já está inicializado (`supabase/config.toml` e `supabase/migrations/`). Não é necessário rodar `supabase init`.
- Edge Functions: para testar funções contra o local, use `supabase functions serve` (e opcionalmente `supabase functions deploy` apenas no projeto remoto quando for deploy).
- Se aparecer erro de CORS no frontend, confira se `VITE_SUPABASE_URL` no `.env.local` é exatamente a URL mostrada no `supabase status` (geralmente `http://127.0.0.1:54321`).

---

## Resolução de problemas

| Erro | Solução |
|------|--------|
| `Installing Supabase CLI as a global module is not supported` | Não use `npm install -g supabase`. Instale o CLI com [Scoop](https://github.com/supabase/scoop-bucket) ou baixando o executável em [Releases](https://github.com/supabase/cli/releases). |
| `failed to inspect service... docker client must be run with elevated privileges` / `pipe docker_engine: The system cannot find the file specified` | O Docker não está acessível: (1) Abra o **Docker Desktop** e espere iniciar; (2) Se persistir, abra o terminal **como Administrador** e rode `supabase start` de novo; (3) Se ainda falhar, reinstale o [Docker Desktop](https://docs.docker.com/desktop/). |
