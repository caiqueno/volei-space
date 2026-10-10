---
title: >-
  Grupos
category: modulo
tags: [grupos]
sources: [repo:athrios/volei-space]
summary: >-
  Os jogos da fase de grupos saem todos contra todos dentro do mesmo grupo. Criar um jogo de grupo entre grupos diferentes responde 422.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Grupos

**Mesmo grupo — implementado:** o gerador de `/painel/estrutura` monta o todos contra todos de cada grupo e recusa o lote se algum par cruzar grupos. `POST` e `PUT` de `/api/partidas` recusam jogo de fase de grupos entre equipes de grupos diferentes, ou quando uma delas ainda não está em grupo. Semifinal, final e as outras fases de mata-mata continuam podendo cruzar. O calendário automático, quando já existe vínculo de grupo, também gera só dentro do grupo. A tela alinha a quantidade pedida aos cartões: se a configuração pede 2 grupos e só havia um cartão, a distribuição é refeita e só grava quando o organizador confirma. Formato grupos + mata-mata sem quantidade salva abre em 2 grupos quando há pelo menos 4 equipes. Não houve migration e nenhum jogo já gravado foi reescrito.

**Implementado:** configuração de quantidade e regras em `setup/estrutura`; distribuição real de equipes e confrontos em `src/app/api/organizador/ligas/[id]/estrutura/route.ts`; migrations de grupos em `supabase/migrations`. A geração exige o id de uma `CategoriaCampeonato` do campeonato, usa a `CategoriaConfiguracao` dessa categoria e não grava `Liga.quantidadeGrupos`. Apaga só grupos, vínculos e partidas ainda não iniciadas das fases `GRUPOS` e `GERAL` dessa categoria; se a exclusão esbarrar em chave, esses jogos são cancelados. Mata-mata não entra. Jogo em andamento, encerrado, com súmula, placar ou vencedor dessa categoria bloqueia a nova geração. Outra categoria permanece. A tela `/painel/estrutura` escolhe a categoria antes de salvar grupos ou calendário. O insert grava `categoriaCampeonatoId` e deixa `serie` nula — o gatilho `guard_category_scope` recusa série. Confrontos novos recebem `sumulaToken` aleatório; o token já salvo não é trocado. `GET` da estrutura devolve `setsPorA`, `setsPorB` e `sumulaToken`, senão a súmula do árbitro não acha a partida. `Partida.atualizadoEm` tem default `now()` na migration `202610090004_partida_atualizado_em_default.sql`; sem isso o insert do cliente chega nulo e o banco recusa o confronto. Essa migration ainda não está aplicada em produção. O isolamento desta nota não criou migration.

O turno único e o returno saem de `montarConfrontos` (`src/lib/rodadas.ts`), usado por `ensureSchedule` e por `buildGroupMatches`. Sem jogos gravados, o método do círculo fecha o turno em n−1 rodadas quando o número de equipes é par, e em n rodadas quando é ímpar: quatro equipes ficam em três rodadas, com dois jogos em cada uma; cinco equipes ficam em cinco rodadas. Ida e volta repete o turno com o mando invertido. Se já existe jogo, o confronto que falta ocupa a menor rodada em que as duas equipes estão livres e o jogo antigo não muda de rodada. Por isso incluir a quarta equipe não repete time na mesma rodada e não cria a rodada 6. A função SQL `substituir_estrutura_categoria` ainda numera `round_no` em sequência e não é chamada por `src/`. Não houve migration. As partidas `GERAL` da liga 60 em produção continuam com a numeração antiga (919, ANGELS x RS, na rodada 5; 920, TARGET x RS, na rodada 6). Um calendário novo das equipes 266, 267, 268 e 269 coloca esses pares nas rodadas 2 e 3. Os jogos `GRUPOS` 923 e 924, um par em cada grupo de duas equipes, permanecem na rodada 1.

A definição de grupos do campeonato não se confunde com o convite de equipe por categoria. Convites não devem entrar na distribuição competitiva até o cadastro da equipe estar concluído. Quantidade de classificados deve ser compatível com a fase eliminatória configurada.

Para apresentação pública e classificação, preserve o campeonato, categoria e fase corretos. Ver [[modulos/PARAMETRIZACAO]], [[modulos/INSCRICOES]], [[modulos/MATA-MATA]].

**Aprovado, pendente:** campeonato legado, sem categoria nas equipes, recebe 422 e não é apagado por inteiro. Leituras que ainda usam a string `categoria` fora deste fluxo continuam. O requisito em `docs/requisitos/CATEGORIAS-COMO-COMPETICOES.md` descreve o isolamento inteiro; convite e recálculo SQL não entraram aqui. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
