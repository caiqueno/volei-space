---
title: >-
  Referência — Categorias como competições
category: reference
tags: [categorias, requisito]
sources: [repo:athrios/volei-space/docs/requisitos/CATEGORIAS-COMO-COMPETICOES.md]
summary: >-
  Destilação do requisito de categorias isoladas com CategoriaCampeonato.
status: misto
created: 2026-09-25
updated: 2026-10-10
---

# Categorias como competições isoladas (referência)

> [!important] Camada 1
> Fonte bruta: requisito de categorias no repositório (`docs/requisitos/CATEGORIAS-COMO-COMPETICOES.md`).

## Key Ideas

- Cada categoria da `Liga` é competição interna independente.
- Modelo-alvo: entidade `CategoriaCampeonato` e chave `categoriaCampeonatoId`.
- Isolamento de grupos, calendário, chave e leituras públicas está no aplicativo desde 10/10/2026. Convite, recálculo SQL e o restante do requisito continuam pendentes. Nenhuma migration nova.
- Séries Ouro/Prata são legado LUVA — não regem fluxos novos.

## Wiki compilada

- [[03-REGRAS-DE-NEGOCIO]] · [[11-DECISOES]]
- [[modulos/INSCRICOES]] · [[modulos/PARAMETRIZACAO]]
- [[historico/LEGADO-LUVA]]
