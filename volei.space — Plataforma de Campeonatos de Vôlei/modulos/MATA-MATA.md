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
updated: 2026-10-09
---
# Mata-mata

**Implementado:** funções em `src/lib/mata-mata.ts` e `src/lib/eliminatorias.ts`; rotas de estrutura e chaveamento em `src/app/api/organizador/ligas/[id]/mata-mata`. A parametrização define formato e fase eliminatória; as validações de capacidade estão em `src/lib/championship-validation.ts`. O insert da chave grava `categoriaCampeonatoId` da equipe e `serie` nula, e recusa confronto entre categorias diferentes. O mata-mata é jogo único: volta responde 409 na rota e o índice parcial do banco também impede o segundo jogo. A classificação vigente soma só fases `GERAL` e `GRUPOS`; a chave não entra na tabela.

A chave usa equipes elegíveis do campeonato, com a quantidade exigida pela fase escolhida. Resultado e classificação de grupos não devem contar indevidamente partidas eliminatórias. Corrigir uma súmula de eliminatória pode exigir recalcular avanço ou sinalizar conflitos com jogos posteriores; verificar esse impacto antes de automatizar.

Relacionados: [[modulos/GRUPOS]], [[modulos/PARTIDAS]], [[modulos/SUMULA-DIGITAL]].

**Categorias — aprovado, pendente:** o insert da chave já isola a categoria, mas o avanço e a página pública ainda leem `Liga.faseEliminatoria` e `classificadosPorGrupo`, não só a configuração da categoria. As duas camadas precisam estar preenchidas. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
