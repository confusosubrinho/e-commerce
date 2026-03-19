---
name: lovable-build-with-url
description: Gera e valida links do Lovable usando a integração "Build with URL" (autosubmit + hash params), incluindo encoding do prompt e inclusão de imagens públicas. Use quando o usuário mencionar Lovable Build with URL, lovable.dev links, autosubmit=true, #prompt=, parâmetro images=, link generator, ou quiser compartilhar/automatizar criação de apps via URL.
---

# Lovable — Build with URL

## Objetivo

Criar links do Lovable que **abrem e iniciam automaticamente** a criação de um app usando:

- Base: `https://lovable.dev/?autosubmit=true#`
- Parâmetros no **hash**: `prompt=` e (opcional) `images=`

## Checklist (faça nessa ordem)

- [ ] Definir o **prompt** (claro, conciso, focado no core).
- [ ] Fazer **URL-encoding** do prompt (espaços como `%20`, caracteres especiais encodeados).
- [ ] Montar a URL com:
  - `?autosubmit=true#prompt=...`
  - (Opcional) adicionar `&images=...` (pode repetir `images=` até 10 vezes)
- [ ] Garantir que as imagens são **URLs públicas** e em **JPEG/PNG/WebP**.
- [ ] Validar rapidamente:
  - o `#prompt=` está presente
  - `autosubmit=true` está no querystring
  - a URL não ficou longa demais (evitar prompts gigantes em links compartilháveis)

## Regras e guardrails

- **Parâmetros ficam após `#`** (hash), não em `?`.
- **`autosubmit=true` é obrigatório** para auto-executar.
- **`images` é repetível**: `...&images=url1&images=url2`.
- **Limites**:
  - `prompt`: até 50.000 caracteres (mas links enormes podem falhar no browser)
  - `images`: até 10 URLs

## Output padrão

Quando o usuário pedir “gera o link”, devolva:

- A URL final pronta para copiar
- (Opcional) uma versão “debug” com o prompt antes do encoding, para conferência

## Recursos

- Exemplos prontos: [examples.md](examples.md)
- Referência (parâmetros, limites, troubleshooting): [reference.md](reference.md)
