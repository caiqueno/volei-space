---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  A vitrine mostra a fase do mata-mata, numera o turno sem reescrever jogos já gravados e deixa data e local do card legíveis. Nome novo de equipe entra em maiúsculas. 20261010140000 ainda não foi aplicada.
status: misto
created: 2026-09-25
updated: 2026-10-10
---

# Hot

## Foco atual

Em 10 de outubro de 2026 a página ao vivo, a súmula e o card do jogo usam o nome da fase no mata-mata (`Final`, `3º lugar`, `Semifinal`). Data e local «A definir» somem quando a partida já encerrou; jogo agendado continua com «A definir». O turno único e o returno ocupam a primeira rodada em que as duas equipes estão livres. Três equipes que já jogaram entre si não empurram o quarto confronto para a rodada 6. Jogos já gravados não são reescritos. A função SQL `substituir_estrutura_categoria` continua numerando em sequência e não é chamada pelo app; não houve migration. As partidas `GERAL` da liga 60 em produção ficam como estão: 919 está na rodada 5 e 920 na 6. Um calendário novo das equipes 266–269 coloca os dois pares nas rodadas 2 e 3. O card de data e local usa a superfície elevada `#16243D` e o texto `#F5F7FB`. Nome de equipe novo ou editado é gravado em maiúsculas no servidor (inscrição, formulário, importação e admin). A tela também aplica `text-transform` e `normalizarNomeEquipe`. Não houve migration nem atualização das linhas já gravadas. Fonte: [[modulos/PARTIDAS]], [[modulos/GRUPOS]], [[modulos/MATA-MATA]], [[modulos/EQUIPES-E-ATLETAS]], [[09-UI-UX]].

`20261010140000_habilitar_rls_tabelas_publicas.sql` liga RLS em cada tabela do schema `public`. O histórico anterior deixa nove sem RLS (`CandidaturaArbitro`, `CandidaturaEquipe`, `CandidaturaPartidaArbitro`, `CandidaturaQuadra`, `ClassificacaoEliminatoria`, `CodigoAcessoOrganizador`, `ContaPublico`, `ConviteEquipe`, `Interessado`); o ENABLE das outras está repetido porque o QA ainda viu cerca de 39 tabelas abertas. Não há `FORCE`. `service_role` não muda. A policy nova é só `public_read_partidas`, se faltar. `anon` perde privilégio fora das colunas de placar de `Partida`. `202610100002` não foi editada nem é pré-requisito. Nada foi aplicado em produção nem em desenvolvimento. Fonte: [[07-SEGURANCA]], [[06-BANCO-DE-DADOS]].

Em 10 de outubro de 2026 a súmula guarda a papeleta confirmada e o encerramento que ainda espera oficialização, a lista do MVP usa o número da partida, e o mesmo aviso não entra três vezes. Tokens novos de grupos, mata-mata e calendário automático são aleatórios; os `luv-…` já gravados seguem válidos. A geração continua exigindo uma categoria e não cruza confrontos. A prévia válida deixa de dizer «0 de 6 áreas disponíveis». O início do painel não mostra próximo jogo em campeonato `FINALIZADO` nem quando só há jogos encerrados. Fonte: [[modulos/SUMULA-DIGITAL]], [[07-SEGURANCA]], [[modulos/PARAMETRIZACAO]], [[modulos/PARTIDAS]], [[modulos/GRUPOS]], [[modulos/MATA-MATA]].

Estrutura, classificação e eliminatórias da categoria podem ser gravadas com equipes inscritas e jogos só agendados. O bloqueio fica para jogo em andamento, encerrado ou com súmula, com mensagem que explica o motivo. A função `salvar_configuracao_categoria` ainda recusa essa gravação (`Operacao iniciada`); a rota grava direto nesse caso. Com uma categoria, fase eliminatória e tie-break também vão para `Liga`, senão `/fase-mata-mata` continua em `NENHUMA`. Recriar confrontos vale só para a categoria escolhida: remove ou cancela jogos não iniciados das fases `GERAL` e `GRUPOS` dessa categoria e deixa o mata-mata e as outras categorias. Portal, tabela, jogos, ranking e pódio filtram por `categoriaCampeonatoId`. Fonte: [[modulos/PARAMETRIZACAO]], [[modulos/GRUPOS]], [[modulos/MATA-MATA]], [[modulos/CLASSIFICACAO]].

