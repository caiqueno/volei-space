---
title: >-
  Segurança
category: area
tags: [seguranca]
sources: [repo:athrios/volei-space]
summary: >-
  20261010140000 liga RLS em cada tabela public e ainda não foi aplicada. Partida segue com a leitura das colunas de placar.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Segurança e permissões

**Confirmado no repositório:** autenticação e verificações de posse em `src/lib/auth.ts` e `src/lib/championship-setup-access.ts`; migrations de RLS em `supabase/migrations`; operações públicas por token em inscrições e súmula. A presença de uma migration não garante sua aplicação ou eficácia no projeto Supabase em uso.

## Regras para alterações

- O deploy da `main` usa só o Supabase de produção. As outras branches e o ambiente local usam só o de desenvolvimento. A chave `service_role` não entra no navegador nem substitui a chave pública quando está ausente. Credenciais reais ficam fora do Git.
- A inscrição pública do campeonato usa o token de `LinkInscricaoCampeonato`. O servidor recusa token de outro campeonato, link desativado e período fechado. O id numérico da liga não substitui o token.
- O árbitro entra no jogo pelo link exclusivo que o organizador gera na guia Jogos. O painel separado de árbitros saiu do menu do organizador. O cadastro e a escala gravada no jogo permanecem. O código fica fora da URL e é gravado só como hash. O servidor confere o código, limita tentativas e registra geração, troca, regeneração, revogação, entrada e código incorreto. Um identificador numérico de outra partida não substitui esse link.
- O login de organizador e de árbitro pede a coluna `trocarSenha`. Se o banco do ambiente ainda não tem essa coluna, a consulta repete sem ela e a troca obrigatória de senha não se aplica nesse banco. Uma tabela de perfil ausente não interrompe a busca nas outras.
- Organizador deve operar apenas campeonatos de sua posse. O interessado envia nome, e-mail e telefone em `/seja-membro`. A conta fica `PENDENTE` e o login é recusado até o administrador liberar em Solicitações de organizadores. A liberação grava status `ATIVA`, uma senha temporária e `trocarSenha`. Essa senha só entra uma vez: o organizador substitui por uma senha nova antes de usar o painel. Criar, editar ou excluir equipe, jogador ou partida exige o organizador dono do campeonato; outro organizador recebe acesso negado ou registro não encontrado. O portal público continua listando campeonatos e o placar ao vivo. O perfil `publico` cria a própria conta e autentica, mas as rotas de gerenciamento continuam restritas a `organizador`.
- Convite de equipe deve limitar leitura e escrita ao campeonato, categoria e equipe vinculados; link público de divulgação não autoriza edição.
- `POST /api/inscricao/[slug]/jogadores` recusa o slug como autorização. O elenco entra pelo link de convite.
- `GET` público de equipe e partida devolve do atleta só id, nome, número, posição e foto. CPF e documento ficam fora dessa resposta. A auditoria de 06/10/2026 achou três rotas que não cumpriam isso e devolviam `Jogador` inteiro — `GET /api/jogadores` (sem sessão, qualquer organizador), `GET /api/rankings` e a página pública `/equipes/[slug]`. As três passaram a listar colunas; `cpf`, `documentoTipo`, `documentoNumero`, `dataNascimento`, `telefone`, `telefoneEmergencia`, `documentosUrls` e `qrCodeToken` não saem mais por elas. Quem adicionar uma consulta de atleta escreve as colunas: `select('*')` em `Jogador` é o jeito de repetir o vazamento.
- Token de súmula permite correção por 30 minutos do **primeiro** encerramento; após isso, corrigir exige identidade e propriedade do organizador verificadas no servidor.
- MVP, placares, substituições e status precisam de validação de servidor, não apenas da interface.
- Nova tabela ou RPC requer decisão explícita sobre RLS, permissões `anon`/`authenticated`, uso de `service_role` e isolamento de dados pessoais. O default global de `EXECUTE` para `PUBLIC` não cai com `alter default privileges in schema public`. A migration `202610090001_revogar_execute_public_default.sql` revoga esse default das funções que `postgres` criar depois, e deixa `EXECUTE` para `service_role`. Ela ainda não foi aplicada nos bancos. Arquivo posterior a `202610060005` não pode conceder acesso a `anon` ou `authenticated`. Revogar esse acesso continua permitido.
- Uploads, fotos, documentos e QR de atletas exigem políticas compatíveis com a finalidade e o escopo.

