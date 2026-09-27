---
title: >-
  Obsidian Skills (kepano)
category: reference
tags: [obsidian, skills, llm-wiki]
sources: [url:https://github.com/kepano/obsidian-skills]
summary: >-
  Skills de agente para Markdown Obsidian, Bases, Canvas, CLI, Defuddle e Knap.
status: implementado
created: 2026-09-25
updated: 2026-09-25
---

# Obsidian Skills (kepano)

> [!important] Fonte
> Repositório: [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills). Instalado neste projeto em `.agents/skills/` e espelhado em `.cursor/skills/` e no vault em `.claude/skills/`.

## Skills instaladas

| Skill | Quando usar |
| --- | --- |
| `obsidian-markdown` | Wikilinks, callouts, properties, embeds em `.md` |
| `obsidian-bases` | Arquivos `.base` (views, filtros, fórmulas) |
| `json-canvas` | Arquivos `.canvas` (JSON Canvas) |
| `obsidian-cli` | CLI do Obsidian (plugins/temas) |
| `defuddle` | Extrair markdown limpo de páginas web |
| `knap` | Templates Markdown a partir de JSON/CSV |

## Como reinstalar / atualizar

```bash
npx skills add https://github.com/kepano/obsidian-skills
```

## Relação com LLM Wiki

Estas skills ensinam o agente a **escrever formatos Obsidian corretos**. O schema do produto continua em [[AGENTS]]; o padrão Karpathy em [[references/LLM-WIKI-KARPATHY]].

Ao editar o vault, preferir `obsidian-markdown` (callouts, wikilinks, frontmatter).
