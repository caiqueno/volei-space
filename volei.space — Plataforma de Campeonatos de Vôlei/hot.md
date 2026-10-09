---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Geração de grupos e mata-mata grava a categoria e serie nula. A importação Winners usa o fluxo HTTP do app.
status: implementado
created: 2026-09-25
updated: 2026-10-09
---

# Hot

## Foco atual

A geração de grupos, o mata-mata e o calendário automático passam a gravar `categoriaCampeonatoId` e `serie` nula. Sem isso o gatilho recusa a partida. `Partida.atualizadoEm` ganha default `now()` na migration `202610090001`, ainda não aplicada em produção. O `GET` da estrutura devolve `sumulaToken`. O script `scripts/import-winners.mjs` cria Winners Oficial, Winners Teste e Winner QA pelo HTTP do app: inscrição aprovada, grupos, súmula e mata-mata em jogo único. No Winners Teste o campeão sai da final. A tabela continua só com a fase de grupos. Fonte: [[modulos/GRUPOS]], [[modulos/MATA-MATA]], [[modulos/PARTIDAS]].

## Key Takeaways

- A triagem de 4 de outubro de 2026 está na `main`. O portal por campeonato, a galeria e o botão Finalizar só em campeonato ativo entram na `main` em 5 de outubro.
- Em 5 de outubro a produção ganhou a função `selecionar_categorias_campeonato`, as políticas de upload e a coluna `Midia.thumbUrl`.
- A parametrização por categoria ativa e a comparação da replicação entram na `main` junto com o portal e a galeria.
- Produção, no commit `6f9c8f6`, responde `GET /api/ping` com alvo `producao`.
- Cada vaga parametrizada tem um link em `ConviteVagaEquipe`. O painel de jogos lê o `ligaId` da URL.
- O ao vivo do operador abre no painel (`/painel?secao=aovivo`). A súmula pública é só o registro; o lançamento fica em `/sumula/{token}/lancar`.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
