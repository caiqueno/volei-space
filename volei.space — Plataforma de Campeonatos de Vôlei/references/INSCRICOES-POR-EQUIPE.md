---
title: >-
  Referência — Inscrições por equipe
category: reference
tags: [inscricoes, requisito]
sources: [repo:athrios/volei-space/docs/requisitos/INSCRICOES-POR-EQUIPE.md]
summary: >-
  Destilação do requisito normativo de inscrição por convite de equipe na categoria.
status: aprovado-pendente
created: 2026-09-25
updated: 2026-09-25
---

# Inscrições por equipe (referência)

> [!important] Camada 1
> Fonte bruta imutável: [`docs/requisitos/INSCRICOES-POR-EQUIPE.md`](https://github.com/athrios/volei-space/blob/main/docs/requisitos/INSCRICOES-POR-EQUIPE.md). Esta página é destilação; em conflito, prevalece a fonte.

## Key Ideas

- Organizador gera link de convite **por categoria** antes da `Equipe` existir.
- Líder cadastra equipe e atletas; ao concluir, entra direto — **sem aprovação manual** (legado LUVA).
- Token limitado a campeonato + categoria + convite; não duplicar em repetição.
- Arquitetura-alvo: `ligaId` + `categoriaCampeonatoId` no servidor. ^[inferred]

## Wiki compilada

- [[modulos/INSCRICOES]] — nota operacional do módulo
- [[modulos/EQUIPES-E-ATLETAS]]
- [[04-FLUXOS]] · [[07-SEGURANCA]]
- [[references/CATEGORIAS-COMO-COMPETICOES]]