Os avisos da súmula de lançamento somem sozinhos em 3 segundos e não passam de dois na tela. O mais novo empurra o mais antigo e o temporizador é cancelado ao desmontar. Na pontuação eles ficam acima da faixa do placar e do `+1`. `prefers-reduced-motion: reduce` tira o deslocamento de entrada. A frase sem acento era o `catch` de `POST /api/arbitro/partidas/{token}/iniciar`. A súmula da captura (Set Point x Líbero FC, rodada 6, Ginásio Municipal, 15/08/2026) é a demonstração `token-demo-…`. O GET e o PUT de `/api/sumula/{token}` têm atalho e não gravam partida; o POST de iniciar não tem. Sem sessão de árbitro a rota responde 401; com sessão e sem essa partida, 404. A demonstração agora marca `EM_ANDAMENTO` localmente e não chama essa rota. Partida real que falhar de verdade mostra a frase com acento. Fonte: [[modulos/SUMULA-DIGITAL]], [[09-UI-UX]].

Encerrar um set que não fecha a partida inverte os lados da quadra na súmula e grava «Equipes inverteram os lados da quadra.». O saque dos sets 2 a 4 continua com quem não sacou no set anterior; o 5º set continua no sorteio. O pulso do rótulo segue `sumula-micro-set`. Fonte: [[modulos/SUMULA-DIGITAL]].

Microinterações só visuais em `src/app/micro-interactions.css`: entrada de tela, botão (hover, clique e foco), menu hambúrguer, abas dos documentos legais, aviso e fade de carregamento. Durações de 180–220ms, só `transform` e `opacity`. `prefers-reduced-motion: reduce` zera essas regras. Súmula, páginas públicas, pódio, painel e identificação não recebem a troca de tela nem o menu novo. Os keyframes de `globals.css` da base Noite de final ficam como estão. Fonte: [[09-UI-UX]].

Em 10 de outubro de 2026 a leitura pública de `SetPartida` e `ClassificacaoEntrada` fecha na migration `202610100002_fechar_leitura_publica_placar.sql`, ainda não aplicada. O prefixo `202610100001` continua no número da camisa. Ela liga o RLS, remove as policies `USING (true)`, revoga `anon` e `authenticated` e repete o revoke dos default privileges para `postgres` e, se o papel puder, para `supabase_admin`. Placar e tabela continuam nas APIs com `service_role`. O navegador consulta essas APIs a cada 4 segundos. O aviso do Realtime nessas duas tabelas para quando a migration entrar. `Partida` segue com SELECT das colunas de placar. A função `finalizar_inscricao_equipe_rascunho` volta a ler `inscricaoAprovacaoAutomatica` só depois dessa migration. Até lá o SQL já instalado grava `APROVADA`. O `POST /api/inscricoes-campeonato` já respeita a flag, e o rascunho não força mais `APROVADA` por cima do retorno.

A migration `20261010015632_indices_consultas_quentes.sql` só cria índice, se ainda não existir, nas consultas de campeonato, equipe, atleta, partida e súmula. `Partida.grupoId` e `GrupoEquipeCampeonato.equipeId` passam a ser a primeira coluna de um índice. Os compostos cobrem fase e rodada, status e horário, elenco por equipe, e ocorrência por partida e set. Pontos e presença já estavam cobertos pela unicidade. O `@@index` está no Prisma; a vitrine com `simulacao = false` fica só no SQL. Nada foi aplicado em produção nem em desenvolvimento. Fonte: [[06-BANCO-DE-DADOS]].

A súmula de lançamento ganha microinterações só visuais: ACE, toque no atleta, bloqueio B, troca de set e abertura/fechamento do modal de substituição. São opacidade e transform em `sumula-micro.css`, desligadas com `prefers-reduced-motion`. O lance entra na hora. O `+1` continua com a bola. Fonte: [[09-UI-UX]], [[modulos/SUMULA-DIGITAL]].

Microinterações públicas em `src/styles/microinteracoes.module.css`, em cima da base «Noite de final». Home, campeonato, classificação, jogos, chaveamento, perfil da equipe, pódio e a aparência do painel do organizador. Animação só com `transform` e `opacity`, 160–280ms. `prefers-reduced-motion` desliga. O líder da tabela tem faixa dourada. O campeão do pódio e do chaveamento tem brilho dourado curto. Súmula, menu, toasts, loading e os utilitários de `globals.css` não mudam. Sem API, banco ou permissão. Fonte: [[09-UI-UX]].

Base visual «Noite de final», sem mudar telas, rotas, API ou banco. Tokens `--vs-*` em `globals.css` e `tailwind.config.ts`. Fontes só por `next/font`: Barlow Condensed 600/700 e Manrope 400–700. Saiu o `@import` duplicado da Manrope, a redefinição de utilitários Tailwind e os `!important` dos passes de override. `--luva-*`, `--landing-*` e `--dark-*` ficam como aliases. O seletor do árbitro exclui `.referee-feedback`, e a papeleta ganha as regras novas de linha, saque e número. Fonte: [[09-UI-UX]].

