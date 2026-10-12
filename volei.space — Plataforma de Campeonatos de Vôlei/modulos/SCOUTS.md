---
title: >-
  Scouts
category: modulo
tags: [scouts]
sources: [repo:athrios/volei-space]
summary: >-
  O MVP de /rankings usa o destaque da final quando existe. O avatar é um círculo laranja. Sem migration.
status: misto
created: 2026-09-20
updated: 2026-10-12
---
# Scouts e rankings

**MVP do campeonato — implementado, sem migration:** o cartão de `/rankings` lia só a soma de saque, ataque e bloqueio em `OcorrenciaPartida`. Por isso trocar `DestaquesPartida` não mudava o nome. Com o campeonato concluído, `GET /api/portal/rankings` passa a ler o `tipo` MVP da partida `fase` FINAL da categoria. Se esse destaque existe, o cartão mostra esse atleta, a equipe e a foto (`fotoRostoUrl`, senão `fotoUrl`). Os números continuam os da temporada dele. Sem destaque na final, segue o maior total. A resposta continua `no-store`. O avatar é um círculo com anel laranja. Sem foto, ficam as iniciais. O botão de story gera a imagem desse cartão. Nada é gravado.

**Story do ranking — implementado, sem migration:** em `/rankings` e em `/classificacao`, cada caixinha (Top Atacantes, Top Bloqueadores, Top Sacadores) tem o próprio botão. A imagem traz só aquele título, o ícone e até cinco linhas, com medalha, nome, equipe e o valor daquele fundamento. Não junta as três caixas nem a classificação geral. A cor da prévia não é gravada. A leitura dos scouts não muda. Ver [[09-UI-UX]].

**Quadro de scouts — implementado, sem migration:** os cinco primeiros de ataque, bloqueio e saque e a tabela Scouts gerais (PTS, ATQ, BLQ, ACE) aparecem em `/classificacao` e em `/rankings`. Scouts gerais fica depois das tabelas dos grupos. A tela mostra 10 atletas e «Ver mais» abre mais 10; essa quantidade não volta na releitura. PTS é a soma dos três. A ordem é PTS, ataque, bloqueio, saque e nome. Entram todos os atletas, inclusive com zero, conforme a pessoa abre a lista. A linha traz a posição num círculo, o nome inteiro, a camisa embaixo e o escudo (`Equipe.logoUrl`; sem logo, as iniciais). No celular os números rolam na própria faixa e o nome não é cortado. A camisa `-1` não aparece. A releitura segue a cada 12 segundos e não mexe na rolagem da página.

**Classificação geral de jogadores — implementado, sem migration:** em `/rankings`, na área pública e no painel do organizador (o menu Rankings abre a mesma página), a tabela lista todos os atletas da categoria, inclusive com zero. Não separa por grupo nem por equipe. Colunas: posição, nome, equipe, ataque, bloqueio, saque e total. Se a súmula gravar um `point` ou `ponto` com atleta, entra a coluna Ponto. O clique no cabeçalho reordena na tela; a posição continua sendo a do ranking. Abaixo de 768px, `globals.css` troca `.overflow-x-auto` por `overflow-x: clip`. Scouts gerais não usa essa classe: a faixa de PTS, ATQ, BLQ e ACE rola sozinha. A consulta da equipe pede `logoUrl` e `corHex`. A ordem oficial é total, depois ataque, bloqueio, saque e nome. A leitura é `GET /api/portal/rankings/jogadores`. Ela só conta ocorrência de campeonato que ainda existe, ignora descrição de lance desfeito, anulado ou excluído, ignora «Registro de » e ignora ponto sem jogador. Cartão, tempo, substituição, lesão, anotação e troca de camisa não entram. A aba visível relê a cada 12 segundos, com `Cache-Control: private, no-store`. O processo guarda a leitura por 8 segundos para várias abas não repetirem a consulta. `OcorrenciaPartida` não está na publicação `supabase_realtime`; a tela não abre canal novo. O MVP do campeonato concluído continua no cartão de cima. A consulta de ocorrências pede `tipo`, `jogadorId` e `descricao`, com a partida por `ligaId` e `categoriaCampeonatoId`. `OcorrenciaPartida` não tem `createdAt`, `updatedAt` nem `criadoEm`. O atleta é o `jogadorId`. Ao lado do nome, a tabela mostra `Jogador.numero` de 0 a 99. `SumulaPresenca.numero = -1`, o texto `-1` e a marca `sem` são camisa vazia: não aparecem e não atribuem ponto.

**Implementado:** ocorrências da partida e cálculo de scouts em `src/lib/player-scouts.ts`; rankings de votos em `src/app/api/rankings` e a página `src/app/rankings`. Estatística do campeonato acumula partidas consideradas oficiais; estatística do MVP no resumo usa apenas **a partida atual**.

**Aprovado, pendente:** sugerir MVP somente entre jogadores da vencedora por total de pontos de ataques, bloqueios e aces naquela partida; empate por aces, bloqueios e ataques. A escolha final pode ser manual, sempre na vencedora. Corrigir ocorrência ou MVP exige atualização dos rankings e do resumo.

Confirme identificação por `jogadorId`; descrições e números de camisa não devem substituir vínculo inequívoco quando disponível. Ver [[modulos/SUMULA-DIGITAL]].

**Categorias — a classificação geral filtra no aplicativo; o recálculo SQL antigo segue pendente:** a tabela nova lê `categoriaCampeonatoId` da equipe e da partida e não junta atletas de categorias diferentes. Não há função SQL nova. Rankings de votos e o texto antigo de escopo continuam como estavam. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
