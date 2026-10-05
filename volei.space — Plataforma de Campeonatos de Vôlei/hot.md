---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  O organizador entra por Seja membro. O painel lista só o elenco dele. O Ao vivo público não mostra campeonato de teste.
status: implementado
created: 2026-09-25
updated: 2026-10-04
---

# Hot

## Foco atual

O acesso de organizador é só Seja membro: nome, e-mail e telefone. O administrador libera e pode reenviar a senha. A listagem de equipe e jogador, com a sessão do organizador, fica nos campeonatos dele. A ativação do campeonato não simula Pix. A súmula oficial pede 8 substituições persistidas e o MVP da vencedora. O Ao vivo público ignora massa de teste e relê a cada 2 segundos. O link de inscrição é por categoria. Fonte: [[13-TRIAGEM-PRODUTO]].

## Key Takeaways

- A triagem de 4 de outubro de 2026 está na `main`.
- Produção, no commit `6f9c8f6`, responde `GET /api/ping` com alvo `producao`.
- O link é por categoria. O convite exclusivo de uma equipe apontada, antes de existir `Equipe`, continua pendente.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
