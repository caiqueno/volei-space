---
title: >-
  Segurança
category: area
tags: [seguranca]
sources: [repo:athrios/volei-space]
summary: >-
  Acesso e dados pessoais. Função nova não nasce executável por PUBLIC.
status: implementado
created: 2026-09-20
updated: 2026-10-09
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
- Nova tabela ou RPC requer decisão explícita sobre RLS, permissões `anon`/`authenticated`, uso de `service_role` e isolamento de dados pessoais. O default global de `EXECUTE` para `PUBLIC` não cai com `alter default privileges in schema public`. A migration `202610090001_revogar_execute_public_default.sql` revoga esse default das funções que `postgres` criar depois, e deixa `EXECUTE` para `service_role`. Ela ainda não foi aplicada nos bancos. Arquivo de migration que conceda acesso a `anon` ou `authenticated` fica antes de `202610060004` e `202610060005`.
- Uploads, fotos, documentos e QR de atletas exigem políticas compatíveis com a finalidade e o escopo.

## Sessão, recuperação de senha e login

**Implementado:** o JWT de sessão do administrador carrega `scope: admin`, `typ: admin` e audiência `volei-admin`, e não carrega `purpose`. `isAdminSession` recusa token com `purpose`, com `scope` diferente de `admin`, ou sem esse tipo e essa audiência. Recuperação de senha, sessão pública e ativação de conta usam audiência e tipo próprios. O link de reset dura 30 minutos, traz um fingerprint HMAC da senha com prefixo `volei-password-reset-v1` (não o hash bcrypt) e deixa de valer quando a senha muda. Sessão antiga, sem tipo e audiência de administrador, pede login de novo.

`ADMIN_EMAIL` é obrigatório em produção e no preview da Vercel. Sem essa variável o login de administrador é recusado. No `next dev` local, com a variável ausente, a tabela `Admin` continua sendo a lista, como em 29/09/2026.

O login responde «Usuário ou senha não conferem.» antes de a senha conferir. Depois da senha correta, perfil errado ou organizador aguardando liberação usam a frase específica. O limite em memória é de 30 tentativas por IP e 8 por IP e e-mail a cada 10 minutos, por instância. O cookie `luva_token` segue sendo a sessão; o corpo do login de administrador não devolve o JWT. Curingas `%` e `_` no `ILIKE` do e-mail são escapados, e a linha lida ainda precisa ser o mesmo e-mail.

Erros de autenticação, da edição pública de candidatura e do cadastro de equipe, árbitro e quadra não devolvem mensagem interna do banco. A duplicidade de e-mail continua respondendo 409 com a frase já usada na tela. O cadastro rápido de inscrição ainda devolve o detalhe do erro.

`POST /api/partidas` e `POST /api/partidas/{id}/aprovar` aceitam a sessão do administrador ou a do organizador dono do campeonato. `PUT /api/partidas/{id}` continua só com o organizador dono. A partida recusa o mesmo time nos dois lados e time de outro campeonato. Se a categoria muda, `categoriaCampeonatoId` é recalculado. `GET /api/equipes` lista colunas explícitas. `GET /api/mensagens` e `GET /api/partidas` recusam identificador que não seja inteiro positivo.

## Webhook e súmula

**Implementado, com pendência de banco:** o webhook InfinitePay exige `INFINITEPAY_WEBHOOK_SECRET` fora do desenvolvimento local. Assinatura de tamanho diferente não derruba a rota. O corpo passa por schema (`equipe` ou `arbitro`, status e valor). Evento que não é `paid` responde `{ received: true }`. Evento `paid` só ativa equipe se a candidatura aponta para um `Pagamento` do mesmo identificador. O valor confere em reais ou com o webhook em centavos desse valor; o inverso não confere, para R$ 100 e R$ 1 não serem tratados como iguais. Repetição não cria outra equipe quando a candidatura já tem `equipeId`, e o índice único `(nome, ligaId, categoria, serie)` segura a corrida mais comum. Árbitro só ativa se já existe `Pagamento` com aquele `infinitePayId`, o valor confere e o pagamento não é de uma equipe. Falha de banco responde 500 para o provedor tentar de novo. Nada no código grava `Pagamento` hoje, então este webhook não ativa candidatura até essa linha existir.

A gravação da súmula confere cada erro e, se quebra no meio, tenta recolocar sets, presenças, ocorrências e destaques lidos antes. Isso não é transação: duas gravações simultâneas ainda podem se misturar. A correção definitiva é uma função única no banco. `GET /api/sumula/{token}?consulta=1` segue sem `requireSumulaLeitura` de propósito: é a leitura pública já filtrada. Tokens de demonstração da súmula não respondem com `NODE_ENV=production` nem em preview.

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
