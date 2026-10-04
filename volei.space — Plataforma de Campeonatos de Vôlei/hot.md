---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  O interessado pede acesso de organizador. O administrador libera. Cada organizador só altera os próprios dados. O portal tem Ao vivo.
status: implementado
created: 2026-09-25
updated: 2026-10-04
---

# Hot

## Foco atual

O acesso de organizador começa em Entrar: Membro ou Seja membro. O interessado informa nome, e-mail e telefone. O administrador libera a conta. Cada organizador só altera os próprios campeonatos, equipes, jogadores e partidas. O portal tem a página Ao vivo. A massa Marcos/Antonio fica só no banco de desenvolvimento. Fonte: [[07-SEGURANCA]].

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
