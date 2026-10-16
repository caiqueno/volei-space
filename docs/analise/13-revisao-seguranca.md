# 13 - Revisão de segurança (volei.space)

Agente: seguranca. Data: 2026-10-16. Somente leitura; nada tocado em produção nem em banco. Lidos: `CLAUDE.md`, `07-SEGURANCA.md`, `src/middleware.ts`, `src/lib/{auth,admin-access,organizador-isolamento,acesso-arbitro-jogo,arbitro-access,sumula-access,championship-setup-access,team-registration-draft,email}.ts`, ~45 rotas em `src/app/api`, migrations de RLS e storage.

**Limite:** as migrations `supabase-*.sql` não têm timestamp; a ordem de aplicação e o estado real do Supabase de produção são desconhecidos. **Antes de qualquer correção, confirmar no painel do Supabase** RLS por tabela, grants de `anon` e policies de `storage.objects`.

## Ação imediata
- `README.md:35-36`, `COMO-TESTAR.txt` e `setup-db.mjs:236-245,421` documentam um login de administrador padrão. Se essa conta existir em qualquer ambiente, trocar a senha agora e remover a credencial dos arquivos (valor não copiado aqui).
- Não há chave de Supabase, JWT ou SMTP no código; `.env.example` só tem placeholders. Se o `JWT_SECRET` de produção for parecido com o placeholder (`.env.example:15`), trocá-lo; o código não valida o tamanho do segredo (`src/lib/auth.ts:9-13`).

## Crítico
**C1. RLS desligado e grants para `anon` nas tabelas centrais, com a anon key pública.**
- `supabase-organizador-campeonatos.sql:15-34` desliga RLS de `Liga`, `Equipe`, `Partida`, `InscricaoCampeonato`, `ClassificacaoEntrada` e concede `select, insert, update` a `anon`. `supabase-cadastro-contatos-unicos.sql:15-17`, `supabase-fix-cadastro-rls.sql:4-6` e `supabase-candidaturas-quadras.sql:74-79` desligam RLS de `CandidaturaEquipe/Arbitro/Quadra` ("padrão do protótipo"). `supabase-candidaturas-organizadores.sql:150-169` dá `select, insert, update` a `anon` em `CandidaturaOrganizador` com leitura `using (true)`.
- Cenário: a anon key vai ao navegador; qualquer pessoa chama o PostgREST, lê e-mail, telefone e `senhaHash` das candidaturas e, nas tabelas sem RLS, altera `senhaHash`/`status` (autoaprovação, tomada de conta), `Liga.organizadorId` e placares.
- Indício de que está ativo: várias rotas escrevem com o client anon (`src/lib/supabase.ts`): `api/equipes/route.ts:73-77`, `api/equipes/[id]/route.ts:31-36,48`, `api/jogadores/route.ts:40`, `api/jogadores/[id]/route.ts:20,37`, `api/partidas/[id]/route.ts:42`, `api/mensagens`.
- Impacto: isolamento entre organizadores (só no Node) contornável; vazamento de hashes e dados pessoais; tomada de qualquer conta.
- Correção: ligar RLS em todas as tabelas; `revoke all ... from anon, authenticated` nas tabelas de escrita e nas com `senhaHash`/dado pessoal; manter só `select` público em colunas/views públicas; migrar as escritas listadas para `supabaseAdmin`; padronizar migrations com timestamp; auditar `pg_policies` e `information_schema.role_table_grants`.

