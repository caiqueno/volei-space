---
title: >-
  Mata-mata
category: modulo
tags: [mata-mata]
sources: [repo:athrios/volei-space]
summary: >-
  O método de chaveamento monta a primeira rodada. Manual não pareia essa rodada. Sem a coluna, o cruzamento atual continua.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Mata-mata

**Vaga a definir — implementado no código, migration pendente:** o organizador agenda semifinal, 3º lugar e final com data, horário e quadra antes dos times. Cada lado guarda a origem, por exemplo `1º Grupo A`, `2º Grupo B`, `Vencedor Semi 1` ou `Perdedor Semi 2`. O jogo e o link do juiz permanecem os mesmos. Quando a fase de grupos da categoria encerra, a origem de grupo vira o time classificado. Quando a semi encerra, vencedor e perdedor entram na final e no 3º lugar. A súmula não inicia enquanto um lado estiver sem time. A página pública, a chave e o painel mostram o texto da vaga. `20261010142000_vaga_a_definir.sql` deixa `equipeAId` e `equipeBId` nulos e cria `origemVagaA` e `origemVagaB`. Não foi aplicada. O prefixo fica depois de `20261010141000`. Sem essas colunas, a agenda some e o restante da chave continua como hoje. A geração automática da primeira rodada espera o fim dos grupos, para não ocupar a vaga com um ranque ainda aberto.

**Sets por fase — implementado no código, migration pendente:** `setsPorPartida` continua valendo para grupos, quartas, oitavas e dezesseis avos. Final, semifinal e disputa de 3º lugar aceitam um inteiro de 1 a 5 em `setsPorPartidaFinal`, `setsPorPartidaSemifinal` e `setsPorPartidaTerceiroLugar`. Null herda o campeonato. O tie-break, quando ligado, é o último set dessa quantidade. A súmula, a validação, o resultado manual e a aprovação usam essa quantidade. O campo fica em Eliminatórias e continua editável depois que os grupos começam; trava só se o jogo daquela fase já começou, encerrou ou tem súmula. A migration `20261010136000_sets_por_fase_mata_mata.sql` ainda não foi aplicada. Sem ela, a leitura cai no padrão do campeonato e gravar o campo novo falha.

**Pódio público — implementado:** `/portal?ligaId=` e `/classificacao` mostram pódio, resultado da final, resultado do 3º lugar e a chave quando a categoria tem mata-mata. O pódio aparece assim que a final tem vencedor, mesmo com o campeonato ainda ativo. A tabela de pontos continua só com `GERAL` e `GRUPOS`. Campeonato de teste ou simulação não entra nessa API.

**Método de chaveamento — implementado, sem migration:** `POST .../mata-mata/gerar` lê `metodoChaveamento` da categoria e, sem categoria, da liga. Cruzamento de grupos continua 1º A × 2º B e 1º B × 2º A. Ranking geral ordena os classificados pelos jogos de grupo e faz 1º × último. Sorteio embaralha esses classificados e pareia vizinhos. Manual não cria a primeira rodada; final e 3º lugar ainda saem dos jogos já decididos. Sem o método, ou se a coluna não existir, o gerador repete o cruzamento atual e a leitura da fase não falha. A coluna já existia com padrão `MANUAL`. Não há arquivo novo de migration.

**Chave automática — implementado:** em `/fase-mata-mata`, o organizador dispara uma vez `POST /api/organizador/ligas/{id}/mata-mata/gerar`. Com cruzamento de grupos, ou quando o método não vem na leitura, dois ou mais grupos com pelo menos dois classificados cruzam grupos vizinhos: 1º do primeiro × 2º do segundo e 1º do segundo × 2º do primeiro. Sem esse par de grupos, a vaga segue a classificação única: 1º × último e 2º × penúltimo. A final usa os vencedores das semifinais; o 3º lugar, quando a disputa está ligada, usa os perdedores. Slot de fase e rodada já ocupado não é reescrito. Cada grupo é ordenado por `calcularClassificacao` só com os jogos `GERAL` e `GRUPOS` daquelas equipes, e o empate em pontos usa confronto direto. O limite sai de `GrupoCampeonato.classificados`, depois da configuração, e cai em 2. Não há migration.

