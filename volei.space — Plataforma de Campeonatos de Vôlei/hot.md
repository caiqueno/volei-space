---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  O acesso do árbitro é por link e código. A massa TOURNAMENT-SEED-2026 tem 400 jogos nos dois bancos.
status: implementado
created: 2026-09-25
updated: 2026-10-01
---

# Hot

## Foco atual

O organizador gera, na guia Jogos, um link exclusivo por partida e define o código. O árbitro abre `/arbitro/jogo/{token}`, informa o código e cai na tela daquele jogo. A massa `TOURNAMENT-SEED-2026` está nos dois bancos: 10 campeonatos e 400 partidas, identificadas por `seedKey`. Os 8 campeonatos que já existiam em produção foram mantidos. Fonte: [[06-BANCO-DE-DADOS]] e [[modulos/PARTIDAS]].

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
