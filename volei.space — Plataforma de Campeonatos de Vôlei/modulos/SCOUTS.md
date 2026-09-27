---
title: >-
  Scouts
category: modulo
tags: [scouts]
sources: [repo:athrios/volei-space]
summary: >-
  Registro de scouts.
status: misto
created: 2026-09-20
updated: 2026-09-25
---
# Scouts e rankings

**Implementado:** ocorrências da partida e cálculo de scouts em `src/lib/player-scouts.ts`; rankings públicos em `src/app/api/rankings` e `src/app/rankings`. Estatística do campeonato acumula partidas consideradas oficiais; estatística do MVP no resumo usa apenas **a partida atual**.

**Aprovado, pendente:** sugerir MVP somente entre jogadores da vencedora por total de pontos de ataques, bloqueios e aces naquela partida; empate por aces, bloqueios e ataques. A escolha final pode ser manual, sempre na vencedora. Corrigir ocorrência ou MVP exige atualização dos rankings e do resumo.

Confirme identificação por `jogadorId`; descrições e números de camisa não devem substituir vínculo inequívoco quando disponível. Ver [[modulos/SUMULA-DIGITAL]].

**Categorias — aprovado, pendente:** scouts, rankings e destaques acumulados devem ser consultados e recalculados por `CategoriaCampeonato`, usando `categoriaCampeonatoId` sempre que aplicável. A escolha do MVP da partida segue a súmula, enquanto rankings de categorias diferentes não se misturam. O escopo textual atual precisa de migração. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
