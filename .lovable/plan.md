

# Melhoria de UI/UX do Blog — Admin + Front-end + Mobile

## Resumo

Melhorar a experiência do blog em 3 frentes: painel admin (formulário de post, upload de imagem com opção de galeria ou dispositivo, dimensão sugerida), front-end público (cards, tipografia, responsividade mobile), e página interna do post (layout, legibilidade, compartilhamento).

## Mudanças

### 1. Admin — BlogAdmin.tsx (reescrita significativa)

**Upload de imagem melhorado:**
- Dois botões claros: "Enviar do dispositivo" e "Escolher da galeria" (reusa `MediaPickerDialog` existente)
- Sugestão de dimensão visível: "Recomendado: 1200×630px (16:9)" — não hardcoded, lido do componente
- Preview maior da imagem com botão de remover
- Drag & drop zone para a imagem

**UX do formulário:**
- Melhor layout mobile: tabs empilhadas, campos full-width
- Grid 1 coluna em mobile para status/data
- Contador de caracteres visual para SEO com barra de progresso (verde/amarelo/vermelho)
- Preview do Google mais realista no SEO tab
- Lista de posts: layout em cards no mobile em vez de row comprimida, mostrando thumbnail maior

**Lista de posts:**
- Cards visuais com thumbnail, título, status badge, data, slug
- No mobile: stack vertical com imagem no topo
- Skeleton loading para a lista

### 2. Front-end — BlogPage.tsx

**Melhorias visuais:**
- Hero/destaque do primeiro post (featured post grande no topo)
- Cards com hover elevação suave e border-radius consistente
- Autor e data mais visíveis
- No mobile: grid 1 coluna com cards full-width
- Empty state mais amigável com ilustração

### 3. Front-end — BlogPostPage.tsx

**Melhorias:**
- Imagem destacada full-width com aspect-ratio 16:9
- Melhor tipografia do conteúdo (prose classes aprimoradas)
- Breadcrumb: Home > Blog > Post
- Botão de compartilhar (copiar link / WhatsApp)
- No mobile: padding reduzido, imagem full-bleed, texto maior

### 4. Admin — Upload de imagem com MediaPickerDialog

- Integrar o `MediaPickerDialog` já existente no formulário do blog
- Estado `showMediaPicker` para abrir/fechar o dialog
- Callback `onSelect` seta `featured_image_url`
- Botão "Remover imagem" quando houver imagem selecionada

## Arquivos modificados

- `src/pages/admin/BlogAdmin.tsx` — UI/UX do admin, integração MediaPicker, upload melhorado, mobile
- `src/pages/BlogPage.tsx` — Layout público melhorado, featured post, mobile
- `src/pages/BlogPostPage.tsx` — Layout do post, breadcrumb, compartilhamento, mobile

## Nenhuma mudança de banco de dados necessária

A estrutura de tabelas `blog_posts` e `blog_settings` já atende todos os requisitos. O upload usa o bucket `product-media` existente.

