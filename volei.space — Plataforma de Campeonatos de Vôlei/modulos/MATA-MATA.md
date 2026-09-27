---
title: >-
  Mata-mata
category: modulo
tags: [mata-mata]
sources: [repo:athrios/volei-space]
summary: >-
  Fase eliminatória.
status: misto
created: 2026-09-20
updated: 2026-09-25
---
# Mata-mata

**Implementado:** funções em `src/lib/mata-mata.ts` e `src/lib/eliminatorias.ts`; rotas de estrutura e chaveamento em `src/app/api/organizador/ligas/[id]/mata-mata`. A parametrização define formato e fase eliminatória; as validações de capacidade estão em `src/lib/championship-validation.ts`.

A chave usa equipes elegíveis do campeonato, com a quantidade exigida pela fase escolhida. Resultado e classificação de grupos não devem contar indevidamente partidas eliminatórias. Corrigir uma súmula de eliminatória pode exigir recalcular avanço ou sinalizar conflitos com jogos posteriores; verificar esse impacto antes de automatizar.

Relacionados: [[modulos/GRUPOS]], [[modulos/PARTIDAS]], [[modulos/SUMULA-DIGITAL]].

**Categorias — aprovado, pendente:** classificados e chaveamento pertencem a uma única `CategoriaCampeonato`, vinculada por `categoriaCampeonatoId` no modelo-alvo. Equipes de categorias diferentes não disputam a mesma eliminatória; correções e avanço devem preservar esse limite. A segmentação por string atual requer migração. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
