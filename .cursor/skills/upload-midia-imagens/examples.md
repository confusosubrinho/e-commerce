# Exemplos — Upload de mídia/imagens (Supabase Storage)

## 0) Convenção de path (recomendado)

- **Público ou privado**: use um path não “adivinhável” e segmentado:
  - `userId/{uuid}.{ext}`
  - Multi-tenant: `tenantId/userId/{uuid}.{ext}`

Persistir no banco:

- `bucket`: `"product-images"` / `"avatars"` / etc.
- `path`: `"tenant_123/user_456/uuid.webp"`
- `mime_type`, `size_bytes`, `width`, `height` (se você extrair)

## 1) Upload simples (supabase-js)

```ts
import { supabase } from "@/integrations/supabase/client";

export async function uploadImage(params: {
  bucket: string;
  path: string;
  file: File;
}) {
  const { bucket, path, file } = params;

  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo inválido: envie uma imagem.");
  }

  // Ajuste conforme seu produto (ex.: 5MB)
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("Imagem muito grande.");
  }

  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;
  return data; // { path, fullPath, ... }
}
```

## 2) URL pública (bucket público)

```ts
import { supabase } from "@/integrations/supabase/client";

export function getPublicImageUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
```

## 3) URL assinada (bucket privado/protegido)

```ts
import { supabase } from "@/integrations/supabase/client";

export async function getSignedImageUrl(params: {
  bucket: string;
  path: string;
  expiresInSeconds?: number;
}) {
  const { bucket, path, expiresInSeconds = 60 } = params;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
```

## 4) React: input file + preview + upload

```tsx
import { useMemo, useState } from "react";
import { uploadImage } from "./uploadImage";

export function ImageUploader() {
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function onUpload() {
    if (!file) return;
    const path = `user_${crypto.randomUUID()}/${crypto.randomUUID()}.webp`;
    await uploadImage({ bucket: "images", path, file });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {previewUrl ? <img src={previewUrl} alt="Preview" style={{ maxWidth: 320 }} /> : null}
      <button onClick={onUpload} disabled={!file}>
        Enviar
      </button>
    </div>
  );
}
```

Observação: esse exemplo usa preview local e é útil para UX; para produção, use um componente de UI (shadcn/ui etc.).

## 5) Progresso de upload (Uppy)

Quando você precisa de progresso/UX avançada, use Uppy.

Referências:

- `yyassif/uppy-supabase-nextjs` (Uppy + Supabase Storage) — `https://github.com/yyassif/uppy-supabase-nextjs?utm_source=chatgpt.com`
- `madzalo/supabase-file-upload` (progresso) — `https://github.com/madzalo/supabase-file-upload?utm_source=chatgpt.com`

Padrão de alto nível:

1. Inicialize Uppy com restrições (tamanho/MIME).
2. No “upload”, envie para o Storage (direto se o bucket/policy permitir).
3. Salve no banco (bucket+path).

## 6) Exibir privado via rota server (proxy)

Se o bucket for privado e você quer “link estável”, crie uma rota no servidor (ex.: Next `pages/api` ou Route Handler) que:

- valida o usuário/tenant
- baixa o objeto do Storage
- responde com `Content-Type` correto

Referência:

- `activenode/supabase-nextjs-image-api` — `https://github.com/activenode/supabase-nextjs-image-api?utm_source=chatgpt.com`