## Sessão, recuperação de senha e login

**Implementado:** o JWT de sessão do administrador carrega `scope: admin`, `typ: admin` e audiência `volei-admin`, e não carrega `purpose`. `isAdminSession` recusa token com `purpose`, com `scope` diferente de `admin`, ou sem esse tipo e essa audiência. Recuperação de senha, sessão pública e ativação de conta usam audiência e tipo próprios. O link de reset dura 30 minutos, traz um fingerprint HMAC da senha com prefixo `volei-password-reset-v1` (não o hash bcrypt) e deixa de valer quando a senha muda. Sessão antiga, sem tipo e audiência de administrador, pede login de novo.

`ADMIN_EMAIL` é obrigatório em produção e no preview da Vercel. Sem essa variável o login de administrador é recusado. No `next dev` local, com a variável ausente, a tabela `Admin` continua sendo a lista, como em 29/09/2026.

O login responde «Usuário ou senha não conferem.» antes de a senha conferir. Depois da senha correta, perfil errado ou organizador aguardando liberação usam a frase específica. O limite em memória é de 30 tentativas por IP e 8 por IP e e-mail a cada 10 minutos, por instância. O cookie `luva_token` segue sendo a sessão; o corpo do login de administrador não devolve o JWT. Curingas `%` e `_` no `ILIKE` do e-mail são escapados, e a linha lida ainda precisa ser o mesmo e-mail.

Erros de autenticação, da edição pública de candidatura, do cadastro de equipe, árbitro e quadra e da inscrição rápida não devolvem mensagem interna do banco. A duplicidade de e-mail continua respondendo 409 com a frase já usada na tela. A validação do formulário continua devolvendo a lista de campos.

`POST /api/partidas` e `POST /api/partidas/{id}/aprovar` aceitam a sessão do administrador ou a do organizador dono do campeonato. `PUT /api/partidas/{id}` continua só com o organizador dono. A partida recusa o mesmo time nos dois lados e time de outro campeonato. Se a categoria muda, `categoriaCampeonatoId` é recalculado. `GET /api/equipes` lista colunas explícitas. `GET /api/mensagens` e `GET /api/partidas` recusam identificador que não seja inteiro positivo.

## Webhook e súmula

**Implementado, com pendência de banco:** o webhook InfinitePay exige `INFINITEPAY_WEBHOOK_SECRET` fora do desenvolvimento local. Assinatura de tamanho diferente não derruba a rota. O corpo passa por schema (`equipe` ou `arbitro`, status e valor). Evento que não é `paid` responde `{ received: true }`. Evento `paid` só ativa equipe se a candidatura aponta para um `Pagamento` do mesmo identificador. O valor confere em reais ou com o webhook em centavos desse valor; o inverso não confere, para R$ 100 e R$ 1 não serem tratados como iguais. Repetição não cria outra equipe quando a candidatura já tem `equipeId`, e o índice único `(nome, ligaId, categoria, serie)` segura a corrida mais comum. Árbitro só ativa se já existe `Pagamento` com aquele `infinitePayId`, o valor confere e o pagamento não é de uma equipe. Falha de banco responde 500 para o provedor tentar de novo. Nada no código grava `Pagamento` hoje, então este webhook não ativa candidatura até essa linha existir.

A gravação da súmula confere cada erro e, se quebra no meio, tenta recolocar sets, presenças, ocorrências e destaques lidos antes. Isso não é transação: duas gravações simultâneas ainda podem se misturar. A correção definitiva é uma função única no banco. `GET /api/sumula/{token}?consulta=1` segue sem `requireSumulaLeitura` de propósito: é a leitura pública já filtrada. Tokens de demonstração da súmula não respondem com `NODE_ENV=production` nem em preview. Súmulas novas da geração de grupos, do insert do mata-mata e do calendário automático recebem `crypto.randomBytes(32)` em base64url. Não há migration: o token já gravado, inclusive no formato `luv-…`, continua abrindo a súmula pela comparação exata, e o id numérico da partida também. As funções SQL de confronto que já usam `gen_random_uuid()` não foram reescritas.

