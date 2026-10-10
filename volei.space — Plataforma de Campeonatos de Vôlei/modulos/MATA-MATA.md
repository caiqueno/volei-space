---
title: >-
  Mata-mata
category: modulo
tags: [mata-mata]
sources: [repo:athrios/volei-space]
summary: >-
  Classificados incluem os melhores gerais; a final define o campeão antes de finalizar.
status: misto
created: 2026-09-20
updated: 2026-10-09
---
# Mata-mata

**Implementado:** funções em `src/lib/mata-mata.ts`, `src/lib/classificados.ts` e `src/lib/eliminatorias.ts`; rotas de estrutura e chaveamento em `src/app/api/organizador/ligas/[id]/mata-mata`. A parametrização define formato e fase eliminatória; as validações de capacidade estão em `src/lib/championship-validation.ts`.

A chave legado usa os N primeiros de cada grupo e, em seguida, `melhoresClassificadosGerais`. Sem grupos, o mata-mata puro leva todas as equipes da tabela. O confronto seguinte só aceita os vencedores dos dois jogos que o alimentam; o 3º lugar só aceita os perdedores das semifinais e só existe quando `disputaTerceiroLugar` não está desligado. WO com `vencedorId` e sets 0×0 também avança. `POST /api/organizador/ligas/[id]/finalizar` recusa o campeonato sem campeão: final decidida no mata-mata, ou líder com jogo válido nos pontos corridos. A disputa de 3º lugar, quando ligada e há semifinal, também precisa estar decidida.

**Ainda no banco:** `classificados_categoria` não devolve ninguém quando o formato não é mata-mata e não há grupos. `criar_confronto_categoria` ignora `vencedorId` e não tem vaga para ida e volta — o índice único é um jogo por fase e slot. Um número ímpar de equipes no calendário automático continua sem bye, porque não há coluna para isso.

Relacionados: [[modulos/GRUPOS]], [[modulos/PARTIDAS]], [[modulos/SUMULA-DIGITAL]].

**Categorias — aprovado, pendente:** classificados e chaveamento pertencem a uma única `CategoriaCampeonato`, vinculada por `categoriaCampeonatoId` no modelo-alvo. Equipes de categorias diferentes não disputam a mesma eliminatória; correções e avanço devem preservar esse limite. A segmentação por string atual requer migração. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
