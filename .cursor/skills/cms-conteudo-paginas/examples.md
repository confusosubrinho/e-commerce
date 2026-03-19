## Exemplos de blocos (formato recomendado)

### Hero

```json
{
  "id": "b_01HZZZ7H3D2G9V9K8Z2X2N8M0Q",
  "type": "hero",
  "props": {
    "title": "Nova coleção",
    "subtitle": "Peças essenciais para o dia a dia",
    "primaryCta": { "label": "Comprar agora", "href": "/colecao/nova" },
    "image": { "mediaId": "m_01HZZZ9K..." }
  }
}
```

### Grid de cards

```json
{
  "id": "b_01HZZZB2...",
  "type": "cardGrid",
  "props": {
    "columns": 3,
    "items": [
      { "title": "Frete grátis", "description": "Acima de R$ 199", "icon": "truck" },
      { "title": "Troca fácil", "description": "7 dias", "icon": "refresh" },
      { "title": "Pix", "description": "5% off", "icon": "pix" }
    ]
  }
}
```

### Rich text (com “document model”)

Evite salvar HTML como fonte de verdade. Prefira um modelo estruturado (ex.: lexical/prosemirror).

```json
{
  "id": "b_01HZZZC3...",
  "type": "richText",
  "props": {
    "doc": {
      "type": "doc",
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Conteúdo editável..." }] }
      ]
    }
  }
}
```

## Exemplo de documento “Page”

```json
{
  "id": "p_01HZZZP...",
  "tenant_id": "t_01AAA...",
  "slug": "sobre",
  "status": "published",
  "title": "Sobre",
  "seo_title": "Sobre a Loja X",
  "seo_description": "Conheça nossa história, valores e propósito.",
  "canonical_url": "https://loja.exemplo.com/sobre",
  "noindex": false,
  "og_image_id": "m_01BBB...",
  "blocks": [
    { "id": "b_...", "type": "hero", "props": { "title": "Sobre nós" } },
    { "id": "b_...", "type": "richText", "props": { "doc": { "type": "doc", "content": [] } } }
  ],
  "published_at": "2026-03-18T12:00:00.000Z",
  "updated_at": "2026-03-18T12:34:00.000Z"
}
```

## Fluxo mínimo (Admin)

### 1) Criar página

- Criar `status=draft`
- Gerar `slug` (único por tenant)
- Inicializar `blocks` com 1–2 blocos padrão (ex.: hero + richText vazio)

### 2) Salvar draft

- Validar schema do documento (campos base + blocos)
- Persistir `blocks` e `updated_at`

### 3) Preview seguro

- Gerar token de preview curto (ex.: 10 min), atrelado a `tenant_id` + `page_id`
- URL de preview não deve ser indexável (ex.: `noindex`, headers)

### 4) Publicar

- `status=published`
- `published_at=now` (se primeira publicação)
- invalidar cache / revalidar rota