Não registre tokens reais, segredos, dados de atletas nem credenciais nos documentos do vault. Ver [[06-BANCO-DE-DADOS]].

## Sessão, webhook e leitura de atleta (09/10/2026)

Implementado neste lote, conferido no código:

- O JWT de recuperação de senha leva um HMAC da `senhaHash`, não o hash. Trocar a senha invalida o link. Tokens de admin, sessão pública, recuperação e ativação têm `aud` e `typ` próprios e a verificação recusa o tipo errado.
- `ADMIN_EMAIL` é obrigatório em produção e no preview. No `next dev` local, sem a variável, a tabela `Admin` continua valendo. O login e o esqueci-a-senha têm limite de tentativas. A resposta de login não devolve o JWT nem `err.message`. O logout apaga `luva_token` com os mesmos atributos usados ao gravar o cookie.
- O webhook InfinitePay recusa a chamada sem `INFINITEPAY_WEBHOOK_SECRET` fora do `next dev` local, compara a assinatura só com buffers do mesmo tamanho, confere valor e vínculo com `Pagamento`, e só ativa a candidatura nesse caminho. `parseExternalId` existe como conferência auxiliar e não substitui o schema da rota.
- `GET` e `POST /api/dev/massa-qa` exigem sessão de administrador, além do bloqueio fora do banco de desenvolvimento. A resposta de erro não inclui a exceção.
- `GET /api/organizador/quadras` e o `PATCH` só alcançam quadras de campeonatos do organizador autenticado.
- Súmula e operação do árbitro listam do atleta `id`, `nome`, `numero`, `posicao`, `fotoUrl`, `fotoRostoUrl` e `equipeId`, e do árbitro `id` e `nome`.
- `GET /api/inscricao-rapida/[token]` mascara CPF e data de nascimento. Ao concluir, o token do rascunho é substituído e o link anterior deixa de abrir a inscrição.
- `POST` e `PUT /api/partidas` recusam equipes de outro campeonato. O `PUT` grava só liga, equipes, categoria, rodada, data, local e endereço.
- As rotas de `ligas` registram a falha no servidor e não devolvem `err.message`.

A auditoria das rotas em `src/app/api` manteve públicos os fluxos de vitrine, portal, ping, cadastro, interessados, inscrição por token, súmula por sessão e QR do atleta. Mutações de campeonato, equipe, jogador e partida continuam presas ao organizador dono.

## Leitura pública e papéis (10/10/2026)

**Código neste repositório. A migration ainda não foi aplicada em nenhum banco.**