**C2. Dados de atletas (inclui menores) legíveis por qualquer pessoa; storage de documentos público e gravável.**
- `supabase-producao-elenco-sumula-rls.sql:73-76` cria `public_read_jogadores` com `using (true)`: `anon` lê CPF, `documentoNumero`, `dataNascimento`, telefone, `telefoneEmergencia`, `documentosUrls`, `qrCodeToken` (colunas em `api/capitao/jogadores/route.ts:204-224`). `supabase-rls-producao-permissoes-campeonatos.sql:50-63` limita por status da liga mas é `select *`. `07-SEGURANCA.md:26` afirma que o GET público só devolve id, nome, número, posição e foto: vale só para o código Next, o PostgREST contorna.
- Bucket `atleta-arquivos` é **público**, com fotos e PDFs de documentos; policies de SELECT, INSERT e UPDATE para `anon` em `supabase-producao-elenco-sumula-rls.sql:13-48`, `supabase-admin-uploads-portal.sql:27-59`, `supabase-storage-uploads-elenco-quadras.sql:5-37` (a policy "upload_publico_temporario" continua ativa).
- Cenário: listar o bucket e baixar documentos de menores; sobrescrever arquivos (UPDATE aberto); subir arquivos sem limite (custo); `allowed_mime_types` confia no Content-Type do cliente; ler `qrCodeToken` e fazer check-in falso na súmula.
- Impacto: exposição de dados pessoais sensíveis de menores (LGPD art. 14).
- Correção: bucket privado; URL assinada de curta duração gerada no servidor após checar organizador dono, capitão ou árbitro escalado; remover INSERT/UPDATE de `anon` (upload por rota autenticada com validação de tipo e tamanho); remover a policy pública `select *` de `Jogador` e expor view `id, nome, numero, posicao, fotoUrl`; mover CPF, documento, nascimento e telefones para tabela privada; `jogador-fotos` e `equipe-emblemas` públicos só com INSERT autenticado e caminho amarrado ao dono.

**C3. Token de recuperação de senha do admin funciona como sessão de admin e carrega o hash da senha.**
- `src/lib/auth.ts:42-47,118-134`, `src/lib/admin-access.ts:18-23`, `src/app/api/auth/forgot-password/route.ts:26-31`. `signPasswordResetToken` usa o mesmo `JWT_SECRET`, com `adminId` e `email` e sem `scope`; `isAdminSession` só exige `adminId` e e-mail permitido (rejeita apenas `public-user`). O token do link (30 min) passa em `verifyToken` e `requireAuth` por cookie ou Bearer: quem tiver o link (histórico, proxy, Referer, e-mail encaminhado) ganha sessão de admin sem saber a senha. O token contém `senhaHash` em base64 legível.
- Correção: `isAdminSession` exigir `scope === 'admin'`; `signToken` emitir `scope:'admin'`; rejeitar tokens de `password-reset` e `account-activation` em qualquer verificação de sessão; não colocar `senhaHash` no JWT (token aleatório de uso único, guardado só como hash no banco, com expiração); passar o token por fragmento (`#`) e `Referrer-Policy: no-referrer`.

## Alto
- **A1. Sem rate limit** em login (`api/auth/route.ts:27-105`), `forgot-password/route.ts:12-47` e `reset-password/route.ts`; só o acesso de árbitro por jogo tem (`acesso-arbitro-jogo.ts:134-144`). Permite força bruta, credential stuffing e e-mail em massa ao admin. Tempo de resposta difere quando o e-mail não existe. Correção: limite por IP e e-mail (Upstash/Vercel KV ou tabela), atraso progressivo, tempo uniforme.
- **A2. `POST /api/inscricao-rapida` aceita `ligaId` numérico** (`schemas.ts:153-160`, `team-registration-draft.ts:152-170`): `linkToken` não é validado e link revogado é ignorado; contradiz `07-SEGURANCA.md:20`; IDs sequenciais. Qualquer pessoa cria rascunhos em qualquer campeonato. Correção: exigir `linkToken`/`tokenCategoria`, remover `ligaId` do schema público (ou validar `LinkInscricaoCampeonato` no servidor), rate limit.
- **A3. Organizador pode tomar conta de árbitros independentes** (`api/organizador/arbitros/route.ts:57-85`): se existe `CandidaturaArbitro` com `organizadorId` nulo, qualquer organizador liberado o "adota", trocando `senhaHash`, `nome`, `status`; `ensureArbitro` (`:129-157`) altera o `Arbitro` global. Correção: 409 se o e-mail já existe e não é do organizador; vínculo por convite aceito pelo árbitro; nunca sobrescrever senha preexistente.
- **A4. `ativar-conta` emite sessão sem senha e ignora `trocarSenha`** (`api/auth/ativar-conta/route.ts:38-47`): token de 24 h reutilizável e não consumido; payload omite `trocarSenha`. Várias rotas usam `requirePublicRole` sem `releasedOnly` (`api/ligas/route.ts:99`, `api/organizador/perfil/route.ts:13,32`, `api/inscricoes-campeonato/route.ts:34,195`, `api/ligas/[slug]` GET): organizador PENDENTE ou REJEITADO cria campeonato. Correção: token de uso único (hash consumido); copiar `trocarSenha` e `status` ao JWT; `releasedOnly: true` em todas as rotas de organizador; helper `requireOrganizador()`.
- **A5. Webhook InfinitePay** (`src/lib/infinitepay.ts:59-78`, `api/webhooks/infinitepay/route.ts:45-134`): sem `INFINITEPAY_WEBHOOK_SECRET` a validação é pulada em desenvolvimento (falha fechada em produção); `timingSafeEqual` lança exceção se os tamanhos diferirem (500); não confere `amount` nem existência do pagamento; usa client anon; cria equipe e árbitro a partir de `external_id`; replay reprocessa. Correção: comparar tamanhos antes, validar valor e idempotência (`infinitePayId` único), `supabaseAdmin`; se for fluxo legado LUVA, desativar a rota.
- **A6. Pagamento "simulado" confirma ativação sem cobrança** (`api/organizador/ligas/[id]/pagamento/confirmar/route.ts:1-36`): qualquer organizador dono grava `pagamentoConfirmadoEm` com um POST ("Pix fake"). Correção: só o webhook assinado do gateway grava; rota inacessível em produção.

