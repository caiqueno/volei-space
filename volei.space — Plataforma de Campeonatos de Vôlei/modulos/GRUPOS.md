---
title: >-
  Grupos
category: modulo
tags: [grupos]
sources: [repo:athrios/volei-space]
summary: >-
  Fase de grupos.
status: misto
created: 2026-09-20
updated: 2026-10-09
---
# Grupos

**Implementado:** configuração de quantidade e regras em `setup/estrutura`; distribuição real de equipes e confrontos em `src/app/api/organizador/ligas/[id]/estrutura/route.ts`; migrations de grupos em `supabase/migrations`. A geração exige que as equipes aprovadas compartilhem uma `CategoriaCampeonato`, grava `categoriaCampeonatoId` no grupo, no vínculo e na partida, e deixa `serie` nula — o gatilho `guard_category_scope` recusa série. `GET` da estrutura devolve `setsPorA`, `setsPorB` e `sumulaToken`, senão a súmula do árbitro não acha a partida. `Partida.atualizadoEm` tem default `now()` na migration `202610090001_partida_atualizado_em_default.sql`; sem isso o insert do cliente chega nulo e o banco recusa o confronto. Essa migration ainda não está aplicada em produção.

A definição de grupos do campeonato não se confunde com o convite de equipe por categoria. Convites não devem entrar na distribuição competitiva até o cadastro da equipe estar concluído. Quantidade de classificados deve ser compatível com a fase eliminatória configurada.

Para apresentação pública e classificação, preserve o campeonato, categoria e fase corretos. Ver [[modulos/PARAMETRIZACAO]], [[modulos/INSCRICOES]], [[modulos/MATA-MATA]].

**Aprovado, pendente:** a geração já recusa elenco de categorias diferentes, mas outras leituras ainda usam a string `categoria`. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