- `202610100002_fechar_leitura_publica_placar.sql` liga o RLS em `SetPartida` e `ClassificacaoEntrada`, remove `public_read_sets`, `luv_public_select_set_partida`, `public_read_classificacao` e `luv_public_select_classificacao`, e revoga todo o acesso de `public`, `anon` e `authenticated` nessas tabelas. Não cria policy nova para a chave publicável. O `service_role` segue ignorando o RLS. Os default privileges de `postgres` deixam de conceder tabela, sequência e função novas a `anon` e `authenticated`. O mesmo revoke vale para `supabase_admin` quando o papel da migration puder alterá-lo; se não puder, o Postgres só registra um aviso e o restante da migration segue.
- O placar ao vivo e a classificação já saem de `GET /api/partidas/[id]/ao-vivo`, `GET /api/classificacao` e `GET /api/portal/classificacao`. `useBancoAoVivo` repete essas consultas a cada 4 segundos, mesmo se o canal do Realtime falhar. Depois da migration, o evento `postgres_changes` dessas duas tabelas para de chegar ao navegador.
- `Partida` continua com o `GRANT` de colunas de placar de `202610060004`, sem `sumulaToken`. Fechar essa leitura fica para quando a consulta periódica estiver em produção.
- Cada rota em `src/app/api/organizador/ligas/[id]` confere o organizador dono (`requireOwnedLigaForSetup`, `ligaDoOrganizador`, `exigirOrganizadorDaLiga`, `getOwnedLiga` ou comparação de `organizadorId`). `PATCH /api/organizador/partidas/[id]/arbitro` exige o dono do campeonato e um árbitro dessa organização. `POST /api/arbitro/partidas/[token]/iniciar` recusa token numérico sem o cookie do link daquela partida. A conta de árbitro escalado continua entrando pelo `sumulaToken`.
- `POST /api/inscricoes-campeonato` grava `APROVADA` só com `Liga.inscricaoAprovacaoAutomatica` verdadeiro, e só então conta a vaga. Uma inscrição que já está `APROVADA` não é rebaixada. O JavaScript do rascunho não cobre mais o status devolvido pela função. A função no banco só passa a fazer o mesmo depois de `202610100001`.
- `GET /api/ligas` e `GET /api/ligas/[slug]` selecionam `LIGA_COLUNAS_PUBLICAS`. `organizadorId`, `seedKey`, `pagamentoConfirmadoEm`, `finalizadoPor` e `simulacaoRelogio` não saem na resposta. A listagem pública usa o `service_role`, porque a chave publicável já não lê `Liga`.
- `GET /api/equipes` e `GET /api/rankings` não embutem relação. Sem sessão, a lista de equipes só inclui campeonatos `EM_BREVE`, `ATIVA`, `ENCERRADA` ou `FINALIZADO` com `simulacao` desligada. Administrador vê o conjunto inteiro. Organizador vê os campeonatos dele. O ranking devolve nome, número, posição, foto e o nome da equipe, sem CPF, documento, telefone ou QR.
- `.env.example` descreve `ADMIN_EMAIL` como obrigatória em produção e no preview da Vercel. No `next dev` local, vazia, a tabela `Admin` continua valendo.

## RLS em todas as tabelas public (10/10/2026)

**Código neste repositório. A migration ainda não foi aplicada em nenhum banco.**

- O histórico ordenado deixa sem RLS: `CandidaturaArbitro`, `CandidaturaEquipe`, `CandidaturaPartidaArbitro`, `CandidaturaQuadra`, `ClassificacaoEliminatoria`, `CodigoAcessoOrganizador`, `ContaPublico`, `ConviteEquipe` e `Interessado`. As outras tabelas do Prisma têm `ENABLE` em arquivo anterior. Nos projetos, o QA encontrou cerca de 39 tabelas sem RLS, porque parte desses `ENABLE` está em migration marcada como aplicada sem o efeito no banco.
- `20261010140000_habilitar_rls_tabelas_publicas.sql` liga RLS em cada tabela `public` do Prisma e das migrations, com `ALTER TABLE IF EXISTS` e `to_regclass`. Não usa `FORCE ROW LEVEL SECURITY` e não cita `service_role`.
- A chave publicável no navegador assina o Realtime em `useBancoAoVivo` (`Partida`, `SetPartida`, `ClassificacaoEntrada`) e envia arquivo ao storage. Não há `supabase.from` de tabela nesse cliente. A policy `public_read_partidas` (`SELECT` para `anon` e `authenticated`, `USING (true)`) só é criada se faltar, para o `GRANT` de colunas de placar de `Partida` continuar. `sumulaToken` fica de fora desse `GRANT`. `SetPartida` e `ClassificacaoEntrada` não recebem policy nova. `anon` e `authenticated` perdem `ALL` nas demais tabelas, e `PUBLIC` perde `ALL` em todas, inclusive `Partida`.
- O servidor segue em `supabaseAdmin`. Página pública, login, súmula e painel não passam a ler tabela com a chave publicável. O aviso do Realtime de `SetPartida` e `ClassificacaoEntrada` pode parar nesta migration; a tela já consulta a API a cada 4 segundos. `202610100002` continua responsável por apagar as policies antigas dessas duas tabelas e por reescrever `finalizar_inscricao_equipe_rascunho`. Esta migration não altera aquele arquivo.
