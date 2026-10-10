---
title: >-
  Classificação
category: modulo
tags: [classificacao]
sources: [repo:athrios/volei-space/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md]
summary: >-
  O cálculo segue em classificacao.ts. A gravação usa a mesma trava da súmula e persiste punicoes. A RPC antiga de 4/3/1/0 não é chamada. Com dois ou mais grupos, a tabela separa um bloco por grupo e desempata por confronto direto. W.O. sem placar segue a faixa de margem 2.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Classificação

**Pódio no portal — implementado:** a tabela de `ClassificacaoEntrada` não recebe jogo de mata-mata. Em `/portal?ligaId=` e em `/classificacao`, quando a categoria tem chave, a tela mostra o pódio (campeão, vice e 3º), o placar da final, o placar do 3º lugar e a chave. O 1º e o 2º saem da final com vencedor; o 3º sai da disputa de 3º lugar. Isso não espera o status `FINALIZADO`. Sem chave, esse bloco não aparece. `GET /api/portal/mata-mata` recusa campeonato de teste. Fonte: [[modulos/MATA-MATA]].

**Implementado:** a página `/classificacao` lista os campeonatos públicos e abre a tabela na própria tela. `?ligaId=` expande esse campeonato quando ele entra na lista pública. `?categoria=` escolhe a categoria desse campeonato; sem ela, a tela abre a primeira. Equipes ativas da categoria aparecem com zero antes de qualquer partida, no que `GET /api/portal/classificacao` devolver. A página, o portal e `GET /api/classificacao` leem `ClassificacaoEntrada` filtrada por `categoriaCampeonatoId`. UUID inválido responde 422 antes do banco. Desde 9 de outubro de 2026, `recalculateLeagueClassification` grava o cálculo de `src/lib/classificacao.ts`: só entram partidas de fase `GERAL` ou `GRUPOS`; 2×0, 3×0 e 3×1 usam a faixa de margem 2 ou mais; 2×1 e 3×2 usam a faixa de 1 set; o set já fechado de uma partida `EM_ANDAMENTO` soma saldo de sets e de pontos dos dois lados, sem jogo, vitória ou ponto de campeonato; WO com vencedor conta como vitória. Sem `woSetsVencedor`, o W.O. continua com zero sets e a faixa de margem de 2 ou mais. Com o placar configurado, sets e pontos do rally entram no saldo; `woPunicaoPontos` sai dos pontos de quem perde e soma em `punicoes`. Ausente ou zero não muda o campeonato. `20261010150000_wo_configuravel.sql` ainda não foi aplicada. O placar do set em aberto fica na partida, não na tabela. O recálculo roda ao iniciar a partida, ao fechar um set, ao encerrar o jogo e antes de finalizar o campeonato. A tela escuta `ClassificacaoEntrada` pelo Realtime e relê a categoria ao reconectar. No painel, o aviso de espera da eliminatória usa a fase gravada em `Liga` e só permanece enquanto houver jogo de fase `GERAL` ou `GRUPOS` da categoria selecionada sem resultado. Jogo cancelado não segura essa espera.

**Divergência no banco:** a função `recalcular_classificacao_liga` que prevalece em `supabase-recalcular-classificacao-liga-atomico.sql` ainda pontua 4/3/1/0, mistura o mata-mata e não lê o set ao vivo. O servidor não chama essa RPC nem a recria. `recalcular_classificacao_categoria` em `202610060003_classificacao_ao_vivo.sql` chega perto da regra, mas o set ao vivo só credita o vencedor e WO fica de fora. `calcular_pontos_resultado` ainda casa o placar exato.

**Trava — implementado no código, migration pendente:** `gravar_classificacao_calculada` grava as linhas já calculadas por `src/lib/classificacao.ts` dentro de `pg_advisory_xact_lock(liga)`, a mesma trava de `gravar_sumula_partida`. A linha leva `punicoes` do W.O. Partida com categoria usa as faixas, o tie-break e o placar de W.O. de `CategoriaConfiguracao`. Sem categoria, o set ao vivo usa as colunas da `Liga` (pontos e tie-break dela; terceiro set obrigatório desligado). `20261010137000_sumula_transacional.sql` não foi aplicada. Enquanto a função não existir, a gravação volta ao upsert sem trava e ainda grava `punicoes`.

**Confronto direto — implementado na leitura:** quando a categoria tem dois ou mais grupos, `GET /api/classificacao` e `GET /api/portal/classificacao` devolvem `grupos` além de `linhas`. Cada bloco reordena as equipes daquele grupo. Empate nos critérios anteriores ao confronto direto usa os jogos encerrados só entre os empatados. A posição gravada em `ClassificacaoEntrada` continua global e não inclui esse critério, para não mudar a tabela de quem não tem grupos. A função SQL ainda ignora `CONFRONTO_DIRETO`.

**Aprovado, pendente:** isolar a tabela por `categoriaCampeonatoId` no SQL continua dependendo da função de categoria. A consulta do aplicativo já filtra; as funções SQL não foram alteradas nesta entrega.

Resultado manual, aprovação histórica, súmula e correção precisam produzir tabela coerente. Classificação de fase de grupos e eliminatórias requer escopo correto; não misturar jogos de campeonatos ou fases. Ver [[modulos/SUMULA-DIGITAL]] e [[06-BANCO-DE-DADOS]].

**Categorias — aprovado, pendente:** a consulta pública e a do painel já separam a tabela por `categoriaCampeonatoId`. O recálculo SQL ainda não. Campeonato sem categoria continua sem esse filtro. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
