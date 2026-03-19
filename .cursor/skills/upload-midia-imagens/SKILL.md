---
name: upload-midia-imagens
description: Implementa upload de mídia/imagens para Supabase Storage com React/Next.js, incluindo (opcional) progresso de upload com Uppy, organização de paths, validações e boas práticas. Use quando o usuário mencionar upload de imagem, upload de mídia, Supabase Storage, bucket, Uppy, progresso de upload, URL assinada (signed URL), bucket privado/protegido, ou exibição segura de imagens privadas.
---

# Upload de mídia / imagens (Supabase Storage)

## Objetivo

Entregar um fluxo de **upload + armazenamento + exibição** de imagens/mídia usando Supabase Storage, com segurança quando o bucket for **privado**.

## Decisão rápida (ponto mais importante)

- **Bucket público**: pode exibir por URL pública (simples, mas não serve para dados sensíveis).
- **Bucket privado/protegido**: **não existe “link direto” seguro**. Use:
  - **Signed URL** com expiração (melhor para a maioria dos casos), ou
  - **Proxy/API** no servidor (mini-CDN) para servir a imagem com autorização e/ou transformação.

## Checklist de implementação

- [ ] Definir bucket(s): `public` vs `private`
- [ ] Padronizar path do arquivo (recomendado): `userId/uuid.ext` (ou `tenantId/userId/uuid.ext`)
- [ ] Validar arquivo (tamanho/MIME) **antes** do upload
- [ ] Fazer upload (`supabase.storage.from(bucket).upload(...)`)
- [ ] Persistir no banco o “ponteiro” do arquivo (bucket + path + metadata)
- [ ] Exibir:
  - Público: `getPublicUrl`
  - Privado: `createSignedUrl` **ou** rota server que faz o download e responde como imagem

## Quando usar Uppy (progresso / UX)

Use Uppy quando você precisa de:

- **barra de progresso**, múltiplos arquivos, drag-and-drop
- cancelamento/retry
- (opcional) uploads grandes com estratégia resumable (depende do seu setup)

Referências leves:

- `yyassif/uppy-supabase-nextjs` (exemplo objetivo com Uppy + Supabase Storage)
- `madzalo/supabase-file-upload` (bom para fluxo com progresso)

## Exibição segura de imagens privadas (atenção)

Se o bucket for privado, siga o padrão de “exibição cuidadosa” (signed URL ou proxy).

Referência prática:

- `activenode/supabase-nextjs-image-api` (exemplo de mini-CDN/rota de imagem para evitar limites e servir privado com controle)

## Arquivos de apoio

- Para exemplos prontos (SQL + TS/React + Uppy): veja [examples.md](examples.md)
- Para detalhes de políticas, buckets privados, signed URLs e proxy: veja [reference.md](reference.md)
