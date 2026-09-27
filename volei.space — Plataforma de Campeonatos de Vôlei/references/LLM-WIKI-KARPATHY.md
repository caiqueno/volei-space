---
title: >-
  LLM Wiki (Karpathy) — padrão
category: reference
tags: [llm-wiki, schema, referencia]
sources: [url:https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f, raw/LLM-WIKI-KARPATHY.md]
summary: >-
  Destilação do gist de Andrej Karpathy: wiki persistente compilada por LLM, não RAG a cada pergunta.
status: implementado
created: 2026-09-25
updated: 2026-09-25
---

# LLM Wiki (Karpathy)

> [!important] Camada 1
> Texto integral imutável: [[raw/LLM-WIKI-KARPATHY]]. Original: [gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). Schema deste produto: [[AGENTS]].

## Ideia central

RAG clássico **redescobre** conhecimento a cada pergunta. O padrão LLM Wiki **compila** uma wiki em Markdown interligada: ao ingerir uma fonte, o LLM atualiza páginas, cruza referências, marca contradições e mantém a síntese viva. A wiki é um artefato **persistente e acumulativo**.

- Você cura fontes e faz boas perguntas.
- O LLM escreve e mantém a wiki (resumo, links, índice, log).
- Obsidian = IDE; LLM = programador; wiki = codebase.

## Arquitetura (3 camadas)

| Camada | No volei.space |
| --- | --- |
| Fontes brutas (imutáveis) | `docs/requisitos/`, código, e `raw/` (ex.: este gist) |
| Wiki (LLM mantém) | este vault (`modulos/`, áreas `00`–`12`, `references/`, …) |
| Schema | [[AGENTS]] + `CLAUDE.md` na raiz do repo |

## Operações

1. **Ingest** — nova fonte em `raw/` ou `docs/requisitos/` → destilar → atualizar páginas ligadas → [[index]] → [[log]].
2. **Query** — perguntar contra a wiki; respostas boas **voltam** como páginas (`synthesis/`, `journal/`, módulo).
3. **Lint** — periodicamente: contradições, órfãos, claims velhos, links faltando.

## Arquivos especiais (Karpathy)

- [[index]] — catálogo por categoria (o LLM lê primeiro).
- [[log]] — cronologia append-only (`## [data] operação | título`).
- Neste vault também: [[hot]] (snapshot de sessão) e `.manifest.json`.

## Por que funciona aqui

Manutenção de wiki (cross-links, estados implementado/pendente/histórico, isolamento de categoria) é o trabalho chato que o time não quer fazer. O LLM faz o bookkeeping; você decide o produto.

## Instanciação volei.space

Não usamos pastas genéricas `concepts/` / `entities/` do ecossistema obsidian-wiki: o domínio é produto SaaS. Categorias: `area`, `modulo`, `historico`, `reference`, `synthesis`, `journal` — ver [[AGENTS]].

Síntese da aplicação: [[synthesis/LLM-WIKI-NO-VOLEI-SPACE]].
