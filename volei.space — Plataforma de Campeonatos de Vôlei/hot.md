---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  O organizador gera o link de inscrição do campeonato e o link do jogo. A massa LINK-FLOW-2026 está nos dois bancos.
status: implementado
created: 2026-09-25
updated: 2026-10-01
---

# Hot

## Foco atual

O organizador gera, na prévia e em Campeonatos → Ações, um link `/inscricao/campeonato/{token}`. A equipe abre esse endereço e o campeonato já vem identificado. O menu Árbitros e a lista para procurar partida saíram. O acesso do árbitro continua só pelo link do jogo e pelo código, na guia Jogos. A agenda geral não carrega mais todos os jogos de uma vez. A massa `LINK-FLOW-2026` está nos dois bancos, além da `TOURNAMENT-SEED-2026`. Fonte: [[modulos/INSCRICOES]] e [[modulos/PARTIDAS]].

## Key Takeaways

- **Não está pronto para uso real:** falta `.env` (Supabase, JWT, e-mail, InfinitePay).
- `GET /api/ping` = 200 `not_configured`. Rotas de dados = 500 sem banco.
- Testes de domínio passaram (pricing, sync, setup, organizador, rascunho).
- Skills kepano: só `.agents/skills` + `.cursor/skills`. Cópia no vault removida.
- Inscrição rápida, inscrições do campeonato e candidatura **coexistem**; convite por e-mail não tem tela.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