## Médio
- **M1.** Árbitro recebe dados pessoais completos: `arbitro-access.ts:19` e `sumula-access.ts:11` usam `Jogador(*)`; `GET /api/arbitro/partidas/[token]` devolve CPF, documento, nascimento, telefones e `documentosUrls`; `Arbitro(*)` expõe e-mail e telefone de outros árbitros; `Liga(*)` também. Correção: `select` explícito (id, nome, número, posição, foto, `qrCodeToken`).
- **M2.** Tentativas do link de árbitro não atômicas (`api/arbitro/jogo/[token]/route.ts:46-61`): requisições paralelas passam de 5; código aceita 4 caracteres (`acesso-arbitro-jogo.ts:50-54`). Correção: incremento atômico (RPC `update ... returning`), mínimo 6 caracteres, limite por IP.
- **M3.** Leitura pública de súmula por ID numérico (`sumula-access.ts:14`; `api/sumula/[token]/route.ts:28-30`): `^\d+$` como `Partida.id`; `GET /api/sumula/<id>?consulta=1` devolve elenco, presenças e ocorrências sem autenticação e permite enumerar partidas. Tokens demo fixos em `sumula/[token]/route.ts:11`. Correção: só token aleatório; consulta apenas de partidas públicas; remover demos de produção.
- **M4.** `GET /api/equipes` e `/api/ligas` públicos com `select *` (`api/equipes/route.ts:21,40`, `api/equipes/[id]/route.ts:11`): podem incluir contatos do líder, `organizadorId`; para visitante, `ligasVisiveisAoOrganizador` devolve `null` e lista tudo, inclusive rascunho e simulação de outros organizadores; `api/ligas/route.ts:42,130` e `ligas/[slug]/route.ts:156` devolvem `err.message`. Correção: colunas públicas fixas e filtro por liga publicada.
- **M5.** Cadastro de equipe e de público sem verificação de e-mail (`api/candidaturas/equipes/route.ts:57-127`): conta `ATIVA` com cookie de sessão; quem cadastra o e-mail alheio assume a identidade e bloqueia o dono (409); enumeração por `duplicateMessage`. `candidaturas/organizadores/route.ts:23-35`, `candidaturas/publico`, `interessados` abertos sem rate limit nem captcha.
- **M6.** Rascunho de inscrição: token de portador permanente com dados pessoais (`team-registration-draft.ts:210-247`; `api/inscricao-rapida/[token]/...`): quem tem o UUID lê e edita CPF, nascimento e documentos, sem expiração, mesmo após finalizar; o link circula por WhatsApp. Correção: expiração, mascarar CPF/documento, confirmação para alterar após finalizar.
- **M7.** Sem cabeçalhos de segurança (`next.config.mjs`, `vercel.json`): sem CSP, `X-Frame-Options` (há script `painel-embed` para iframe), `Referrer-Policy`, HSTS; só `X-Robots-Tag`. Correção: `headers()` com CSP, `frame-ancestors`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS, `Permissions-Policy`.
- **M8.** Sessão JWT sem revogação (`auth.ts:63-69,100-116`): `tipo`, `status`, `trocarSenha` por 8 h sem revalidar no banco; logout só apaga o cookie (`api/auth/route.ts:261-265`); aceita `Authorization: Bearer` e o login de admin devolve o token no corpo (`:132`). Correção: `jti`/`sessionVersion` checado em ações sensíveis; tirar token do corpo e Bearer.
- **M9.** Middleware não exige sessão em `/painel`, `/capitao`, `/arbitro` (`middleware.ts:42-50` só redireciona por `trocarSenha`); proteção depende de cada página. Rotas de API foram bem checadas; confirmar as páginas.

