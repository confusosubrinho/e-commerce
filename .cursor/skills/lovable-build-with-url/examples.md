# Exemplos — Lovable Build with URL

## Exemplo A — Link básico (prompt simples)

Prompt (humano):

> Crie um app de tarefas (todo) com login e lista de tarefas por usuário.

URL (exemplo com encoding mínimo):

`https://lovable.dev/?autosubmit=true#prompt=Crie%20um%20app%20de%20tarefas%20(todo)%20com%20login%20e%20lista%20de%20tarefas%20por%20usu%C3%A1rio.`

## Exemplo B — Link com 1 imagem de referência

`https://lovable.dev/?autosubmit=true#prompt=Crie%20uma%20landing%20page%20minimalista%20com%20hero%20e%20CTA&images=https%3A%2F%2Fexemplo.com%2Fref.webp`

## Exemplo C — Link com múltiplas imagens (até 10)

`https://lovable.dev/?autosubmit=true#prompt=Crie%20uma%20p%C3%A1gina%20que%20exibe%20as%20imagens%20abaixo%20em%20grid%20responsivo&images=https%3A%2F%2Fexemplo.com%2F1.png&images=https%3A%2F%2Fexemplo.com%2F2.jpg&images=https%3A%2F%2Fexemplo.com%2F3.webp`

## Exemplo D — Prompt longo (recomendação prática)

Se o prompt ficar grande, prefira:

- condensar requisitos no essencial
- mover detalhes para dentro do app (ex.: documento/README), não no link

Ainda assim, formato base:

`https://lovable.dev/?autosubmit=true#prompt=SEU_PROMPT_URL_ENCODED`

## Exemplo E — Template de resposta (o que entregar ao usuário)

- **URL final**: `https://lovable.dev/?autosubmit=true#prompt=...&images=...`
- **Prompt original** (sem encoding):
  - `<cole aqui>`
- **Checklist rápido**:
  - `autosubmit=true` presente
  - `#prompt=` presente
  - imagens públicas (se houver)