`scripts/import-winners.mjs` deixa de redefinir a senha em toda execução. Se o organizador já está `ATIVA`, o script entra com `ORGANIZADOR_SENHA` e não chama `POST /api/admin/organizadores`. A senha temporária só entra ao criar a conta. `--reset-senha` força a troca. Conta existente fora de `ATIVA` também fica sem troca, até essa flag. O teste `scripts/import-winners.test.mjs` usa chamadas falsas e não abre banco. O script não foi executado contra produção.

Em 10 de outubro de 2026 a súmula passa a fechar o par de substituição no set. Se o #5 sai e o #9 entra, o #9 só pode sair para o #5 voltar. Depois da volta, nenhum dos dois é substituído de novo naquele set. O modal da quadra lista só reservas elegíveis e nunca quem está em quadra. A troca de líbero não conta e não cria par. O limite continua em 8. Não há substituição excepcional. O `PUT` e o `POST` de `/api/sumula/[token]` recusam troca inválida. O requisito bruto ainda permite repetir o par; a decisão do dono fecha na volta. Fonte: [[modulos/SUMULA-DIGITAL]], [[11-DECISOES]].

O credenciamento pré-partida edita o número da camisa no badge do atleta. O valor fica em `SumulaPresenca.numero` e não altera `Jogador.numero`. A faixa é 0–99 e o número efetivo não repete na mesma equipe naquela partida. `presente` nulo continua Pendente; a migration `202610100001` ainda não foi aplicada. Fonte: [[modulos/SUMULA-DIGITAL]], [[06-BANCO-DE-DADOS]].

A conferência da papeleta na súmula mostra um time por vez, com indicação de quem já confirmou e um comando para o outro time. A quadra 2D com os dois lados continua na pontuação. O saque do set 1 é escolha; nos sets 2, 3 e 4 o sistema impõe quem não sacou no set anterior; no 5º set há sorteio no aplicativo ou registro do resultado da mesa. A gravação da súmula recusa a alternância quebrada. Fonte: [[modulos/SUMULA-DIGITAL]].

Correções de interface no campeonato público, sem API, Prisma nem cálculo de tabela. A página do slug mostra a chave e, se `FINALIZADO`, o pódio da final e do 3º lugar. Inscrições fechadas escondem «Inscrever equipe» e «Já tenho conta». O status usa `formatLigaStatus` também em Rankings. Jogos e portal nomeiam a fase (`3º lugar`) e omitem data ou local ausente em partida encerrada. `/classificacao?ligaId=` expande o campeonato da lista pública. O perfil da equipe quebra o nome do atleta e usa rótulo de formato. Fonte: [[09-UI-UX]], [[modulos/MATA-MATA]], [[modulos/CLASSIFICACAO]].

Na faixa de placar da súmula, cada equipe ficou com um único `+1`. Ele registra o ponto sem jogador: sem modal, sem `jogadorId` e com o histórico «Sem jogador». O modal de saque, bloqueio ou ataque saiu, porque só o `+1` antigo o abria. ACE, o toque no atleta, o bloqueio da rede e a quadra 3D continuam atribuindo o ponto. Tempos, desfazer, placar e rodízio não mudaram. Fonte: [[modulos/SUMULA-DIGITAL]].

Movimento reutilizável em `src/styles/vs-motion.css` e `VolleyballBurst`. O +1 da súmula usa press, foco e a bola. O clique registra antes da animação. Sem API, banco ou data fetching. Fonte: [[09-UI-UX]].

A geração de grupos, o mata-mata e o calendário automático passam a gravar `categoriaCampeonatoId` e `serie` nula. Sem isso o gatilho recusa a partida. `Partida.atualizadoEm` ganha default `now()` na migration `202610090004_partida_atualizado_em_default.sql`, ainda não aplicada em produção. O prefixo `202610090001` continua sendo a revogação de EXECUTE. O `GET` da estrutura devolve `sumulaToken`. O script `scripts/import-winners.mjs` cria Winners Oficial, Winners Teste e Winner QA pelo HTTP do app: inscrição aprovada, grupos, súmula e mata-mata em jogo único. A confirmação simulada de pagamento sai da sessão de administrador, porque o organizador não confirma com o gateway desligado. No Winners Teste o campeão sai da final, e finalizar exige essa final e o 3º lugar. A tabela continua só com a fase de grupos. O script não foi executado neste merge. Fonte: [[modulos/GRUPOS]], [[modulos/MATA-MATA]], [[modulos/PARTIDAS]].