## Baixo
- **L1.** `CodigoAcessoOrganizador.codigo` em texto puro (listado em `api/admin/codigos-acesso/route.ts:15`); `JWT_EXPIRES_IN` do `.env.example` não é usado (8 h fixo).
- **L2.** Senha só `min(8)`, bcrypt custo 10; subir para 12+ e checar senhas vazadas.
- **L3.** `z.string().url()` aceita `javascript:` e `data:` em `fotoUrl`, `logoUrl`, `diplomaUrl`, `fotosUrls` (`schemas.ts`); há `<a href={file.url}>` em `app/admin/candidaturas/page.tsx:272`. Restringir a `https:` e ao host do Storage.
- **L4.** `api-response.ts:7-9` repassa `details` (erro Postgres/Zod) ao cliente.
- **L5.** `convites-equipe`: GET aplica `limit(80)` antes do filtro por organizador (`:19-33`); POST envia e-mail a qualquer endereço sem limite (relay). Texto escapado (`escapeHtml`): ok.
- **L6.** `candidaturas/[tipo]/[id]/route.ts:34`: `params` sem `await` (em Next 15 é `Promise`); corretude, não segurança.
- **L7.** `api/ligas/[slug]` DELETE apaga inscrições e candidaturas mas deixa `Equipe` e `Jogador` órfãos com dados pessoais.
- **L8.** `ADMIN_EMAIL` ausente faz `adminEmailAllowed` retornar `true` (falha aberta, `admin-access.ts:12-16`); `?admin=1` em `api/auth/route.ts:43` revela se o e-mail existe como admin.

## LGPD e dados de menores
- Sem campos nem fluxo de responsável legal, consentimento ou verificação de idade (`playerInscricaoSchema`, `inscricaoRapidaJogadorSchema`); os Termos (`src/app/termos-de-uso/page.tsx:16`) só declaram que o organizador tem autorização; sem registro técnico (quem, quando, versão do termo).
- Coleta de CPF, RG, nascimento, telefones, foto e documentos sem base legal por finalidade nem minimização; CPF gravado em texto puro.
- Sem retenção, anonimização ou endpoint de direitos do titular (acesso, correção, eliminação).
- Dados e imagens de menores em bucket público (C2).
- Recomendações: `dataNascimento` obrigatória, `responsavelNome`, `responsavelContato`, `consentimentoEm` com versão do termo (obrigatórios para menor de 18); cifrar/mascarar CPF e documentos em tabela privada; retenção por campeonato com job de anonimização; fluxo de exclusão com log; ROPA e DPO na política de privacidade; documentos visíveis só ao organizador dono e ao árbitro escalado, com auditoria de acesso.

## O que está correto
- Isolamento organizador/campeonato/equipe/jogador no servidor (`exigirOrganizadorDaLiga`, `organizador-isolamento.ts`, `requireOwnedLigaForSetup`) aplicado de forma consistente nas rotas `organizador/ligas/[id]/*`.
- Rotas do capitão checam posse por `equipeId`; `candidaturas/[tipo]/[id]` exige `userId` dono.
- Cookie `httpOnly`, `secure` em produção, `sameSite=lax`; segredo em variável de ambiente.
- Link do árbitro por jogo: token de 128 bits, código com hash bcrypt, limite de tentativas, auditoria.
- `/api/jogadores/qr/[token]` expõe só nome e foto; `/api/inscricao/[slug]/jogadores` recusa gravação.
- E-mails escapam HTML; central de simulações bloqueada em produção; `service_role` só no servidor.

## Ordem sugerida
1. Rotacionar credenciais do admin (e `JWT_SECRET` se fraco).
2. C1 e C2: auditar e corrigir RLS, grants e storage no Supabase.
3. C3: separar o escopo dos JWTs.
4. A1 a A6.
5. M1 a M9, depois os itens baixos.
6. Plano de LGPD para menores.

Quem implementa: `banco-de-dados` (RLS, grants, storage, colunas de consentimento e retenção) e `backend` (auth, rate limit, selects explícitos, rotas).
