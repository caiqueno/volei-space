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
updated: 2026-10-10
---

# Log

## [2026-10-10] query | microinterações da súmula

- pages_updated=`09-UI-UX`, `modulos/SUMULA-DIGITAL`, `hot`, `log`
- ACE, toque no atleta, bloqueio B, troca de set e o modal de substituição ganham pulso local de opacidade e transform. O ponto continua no mesmo clique. O `+1` não muda.

## [2026-10-10] decisao | base visual Noite de final

- pages_updated=`09-UI-UX`, `hot`, `log`
- Tokens `--vs-*` passam a ser a paleta única. `--luva-*`, `--landing-*` e `--dark-*` viram aliases. Barlow Condensed e Manrope carregam só por `next/font`.
- `globals.css` deixa de redefinir utilitários Tailwind e de usar `!important` nos passes de override. Lógica, rotas, API e banco não mudam.

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
