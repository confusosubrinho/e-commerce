# Lovable – Boas Práticas de Uso

## Visão geral

Esta skill orienta o agente a trabalhar em projetos hospedados no Lovable seguindo as melhores práticas oficiais descritas em `https://docs.lovable.dev/tips-tricks/best-practice`.

Objetivo principal:  
**Evitar loops e quebras desnecessárias**, usando Knowledge file, Plan mode, Visual Edit e versionamento do Lovable de forma consistente.

---

## Quando ativar esta skill

Ative esta skill sempre que:

- O usuário mencionar **Lovable** ou o projeto for claramente um projeto criado no Lovable (`lovable.dev`, “Remix”, “T=0”, etc.).
- O usuário pedir ajuda para:
  - “organizar melhor as instruções”, “melhorar os prompts” ou “sair de um loop de bugs” em um projeto Lovable;
  - trabalhar com **Knowledge file**, **Plan mode**, **Visual Edit**, **Supabase** dentro do Lovable;
  - comparar versões (T–1, T–0), reverter, pin/“fixar” versões, ou usar **Remix**.
- O usuário estiver claramente frustrado com o projeto no Lovable (“a IA está quebrando tudo”, “entrou em loop”, etc.).

Palavras-chave que devem disparar esta skill (exemplos, não exaustivo):

- `lovable`, `lovable.dev`, `projeto Lovable`
- `Plan mode`, `Plan`, `modo plano`
- `Knowledge file`, `Knowledge`, `conhecimento do projeto`
- `Supabase` **dentro do Lovable**
- `Visual Edit`, `editar visualmente`
- `Remix`, `T=0`, `T–1`, `versão anterior`, `pin`, `fixar versão`

---

## Comportamento do agente ao usar esta skill

Sempre que esta skill estiver ativa, o agente deve:

1. **Reconhecer o contexto Lovable**
   - Entender que:
     - Cada alteração do Lovable é um **commit**;  
     - Existe histórico por tempo (`T–0`, `T–1`, etc.);  
     - O projeto pode ter **Supabase conectado**, o que torna reverts mais perigosos.
   - Jamais assumir que reverter no Lovable é “seguro” sem validar o esquema do banco.

2. **Usar e reforçar o uso do Knowledge file**
   - Se não existir (ou se estiver pobre), sugerir explicitamente ao usuário:
     - Criar/atualizar o Knowledge com:
       - visão do produto (PRD resumido),
       - jornadas de usuário,
       - papéis (roles),
       - features principais,
       - diretrizes de UI/UX.
   - Frase modelo para o usuário (em português, para ele colar no Lovable se quiser):
     - “Gere um Knowledge para meu projeto em T=0 com base nas features já implementadas.”

3. **Preferir Plan mode para planejamento e diagnóstico**
   - Quando:
     - o usuário estiver debugando algo complexo,
     - já tiver tido 2–3 tentativas falhas de “Try to Fix”,
     - estiver pedindo “como implementar X” em grande escala.
   - Orientar o usuário a:
     - Entrar em Plan mode e pedir “Sugira 3 maneiras de implementar X”;
     - Revisar e aprovar o plano antes de executar.

4. **Quebrar trabalho em blocos pequenos e testáveis**
   - Incentivar prompts no formato:
     - “No `/rota` implemente [uma coisa específica]. Comportamento esperado: [XYZ]. **Não** toque em [componentes/sistemas X] a menos que seja estritamente necessário.”
   - Reforçar:
     - Fazer **uma** alteração de comportamento por vez;
     - Testar por role (Admin, User, Investor, etc.) depois de cada bloco.

5. **Evitar efeitos colaterais e loops**
   - Sempre que o usuário relatar que “tudo quebrou” ou que o AI está em loop:
     - Sugerir sequência:
       1. Ir para Plan mode;
       2. Colar o erro / screenshot;
       3. Pedir algo como:
          - “Investigue sem quebrar outras features. Se necessário, volte à última versão estável e corrija a partir dela.”
   - Reforçar que é melhor:
     - Comparar T–1 x T–0 e entender o diff do que ficar aplicando patches cegamente.

