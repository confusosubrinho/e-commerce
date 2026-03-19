# Referência — Lovable Build with URL

## Fonte (doc oficial)

Baseado em: [Lovable API: Build with URL](https://docs.lovable.dev/integrations/build-with-url).

## Base URL

- Base: `https://lovable.dev/?autosubmit=true#`
- `autosubmit` (boolean): precisa ser `true` para disparar automaticamente

## Formato com parâmetros

`https://lovable.dev/?autosubmit=true#prompt=YOUR_PROMPT_HERE&images=IMAGE_URL_1&images=IMAGE_URL_2`

### `prompt`

- **Tipo**: string
- **Obrigatório**: sim
- **Limite**: até 50.000 caracteres
- **Observação**: use URL encoding (ex.: espaço vira `%20`).

### `images`

- **Tipo**: string (repetível)
- **Obrigatório**: não
- **Limite**: até 10 valores
- **Regras**:
  - URLs devem ser **publicamente acessíveis**
  - formatos suportados: **JPEG, PNG, WebP**
  - cada URL deve ser URL-encoded

## Erros comuns / troubleshooting

- **Link abre mas não executa**:
  - faltou `autosubmit=true` no `?`
  - `prompt` não está no `#` (hash)
  - URL malformada (encoding quebrado)

- **Imagens não aparecem / não influenciam o build**:
  - URL não é pública
  - formato não suportado
  - URL sem encoding (caracteres especiais quebram parsing)
  - excedeu 10 imagens

- **“URL too long” / link quebra no browser**:
  - reduzir tamanho do prompt
  - remover excesso de imagens
  - usar o Lovable Link Generator para evitar erros de encoding

## Generator oficial

Para evitar erros de encoding, usar o gerador de links: `https://lovable.dev/links`
