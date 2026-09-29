---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  No perfil do organizador, Início, tabela e galeria leem os campeonatos numa consulta. A guia já visitada fica montada.
status: implementado
created: 2026-09-25
updated: 2026-09-29
---

# Hot

## Foco atual

No perfil do organizador, Início, tabela e galeria leem os campeonatos numa consulta. A guia já visitada fica montada. Fonte: [[09-UI-UX]].

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
