---
title: >-
  Mata-mata
category: modulo
tags: [mata-mata]
sources: [repo:athrios/volei-space]
summary: >-
  A final pode ter quantidade de sets própria. O portal público mostra pódio e chave quando a final tem vencedor.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Mata-mata

**Sets por fase — implementado no código, migration pendente:** `setsPorPartida` continua valendo para grupos, quartas, oitavas e dezesseis avos. Final, semifinal e disputa de 3º lugar aceitam um inteiro de 1 a 5 em `setsPorPartidaFinal`, `setsPorPartidaSemifinal` e `setsPorPartidaTerceiroLugar`. Null herda o campeonato. O tie-break, quando ligado, é o último set dessa quantidade. A súmula, a validação, o resultado manual e a aprovação usam essa quantidade. O campo fica em Eliminatórias e continua editável depois que os grupos começam; trava só se o jogo daquela fase já começou, encerrou ou tem súmula. A migration `20261010135000_sets_por_fase_mata_mata.sql` ainda não foi aplicada. Sem ela, a leitura cai no padrão do campeonato e gravar o campo novo falha.

**Pódio público — implementado:** `/portal?ligaId=` e `/classificacao` mostram pódio, resultado da final, resultado do 3º lugar e a chave quando a categoria tem mata-mata. O pódio aparece assim que a final tem vencedor, mesmo com o campeonato ainda ativo. A tabela de pontos continua só com `GERAL` e `GRUPOS`. Campeonato de teste ou simulação não entra nessa API.

**Implementado:** funções em `src/lib/mata-mata.ts`, `src/lib/classificados.ts` e `src/lib/eliminatorias.ts`; rotas de estrutura e chaveamento em `src/app/api/organizador/ligas/[id]/mata-mata`. A parametrização define formato e fase eliminatória; as validações de capacidade estão em `src/lib/championship-validation.ts`. O insert da chave grava `categoriaCampeonatoId` da equipe e `serie` nula, e recusa confronto entre categorias diferentes. O `sumulaToken` desse insert é aleatório; a configuração da chave e o pareamento não mudam. Slot, alimentadores e classificados são lidos só nessa categoria, então duas categorias podem ter a mesma final na rodada 1. Com categoria informada, fase e disputa de 3º lugar vêm de `CategoriaConfiguracao`. O mata-mata é jogo único: volta responde 409 na rota e o índice parcial do banco também impede o segundo jogo. A classificação vigente soma só fases `GERAL` e `GRUPOS`; a chave não entra na tabela. A página pública `/campeonatos/[slug]` e `/fase-mata-mata` mostram a chave da categoria escolhida (a primeira, se a URL não pedir outra) e, com status `FINALIZADO`, o pódio de `getChampionshipPodium` dessa categoria (final e disputa de 3º lugar).

Na vitrine, a fase gravada substitui o número da rodada: Final, Semifinal, quartas, oitavas, dezesseis avos e 3º lugar. Vale para o card, a página ao vivo, a súmula e o calendário da estrutura quando `fase` está preenchida. Duas categorias podem continuar com a final na rodada 1; o rótulo público é «Final».

A chave legado usa os N primeiros de cada grupo e, em seguida, `melhoresClassificadosGerais`. Sem grupos, o mata-mata puro leva todas as equipes da tabela. O confronto seguinte só aceita os vencedores dos dois jogos que o alimentam; o 3º lugar só aceita os perdedores das semifinais e só existe quando `disputaTerceiroLugar` não está desligado. WO com `vencedorId` e sets 0×0 também avança. `POST /api/organizador/ligas/[id]/finalizar` recusa o campeonato sem campeão: final decidida no mata-mata, ou líder com jogo válido nos pontos corridos. A disputa de 3º lugar, quando ligada e há semifinal, também precisa estar decidida.

`/fase-mata-mata` lê `Liga.faseEliminatoria`. Quando o campeonato tem uma categoria, salvar Eliminatórias copia essa fase para `Liga`; com mais de uma categoria a cópia não acontece, para não misturar as chaves. A tabela do organizador só pede o fim da fase de grupos enquanto existir jogo `GERAL` ou `GRUPOS` ainda não encerrado.

**Ainda no banco:** `classificados_categoria` não devolve ninguém quando o formato não é mata-mata e não há grupos. `criar_confronto_categoria` ignora `vencedorId` e não tem vaga para ida e volta — o índice único é um jogo por fase e slot. Um número ímpar de equipes no calendário automático continua sem bye, porque não há coluna para isso.

Relacionados: [[modulos/GRUPOS]], [[modulos/PARTIDAS]], [[modulos/SUMULA-DIGITAL]].

**Categorias — aprovado, pendente:** sem `CategoriaConfiguracao`, a chave ainda cai em `Liga.faseEliminatoria`. O índice único do mata-mata já inclui a categoria; esta entrega não criou migration. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
