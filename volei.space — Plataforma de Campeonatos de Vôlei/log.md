---
title: >-
  Log da wiki
category: area
tags: [log, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Registro append-only de ingestões, atualizações e manutenções do vault.
status: implementado
created: 2026-09-25
updated: 2026-10-11
---

# Log

## [2026-10-11] fix | camisa digitada na posição vazia da papeleta

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`
- A posição vazia busca a camisa da súmula do time daquele lado. `01` e `1` são a mesma. Sem API, banco, migration ou payload novo.

## [2026-10-11] lint | quadro reusa a vista da chave e as iniciais ficam num helper

- pages_updated=`modulos/CLASSIFICACAO`, `modulos/MATA-MATA`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- `/classificacao` e `/rankings` usam `VistaChavePublica`. Os títulos passam a ser os do portal. O cartão ao vivo não repete «Partida ao vivo». `iniciais` cobre o MVP, o escudo e o avatar da súmula, com o mesmo resultado. Sem migration e sem mudança de leitura.

## [2026-10-11] fix | ajustes de tela na súmula e na chave

- pages_updated=`modulos/SUMULA-DIGITAL`, `modulos/MATA-MATA`, `09-UI-UX`, `hot`, `log`
- Só apresentação e interação. Sem API, banco, migration ou payload novo. O líbero inicial segue opcional. A gravação de pontos não muda.

## [2026-10-10] fix | par da substituição pode trocar de novo no set

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`, `11-DECISOES`
- A volta não fecha o par. Os dois atletas só trocam entre si e cada troca conta no limite. Sem migration e sem mudança na gravação de pontos.

## [2026-10-10] fix | líbero inicial deixa de ser obrigatório na papeleta

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`, `06-BANCO-DE-DADOS`
- Confirmar a papeleta vale com as seis posições. Sem líbero, a escolha é nenhum. O `PUT` da súmula não recusa o andamento por isso. Sem migration e sem mudança na gravação de pontos.

## [2026-10-10] fix | menu da súmula recolhe ou fica fixo no desktop

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`
- A barra esquerda pode virar um trilho de ícones. A escolha fica no navegador. No desktop ela gruda abaixo da faixa Sair, para Recolher/Fixar continuar clicável. Sem migration e sem mudança na gravação de pontos.

## [2026-10-10] fix | barra de placar em duas metades abaixo da quadra

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`
- Os controles do set ficam lado a lado, alinhados com a quadra. O `+1`, o desfazer, os cartões e o tempo permanecem. Sem migration e sem mudança na gravação de pontos.

## [2026-10-10] fix | papeleta vazia em cada set e lista pela camisa

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`, `12-BUGS-E-DEBITOS-TECNICOS`
- Encerrar o set zera as seis posições dos dois times. A lista da posição e o líbero seguem a camisa da súmula, com sem número por último. Sem migration e sem mudança na gravação de pontos.

## [2026-10-10] feat | quadro de classificação com chave, Top 5 e scouts

- pages_updated=`modulos/CLASSIFICACAO`, `modulos/SCOUTS`, `hot`, `log`
- `/classificacao` e `/rankings` mostram líder, pódio, chave em duas colunas, Top 5 e a tabela de grupos. Os scouts relêem a cada 12 segundos. Sem migration e sem mudança na súmula.

## [2026-10-10] fix | ranking não consulta createdAt e trata camisa -1 como vazia

- pages_updated=`modulos/SCOUTS`, `hot`, `log`
- A leitura da classificação pede `tipo`, `jogadorId` e `descricao`. `OcorrenciaPartida` não tem `createdAt`. O número `-1` da súmula não identifica atleta e não aparece como camisa. Sem migration.

## [2026-10-10] fix | pontos do ranking visíveis no celular

- pages_updated=`modulos/SCOUTS`, `hot`, `log`
- A API de jogadores do Winners já devolvia os fundamentos. Abaixo de 768px o CSS cortava a rolagem horizontal e escondia ataque, bloqueio, saque e total. A tabela empilha esses números. Sem migration.

## [2026-10-10] feat | classificação geral de jogadores no ranking

- pages_updated=`modulos/SCOUTS`, `05-MODULOS`, `hot`, `log`
- `/rankings` lista todos os atletas por ataque, bloqueio e saque da súmula, com releitura a cada 12 segundos na aba visível. Sem migration, sem Realtime novo e sem merge.

## [2026-10-10] fix | camisa repetida esvazia o outro atleta e a papeleta abre vazia

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`, `12-BUGS-E-DEBITOS-TECNICOS`
- Atribuir uma camisa já usada passa o número para o atleta editado e deixa o anterior sem número, no mesmo salvamento. A papeleta não pré-preenche as seis posições. Nenhuma migration.

## [2026-10-10] fix | seletor de líbero usa a camisa da súmula

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`, `12-BUGS-E-DEBITOS-TECNICOS`
- O banco mostrava a camisa da partida e «Selecionar líbero» mostrava o número do cadastro. Na ALL BLACK o #1 do banco não aparecia na lista. O rótulo passa a ser a camisa da súmula. Nenhuma migration.

## [2026-10-10] fix | MVP da anotação oficializa pela camisa da súmula

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`, `12-BUGS-E-DEBITOS-TECNICOS`
- Na partida 1036 a ata «TARGET - #10 …: MVP» não gravou `DestaquesPartida`. O 10 era a camisa da súmula, não a do cadastro. A escolha passa a gravar o destaque da oficialização, e Encerrar partida / Oficializar súmula aparecem quando já há vencedor. Nenhuma migration.

## [2026-10-10] fix | correção de ponto não copia o set anterior

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`
- Na partida 1035 o set 2 foi de 0×1 para 23×13 porque o histórico do set 1 ainda estava na tela. A correção passa a valer só no set em andamento. Nenhuma migration.

## [2026-10-10] feat | saque alterna até o último set da fase

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Melhor de 3 alterna nos sets 1 e 2 e sorteia o 3º. Melhor de 5 alterna até o 4º e sorteia o 5º. A quantidade é a da fase, inclusive quartas e oitavas. Nenhuma migration. Sem merge.

## [2026-10-10] fix | corrigir último ponto permanece

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `12-BUGS-E-DEBITOS-TECNICOS`, `hot`, `log`
- Na partida 1095 o `PUT` das 11:46:55 gravou 1x0 e o das 11:46:57 regravou 2x0. A função troca as ocorrências pelo corpo recebido. A tela envia a versão no registro e repete o estado mais novo. Versão menor ou reserva antiga responde 409 e o aviso aparece. Nenhuma migration.

## [2026-10-10] feat | líbero configurável

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Sem configuração, a súmula continua pedindo um líbero inicial. A troca não conta como substituição. `20261010139990_libero_sumula.sql` não foi aplicada.

## [2026-10-10] fix | andamento da súmula grava o placar

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `12-BUGS-E-DEBITOS-TECNICOS`, `hot`, `log`
- O `PUT` de andamento da partida 1095 respondia 500. O Postgres registrava `duplicate key` em `OcorrenciaPartida_pkey` (PostgREST 409 em `gravar_sumula_partida`). O registro de presença do PR #54 inseria `id` explícito e a sequence não andava. A função preserva «Registro de ». A ocorrência passa a omitir o `id`. A gravação repete o 23505 até a sequence alcançar o maior id. A tela enfileira os salvamentos. Nenhuma migration.

## [2026-10-10] feat | tempo médico e lesão

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- As duas opções nascem desligadas. Sem elas, a súmula não muda. `20261010139980_lesao_sumula.sql` não foi aplicada.

## [2026-10-10] feat | tempos da súmula

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Sem número gravado, cada equipe segue com 2 tempos e um único botão. O tempo de equipe só aparece com a opção ligada. `20261010139970_tempos_sumula.sql` não foi aplicada.

## [2026-10-10] feat | aviso de rodízio

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- O aviso só aparece com a opção ligada e não recusa o ponto. `20261010139960_alerta_rodizio.sql` não foi aplicada. Sem a coluna, a súmula não muda.

## [2026-10-10] fix | vaga na tela do juiz e na chave pública

- pages_updated=`modulos/MATA-MATA`, `modulos/PARTIDAS`, `modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- A tela do juiz mostra a origem da vaga. A chave pública liga o jogo pela fase e pela rodada. Oficializar a súmula preenche os times sem passar pelo pagamento. `20261010142000` já está em produção.

## [2026-10-10] feat | limite de substituições

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- O campo vazio mantém 8 substituições por set. `20261010139950_limite_substituicoes.sql` não foi aplicada. Sem a coluna, a súmula não muda.

## [2026-10-10] feat | sets de quartas e oitavas

- pages_updated=`modulos/MATA-MATA`, `modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Quartas e oitavas herdam `setsPorPartida` enquanto o campo da fase estiver vazio. `20261010139900_sets_quartas_oitavas.sql` não foi aplicada. Sem as colunas, a leitura da súmula mantém final, semifinal e 3º lugar.

## [2026-10-10] feat | cargos de arbitragem

- pages_updated=`modulos/PARTIDAS`, `hot`, `log`
- O calendário grava 1º árbitro, 2º árbitro, mesário e juiz de linha. O mesmo árbitro não cobre dois jogos no intervalo de 90 minutos. Sem migration.

## [2026-10-10] feat | conflito de agenda

- pages_updated=`modulos/PARTIDAS`, `hot`, `log`
- O calendário e a vaga do mata-mata recusam equipe, quadra ou dia indisponível no mesmo intervalo de 90 minutos. Sem migration.

## [2026-10-10] feat | ida e volta

- pages_updated=`modulos/MATA-MATA`, `hot`, `log`
- O segundo jogo da chave usa a rodada 1000 acima da ida. O agregado soma os sets. O calendário automático respeita `turnoReturno`. Sem o flag, ou sem a coluna, permanece um jogo. Sem migration.

## [2026-10-10] feat | método de chaveamento

- pages_updated=`modulos/MATA-MATA`, `hot`, `log`
- A primeira rodada segue ranking geral, cruzamento de grupos, sorteio ou manual. Manual não pareia essa rodada. Sem a coluna, o gerador mantém o cruzamento atual. Sem migration.

## [2026-10-10] feat | média de sets e média de pontos

- pages_updated=`modulos/CLASSIFICACAO`, `06-BANCO-DE-DADOS`, `hot`, `log`
- O desempate por quociente entra em `src/lib/classificacao.ts`. O padrão da categoria não muda. `20261010139800_quociente_classificacao.sql` não foi aplicada. Enquanto a checagem antiga recusar os tokens, o salvamento grava a categoria sem eles.

## [2026-10-10] lint | id da presença é identity

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- `SumulaPresenca.id` e `OcorrenciaPartida.id` são identity `BY DEFAULT`. O 500 da presença continua sendo a falta de unicidade em `(partidaId, jogadorId)`, não a falta de default.

## [2026-10-10] feat | vaga a definir no mata-mata

- pages_updated=`modulos/MATA-MATA`, `modulos/PARTIDAS`, `modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- O jogo do mata-mata pode nascer sem os dois times, com origem da vaga, data, horário e quadra. O link do juiz permanece na mesma partida. A súmula não inicia até os times entrarem. `20261010142000_vaga_a_definir.sql` não foi aplicada; sem as colunas a função fica desligada.

## [2026-10-10] feat | atleta único na categoria

- pages_updated=`modulos/INSCRICOES`, `modulos/EQUIPES-E-ATLETAS`, `hot`, `log`
- A mesma pessoa não entra em duas equipes da categoria. Documento tem prioridade; sem ele, nome e nascimento. A própria equipe não é bloqueada. Sem migration. Falha de leitura não interrompe a inscrição.

## [2026-10-10] fix | seletor de campeonato no elenco

- pages_updated=`modulos/EQUIPES-E-ATLETAS`, `hot`, `log`
- `/painel/elenco` só pedia um campeonato e não oferecia escolha. A página abre o `ligaId` do painel e, sem ele, o primeiro campeonato do organizador. O seletor troca a consulta.

## [2026-10-10] fix | desfazer ponto depois de recarregar

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`
- O botão de corrigir o último ponto lia só a memória da tela. Ao reabrir a súmula, o histórico do set em andamento volta a ser montado pelos eventos gravados.

## [2026-10-10] fix | presença do árbitro sem upsert

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- `POST /api/arbitro/partidas/{token}/presenca` respondia 500 porque o `upsert` em `(partidaId, jogadorId)` não tem constraint em produção. O Postgres registra `42P10`. O código passa a ler e atualizar, ou inserir com `id` explícito. Nenhuma migration foi aplicada.

## [2026-10-10] feat | gênero e idade da categoria

- pages_updated=`modulos/INSCRICOES`, `modulos/EQUIPES-E-ATLETAS`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Gênero e faixa de idade nascem vazios. A conferência só roda quando a categoria e o atleta têm o dado. Sem a coluna, a regra fica desligada. `20261010139700_elegibilidade_categoria.sql` não foi aplicada. O prefixo fica depois de `20261010139500` e antes da migration de RLS.
- Leitura do projeto `mqbkwbqpnhsqaemavive`: W.O., sets por fase, formulário, `punicoes` e as funções usadas pela súmula, pela inscrição e pela classificação já estão no schema. `SuspensaoAtleta` e as colunas de gênero, idade e sexo não estão.

## [2026-10-10] fix | menu do painel não cobre a página

- pages_updated=`09-UI-UX`, `hot`, `log`
- A faixa inferior do painel ficava visível a partir de 1024px, empilhava os itens e punha Sair ao lado de Elenco, por cima do conteúdo. Agora ela só aparece abaixo de 1024px, numa linha. Sair fecha a lista, abaixo de Rankings. Em tela baixa a guia rola por dentro.

## [2026-10-10] fix | leitura ao vivo de sets e classificação

- pages_updated=`06-BANCO-DE-DADOS`, `07-SEGURANCA`, `hot`, `log`
- `20261010141000_leitura_publica_sets_classificacao.sql` devolve só o `SELECT` de `SetPartida` e `ClassificacaoEntrada` a `anon` e `authenticated`, com policy de leitura, `replica identity full` e publicação no Realtime se faltar. Não abre escrita nem `Partida.sumulaToken`. O W.O. é `20261010139000`. `20261010139500` fica entre o W.O. e a RLS. Não foi aplicada. As duas de RLS entram juntas, a `140000` e em seguida esta.

## [2026-10-10] feat | cartões e sanções

- pages_updated=`modulos/SUMULA-DIGITAL`, `modulos/CLASSIFICACAO`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Advertência, penalidade, expulsão e desqualificação acumulam. A suspensão da partida seguinte é automática. `punicoes` recebe o peso, sem tirar ponto de campeonato. `20261010139500_sancoes_suspensao.sql` não foi aplicada. O prefixo fica depois de `20261010139000` e antes da migration de RLS.

## [2026-10-10] fix | formulário da inscrição segue a categoria

- pages_updated=`modulos/INSCRICOES`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Não coletar, opcional e obrigatório de nascimento e documento passam a valer no formulário público. A categoria prevalece sobre a liga. `20261010138500_formulario_inscricao_categoria.sql` não foi aplicada. O prefixo fica depois de `20261010138000` e antes de `20261010139000`.

## [2026-10-10] fix | ordem dos jogos e horário em UTC

- pages_updated=`modulos/PARTIDAS`, `hot`, `log`
- Agenda, `/jogos`, painel, árbitro e jogos dentro da fase sobem por data e hora, com desempate na rodada. `dataHora` sem fuso sai como UTC com `Z`. 11:30 UTC aparece como 08:30 em `America/Sao_Paulo`. Nenhuma linha de partida foi atualizada.

## [2026-10-10] fix | teste da súmula aceita a escalação sugerida

- pages_updated=`log`
- Ao ir para a escalação, a partida deixa de mostrar «Sem atleta» e sugere #1 a #6. O nome da equipe aparece em maiúsculas. O teste da mesa confere essa sugestão, define o líbero e segue. A escalação vazia continua valendo só no pré-jogo.

## [2026-10-10] fix | prefixo do W.O. antes da migration de RLS

- pages_updated=`06-BANCO-DE-DADOS`, `modulos/CLASSIFICACAO`, `hot`, `log`
- `20261010138000` ficou com o confronto da categoria. `20261010150000_wo_configuravel.sql` passou a `20261010139000_wo_configuravel.sql`, depois desse confronto e antes de `20261010140000`. O SQL não mudou e não foi aplicado.

## [2026-10-10] fix | merge da operação por categoria com a main

- pages_updated=`modulos/CLASSIFICACAO`, `modulos/GRUPOS`, `modulos/MATA-MATA`, `06-BANCO-DE-DADOS`, `hot`, `log`
- A main entrou com súmula transacional, W.O. configurável, jogo só no mesmo grupo e confronto direto. `20261010138000` continua sendo o WO da chave da categoria. `20261010137000` é a súmula e `20261010150000` é o W.O. configurável.

## [2026-10-10] fix | prefixo da migration do WO da categoria

- pages_updated=`06-BANCO-DE-DADOS`, `modulos/MATA-MATA`, `hot`, `log`
- `20261010137000` ficou com a súmula transacional. O WO da chave da categoria passou para `20261010138000_confronto_categoria_vencedor.sql`, ainda sem aplicar, e a migration de RLS continua a última.

## [2026-10-10] fix | operação de campeonato por categoria

- pages_updated=`modulos/CLASSIFICACAO`, `modulos/GRUPOS`, `modulos/MATA-MATA`, `06-BANCO-DE-DADOS`, `hot`, `log`
- A chave chama `criar_confronto_categoria`, a classificação manual chama `classificar_equipe_categoria` e a tabela pública sai separada por categoria, só com id, nome, cor e logo da equipe. A geração de grupos não chama `substituir_estrutura_categoria`. O arquivo do WO foi renomeado para `20261010138000` e continua sem aplicar, antes da migration de RLS.

## [2026-10-10] fix | regras da categoria na súmula e gravação transacional

- pages_updated=`modulos/SUMULA-DIGITAL`, `modulos/CLASSIFICACAO`, `modulos/PARAMETRIZACAO`, `06-BANCO-DE-DADOS`, `12-BUGS-E-DEBITOS-TECNICOS`, `hot`, `log`
- A súmula usa `CategoriaConfiguracao` da partida. Sem categoria, o fallback é a `Liga`, com terceiro set obrigatório desligado. `20261010137000_sumula_transacional.sql` cria a gravação atômica e a trava da classificação calculada em `classificacao.ts`, inclusive `punicoes`. Não foi aplicada. O prefixo `20261010138000` fica livre. A RPC antiga de pontuação não foi recriada. O teste de RLS aceita arquivo posterior que não cria tabela nem concede a `anon`; `20261010150000` é esse caso.

## [2026-10-10] feat | jogos só dentro do grupo, tabelas separadas e elenco

- pages_updated=`modulos/GRUPOS`, `modulos/CLASSIFICACAO`, `modulos/MATA-MATA`, `modulos/PARTIDAS`, `hot`, `log`
- O gerador e a criação manual recusam jogo de grupo entre grupos diferentes. A classificação separa os grupos e usa confronto direto. A chave automática usa esse ranque. O elenco é consulta. Nenhuma migration foi aplicada e os jogos já gravados não foram alterados.

## [2026-10-10] feat | W.O. configurável

- pages_updated=`modulos/CLASSIFICACAO`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Placar e punição do W.O. são opcionais. Sem eles, a tabela segue a vitória de margem 2 e zero sets. `20261010150000_wo_configuravel.sql` não foi aplicada.

## [2026-10-10] fix | súmula do organizador, scout e chave automática

- pages_updated=`modulos/SUMULA-DIGITAL`, `modulos/MATA-MATA`, `modulos/PARTIDAS`, `hot`, `log`
- O organizador grava a própria súmula. O MVP pede confirmação. Anotações usam o número da partida. Últimos pontos seguem o lado do lance. A quadra encerrada esconde +1, ACE, P, B e S. O scout separa ponto sem atleta. O árbitro do link deixa de aparecer como não registrado, e o credenciamento não volta em jogo já iniciado. Ver mais conserva o mata-mata sem data. A chave nasce dos grupos e o texto dos cartões claros fica escuro. Sem migration.

## [2026-10-10] fix | sets por fase do mata-mata e pódio público

- pages_updated=`modulos/MATA-MATA`, `modulos/SUMULA-DIGITAL`, `modulos/PARAMETRIZACAO`, `modulos/CLASSIFICACAO`, `06-BANCO-DE-DADOS`, `hot`, `log`
- A final, a semifinal e o 3º lugar podem ter quantidade de sets própria. O portal e a classificação mostram pódio, final, 3º lugar e chave. `20261010136000_sets_por_fase_mata_mata.sql` não foi aplicada. O prefixo fica depois de `20261010135000` e antes da migration de RLS.

## [2026-10-10] fix | nascimento e documento do atleta opcionais

- pages_updated=`modulos/INSCRICOES`, `modulos/EQUIPES-E-ATLETAS`, `06-BANCO-DE-DADOS`, `hot`, `log`
- O default da liga e da categoria nasce opcional. Link da vaga, rascunho, inscrição rápida e capitão não exigem data de nascimento nem documento. `20261010135000_nascimento_documento_atleta_opcional.sql` não foi aplicada.

## [2026-10-10] fix | foto do atleta opcional na inscrição

- pages_updated=`modulos/INSCRICOES`, `modulos/EQUIPES-E-ATLETAS`, `06-BANCO-DE-DADOS`, `hot`, `log`
- Link da vaga, rascunho, inscrição rápida e capitão não exigem foto. O upload continua quando a imagem é enviada. `20261010130000_foto_atleta_opcional.sql` não foi aplicada.

## [2026-10-10] fix | fase do mata-mata, rodadas do turno e contraste do card

- pages_updated=`modulos/PARTIDAS`, `modulos/GRUPOS`, `modulos/MATA-MATA`, `modulos/EQUIPES-E-ATLETAS`, `09-UI-UX`, `hot`, `log`
- O acompanhamento ao vivo e a súmula mostram a fase. Data e local ausentes somem na partida encerrada. O turno preenche a primeira rodada livre e não reescreve jogo já gravado. O card de data e local usa a superfície elevada da Noite de final. Nome novo de equipe é gravado em maiúsculas no servidor; a tela também deixa o nome em maiúsculas. Nenhuma migration. As partidas da liga 60 em produção não foram alteradas.

## [2026-10-10] decisao | RLS em todas as tabelas public

- pages_updated=`06-BANCO-DE-DADOS`, `07-SEGURANCA`, `03-REGRAS-DE-NEGOCIO`, `hot`, `log`
- `20261010140000_habilitar_rls_tabelas_publicas.sql` liga RLS em cada tabela `public`, sem `FORCE` e sem alterar `service_role`. A policy nova é `public_read_partidas`, só se não existir. `anon` fica com o `SELECT` das colunas de placar de `Partida`. Não foi aplicada. `202610100002` permanece intacta.

## [2026-10-10] fix | bugs E2E da súmula, prévia e início

- pages_updated=`modulos/SUMULA-DIGITAL`, `modulos/PARAMETRIZACAO`, `modulos/PARTIDAS`, `modulos/GRUPOS`, `modulos/MATA-MATA`, `07-SEGURANCA`, `hot`, `log`
- A papeleta e o encerramento antes da oficialização persistem. O MVP mostra o número da partida. Tokens novos são aleatórios e os antigos continuam. A geração de grupos e a chave seguem isoladas por categoria. A prévia válida não conta «0 de N áreas». Campeonato finalizado não anuncia próximo jogo. Aviso idêntico da súmula não se repete.

## [2026-10-10] fix | edição da categoria até o jogo começar

- pages_updated=`modulos/PARAMETRIZACAO`, `modulos/GRUPOS`, `modulos/MATA-MATA`, `modulos/CLASSIFICACAO`, `hot`, `log`
- Estrutura, classificação e eliminatórias aceitam equipes sem jogo iniciado. Jogo em andamento, encerrado ou com súmula continua bloqueado.
- Recriar confrontos remove ou cancela jogos não iniciados das fases `GERAL` e `GRUPOS` só da categoria escolhida. A função SQL `salvar_configuracao_categoria` não foi alterada.

## [2026-10-10] update | isolamento operacional por categoria

- pages_updated=`modulos/GRUPOS`, `modulos/MATA-MATA`, `modulos/CLASSIFICACAO`, `modulos/PARTIDAS`, `hot`, `log`, `docs/requisitos/CATEGORIAS-COMO-COMPETICOES`
- Gerar grupos e calendário passa a exigir uma categoria e só remove grupos e jogos de grupos dela. A chave e o calendário automático não cruzam categorias. Portal, tabela, jogos, ranking e pódio leem uma categoria. Nenhuma migration foi adicionada e o SQL de setembro não foi reaplicado. Funções SQL de recálculo continuam como estavam.

## [2026-10-10] fix | avisos da súmula somem sozinhos

- pages_updated=`modulos/SUMULA-DIGITAL`, `09-UI-UX`, `hot`, `log`
- Cada aviso fica no máximo 3 segundos e a fila guarda dois. O temporizador sai no unmount. O aviso não cobre a faixa do placar. A demonstração não chama `POST …/iniciar`, que não tem o atalho do token demo.

## [2026-10-10] decisao | troca de lado ao encerrar o set

- pages_updated=`modulos/SUMULA-DIGITAL`, `09-UI-UX`, `hot`, `log`
- Confirmar o fim do set inverte a quadra e reusa a anotação do botão Inverter. A partida encerrada não inverte. O saque dos sets 2 a 4 e o sorteio do 5º ficam como já estavam. O pulso visual continua o de `sumula-micro-set`.

## [2026-10-10] decisao | CSP de desenvolvimento e teste do pulso da súmula

- pages_updated=`hot`, `log`
- No `next dev`, o `script-src` aceita `'unsafe-eval'` para a página hidratar. Em produção continua `'self' 'unsafe-inline'`. O Playwright da súmula demo confere ACE, toque e bloqueio no atleta e que `prefers-reduced-motion` zera o pulso já existente em `sumula-micro.css`.

## [2026-10-10] decisao | microinterações visuais

- pages_updated=`09-UI-UX`, `hot`, `log`
- Entrada de tela, botões, menu hambúrguer, abas legais, aviso e fade de carregamento usam só `transform` e `opacity`, entre 180 e 220ms.
- `prefers-reduced-motion: reduce` desliga essas animações. Súmula, páginas públicas, pódio, painel e identificação ficam de fora. Os keyframes da base em `globals.css` não mudam.

## [2026-10-10] fix | leitura pública de placar e autorização

- pages_updated=`07-SEGURANCA`, `06-BANCO-DE-DADOS`, `modulos/INSCRICOES`, `hot`, `log`
- A migration `202610100002_fechar_leitura_publica_placar.sql` liga o RLS, revoga `anon` e `authenticated` em `SetPartida` e `ClassificacaoEntrada` e ajusta default privileges. O prefixo `202610100001` ficou com o número da camisa. Não foi aplicada. O ao vivo passa a consultar a API a cada 4 segundos.
- `POST /api/inscricoes-campeonato` respeita `inscricaoAprovacaoAutomatica`. A função SQL só faz o mesmo depois da migration. `GET /api/ligas` deixa de devolver `organizadorId` e `seedKey`. `GET /api/equipes` e `GET /api/rankings` montam o join no servidor.

## [2026-10-10] decisao | índices das consultas de campeonato, equipe, partida e súmula

- pages_updated=`06-BANCO-DE-DADOS`, `hot`, `log`
- `20261010015632_indices_consultas_quentes.sql` cria índice se ainda não existir. Não apaga linha. O `@@index` correspondente está no Prisma, exceto a vitrine parcial de `Liga` com `simulacao = false`. Não foi aplicada em produção nem em desenvolvimento.

## [2026-10-10] query | microinterações da súmula

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- ACE, toque no atleta, bloqueio B, troca de set e o modal de substituição ganham pulso local de opacidade e transform. O ponto continua no mesmo clique. O `+1` continua com a bola.

## [2026-10-10] decisao | microinterações públicas

- pages_updated=`09-UI-UX`, `hot`, `log`
- Camada visual em `src/styles/microinteracoes.module.css`. Entrada, hover, toque, líder, chaveamento e brilho do campeão usam só `transform` e `opacity`, entre 160ms e 280ms. `prefers-reduced-motion` desliga. Não altera súmula, menu, toasts, loading, API, banco nem os utilitários da base do PR #17.

## [2026-10-10] decisao | base de movimento e bola no +1

- pages_updated=`09-UI-UX`, `hot`, `log`
- Tokens `--vs-motion-*` e classes `.vs-press`, `.vs-tap`, `.vs-tap-play`, `.vs-hover`, `.vs-focus` em `src/styles/vs-motion.css`. `VolleyballBurst` (`children`, `enabled`) no +1 da súmula. Só transform e opacity; `prefers-reduced-motion` desliga. O ponto não espera a bola. Sem API, banco, auth ou data fetching.

## [2026-10-10] decisao | base visual Noite de final

- pages_updated=`09-UI-UX`, `hot`, `log`
- Tokens `--vs-*` passam a ser a paleta única. `--luva-*`, `--landing-*` e `--dark-*` viram aliases. Barlow Condensed e Manrope carregam só por `next/font`.
- `globals.css` deixa de redefinir utilitários Tailwind e de usar `!important` nos passes de override. Lógica, rotas, API e banco não mudam. As regras novas da papeleta e do número da camisa entram junto.

## [2026-10-10] fix | senha idempotente na importação Winners

- pages_updated=`hot`, `log`
- `scripts/import-winners.mjs` só grava senha ao criar o organizador. Conta já `ATIVA` entra com `ORGANIZADOR_SENHA` e não chama `POST /api/admin/organizadores`. `--reset-senha` força a troca. O teste usa chamadas falsas. O script não foi executado contra produção nem banco real.

## [2026-10-10] decisao | par de substituição fecha na volta

- pages_updated=`modulos/SUMULA-DIGITAL`, `03-REGRAS-DE-NEGOCIO`, `11-DECISOES`, `references/SUMULA-DIGITAL-E-CLASSIFICACAO`, `hot`, `log`
- O modal lista só reservas elegíveis. Quem entrou no set só sai para o titular voltar. Depois da volta o par fecha. Líbero não conta. A API recusa a troca inválida e a 9ª substituição. O requisito bruto ainda descreve a repetição do par.

## [2026-10-10] decisao | número da camisa no credenciamento

- pages_updated=`modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- O número editado no credenciamento fica em `SumulaPresenca.numero`, por partida, e não no cadastro `Jogador.numero`. `202610100001` torna `presente` anulável para a linha existir antes da confirmação. Não foi aplicada em produção.

## [2026-10-10] fix | papeleta de um time e alternância do saque

- pages_updated=`modulos/SUMULA-DIGITAL`, `09-UI-UX`, `hot`, `log`
- A conferência da distribuição tática voltou a mostrar um time por vez. O layout com as duas equipes e a rede no meio tinha entrado em 29/09/2026 junto com a quadra 2D (`d8982de`); essa quadra permanece na pontuação. O saque inicial alterna do set 2 ao 4 e o 5º set exige sorteio. `PUT` e `POST` da súmula recusam a sequência gravada fora dessa regra.

## [2026-10-10] fix | chave, pódio e rótulos públicos

- pages_updated=`09-UI-UX`, `modulos/MATA-MATA`, `modulos/CLASSIFICACAO`, `hot`, `log`
- A página do campeonato mostra a chave e, finalizado, o pódio. Inscrição some com o campeonato fechado. Jogos e portal nomeiam a fase. Classificação abre pelo `ligaId`. Formato, nome de atleta e status usam os mesmos rótulos.

## [2026-10-10] fix | um só +1 na pontuação da súmula

- pages_updated=`modulos/SUMULA-DIGITAL`, `hot`, `log`
- O botão `+1` da faixa de placar passou a registrar o ponto sem jogador, no lugar do par `+1` / Sem jogador. ACE, tempos, desfazer, placar e rodízio ficam. O modal de origem e atleta saiu junto com o único caminho que o abria. Ataque no atleta, bloqueio na rede e ACE continuam atribuindo o ponto.

## [2026-10-10] ingest | importação Winners e partida com categoria

- pages_updated=`modulos/GRUPOS`, `modulos/MATA-MATA`, `modulos/PARTIDAS`, `06-BANCO-DE-DADOS`, `hot`, `log`
- A geração de grupos, o mata-mata e o calendário automático gravam `categoriaCampeonatoId` e deixam `serie` nula. `GET` da estrutura passa a devolver `sumulaToken`.
- A migration `202610090004_partida_atualizado_em_default.sql` define default `now()` em `Partida.atualizadoEm`. O prefixo `202610090001` permanece na revogação de EXECUTE. Ainda não está em produção. O script de importação não foi executado.
- `scripts/import-winners.mjs` cria os três campeonatos pelo fluxo HTTP. A confirmação simulada usa a sessão de administrador. O campeão do Winners Teste é o vencedor da final.

## [2026-10-10] fix | fluxo até o campeão

- pages_updated=`modulos/CLASSIFICACAO`, `modulos/MATA-MATA`, `modulos/SUMULA-DIGITAL`, `12-BUGS-E-DEBITOS-TECNICOS`, `hot`, `log`
- O cálculo da tabela saiu da RPC antiga e foi para `src/lib/classificacao.ts`. A chave legado considera os melhores gerais. Finalizar exige campeão. A súmula corrige por 30 minutos, limita 8 substituições por equipe e set, e a gravação tenta restaurar o conteúdo se quebra no meio. A função SQL atômica continua divergente e não foi alterada. Aprovar partida segue aceitando administrador ou organizador dono, e confere o placar da categoria.

## [2026-10-10] test | suíte de contrato e Playwright

- pages_updated=`hot`, `log`
- Os scripts de teste continuam no `with-ts-node` da main, com Node 22 e `prisma generate && next build`. Entraram Playwright, o contrato da API e o CI de testes com Postgres local. A replicação em `replace-sections` não trata formulário publicado como conflito. Assinatura curta do webhook responde 401, e falha ao processar pagamento pago responde 5xx.

## [2026-10-09] fix | sessão com audiência e leitura de atleta

- pages_updated=`07-SEGURANCA`, `08-INTEGRACOES`, `modulos/PAGAMENTOS`, `hot`, `log`
- A sessão de administrador passa a exigir `typ` e audiência `volei-admin`, além de `scope: admin` quando o campo existe. Recuperação, sessão pública e ativação têm audiência própria. O fingerprint do reset ganha o prefixo `volei-password-reset-v1`. O logout limpa o cookie com os mesmos atributos. A recuperação limita 5 pedidos por IP e 3 por e-mail a cada hora e continua respondendo 500 se o banco falhar. O webhook da main permanece: valor, vínculo com `Pagamento` e exceção de segredo só no `next dev` local. A massa de QA exige sessão de administrador. Quadras do organizador, colunas da súmula, máscara da inscrição rápida, lista fechada do PUT de partida e erros de liga entram neste lote. `ADMIN_EMAIL` continua obrigatório em produção e preview, e opcional no `next dev` local.
## [2026-10-09] fix | sessão, webhook e súmula

- pages_updated=`07-SEGURANCA`, `modulos/PAGAMENTOS`, `modulos/SUMULA-DIGITAL`, `12-BUGS-E-DEBITOS-TECNICOS`, `hot`, `log`
- Token de reset deixa de passar em `isAdminSession`. O JWT de sessão exige `scope: admin` e recusa `purpose`. O reset carrega fingerprint HMAC, não o hash bcrypt. `ADMIN_EMAIL` é obrigatório em produção e preview. Login não enumera conta, limita tentativa em memória (30 por IP e 8 por IP e e-mail) e não devolve o JWT no corpo. O webhook ficou com o schema e o vínculo de `Pagamento` da camada de API, mais a ativação de árbitro quando o pagamento existe e não é de equipe. O valor confere em reais ou em centavos do valor gravado; o inverso ficou de fora. Súmula confere erro e tenta restaurar; a transação no banco continua pendente. `GET ?consulta=1` permanece a consulta pública.

## [2026-10-09] fix | endurecimento da camada de API

- pages_updated=`07-SEGURANCA`, `08-INTEGRACOES`, `modulos/PAGAMENTOS`, `hot`, `log`
- A confirmação simulada de pagamento fica desligada por padrão. O webhook InfinitePay exige segredo, valor e vínculo com a candidatura de equipe. Login de administrador não revela se o e-mail existe. `GET /api/equipes` lista colunas. Partida recusa times iguais ou de outro campeonato, e o administrador cria e aprova jogo.

## [2026-10-09] fix | build, CI e contrato de ambiente

- pages_updated=`08-INTEGRACOES`, `06-BANCO-DE-DADOS`, `hot`, `log`
- O build da Vercel passa a gerar o client Prisma e o Node fica em 22.x. O CI roda install, generate, validate, a trava de migration, lint, typecheck e build. `db:migrate` recusa o pooler de transação. Não há ledger Prisma para aplicar; o SQL continua em `supabase/migrations`.

## [2026-10-09] fix | falhas de interface no cabeçalho, inscrição e nova partida

- pages_updated=`09-UI-UX`, `hot`, `log`
- Cabeçalho e rodapé passam a mostrar «volei.space». Fora da home, o cabeçalho reserva 72px até ler a sessão local. Nova partida trata falha de rede, não busca as equipes duas vezes e lista as categorias do campeonato. Inscrição de equipe distingue erro de sucesso. Sair no admin limpa a sessão local.

## [2026-10-09] fix | histórico de migrations e default de função

- pages_updated=`06-BANCO-DE-DADOS`, `07-SEGURANCA`, `12-BUGS-E-DEBITOS-TECNICOS`, `modulos/INSCRICOES`, `synthesis/PRONTIDAO-E-APIS`, `hot`, `log`
- Os 35 SQL sem prefixo numérico passaram a ter versão anterior a `202610060004`. Nenhum deles concede `anon` ou `authenticated` depois do fechamento. Produção precisa de `supabase migration repair` antes do `db push`, porque esses arquivos já foram aplicados à mão.
- `202610090001` revoga o EXECUTE global de `PUBLIC` nos default privileges do papel `postgres`. O revoke dentro do schema, usado em `202610060004`, não remove esse default.
- `ClassificacaoEntrada` fica única por `(ligaId, equipeId)`. A migration nova não apaga linha. Índices das chaves estrangeiras citadas na revisão entram em `202610090002` e no Prisma. `SetPartida.partidaId` continua coberto pela unicidade `(partidaId, numero)`.
- As policies de leitura do Realtime já estavam nos SQL de elenco e de permissões; agora esses arquivos são versionados e rodam antes do `GRANT` de colunas de `202610060004`, que deixa `Partida` sem `sumulaToken`.
- `setup-db.mjs` saiu. Era o SQLite local da LUVA.
- Nada foi aplicado em banco real.

## [2026-10-06] fix | ver mais não recolhe sozinho

- pages_updated=`modulos/PARTIDAS`, `log`
- "Ver mais" na agenda do campeonato e em Jogos do painel ficava aberto e, segundos depois, a releitura do Realtime gravava de novo a primeira página. A lista aberta pelo usuário permanece; placar e status continuam atualizando.

## [2026-10-06] fix | auditoria antes da massa

- pages_updated=`07-SEGURANCA`, `06-BANCO-DE-DADOS`, `modulos/PARTIDAS`, `hot`, `log`
- A chave publicável lia `Partida.sumulaToken` e `Jogador` inteiro e era aceita em `PATCH /rest/v1/Partida`. A migration `fechar_acesso_anonimo` tirou isso e deixou só a leitura de placar, set e classificação que o Realtime usa; 22 arquivos de servidor passaram para `supabaseAdmin`.
- `GET /api/jogadores` respondia sem sessão com CPF, documento, nascimento, telefones e `qrCodeToken` de todos os organizadores. `GET /api/rankings` e `/equipes/[slug]` repetiam o mesmo `select('*')`. As três listam colunas agora.
- A vitrine pública anunciava «Súmula digital», que pede sessão, e repetia o link público em dois botões. O card ficou com um atalho só, e o acompanhamento `/api/partidas/{id}/ao-vivo` recusa apenas campeonato com `simulacao` — o filtro de campeonato de teste quebrava o link vindo da própria agenda.
- Depois de fechar as tabelas, a chave publicável ainda executava `recalcular_classificacao_liga` por RPC, porque o `revoke` de `anon` não alcança a concessão a `PUBLIC`. A migration `fechar_rpc_anonimo` corrige e deixa o `execute` só com o `service_role`.
- As três migrations e o código foram para a `main` e estão aplicados em produção. Verificado lá: `sumulaToken`, CPF, `Equipe`, `PATCH` e as RPC respondem 401; placar, set e classificação seguem legíveis; as páginas públicas e o login respondem 200.

## [2026-10-06] fix | ponto sem jogador

- pages_updated=`modulos/SUMULA-DIGITAL`, `log`
- O botão Sem jogador registra o ponto do time na hora, sem modal, sem atleta e sem ação. O histórico mostra Sem jogador e a estatística individual não recebe esse ponto.

## [2026-10-06] update | classificação ao vivo

- pages_updated=`modulos/CLASSIFICACAO`, `modulos/PARTIDAS`, `modulos/SUMULA-DIGITAL`, `06-BANCO-DE-DADOS`, `hot`, `log`
- A tabela existe com zero antes da primeira partida. O set encerrado entra no saldo durante o jogo; jogos, vitórias e pontos do campeonato esperam o encerramento. Classificação, agenda e acompanhamento escutam o Realtime e relêem ao reconectar.

## [2026-10-06] update | publicação local e produção

- pages_updated=`log`
- A navegação do organizador, o portal por campeonato, a súmula somente leitura e a inscrição pela categoria seguem para a `main`. O ambiente local continua no banco de desenvolvimento. A produção lê o banco de produção a partir dessa branch.

## [2026-10-06] fix | inscrição pelo clique

- pages_updated=`modulos/INSCRICOES`, `log`
- O rascunho da inscrição relê atletas já salvos ao abrir de novo. Concluir pelo link da categoria não exige mais a série antiga. A classificação da equipe nova grava a categoria e deixa a série vazia. A logo da equipe ainda falha no desenvolvimento porque o bucket `equipe-emblemas` não existe.

## [2026-10-06] update | massa de validação

- pages_updated=`modulos/SUMULA-DIGITAL`, `log`
- A Copa Massa QA, no desenvolvimento, tem oito equipes, jogos equilibrados, súmula, classificação e MVP calculados dos eventos. O recálculo da classificação passa a gravar pela categoria quando a função SQL não consegue. O líbero da súmula ignora o ponto final do número.

## [2026-10-06] update | guia fixa do organizador

- pages_updated=`09-UI-UX`, `log`
- O perfil do organizador mantém a mesma guia em todas as telas: Início, Parametrização, Campeonatos, Classificação, Jogos, Ao vivo, Galeria, Configurações, Portal, Rankings e o quadro da organização.

## [2026-10-06] update | súmula só leitura e novo campeonato

- pages_updated=`modulos/SUMULA-DIGITAL`, `log`
- `/sumula/{token}` mostra o registro da partida, sem edição, 2D, 3D, inverter ou acompanhar ao vivo. O árbitro segue lançando em `/sumula/{token}/lancar`. Novo Campeonato saiu do Início e ficou em Parametrização e Campeonatos.

## [2026-10-06] fix | corrigir quantidade no mata-mata

- pages_updated=`modulos/PARAMETRIZACAO`, `log`
- O botão corrigir da eliminatória com quantidade inválida vai ao campo Quantidade de equipes. A lista de campeonatos deixa de quebrar em várias linhas por causa da regra global de `tablist`.

## [2026-10-06] update | doca ao vivo do operador

- pages_updated=`modulos/SUMULA-DIGITAL`, `modulos/PARTIDAS`, `09-UI-UX`, `hot`, `log`
- O operador abre o acompanhamento na própria tela: doca na súmula e seção Ao vivo do painel. Os campos são os do placar público. O filtro `/ao-vivo` do portal permanece para quem assiste.

## [2026-10-06] update | vaga, jogos do campeonato e súmula

- pages_updated=`modulos/INSCRICOES`, `modulos/PARTIDAS`, `modulos/SUMULA-DIGITAL`, `log`
- A rota de jogos do painel e `/jogos?ligaId=` usam o campeonato da URL. Cada vaga parametrizada tem um link em `ConviteVagaEquipe`, e o rascunho continua depois do refresh. A cópia de parametrização em `replace-sections` grava só a configuração do destino. A súmula do jogo abre pelo token ou pelo id da partida.

## [2026-10-06] update | um MVP do campeonato

- pages_updated=`09-UI-UX`, `modulos/PARTIDAS`, `log`
- O ranking concluído mostra só o MVP do campeonato, somando os pontos de saque, ataque e bloqueio das ocorrências. Empate segue ataque, bloqueio, saque e nome.

## [2026-10-06] update | filtros de jogos e ranking concluído

- pages_updated=`09-UI-UX`, `modulos/PARTIDAS`, `modulos/CLASSIFICACAO`, `log`
- O símbolo volta para `/`. O menu público perde Ao Vivo. Em `/jogos`, Ao vivo, Não iniciado e Encerrados filtram o banco. A classificação pública lê a tabela calculada. MVP só aparece com o campeonato `FINALIZADO` ou `ENCERRADA`.

## [2026-10-06] update | ao vivo pagina os jogos públicos

- pages_updated=`modulos/PARTIDAS`, `log`
- A lista `/ao-vivo` tira os campeonatos de teste antes de paginar, para as partidas `EM_ANDAMENTO` dos demais campeonatos aparecerem. `/jogos` faz o mesmo recorte.

## [2026-10-06] update | módulos públicos sem filtro de organizador

- pages_updated=`09-UI-UX`, `modulos/PARTIDAS`, `log`
- O menu público fica só no cabeçalho: Portal, Jogos, Ao Vivo, Classificação, Rankings e Galeria. Portal abre sempre `/portal`. Jogos e ao vivo leem o banco inteiro. Classificação, rankings e galeria expandem o campeonato na própria tela.

## [2026-10-06] update | menu do portal

- pages_updated=`09-UI-UX`, `log`
- O menu das telas do portal passa a ser Portal, Jogos, Ao vivo, Classificação, Rankings, Galeria e Entrar, inclusive em `/portal` sem campeonato escolhido.

## [2026-10-06] update | capas padrão do portal

- pages_updated=`modulos/PARTIDAS`, `log`
- Campeonato sem foto própria no portal usa uma de quatro imagens de quadra, escolhida pelo id. A capa enviada pelo organizador segue valendo.

## [2026-10-06] update | consultas que rodavam sem a tela precisar

- pages_updated=`09-UI-UX`, `modulos/PARTIDAS`, `hot`, `log`
- A agenda do portal volta a consultar o ao vivo a cada 8 segundos só com partida em andamento, e a cada 60 segundos sem nenhuma. `/ao-vivo` espera 30 segundos quando a lista está vazia. O início do painel deixa de trocar de campeonato sozinho. As seções do painel desmontam ao sair, e a navegação de categoria reutiliza a lista já carregada.

## [2026-10-05] update | publicação da parametrização por categoria

- pages_updated=`hot`, `log`
- Portal, galeria e parametrização por categoria seguem para a `main`. A conclusão de mata-mata sem classificação já está na função de produção.

## [2026-10-05] update | parametrização por categoria

- pages_updated=`modulos/PARAMETRIZACAO`, `log`
- Depois das categorias, a parametrização abre com uma categoria ativa. Estrutura, classificação, eliminatórias, calendário e inscrições gravam nessa categoria. A comparação da replicação mostra origem e destino antes da cópia. Ainda local, sem publicação.

## [2026-10-05] update | publicação do portal e da galeria

- pages_updated=`hot`, `log`
- O portal por campeonato, a galeria com miniatura e a parametrização sem o botão Finalizar no cadastro seguem para a `main`. A coluna `Midia.thumbUrl` entra no banco de produção antes do deploy.

## [2026-10-05] update | categorias, imagem e finalizar

- pages_updated=`modulos/PARAMETRIZACAO`, `09-UI-UX`, `log`
- Em produção faltavam a função `selecionar_categorias_campeonato` e as políticas de upload. Por isso a etapa de categorias falhava e a imagem da identidade não gravava. O botão Finalizar campeonato passa a aparecer só com o campeonato ativo.

## [2026-10-05] update | portal por campeonato e galeria

- pages_updated=`modulos/PARTIDAS`, `modulos/PAGAMENTOS`, `hot`, `log`
- O portal escolhe um campeonato antes de carregar jogos. Ao vivo, próximos e últimos vêm em páginas de 8. A galeria tem capa, miniatura, upload e exclusão isolados por organizador. O pagamento simulado não bloqueia a estrutura. Ainda local, sem publicação na `main`.

## [2026-10-05] update | portal no menu da home

- pages_updated=`src/components/layout/Header.tsx`, `log`
- O menu da página inicial ganhou Portal ao lado de Etapas. O link abre `/portal`.

## [2026-10-04] update | triagem aplicada no código

- pages_updated=`13-TRIAGEM-PRODUTO`, `modulos/INSCRICOES`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- Uma porta de organizador, reenvio de senha, elenco do dono, ativação sem Pix simulado, substituição 8 com MVP, placar público sem massa de teste e link por categoria. Publicado na `main`.

## [2026-10-04] nota | triagem do produto

- pages_updated=`13-TRIAGEM-PRODUTO`, `00-INICIO`, `log`
- A triagem separa correção, próximo update e o que sai do fluxo. Súmula, classificação, mata-mata, isolamento e Ao vivo permanecem.

## [2026-10-04] ops | separação de ambiente do Supabase

- pages_updated=`08-INTEGRACOES`, `log`
- Com `NEXT_PUBLIC_SUPABASE_ALVO` cadastrado na Vercel, a separação de ambiente entra na `main`. Production usa `producao`. Preview e local usam `desenvolvimento`.

## [2026-10-04] ops | publicação do organizador e do ao vivo

- pages_updated=`07-SEGURANCA`, `modulos/SUMULA-DIGITAL`, `log`, `hot`
- Entrar, Seja membro, a liberação do organizador, o isolamento de escrita e `/ao-vivo` foram para a `main`. A separação de ambiente do Supabase ficou de fora deste deploy. A massa Marcos/Antonio continua só no banco de desenvolvimento.

## [2026-10-04] ops | APK 1.1.1

- pages_updated=`log`
- A `main` e a produção estão no commit `d23b5e1`. Entrar com Membro/Seja membro, `/seja-membro` e `/ao-vivo` existem só no ambiente local, ainda sem commit. O instalador `aplicativo-android/volei-space-producao.apk` é a versão 1.1.1 e continua abrindo `https://www.volei.space`.

## [2026-10-04] ops | APK 1.1.0

- pages_updated=`log`
- O instalador `aplicativo-android/volei-space-producao.apk` passou para `versionCode` 2 e `versionName` 1.1.0. Continua abrindo `https://www.volei.space` e é assinado para instalação direta.

## [2026-10-04] fluxo | organizador, isolamento e ao vivo

- pages_updated=`07-SEGURANCA`, `log`, `hot`
- Entrar oferece Membro e Seja membro. O interesse pede só nome, e-mail e telefone e fica pendente até o administrador liberar, com senha temporária. Escrita de equipe, jogador e partida confere o organizador do campeonato. O portal ganhou `/ao-vivo`. A massa de dois organizadores roda só no banco de desenvolvimento. Esta etapa não foi para a `main`.

## [2026-10-04] fluxo | origem do ponto na súmula

- pages_updated=`modulos/SUMULA-DIGITAL`, `log`, `hot`
- O +1 pede saque, bloqueio ou ataque e o atleta. O placar, o histórico e o ao vivo mostram `+1 Ponto de [tipo]`. A ocorrência guarda `ace`, `attack` ou `block` com o `jogadorId`.

## [2026-10-02] fix | carregamento das categorias

- pages_updated=`log`, `modulos/PARAMETRIZACAO`
- A lista de categorias pedia configuração e seções no mesmo select. Em produção o banco recusa esse aninhamento e a 5ª etapa mostra “Não foi possível carregar as categorias.” A leitura passa a trazer só os campos da categoria.

## [2026-10-02] ops | publicação do fluxo de cadastro

- pages_updated=`log`
- O commit `5416441` foi para a `main`. A Vercel publica a produção a partir dessa branch. As alterações locais ainda não commitadas (separação de ambiente, scripts soltos e o app Android) ficaram de fora.

## [2026-10-02] ops | jogadores da massa TOURNAMENT-SEED em produção

- pages_updated=`06-BANCO-DE-DADOS`, `hot`, `log`
- As 80 equipes `SEED-CHAMP` estavam sem elenco. Foram cadastrados 960 jogadores `TESTE-SEED-2026-CH##-EQ##-J###` (12 por equipe) e 9.600 presenças nas 400 partidas `SEED-GAME`. As equipes receberam `seedKey` `SEED-CHAMP-##-EQ##`. O script idempotente é `scripts/seed-torneio-jogadores-2026.sql`. LINK-FLOW e FLUXO-CADASTRO permaneceram.

## [2026-10-02] teste | fluxo de cadastro nos dois ambientes

- pages_updated=`log`
- A massa `FLUXO-CADASTRO-2026` gravou os mesmos campeonatos, equipes, jogadores, partidas e resultados no desenvolvimento e na produção. Mata-mata ficou sem tabela de classificação. O campeonato com grupos mostra a Equipe Teste Alfa com 3 pontos.

## [2026-10-02] fix | digitação do login no celular

- pages_updated=`09-UI-UX`, `log`
- E-mail e senha deixam de nascer somente leitura. No celular, o primeiro toque já recebe o que é digitado, sem precisar sair do campo e voltar.

## [2026-10-02] fluxo | cadastro do campeonato

- pages_updated=`modulos/PARAMETRIZACAO`, `04-FLUXOS`, `log`, `hot`
- Categorias passou a ser a 5ª etapa de Informações do campeonato. Salvar com sucesso avança; erro mantém a etapa. Mata-mata não abre Classificação nem conta essa sessão no progresso.

## [2026-10-02] ops | APK Android com o site de produção

- pages_updated=`log`
- O instalador `aplicativo-android/volei-space-producao.apk` abre `https://www.volei.space`. Campeonatos, jogos e súmula vêm do banco de produção. É um APK de depuração, assinado para instalação direta, sem conta na Play Store.

## [2026-10-01] fix | súmula em produção

- pages_updated=`log`, `modulos/PARTIDAS`
- A súmula em produção respondia 500 porque faltavam as chaves de ocorrência e destaque. Elas foram criadas. O árbitro que entrou pelo link do jogo passa a abrir e gravar a súmula daquela partida sem uma segunda conta.

## [2026-10-01] ui | versão mobile do navegador

- pages_updated=`09-UI-UX`, `log`
- Jogos e portal empilham o card e não despejam centenas de partidas de uma vez. A tabela de jogos do organizador usa a lista `data-stack`. O menu público e o modal do link consideram a área segura e o toque. Conferido em 390px e 320px sem rolagem horizontal em `/jogos`, `/portal` e na inscrição da Copa Nacional.

## [2026-10-01] perf | agenda pública e caminho antigo do árbitro

- pages_updated=`log`, `hot`, `modulos/PARTIDAS`
- A agenda geral deixa de trazer todos os jogos de todos os campeonatos. Sem campeonato escolhido, a consulta traz os jogos em andamento, até 40 próximos e os 20 encerrados mais recentes. Com campeonato escolhido, a agenda desse campeonato continua completa. O portal não repete a consulta no primeiro instante e só atualiza a cada 8 segundos enquanto houver jogo ao vivo; fora isso, a cada 60 segundos. A lista para o árbitro procurar partida saiu de `/jogos` e do painel. O acesso continua pelo link do jogo.

## [2026-10-01] ops | publicação do link de inscrição

- pages_updated=`log`, `hot`, `modulos/INSCRICOES`
- As telas do link de inscrição e a retirada do menu Árbitros foram para a `main`. A separação de ambiente que recusa o banco quando falta `NEXT_PUBLIC_SUPABASE_ALVO` continua só local.

## [2026-10-01] add | link de inscrição e massa LINK-FLOW-2026

- pages_updated=`modulos/INSCRICOES`, `modulos/PARTIDAS`, `06-BANCO-DE-DADOS`, `07-SEGURANCA`, `hot`, `log`
- O organizador passa a gerar um token por campeonato em `/inscricao/campeonato/{token}`. O menu Árbitros saiu do painel. A massa `LINK-FLOW-2026` foi inserida em desenvolvimento e em produção: 10 campeonatos, 100 equipes, 1.200 jogadores e 400 partidas (100 encerradas, 200 em andamento, 100 agendadas). A massa anterior e as 8 ligas reais de produção permaneceram.

## [2026-10-01] ops | publicação do link do árbitro

- pages_updated=`log`
- As telas e as rotas do link do árbitro foram para a `main` no commit `cfdc056`. Em produção, as chaves de partida, equipe e súmula foram criadas para o árbitro ver os nomes dos times. A separação de ambiente que recusa o banco quando falta `NEXT_PUBLIC_SUPABASE_ALVO` continua só local.

## [2026-10-01] add | link do árbitro e massa de 400 jogos

- pages_updated=`06-BANCO-DE-DADOS`, `modulos/PARTIDAS`, `log`, `hot`
- O organizador gera o link do jogo e define o código. O código fica só como hash e fora da URL. A migration `acesso_arbitro_jogo` está nos dois projetos. A massa `TOURNAMENT-SEED-2026` tem 10 campeonatos e 400 partidas em desenvolvimento e em produção, sem apagar as 8 ligas que já existiam em produção. Executar o script de novo não duplica `seedKey`.

## [2026-09-30] add | massa de demonstração no desenvolvimento

- pages_updated=`06-BANCO-DE-DADOS`, `log`, `hot`
- `npm run seed:test` cria 10 campeonatos e 30 partidas só fora da `main` e fora do banco de produção. A massa usa o árbitro já cadastrado `joao@teste.com.br`, sem alterar a conta. O portal público enxerga essas partidas porque elas não estão marcadas como simulação. A limpeza é `npm run seed:test:clean`.

## [2026-09-30] add | administrador de produção

- pages_updated=`log`
- Foi criada a conta `administrador@voleispace.com` na tabela `Admin` de `volei-space-producao`. O login em `www.volei.space` respondeu 200 com destino `/admin`. A senha não fica nesta nota.

## [2026-09-30] fix | login de produção recusado pela chave

- pages_updated=`log`, `hot`
- `POST` de login em produção devolve “Não foi possível consultar o usuário administrador.” A tabela `Admin` de `volei-space-producao` tem uma conta com senha e a RLS está desligada. O log da API mostra `401 Invalid API key` em `GET /rest/v1/Admin` com papel `service_role`, e o mesmo erro na chave `anon`. As chaves da Vercel ainda são as do projeto antigo.

## [2026-09-30] ops | deploy da separação de ambientes

- pages_updated=`08-INTEGRACOES`, `log`, `hot`
- O commit `0a1af60` foi publicado: `main` em Production e `teste-integrado` em Preview, ambos Ready. `GET https://www.volei.space/api/ping` passou de 200 no banco antigo para 500. A URL de produção foi separada; `NEXT_PUBLIC_SUPABASE_ANON_KEY` continua uma só, de 15/09, em Production e Preview. O preview da Vercel exige login, então o ping desse endereço não foi lido de fora.

## [2026-09-30] add | separação dos bancos por branch

- pages_updated=`06-BANCO-DE-DADOS`, `07-SEGURANCA`, `08-INTEGRACOES`, `log`, `hot`
- O cliente Supabase passa a exigir as variáveis do ambiente e recusa mistura entre produção e desenvolvimento. O painel avisa quando não está em produção. A Vercel ainda precisa receber as variáveis de cada ambiente; o site publicado não muda até o próximo deploy da `main`.

## [2026-09-29] add | base de produção no Supabase

- pages_updated=`06-BANCO-DE-DADOS`, `log`, `hot`
- Foi criado o projeto `volei-space-producao` para uso no `main`. O banco local permanece o de desenvolvimento. A cópia já tem as tabelas, as contas, os oito campeonatos, as categorias e os buckets de arquivo. Equipes, atletas, partidas e o apontamento da Vercel ainda não foram concluídos.

## [2026-09-29] fix | login quando falta a coluna de troca de senha

- pages_updated=`07-SEGURANCA`, `log`, `hot`
- O login deixa de falhar com “Não foi possível consultar Criador de campeonatos” quando `CandidaturaOrganizador.trocarSenha` (ou a coluna equivalente do árbitro) não existe no banco do ambiente. A consulta segue sem essa coluna. Isso não troca o projeto Supabase da Vercel.

## [2026-09-29] fix | login do administrador no banco em uso

- pages_updated=`07-SEGURANCA`, `log`, `hot`
- O login reconhece a conta que está na tabela `Admin` do Supabase ligado ao ambiente. O e-mail legado `admin@luv.com.br` deixa de ser o único administrador quando `ADMIN_EMAIL` não está definido.

## [2026-09-29] fix | status da inscrição rápida no build

- pages_updated=`log`
- A página do link trata inscrição ainda aberta como rascunho e inscrição concluída como enviada, para o build aceitar os status do rascunho. Os outros erros de tipo do mesmo build (fases do mata-mata, salvamento do wizard, card público e o organizador da simulação) foram alinhados. Os testes em `scripts/` ficam fora do typecheck do Next.

## [2026-09-29] perf | consultas do perfil do organizador

- pages_updated=`09-UI-UX`, `log`, `hot`
- Início, tabela e galeria passam a ler os campeonatos numa consulta. A guia já aberta permanece montada, então voltar para ela não espera a rede de novo.

## [2026-09-29] fix | oficializar súmula abre o resultado público

- pages_updated=`modulos/SUMULA-DIGITAL`, `log`, `hot`
- Partida encerrada sem `sumulaAprovadaEm` era recusada antes de gravar a súmula. O envio agora publica o resultado e o botão entrega `/partidas/{id}/ao-vivo`, visível sem login.

## [2026-09-29] fix | lado da quadra e nome na 2D

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`
- Na quadra 2D, inverter lados passa a trocar as equipes de metade. O nome do atleta aparece abaixo do número.

## [2026-09-29] fix | quadra 2D com as equipes de frente

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`, `hot`
- A grade 2D foi virada. As duas equipes ficam uma de frente para a outra, com a rede no meio.

## [2026-09-29] fix | portal público sem os jogos oficiais

- pages_updated=`modulos/PARTIDAS`, `09-UI-UX`, `log`, `hot`
- A consulta pública usava o vínculo antigo da equipe, falhava e o portal mostrava a agenda vazia. A abertura sem campeonato escolhido também caía no campeonato mais novo, ainda sem jogos. Agora a agenda lê o registro oficial, separa em andamento, próximos e encerrados, reúne os campeonatos que não são simulação e atualiza a cada 8 segundos.

## [2026-09-29] feat | escolha entre quadra 2D e 3D

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`
- Ao lado de acompanhar ao vivo, a súmula deixa escolher a grade original (2D) ou a quadra com imagem (3D).

## [2026-09-29] fix | ovais do fundo menores

- pages_updated=`09-UI-UX`, `log`
- P1, P5 e P6 usam o mesmo tamanho dos ovais da rede.

## [2026-09-29] fix | espaço na rede da quadra

- pages_updated=`09-UI-UX`, `log`
- Os ovais de P2, P3 e P4 ficam menores e afastados da malha, para não encostar na equipe do outro lado.

## [2026-09-29] fix | ações do oval na quadra

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `log`
- P1 a P6 ficam em negrito acima do oval. O sacador pisca em amarelo e só ele tem ace. A rede tem bloqueio; o fundo tem ponto e substituição.

## [2026-09-28] fix | imagem padrão da quadra

- pages_updated=`09-UI-UX`, `log`
- A súmula passa a usar `public/images/quadra-padrao.png`, com o piso laranja e a rede no centro. As posições continuam nas duas metades.

## [2026-09-28] fix | desenho oficial na quadra da súmula

- pages_updated=`09-UI-UX`, `log`
- A quadra da súmula passa a usar o desenho oficial, cortado na área de jogo e dividido nas duas metades com a linha de ataque a 3 m da rede.

## [2026-09-28] feat | quadra da súmula

- pages_updated=`modulos/SUMULA-DIGITAL`, `09-UI-UX`, `log`
- A pontuação e a escalação passam a mostrar a quadra vista de cima. Os atletas usam a formação já salva. Arrastar só organiza a escalação antes de confirmar.

## [2026-09-28] fix | acompanhamento ao vivo

- pages_updated=`modulos/PARTIDAS`, `log`
- «Acompanhar ao vivo» abria a partida e a consulta falhava no vínculo antigo da equipe, então a tela dizia que a partida não existia.

## [2026-09-28] fix | cabeçalho compacto da súmula

- pages_updated=`09-UI-UX`, `log`
- O título da partida na súmula usava até 4,25rem e empurrava a quadra. Passa a no máximo 1,55rem, com menos padding.

## [2026-09-28] fix | presença do árbitro e abertura da súmula

- pages_updated=`03-REGRAS-DE-NEGOCIO`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- A súmula deixava de carregar porque a consulta ainda usava o vínculo simples de equipe. A leitura passa a exigir sessão e escala, e a rota estável é o id da partida. O árbitro grava presença na partida e, ao iniciar, abre essa súmula.

## [2026-09-28] fix | escala do árbitro e simulação operável

- pages_updated=`03-REGRAS-DE-NEGOCIO`, `modulos/PARTIDAS`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- O organizador grava o árbitro na tabela de jogos. O árbitro deixa de se candidatar e só abre a partida da escala. A súmula passa a exigir essa escala e a recusar placar incompatível com o set configurado.
- migration=`202609280001_category_operation_definer`: a revisão da categoria passa a rodar como dona da função, senão a escala falha com a chave atual.

## [2026-09-28] fix | login sem tela intermediária

- pages_updated=`09-UI-UX`, `hot`, `log`
- O painel esperava a sessão no efeito e, no primeiro desenho, mostrava «Acesso restrito». O cabeçalho da identificação também montava o menu da sessão já gravada. A área da equipe e a lista de campeonatos separam «sem sessão» de «conta sem permissão».

## [2026-09-28] apply | categorias e preço agregado

- source=`feature/segregacao-categoria-precificacao` @ `108d0b5`, aplicado no working tree sem substituir finalização nem simulação
- pages_updated=`03-REGRAS-DE-NEGOCIO`, `hot`, `log`
- divergência mantida: set fecha com margem mínima 2, sem teto

## [2026-09-28] compare | segregação de categoria e precificação

- source=`feature/segregacao-categoria-precificacao` @ `108d0b5`, código em `prototipo-plataforma/outputs/luva-platform`
- pages_created=`docs/comparacao-segregacao-categoria-precificacao.md`
- pages_updated=`03-REGRAS-DE-NEGOCIO`, `hot`, `log`
- local_gap=categoria ainda é texto; preço por categoria e `CategoriaCampeonato` não estão neste working tree
- rule_gap=a branch varia sets e pontuação por categoria e exige margem exatamente 2 acima do alvo; a regra aprovada daqui não presume essa variação e fala em diferença mínima de 2
- sweep=398 arquivos do snapshot; 291 diferem sobretudo pelo trabalho local. Funções SQL de guarda, formulário, estrutura e calendário entraram no mesmo arquivo. Pódio, papeleta e mata-mata já existem aqui. A raiz da branch é legado LUVA

## [2026-09-27] ingest | central de simulações

- pages_updated=`03-REGRAS-DE-NEGOCIO`, `hot`, `log`
- code=`src/lib/simulacao.ts`, `src/lib/simulacao-dados.ts`, `/admin/simulacoes`, migration `simulacao`
- tests=`npm run test:simulacao` ok
- isolation=portal público continuou só com os campeonatos já ativos; linhas `simulacao=true` ficaram fora

## [2026-09-25] lint | prontidão e APIs

- pages_created=`synthesis/PRONTIDAO-E-APIS.md`
- pages_updated=`index`, `hot`, `02-ARQUITETURA`, `08-INTEGRACOES`, `11-DECISOES`, `modulos/INSCRICOES`, wikilinks `docs/requisitos` → `references`
- removed=`vault/.claude/skills` (cópia triplicada das skills)
- code=`scripts/team-registration-draft.test.ts` aponta para `supabase/migrations/`
- tests=pricing, team-sync, championship-setup, organizer-flow, registration-draft ok
- live=`GET /api/ping` 200 not_configured; rotas de dados 500 sem `.env`

## [2026-09-25] ingest | kepano/obsidian-skills

- source=`url:https://github.com/kepano/obsidian-skills`
- installed_to=`.agents/skills/`, `.cursor/skills/`, vault `.claude/skills/`
- skills=`obsidian-markdown`, `obsidian-bases`, `json-canvas`, `obsidian-cli`, `defuddle`, `knap`
- pages_created=`references/OBSIDIAN-SKILLS-KEPANO.md`

## [2026-09-25] ingest | LLM Wiki (Karpathy gist)

- source=`url:https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`
- pages_created=`raw/LLM-WIKI-KARPATHY.md`, `references/LLM-WIKI-KARPATHY.md`, `synthesis/LLM-WIKI-NO-VOLEI-SPACE.md`
- pages_updated=`AGENTS.md`, `00-INICIO.md`, `index.md`, `hot.md`, `.manifest.json`

## [2026-09-25] setup | schema llm-wiki-adaptado

- pages_created=index,log,hot,AGENTS,references/requisitos
- decisao="Aplicar mentalidade LLM Wiki ao vault de produto sem reorganizar áreas/módulos para concepts/entities"