6. **Cuidados específicos com Supabase no Lovable**
   - **Supabase não faz revert limpo** com o Lovable:
     - Se o usuário falar em “reverter para T–X” em projeto com Supabase:
       - Orientar a **validar o schema SQL de T=0**:
         - Conferir se migrations e tabelas batem com o estado esperado;
         - Avaliar se não houve mudança destrutiva.
   - Recomendar:
     - Conectar Supabase **após** o front-end/RSC estarem estáveis, quando possível;
     - Testar qualquer feature ligada a banco antes de publicar.

7. **Uso de Visual Edit para micro-ajustes de UI**
   - Sempre que o pedido for:
     - mudar texto, cores, fonte, espaçamento simples, alinhamento etc.,
   - Sugerir uso de **Visual Edit** em vez de grandes prompts de código, destacando que:
     - É rápido,
     - Não consome créditos,
     - Tem undo fácil.

8. **Uso disciplinado do versionamento / pin / Remix**
   - Reforçar boas práticas:
     - **Fixar (pin)** versões estáveis após implementar uma feature que está funcionando.
     - Em caso de bug:
       - Comparar T–1 x T–0 visualmente e entender o que mudou.
   - Quando o projeto estiver muito “poluído” ou quebrado:
     - Explicar o recurso **Remix**:
       - Cria uma cópia limpa do projeto em T=0;
       - Permite reconstruir com melhores prompts e Knowledge, usando o antigo só como referência;
       - Lembrar que: é preciso desconectar Supabase antes de usar Remix.

9. **Tom e orientações ao usuário**
   - Manter tom calmo, pragmático e encorajador:
     - Explicar que a reta final (últimos 5–10%) tende a ser mais lenta, porém crítica.
   - Encorajar:
     - Prompts mais longos e detalhados quando o usuário estiver frustrado;
     - Explicitar papéis (role) ao implementar permissões:
       - “Como Investor posso ver X, mas não editar. Não aplique essa lógica a Admin.”

---

## Exemplos de uso

### Exemplo 1 – Implementar feature em página específica

**Usuário:**  
“Na página `/settings`, quero implementar o toggle de dark mode com Tailwind, mas sem quebrar nada. Estou usando Lovable.”

**Agente (com esta skill):**

- Pergunta qual role/usuário é afetado, se relevante.
- Sugere usar Plan mode:
  - “Entre em Plan mode e peça:  
    `Sugira 3 maneiras de implementar um toggle de dark mode na página /settings, seguindo Tailwind. Não toque em /shared/Layout.tsx e componentes compartilhados a menos que seja necessário.`”
- Lembra de:
  - Focar primeiro na UI do toggle,
  - Depois conectar o estado,
  - Por fim persistência (se necessária),
  - Testar o comportamento e só então passar à próxima etapa.

### Exemplo 2 – Saindo de um loop de erros

**Usuário:**  
“A cada vez que peço pra corrigir esse erro a IA quebra outra parte do projeto.”

**Agente (com esta skill):**

- Pede para:
  - Entrar em Plan mode;
  - Colar screenshot / stack trace;
  - Usar um prompt orientado a investigação:
    - “Por favor, investigue este erro sem alterar outras partes do app. Se necessário, volte à última versão estável e proponha uma correção a partir dela.”
- Sugere:
  - Comparar T–1 com T–0 para ver quais arquivos mudaram;
  - Focar em corrigir a raiz do problema, não só o sintoma.

### Exemplo 3 – Supabase + revert

**Usuário:**  
“Conectei Supabase, quebrei as tabelas e agora quero só reverter o projeto pra T–3.”

**Agente (com esta skill):**

- Alerta:
  - Que reverts no Lovable **não** garantem que o schema Supabase volte ao estado inicial;
- Recomenda:
  - Validar o SQL/schema de T=0;
  - Verificar migrations aplicadas;
  - Se necessário, recriar parte do schema manualmente;
  - Considerar usar Remix para partir de um estado limpo, mantendo o projeto atual só como referência.

---

## Resumo rápido (para o próprio agente)

- **Sempre**: use Knowledge file, Plan mode e blocos pequenos.
- **Evite**: grandes mudanças de uma vez, especialmente com Supabase conectado.
- **Prefira**:
  - Visual Edit para micro-ajustes de UI;
  - Comparar T–1/T–0 em vez de aplicar patches cegos;
  - Remix quando o projeto estiver muito corrompido.
- **Lembre**: orientar o usuário a escrever prompts claros, com rota, role e escopo bem definidos.

