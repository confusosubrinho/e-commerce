

# Diagnóstico: Imagens Quebradas na Yampi

## Causa Raiz Identificada

**65% das imagens (294 de 454) estão em formato WebP.** O problema está no fallback de conversão WebP → JPEG na função `yampi-sync-images`:

### Bug Principal (linhas 183-203)
Quando o Supabase Image Transformation não está disponível (plano Free/requer Pro), o código faz um **fallback falso**: envia os bytes brutos do WebP com `contentType: "image/jpeg"` e extensão `.jpg`. A Yampi recebe um arquivo que diz ser JPEG mas contém bytes WebP — resultado: **imagem quebrada/corrompida**.

```
WebP bytes → upload como "image/jpeg" com nome ".jpg" → Yampi baixa → não é JPEG real → QUEBRADA
```

### Evidência nos Logs
- 9 de 10 imagens do último batch foram marcadas como `converted: true`
- `yampi_returned_url: null` — Yampi não retorna URL, indicando possível falha no processamento
- Todas as imagens convertidas passam pela URL `.../yampi-converted/.../0.jpg` (que contém bytes WebP)

## Solução

### Conversão real WebP → JPEG no Edge Function usando Deno
Substituir o fallback falso por uma conversão real usando a biblioteca `sharp` (via esm.sh) ou, mais simplesmente, usando o **Canvas API do Deno** para decodificar WebP e re-encodar como JPEG/PNG.

Como o Deno não tem Canvas nativo e sharp pode não funcionar em Edge Functions, a abordagem mais confiável é:

1. **Usar a API de Image Transformation do Supabase** com o parâmetro `format=origin` removido e adicionando `?format=jpeg` explicitamente na URL
2. **Se render falhar (404):** baixar o WebP, re-uploadar com extensão `.webp` e content-type correto (`image/webp`), e enviar essa URL para a Yampi — deixando a Yampi tentar processar o WebP real em vez de bytes corrompidos
3. **Nunca mentir sobre o content-type** — se é WebP, enviar como WebP; se a Yampi rejeitar, logar claramente

### Mudanças no código (`yampi-sync-images/index.ts`)

**Função `convertAndUploadAsPng`:**
- Corrigir a URL do render para incluir `&format=jpeg` explicitamente
- No fallback: enviar com `contentType: "image/webp"` e extensão `.webp` (honesto)
- Adicionar verificação do content-type real do arquivo baixado antes de decidir a extensão
- Logar quando conversão real falha vs fallback

**Validação extra:**
- Após upload, fazer GET (não HEAD) com `Accept: image/*` e verificar se o content-type retornado bate com o esperado
- Se a URL convertida retornar content-type diferente do declarado, marcar como erro

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/yampi-sync-images/index.ts` | Corrigir conversão WebP, eliminar fallback falso, validar content-type real |

### Impacto
- 294 imagens WebP serão enviadas corretamente
- Imagens já convertidas com cache (`.../yampi-converted/...`) serão re-processadas na próxima sincronização
- Zero breaking changes para imagens JPG/PNG (160 imagens não afetadas)

