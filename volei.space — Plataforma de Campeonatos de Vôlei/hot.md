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
updated: 2026-10-02
---

# Hot

## Foco atual

O cadastro do campeonato trata Categorias como a 5ª etapa de Informações. Cada salvamento bem-sucedido abre a etapa seguinte. Mata-mata não passa por Classificação. Fonte: [[modulos/PARAMETRIZACAO]].

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
