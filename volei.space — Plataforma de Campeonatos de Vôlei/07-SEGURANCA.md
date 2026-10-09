---
title: >-
  Segurança
category: area
tags: [seguranca]
sources: [repo:athrios/volei-space]
summary: >-
  Acesso e dados pessoais.
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
- Nova tabela ou RPC requer decisão explícita sobre RLS, permissões `anon`/`authenticated`, uso de `service_role` e isolamento de dados pessoais.
- Uploads, fotos, documentos e QR de atletas exigem políticas compatíveis com a finalidade e o escopo.

Não registre tokens reais, segredos, dados de atletas nem credenciais nos documentos do vault. Ver [[06-BANCO-DE-DADOS]].

## Sessão, webhook e leitura de atleta (09/10/2026)

Implementado neste lote, conferido no código:

- O JWT de recuperação de senha leva um HMAC da `senhaHash`, não o hash. Trocar a senha invalida o link. Tokens de admin, sessão pública, recuperação e ativação têm `aud` e `typ` próprios e a verificação recusa o tipo errado.
- Sem `ADMIN_EMAIL`, nenhuma sessão de administrador é aceita. O login e o esqueci-a-senha têm limite de tentativas. A resposta de login não devolve o JWT nem `err.message`. O logout apaga `luva_token` com os mesmos atributos usados ao gravar o cookie.
- O webhook InfinitePay recusa a chamada se `INFINITEPAY_WEBHOOK_SECRET` estiver ausente, compara a assinatura só com buffers do mesmo tamanho, só marca `Pagamento` uma vez e só ativa a candidatura quando `external_id` confere com esse registro.
- `GET` e `POST /api/dev/massa-qa` exigem sessão de administrador, além do bloqueio fora do banco de desenvolvimento. A resposta de erro não inclui a exceção.
- `GET /api/organizador/quadras` e o `PATCH` só alcançam quadras de campeonatos do organizador autenticado.
- Súmula e operação do árbitro listam do atleta `id`, `nome`, `numero`, `posicao`, `fotoUrl`, `fotoRostoUrl` e `equipeId`, e do árbitro `id` e `nome`.
- `GET /api/inscricao-rapida/[token]` mascara CPF e data de nascimento. Ao concluir, o token do rascunho é substituído e o link anterior deixa de abrir a inscrição.
- `POST` e `PUT /api/partidas` recusam equipes de outro campeonato. O `PUT` grava só liga, equipes, categoria, rodada, data, local e endereço.
- As rotas de `ligas` registram a falha no servidor e não devolvem `err.message`.

A auditoria das rotas em `src/app/api` manteve públicos os fluxos de vitrine, portal, ping, cadastro, interessados, inscrição por token, súmula por sessão e QR do atleta. Mutações de campeonato, equipe, jogador e partida continuam presas ao organizador dono.
