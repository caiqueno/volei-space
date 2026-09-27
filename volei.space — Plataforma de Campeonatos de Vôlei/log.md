---
title: >-
  Log da wiki
category: area
tags: [log, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Registro append-only de ingestões, atualizações e manutenções do vault.
status: implementado
created: 2026-09-25
updated: 2026-09-25
---

# Log

## [2026-09-25] lint | prontidão e APIs

- pages_created=`synthesis/PRONTIDAO-E-APIS.md`
- pages_updated=`index`, `hot`, `02-ARQUITETURA`, `08-INTEGRACOES`, `11-DECISOES`, `modulos/INSCRICOES`, wikilinks `docs/requisitos` → `references`
- removed=`vault/.claude/skills` (cópia triplicada das skills)
- code=`scripts/team-registration-draft.test.ts` aponta para `supabase/migrations/`
- tests=pricing, team-sync, championship-setup, organizer-flow, registration-draft ok
- live=`GET /api/ping` 200 not_configured; rotas de dados 500 sem `.env`

## [2026-09-25] ingest | kepano/obsidian-skills

- source=`url:https://github.com/kepano/obsidian-skills`
- installed_to=`.agents/skills/`, `.cursor/skills/`, vault `.claude/skills/`
- skills=`obsidian-markdown`, `obsidian-bases`, `json-canvas`, `obsidian-cli`, `defuddle`, `knap`
- pages_created=`references/OBSIDIAN-SKILLS-KEPANO.md`

## [2026-09-25] ingest | LLM Wiki (Karpathy gist)

- source=`url:https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`
- pages_created=`raw/LLM-WIKI-KARPATHY.md`, `references/LLM-WIKI-KARPATHY.md`, `synthesis/LLM-WIKI-NO-VOLEI-SPACE.md`
- pages_updated=`AGENTS.md`, `00-INICIO.md`, `index.md`, `hot.md`, `.manifest.json`

## [2026-09-25] setup | schema llm-wiki-adaptado

- pages_created=index,log,hot,AGENTS,references/requisitos
- decisao="Aplicar mentalidade LLM Wiki ao vault de produto sem reorganizar áreas/módulos para concepts/entities"