**Contraste da chave — implementado:** os cartões claros de confronto usam a classe `chave-confronto`. O texto interno fica `#0f172a`, acima da regra que clareia `span` em `main.luva-shell`. A marca colorida da equipe continua fora dessa troca.

**Implementado:** funções em `src/lib/mata-mata.ts`, `src/lib/classificados.ts` e `src/lib/eliminatorias.ts`; rotas de estrutura e chaveamento em `src/app/api/organizador/ligas/[id]/mata-mata`. A parametrização define formato e fase eliminatória; as validações de capacidade estão em `src/lib/championship-validation.ts`. O `POST` da chave exige os dois times na mesma categoria, lê fase e disputa de 3º lugar só da `CategoriaConfiguracao` e recusa a primeira rodada enquanto a fase de grupos dessa categoria não terminou. A gravação chama `criar_confronto_categoria`. A vaga é `categoria + fase + rodada`: a final da segunda categoria não devolve 409 por causa da primeira. O mapa em memória da chave usa a mesma chave. O `sumulaToken` desse insert é aleatório; a configuração da chave e o pareamento não mudam. O mata-mata é jogo único: volta responde 409 na rota e o índice parcial do banco também impede o segundo jogo. Sem pagamento confirmado, a rota responde 403, no mesmo critério da função. A classificação vigente soma só fases `GERAL` e `GRUPOS`; a chave não entra na tabela. A página pública `/campeonatos/[slug]` e `/fase-mata-mata` mostram a chave da categoria escolhida (a primeira, se a URL não pedir outra) e, com status `FINALIZADO`, o pódio de `getChampionshipPodium` dessa categoria (final e disputa de 3º lugar).

Na vitrine, a fase gravada substitui o número da rodada: Final, Semifinal, quartas, oitavas, dezesseis avos e 3º lugar. Vale para o card, a página ao vivo, a súmula e o calendário da estrutura quando `fase` está preenchida. Duas categorias podem continuar com a final na rodada 1; o rótulo público é «Final».

A chave legado usa os N primeiros de cada grupo e, em seguida, `melhoresClassificadosGerais`. Sem grupos, o mata-mata puro leva todas as equipes da tabela. O confronto seguinte só aceita os vencedores dos dois jogos que o alimentam; o 3º lugar só aceita os perdedores das semifinais e só existe quando `disputaTerceiroLugar` não está desligado. WO com `vencedorId` e sets 0×0 também avança. `POST /api/organizador/ligas/[id]/finalizar` recusa o campeonato sem campeão: final decidida no mata-mata, ou líder com jogo válido nos pontos corridos. A disputa de 3º lugar, quando ligada e há semifinal, também precisa estar decidida.

`/fase-mata-mata` escolhe a categoria e, quando ela existe, usa a fase da `CategoriaConfiguracao`. A cópia para `Liga` continua só no campeonato de uma categoria, para não misturar as chaves. A tabela do organizador pede o fim da fase de grupos da categoria que está na tela.

**Ainda no banco:** `classificados_categoria` não devolve ninguém quando o formato não é mata-mata e não há grupos. A função já instalada de `criar_confronto_categoria` ignora `vencedorId`. `20261010138000_confronto_categoria_vencedor.sql` passa a aceitar WO com sets iguais e `vencedorId`, e não foi aplicada. Enquanto ela não entrar, a rota, se a função antiga recusar esse WO, grava o confronto pela aplicação, já com a categoria. Não há vaga para ida e volta — o índice único é um jogo por fase, rodada e categoria. Um número ímpar de equipes no calendário automático continua sem bye, porque não há coluna para isso.

Relacionados: [[modulos/GRUPOS]], [[modulos/PARTIDAS]], [[modulos/SUMULA-DIGITAL]].

**Categorias — chave por categoria, implementada:** sem `CategoriaConfiguracao` a rota responde 422 e não usa `Liga.faseEliminatoria`. O índice único do mata-mata já inclui a categoria. A migration nova só altera o vencedor do confronto e não foi aplicada. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