`GET /api/equipes` e `GET /api/rankings` montam liga, elenco e votos no servidor. O embed quebrava porque o histórico não cria `Equipe_ligaId_fkey` nem `VotoMVP_jogadorId_fkey`. A lista anônima de equipes fica nos campeonatos públicos, fora de simulação. `GET /api/ligas` e `GET /api/ligas/[slug]` devolvem colunas explícitas, sem `organizadorId` nem `seedKey`. Erros de inscrição rápida, rascunho, setup, calendário, estrutura e mata-mata ficam no log. O id numérico da partida não abre a operação do árbitro sem o cookie do link exclusivo. `ADMIN_EMAIL` já era obrigatório em produção e no preview; o exemplo deixa de tratá-la como opcional.

As migrations `202610090001` a `202610090004`, a `202610100001` do número da camisa e a `202610100002` do placar continuam fora dos bancos. Nada deste lote foi executado em produção. Fonte: [[07-SEGURANCA]], [[06-BANCO-DE-DADOS]], [[modulos/INSCRICOES]].

## Key Takeaways

- Publique o código antes da migration. Faça backup de `SetPartida` e `ClassificacaoEntrada` e aplique só `202610100002`. `202610100001` é a do número da camisa.
- A inscrição pelo `POST` nasce `SOLICITADA` quando a aprovação automática está desligada. Uma inscrição já `APROVADA` não volta para trás.
- O árbitro entra pelo token de `AcessoArbitroJogo`. A conta escalada usa o `sumulaToken`.

## Abrir primeiro

1. [[07-SEGURANCA]]
2. [[06-BANCO-DE-DADOS]]
3. [[modulos/INSCRICOES]]

Auditoria de deploy em 9 de outubro de 2026: o build é `prisma generate && next build`, o Node na Vercel fica em 22.x, e o CI cobre install, generate, validate, lint, typecheck e build. `npm run db:migrate` só aceita `DIRECT_URL` na porta 5432. Não há `prisma/migrations`; nada disso reaplica `supabase/migrations` em produção.

Correções só de interface, sem API nem banco. O cabeçalho e o rodapé mostram «volei.space». Fora da home, o cabeçalho reserva 72px até ler a sessão. Nova partida trata falha de rede e resposta que não é JSON, mostra erro e carregamento de campeonatos e equipes, busca as equipes uma vez e lista as categorias em `GET /api/categorias?ligaId=`. A inscrição da equipe não deixa o botão preso se a rede cair, avisa quando a sessão não tem equipe e separa erro de sucesso. Sair no admin reutiliza `encerrarSessaoPublica()`. Aprovar súmula não chama falha de conexão quando o corpo não é JSON.

O histórico SQL ficou ordenado para a CLI. Trinta e cinco arquivos `supabase-*.sql` receberam prefixo anterior a `202610060004` e `202610060005`, então nenhum grant a `anon` ou `authenticated` corre depois do fechamento. Produção e desenvolvimento já receberam esse SQL à mão: `supabase migration repair --status applied` é obrigatório antes de `db push`. Seis migrations novas ainda não foram aplicadas, nesta ordem: `202610090001` tira o EXECUTE global de `PUBLIC` dos default privileges de `postgres` (o revoke dentro do schema não faz isso) e deixa `service_role`; `202610090002` cria os índices de chave estrangeira que faltavam; `202610090003` garante a unicidade `(ligaId, equipeId)` em `ClassificacaoEntrada` sem apagar linha; `202610090004` define `default now()` em `Partida.atualizadoEm`; `202610100001` permite `SumulaPresenca.presente` nulo para guardar o número da camisa antes da confirmação; `202610100002` fecha a leitura pública de sets e classificação. A mesma equipe joga em mais de uma liga. `SetPartida.partidaId` já é a primeira coluna da unicidade `(partidaId, numero)`. As policies de leitura do Realtime estão nos arquivos agora versionados `202609200020` e `202609200021`; o `GRANT` de `202610060004` limita as colunas de `Partida` e não inclui `sumulaToken`. `prisma/schema.prisma` descreve esse banco. Não há `prisma/migrations`. `setup-db.mjs` saiu. Nada foi executado em banco real. Fonte: [[06-BANCO-DE-DADOS]].

## Key Takeaways

- A triagem de 4 de outubro de 2026 está na `main`. O portal por campeonato, a galeria e o botão Finalizar só em campeonato ativo entram na `main` em 5 de outubro.
- Em 5 de outubro a produção ganhou a função `selecionar_categorias_campeonato`, as políticas de upload e a coluna `Midia.thumbUrl`.
- A parametrização por categoria ativa e a comparação da replicação entram na `main` junto com o portal e a galeria.
- Produção, no commit `6f9c8f6`, responde `GET /api/ping` com alvo `producao`.
- Cada vaga parametrizada tem um link em `ConviteVagaEquipe`. O painel de jogos lê o `ligaId` da URL.
- O ao vivo do operador abre no painel (`/painel?secao=aovivo`). A súmula pública é só o registro; o lançamento fica em `/sumula/{token}/lancar`.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
