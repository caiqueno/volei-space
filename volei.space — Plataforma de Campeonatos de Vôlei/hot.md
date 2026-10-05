---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  O portal pede um campeonato antes dos jogos. A galeria, o cadastro em três passos e o botão finalizar só em campeonato ativo seguem para a main.
status: implementado
created: 2026-09-25
updated: 2026-10-05
---

# Hot

## Foco atual

O portal público pede um campeonato e só então carrega os jogos dele, em páginas curtas. A galeria fica no campeonato, com foto principal em `Liga.capaUrl` e fotos em `Midia.thumbUrl`. O organizador cria o primeiro campeonato com nome, categoria e link; a estrutura não espera o pagamento simulado. «Finalizar campeonato» só aparece com status `ATIVA`. Esta fatia segue para a `main`. Fonte: [[modulos/PARTIDAS]].

## Key Takeaways

- A triagem de 4 de outubro de 2026 está na `main`. O portal por campeonato, a galeria e o botão Finalizar só em campeonato ativo entram na `main` em 5 de outubro.
- Em 5 de outubro a produção ganhou a função `selecionar_categorias_campeonato`, as políticas de upload e a coluna `Midia.thumbUrl`.
- A parametrização por categoria ativa e a comparação da replicação entram na `main` junto com o portal e a galeria.
- Produção, no commit `6f9c8f6`, responde `GET /api/ping` com alvo `producao`.
- O link é por categoria. O convite exclusivo de uma equipe apontada, antes de existir `Equipe`, continua pendente.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
