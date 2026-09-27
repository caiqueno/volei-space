---
title: >-
  LLM Wiki no volei.space
category: synthesis
tags: [llm-wiki, produto, synthesis]
sources: [url:https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f, raw/LLM-WIKI-KARPATHY.md]
summary: >-
  Como o padrão Karpathy se instancia neste vault de produto.
status: implementado
created: 2026-09-25
updated: 2026-09-25
---

# LLM Wiki no volei.space

Padrão-fonte: [[references/LLM-WIKI-KARPATHY]]. Schema operacional: [[AGENTS]].

## Mapeamento

| Karpathy | Aqui |
| --- | --- |
| Raw sources | `docs/requisitos/*`, `src/`, PRs, `raw/` |
| Wiki pages | `00`–`12`, `modulos/`, `references/`, `historico/` |
| Schema (`AGENTS.md`) | [[AGENTS]] + `CLAUDE.md` |
| index / log | [[index]] / [[log]] |
| Filtrar respostas boas de volta | `synthesis/`, `journal/`, atualizar módulo |
| Graph Obsidian | Exibição em gráfico do vault |

## Fluxo recomendado

1. Fonte nova → `raw/` ou commit em `docs/requisitos/` (não editar requisito “pela wiki”).
2. Pedir **ingest** ao agente → destila em `references/` + atualiza módulos/áreas.
3. Perguntas de produto → responder com citação `[[wikilink]]`; se a resposta for durável, arquivar em `synthesis/` ou no módulo.
4. De tempos em tempos: **lint** (órfãos, contradições implementado vs pendente, legado LUVA vazando).

## Fora de escopo (de propósito)

- RAG com embeddings (escala atual cabe no [[index]]).
- Reescrever o gist: ele permanece em [[raw/LLM-WIKI-KARPATHY]].
