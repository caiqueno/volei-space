---
title: >-
  Classificação
category: modulo
tags: [classificacao]
sources: [repo:athrios/volei-space/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md]
summary: >-
  A tabela do servidor usa faixa de sets, ignora o mata-mata e soma o set já fechado.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Classificação

**Implementado:** a página `/classificacao` lista os campeonatos públicos e abre a tabela na própria tela. `?ligaId=` expande esse campeonato quando ele entra na lista pública. Equipes ativas aparecem com zero antes de qualquer partida, no que `GET /api/portal/classificacao` devolver. A página lê `ClassificacaoEntrada`. Desde 9 de outubro de 2026, `recalculateLeagueClassification` grava o cálculo de `src/lib/classificacao.ts`: só entram partidas de fase `GERAL` ou `GRUPOS`; 2×0, 3×0 e 3×1 usam a faixa de margem 2 ou mais; 2×1 e 3×2 usam a faixa de 1 set; o set já fechado de uma partida `EM_ANDAMENTO` soma saldo de sets e de pontos dos dois lados, sem jogo, vitória ou ponto de campeonato; WO com vencedor conta como vitória. O placar do set em aberto fica na partida, não na tabela. O recálculo roda ao iniciar a partida, ao fechar um set, ao encerrar o jogo e antes de finalizar o campeonato. A tela escuta `ClassificacaoEntrada` pelo Realtime e relê o campeonato ao reconectar.

**Divergência no banco:** a função `recalcular_classificacao_liga` que prevalece em `supabase-recalcular-classificacao-liga-atomico.sql` ainda pontua 4/3/1/0, mistura o mata-mata e não lê o set ao vivo. O servidor não chama mais essa RPC. `recalcular_classificacao_categoria` em `202610060003_classificacao_ao_vivo.sql` chega perto da regra, mas o set ao vivo só credita o vencedor e WO fica de fora. A trava `pg_advisory_xact_lock` precisa voltar em volta do cálculo novo. `calcular_pontos_resultado` ainda casa o placar exato.

**Aprovado, pendente:** confronto direto não faz parte dos critérios reconhecidos. Isolar a tabela por `categoriaCampeonatoId` no SQL continua dependendo da função de categoria.

Resultado manual, aprovação histórica, súmula e correção precisam produzir tabela coerente. Classificação de fase de grupos e eliminatórias requer escopo correto; não misturar jogos de campeonatos ou fases. Ver [[modulos/SUMULA-DIGITAL]] e [[06-BANCO-DE-DADOS]].

**Categorias — aprovado, pendente:** cada `CategoriaCampeonato` terá tabela e classificados próprios. Recálculo e consulta pública devem usar `categoriaCampeonatoId` na arquitetura-alvo e jamais somar partidas de outra categoria; o modelo atual por strings pode misturá-las. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
