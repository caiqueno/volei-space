# AGENTS — schema do vault volei.space (LLM-WIKI)

Este cofre é um artefato **compilado**: o conhecimento do produto é destilado uma vez e mantido atualizado — não redescoberto a cada pergunta.

**Padrão-fonte:** [LLM Wiki — Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) · cópia imutável [[raw/LLM-WIKI-KARPATHY]] · destilação [[references/LLM-WIKI-KARPATHY]] · aplicação [[synthesis/LLM-WIKI-NO-VOLEI-SPACE]].

## Três camadas

| Camada | Onde | Regra |
| --- | --- | --- |
| **1. Fontes brutas** | `docs/requisitos/*.md`, código em `src/`, migrations, PRs, pasta `raw/` | Imutáveis para a wiki. Não editar requisito normativo nem o gist sob o pretexto de “atualizar a nota”. |
| **2. Wiki** | Este vault Obsidian | Conhecimento destilado, com `[[wikilinks]]`, estado (implementado / aprovado pendente / histórico) e proveniência. |
| **3. Schema** | Este `AGENTS.md` + `CLAUDE.md` na raiz do repo | Diz *como* manter a wiki (Ingest / Query / Lint). |

Entrada humana e de agentes: [[00-INICIO]]. Catálogo: [[index]]. Log: [[log]]. Sessão quente: [[hot]].

## Categorias deste produto (não usar concepts/entities genéricos)

| Pasta / padrão | `category` | Uso |
| --- | --- | --- |
| `00`–`12-*.md` na raiz | `area` | Áreas permanentes do produto |
| `modulos/` | `modulo` | Notas de módulo operacional |
| `historico/` | `historico` | Legado LUVA e material sem força normativa |
| `references/` | `reference` | Destilação de uma fonte bruta (requisito, PR, doc) |
| `synthesis/` | `synthesis` | Análises que cruzam várias áreas/módulos |
| `journal/` | `journal` | Sessões e observações datadas |
| `raw/` | — | Fontes brutas imutáveis (ex.: gist Karpathy); o LLM só lê |
| `_raw/` | — | Inbox: rascunhos; promover na próxima ingestão, não tratar como verdade |

## Frontmatter obrigatório

Toda página da wiki (exceto `_raw/` e arquivos só de sistema) deve ter:

```yaml
---
title: >-
  Título
category: area | modulo | historico | reference | synthesis | journal
tags: [tag1, tag2]
sources: [repo:athrios/volei-space/docs/requisitos/ARQUIVO.md]
summary: >-
  Uma ou duas frases (≤200 chars).
status: implementado | aprovado-pendente | historico | misto
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

- `sources` usa chaves portáveis (`repo:…`, `url:…`), nunca caminho absoluto de máquina.
- Claims inferidos (não literais na fonte) devem ser marcados no corpo com `^[inferred]` quando relevante.
- **Compile, não duplique:** atualize a página existente; não crie segunda nota para o mesmo conceito.

## Estados do produto (vocabulário obrigatório)

- **Implementado** — confirmado em rotas, modelos ou migrations; ainda sujeito a validação no ambiente.
- **Aprovado, pendente** — regra do dono do produto; não apresentar como pronta.
- **Histórico** — fluxo antigo (ex.: LUVA); sem força normativa.

## Operações (Karpathy → este vault)

| Operação | Como pedir / o que fazer |
| --- | --- |
| **Ingest** | Nova fonte em `raw/` ou `docs/requisitos/` → destilar → tocar páginas ligadas → [[index]] + [[log]] + `.manifest.json` |
| **Query** | Responder com `[[wikilinks]]`; se a resposta for durável, arquivar em `synthesis/` ou no módulo |
| **Lint** | Contradições, órfãos, claims “implementado” sem código, legado LUVA vazando |

Após qualquer escrita:

1. Atualizar `updated` no frontmatter das páginas tocadas.
2. Atualizar [[index]] se criou/renomeou/removeu página.
3. Acrescentar linha em [[log]] (`## [YYYY-MM-DD] ingest\|query\|lint\|decisao | título`).
4. Atualizar [[hot]] (~resumo da sessão, ≤500 palavras).
5. Atualizar `.manifest.json` se ingeriu ou reprocessou fonte da camada 1.

## Isolamento e produto

- volei.space é **SaaS multi-organizador**, não a liga LUVA.
- `Liga` / `ligaId` / LUVA no código são legado de nomenclatura.
- Preservar isolamento: organizador → campeonato → categoria → equipe.
- Fontes normativas de inscrição e súmula: camada 1 em `docs/requisitos/`.

## Formato Obsidian

Ao criar ou editar notas neste vault, seguir a skill **obsidian-markdown** (instalada via [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills)): wikilinks `[[Nota]]`, callouts `> [!type]`, properties no frontmatter. Catálogo: [[references/OBSIDIAN-SKILLS-KEPANO]].

## O que não fazer

- Não abrir a raiz `volei-space` como vault (só esta pasta).
- Não tratar `_raw/` como documentação publicada.
- Não restaurar regras LUVA (aprovação manual de equipe, séries Ouro/Prata) como regra atual.
- Não inventar comportamento “implementado” a partir de requisito pendente.
