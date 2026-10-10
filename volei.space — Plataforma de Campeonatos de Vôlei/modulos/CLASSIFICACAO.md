---
title: >-
  Classificação
category: modulo
tags: [classificacao]
sources: [repo:athrios/volei-space/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md]
summary: >-
  A tabela continua só com grupos. O portal e a classificação públicos mostram o pódio do mata-mata ao lado.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Classificação

**Pódio no portal — implementado:** a tabela de `ClassificacaoEntrada` não recebe jogo de mata-mata. Em `/portal?ligaId=` e em `/classificacao`, quando a categoria tem chave, a tela mostra o pódio (campeão, vice e 3º), o placar da final, o placar do 3º lugar e a chave. O 1º e o 2º saem da final com vencedor; o 3º sai da disputa de 3º lugar. Isso não espera o status `FINALIZADO`. Sem chave, esse bloco não aparece. `GET /api/portal/mata-mata` recusa campeonato de teste. Fonte: [[modulos/MATA-MATA]].

**Implementado:** a página `/classificacao` lista os campeonatos públicos e abre a tabela na própria tela. `?ligaId=` expande esse campeonato quando ele entra na lista pública. `?categoria=` escolhe a categoria desse campeonato; sem ela, a tela abre a primeira. Equipes ativas da categoria aparecem com zero antes de qualquer partida, no que `GET /api/portal/classificacao` devolver. A página, o portal e `GET /api/classificacao` leem `ClassificacaoEntrada` filtrada por `categoriaCampeonatoId`. UUID inválido responde 422 antes do banco. Desde 9 de outubro de 2026, `recalculateLeagueClassification` grava o cálculo de `src/lib/classificacao.ts`: só entram partidas de fase `GERAL` ou `GRUPOS`; 2×0, 3×0 e 3×1 usam a faixa de margem 2 ou mais; 2×1 e 3×2 usam a faixa de 1 set; o set já fechado de uma partida `EM_ANDAMENTO` soma saldo de sets e de pontos dos dois lados, sem jogo, vitória ou ponto de campeonato; WO com vencedor conta como vitória. O placar do set em aberto fica na partida, não na tabela. O recálculo roda ao iniciar a partida, ao fechar um set, ao encerrar o jogo e antes de finalizar o campeonato. A tela escuta `ClassificacaoEntrada` pelo Realtime e relê a categoria ao reconectar. No painel, o aviso de espera da eliminatória usa a fase gravada em `Liga` e só permanece enquanto houver jogo de fase `GERAL` ou `GRUPOS` da categoria selecionada sem resultado. Jogo cancelado não segura essa espera.

**Divergência no banco:** a função `recalcular_classificacao_liga` que prevalece em `supabase-recalcular-classificacao-liga-atomico.sql` ainda pontua 4/3/1/0, mistura o mata-mata e não lê o set ao vivo. O servidor não chama mais essa RPC. `recalcular_classificacao_categoria` em `202610060003_classificacao_ao_vivo.sql` chega perto da regra, mas o set ao vivo só credita o vencedor e WO fica de fora. A trava `pg_advisory_xact_lock` precisa voltar em volta do cálculo novo. `calcular_pontos_resultado` ainda casa o placar exato.

**Aprovado, pendente:** confronto direto não faz parte dos critérios reconhecidos. Isolar a tabela por `categoriaCampeonatoId` no SQL continua dependendo da função de categoria. A consulta do aplicativo já filtra; as funções SQL não foram alteradas nesta entrega.

Resultado manual, aprovação histórica, súmula e correção precisam produzir tabela coerente. Classificação de fase de grupos e eliminatórias requer escopo correto; não misturar jogos de campeonatos ou fases. Ver [[modulos/SUMULA-DIGITAL]] e [[06-BANCO-DE-DADOS]].

**Categorias — aprovado, pendente:** a consulta pública e a do painel já separam a tabela por `categoriaCampeonatoId`. O recálculo SQL ainda não. Campeonato sem categoria continua sem esse filtro. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
