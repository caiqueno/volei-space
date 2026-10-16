# 01. Diagnóstico do Volei Space

Agente: `analista-codigo`. Somente leitura. Repositório local, branch `teste-integrado` (HEAD `2d1085d`, árvore limpa exceto `docs/PROMPT-volei-space.md`).
Notas consultadas: `CLAUDE.md`, `00-INICIO.md`, `12-BUGS-E-DEBITOS-TECNICOS.md`, `13-TRIAGEM-PRODUTO.md`, `modulos/SUMULA-DIGITAL.md`, `docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md`, `INSCRICOES-POR-EQUIPE.md`, `ROTEIRO-REVISAO-LOCAL.md`, `docs/PROMPT-volei-space.md`. `README.md` e `BACKLOG-DESENVOLVIMENTO.md` foram tratados como histórico LUVA.
Nada foi executado (sem build, sem testes, sem consulta ao banco): tudo abaixo vem de leitura do código. Onde o comportamento depende do banco real (RLS, RPCs), está marcado "a verificar".

Legenda de estado: **[I]** implementado no código · **[AP]** aprovado e pendente (requisito diz que falta) · **[H]** histórico LUVA.

---

## 1. Arquitetura real

### 1.1 Stack
- Next.js 14.2.18 (App Router), React 18, TypeScript `strict` (`tsconfig.json:6`), Tailwind 3, framer-motion, zod, jose (JWT), bcryptjs, nodemailer, qrcode (`package.json`).
- Banco: PostgreSQL no Supabase. **O runtime não usa Prisma.** Nenhum `import` de `@prisma/client` em `src/`; as 94 rotas e libs que acessam dados usam `@supabase/supabase-js` (`src/lib/supabase.ts:10`, cliente anon; `src/lib/supabase-admin.ts:9`, cliente com service role que ignora RLS). O `prisma/schema.prisma` (699 linhas) está **defasado**: `Partida` e `Equipe` não têm `categoriaCampeonatoId` (só `ConviteVagaEquipe`, `CategoriaConfiguracao` e `CategoriaSetupSecao` têm, `schema.prisma:644,665,677`), embora o código use a coluna (`src/app/api/equipes/route.ts:30`). A fonte de verdade do DDL são `supabase/migrations/*.sql` (52 arquivos).
- Hospedagem: Vercel (`vercel.json`). Serviços externos: Supabase (banco e storage), InfinitePay (`src/lib/infinitepay.ts`, webhook), SMTP/Resend (`src/lib/email.ts`).
- Não há Docker, CI (`.github` não existe) nem testes de componente/E2E.

### 1.2 Módulos (`src/lib`, 80+ arquivos)
Parametrização/categorias (`championship-setup-*.ts`, `category-*.ts`, `pricing/*`), inscrição (`team-registration-draft.ts`, `inscricao-rapida.ts`, `vaga-inscricao.ts`, `championship-registration-sync.ts`), súmula (`sumula-access.ts`, `arbitro-access.ts`, `acesso-arbitro-jogo.ts`, `ponto-sumula.ts`, `player-scouts.ts`), classificação e mata-mata (`championship-operations.ts`, `eliminatorias.ts`, `mata-mata.ts`), ciclo de vida (`championship-lifecycle.ts`, `championship-finalization.ts`), isolamento (`organizador-isolamento.ts`, `championship-setup-access.ts`), simulação/QA (`simulacao*.ts`, `massa-qa.ts`).

### 1.3 Rotas de página (`src/app`)
- Públicas: `/` (landing), `/portal`, `/campeonatos[/slug]`, `/classificacao`, `/jogos`, `/rankings`, `/galeria`, `/ao-vivo`, `/partidas/[id]/ao-vivo`, `/equipes/[slug]`, `/fase-mata-mata`, `/seja-membro`, `/login`, legais.
- Organizador: `/painel`, `/painel/campeonatos`, `/painel/estrutura`, `/painel/parametrizacao[/secao]`.
- Inscrição: `/inscricao/categoria/[token]`, `/inscricao/campeonato/[token]`, `/inscricao/vaga/[token]`, `/inscricao/[slug]`, `/inscricao-rapida[/token]`, `/capitao`.
- Súmula/árbitro: `/sumula/[token]` (leitura), `/sumula/[token]/lancar` (lançamento, 3.594 linhas), `/arbitro/jogo/[token]`, `/arbitro/partida/[token]`.
- Admin: `/admin/*` (acessos, candidaturas, campeonatos, equipes, jogadores, partidas, simulações, configurações). `/admin/login`, `/ficha` e `/cadastro` redirecionam (legado) (`src/middleware.ts:24-37`).

### 1.4 APIs (`src/app/api`, 100+ `route.ts`)
Grupos: `auth/*` (login, ativar-conta, forgot/reset, trocar-senha), `admin/*`, `organizador/*` (ligas/[id]/setup/*, categorias, links-categoria, vagas-inscricao, pagamento, mata-mata, partidas, acesso-arbitro), `candidaturas/*`, `inscricao-rapida/*`, `inscricao/[slug]/jogadores`, `capitao/*`, `equipes`, `jogadores`, `partidas`, `sumula/[token]`, `arbitro/*`, `portal/*`, `classificacao`, `rankings`, `galeria`, `mensagens`, `webhooks/infinitepay`, `ao-vivo`.
Respostas padronizadas por `src/lib/api-response.ts` (`success`/`error`).

### 1.5 Modelo de dados
Prisma (`prisma/schema.prisma:13-699`): `Liga` (campeonato, com dezenas de campos de parametrização, `organizadorId` string sem FK), `Equipe`, `InscricaoCampeonato`, `InscricaoEquipeRascunho`/`InscricaoEquipeJogadorRascunho`, `ConviteEquipe`, `ConviteVagaEquipe`, `Jogador` (CPF, documento, nascimento, telefone, QR), `Arbitro`, `EscalaArbitro`, `CandidaturaPartidaArbitro`, `Partida` (`:289`, com `sumulaToken`), `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida` (MVP), `VotoMVP`, `ClassificacaoEntrada`, `ClassificacaoEliminatoria`, `Premiacao`, `Midia`, `Mensagem`, `Admin`, `Candidatura{Equipe,Arbitro,Quadra,Organizador}`, `Pagamento`, `Interessado`, `CodigoAcessoOrganizador`, `ContaPublico`, `CategoriaCampeonato` (`:621`), `CategoriaConfiguracao`, `CategoriaSetupSecao`, `CategoriaReplicacaoAuditoria`.
Tabelas só nas migrations SQL, ausentes do Prisma: ao menos `AcessoArbitroJogo` (usada em `src/lib/sumula-access.ts:42`) e colunas `categoriaCampeonatoId`, `tokenInscricao`. RPCs de negócio vivem no Postgres: `finalizar_inscricao_equipe_rascunho` (`src/lib/team-registration-draft.ts:435`), `recalcular_classificacao_liga` (`src/lib/championship-operations.ts:65`), `selecionar_categorias_campeonato`, `salvar_configuracao_categoria`, `replicar_configuracao_categorias`.
Observação: não existe **nenhum** evento/log imutável de partida. O estado da súmula é `Partida` + `SetPartida` + `OcorrenciaPartida` (texto livre), reescrito por delete+insert a cada gravação.

### 1.6 Autenticação e autorização
- JWT HS256 (jose) em cookie `luva_token`, httpOnly, `secure` em produção, `sameSite=lax`, 8 h (`src/lib/auth.ts:55,63,178`). Dois tipos: admin (`scope` ausente, `adminId`) e usuário público (`scope: 'public-user'`, papéis `equipe | arbitro | quadra | organizador | publico`).
- `src/middleware.ts` protege **apenas** `/admin/*` (exige JWT de admin, `:55-70`) e redireciona `/painel` para `/trocar-senha` se `trocarSenha` (`:44-52`). Para todas as outras áreas (painel, capitão, súmula) o middleware só põe cabeçalho `noindex`. **Não há autorização no middleware para `/painel`**; ela depende de cada página e de cada rota de API.
- API: `requireAuth` (admin), `requirePublicRole(req, roles, {releasedOnly})` (`auth.ts:100`) e `exigirOrganizadorDaLiga/Equipe/Jogador/Partida` (`src/lib/organizador-isolamento.ts:6-60`), que comparam `Liga.organizadorId` com `userId` do token. Setup: `requireOwnedLigaForSetup` (`championship-setup-access.ts`).
- Acesso por link: `AcessoArbitroJogo` com código hasheado, contador de tentativas e bloqueio de 15 min (`src/app/api/arbitro/jogo/[token]/route.ts:56-59`), sessão assinada em `acesso-arbitro-jogo.ts`. Convite/inscrição por token (`/inscricao/categoria/[token]`, `ConviteVagaEquipe.token`).

### 1.7 Isolamento entre organizadores
- Mutações de equipe, jogador, partida, galeria, setup e links de categoria exigem o dono da liga no servidor (`equipes/route.ts:57`, `partidas/[id]/route.ts:25`, `jogadores/route.ts:37`, `links-categoria/route.ts:9`). Padrão consistente e verificado por leitura.
- **Leituras não têm o mesmo rigor** (ver 4.2): sem sessão de organizador, `GET /api/equipes` e `GET /api/jogadores` devolvem tudo de todos os campeonatos (`ligasVisiveisAoOrganizador` retorna `null` para anônimos e o filtro simplesmente não é aplicado, `organizador-isolamento.ts:50-55`).
- Isolamento por **categoria** [AP/parcial]: `CategoriaCampeonato` existe e as consultas novas filtram por `categoriaCampeonatoId`, mas o texto `categoria` e `serie` ainda existem em `Equipe`/`Partida` (`schema.prisma:100,299-300`) e o `@@unique([nome, ligaId, categoria, serie])` de `Equipe` (`:123`) ainda mistura as duas lógicas. `12-BUGS...` e `13-TRIAGEM...` reconhecem o débito.

---

## 2. Inventário de funcionalidades (com evidência)

| Funcionalidade | Estado | Evidência |
|---|---|---|
| Login unificado (admin/organizador/equipe/árbitro), troca obrigatória de senha | [I] | `src/app/api/auth/route.ts:35-95`, `middleware.ts:44-52` |
| Cadastro de organizador via "Seja membro", aprovação e reenvio de acesso pelo admin | [I] | `src/app/seja-membro/page.tsx`, `api/candidaturas/organizadores/route.ts`, `api/admin/organizadores/route.ts` |
| Wizard de parametrização do campeonato (informações, estrutura, classificação, eliminatórias, calendário, inscrições, prévia) | [I] | `src/components/parametrizacao/sections/*`, `api/organizador/ligas/[id]/setup/*/route.ts` |
| Categorias como entidade (`CategoriaCampeonato`), replicação de configuração, preço por categoria | [I] parcial | `schema.prisma:621`, `api/organizador/ligas/[id]/categorias/{route,replicar/route,preco/route}.ts`, `src/lib/pricing/*` |
| Link de inscrição por categoria; equipe criada direto como `APROVADA` | [I] | `links-categoria/route.ts:28`, `supabase/migrations/202610060002_finalizar_inscricao_sem_serie.sql:60` |
| Convite exclusivo por equipe apontada (antes de existir `Equipe`) | [AP] | `INSCRICOES-POR-EQUIPE.md` regras 1-2; hoje `ConviteVagaEquipe` é por vaga numerada (`schema.prisma:641`), não por equipe |
| Rascunho de inscrição com autosave e finalização atômica (RPC) | [I] | `src/lib/team-registration-draft.ts:435`, `schema.prisma:143,169` |
| Aprovação manual de equipe (candidatura) | [H] | `api/admin/candidaturas/[id]/aprovar/route.ts`, `schema.prisma:488` |
| Série Ouro/Prata | [H] (ainda no schema) | `schema.prisma:100,299` |
| Pagamento do organizador | simulado | `api/organizador/ligas/[id]/pagamento/confirmar/route.ts:1`; webhook InfinitePay existe só para candidaturas legadas (`api/webhooks/infinitepay/route.ts`) |
| Geração de partidas, calendário, grupos e mata-mata | [I] | `api/organizador/ligas/[id]/estrutura/route.ts`, `mata-mata/route.ts`, `src/lib/eliminatorias.ts`, `components/mata-mata/ChaveamentoMataMata.tsx` |
| Classificação por RPC, critérios configuráveis, ajuste manual | [I] | `championship-operations.ts:65`, `api/classificacao/manual/route.ts` |
| Portal público, agenda, ranking, galeria, ao vivo (relê a cada 2 s no placar público) | [I] | `src/app/portal/page.tsx`, `api/portal/*`, `partidas/[id]/ao-vivo/LiveMatchView.tsx` |
| Escala de árbitro, candidatura a partida, link de acesso ao jogo com código | [I] | `api/organizador/partidas/[id]/{arbitro,acesso-arbitro}/route.ts`, `api/arbitro/jogo/[token]/route.ts` |
| Súmula digital: lançamento, leitura somente leitura, QR de atleta | [I] | ver seção 3 |
| Correção de súmula por 30 min via link; depois só organizador | [AP] | `SUMULA-DIGITAL-E-CLASSIFICACAO.md`; não há tal janela em `api/sumula/[token]/route.ts` (POST recusa se `sumulaAprovadaEm` e responde "jaOficial", `:50-52`) |
| Sugestão automática de MVP por scouts | [AP] | `modulos/SUMULA-DIGITAL.md` ("continua pendente"); a API apenas exige MVP da vencedora (`route.ts:62-70`) |
| Simulação/massa de QA, campeonato de teste oculto do público | [I] | `src/lib/simulacao.ts`, `campeonato-teste.ts`, `app/admin/simulacoes/page.tsx` |

---

## 3. Súmula, papeleta, rotação, substituições, líbero, times/atletas e inscrição

### 3.1 Súmula
- **Modelo**: não há tabela de súmula; é a `Partida` com `sumulaToken` (`schema.prisma:289-330`) mais `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida`.
- **Lançamento (cliente)**: `src/app/sumula/[token]/lancar/page.tsx` concentra **toda** a lógica de jogo em estado React: pré-jogo com validação de QR, capitães, sorteio e saque (`:1398-1790`), pontuação com origem do ponto (ace/ataque/bloqueio, `OrigemPontoModal.tsx`, `ponto-sumula.ts`), desfazer ponto (`:477-530`), fechamento de set com confirmação (`:455-465`, `canCloseSetByRules :3556`), tempos técnicos 2 por set (`:807-816`), cartões e anotações (`saveNote :817`), placar ao vivo salvo com debounce de 700 ms (`:955-965`), envio final com 3 tentativas (`:972-985`).
- **Gravação (servidor)**: `GET/POST/PUT /api/sumula/[token]` (`src/app/api/sumula/[token]/route.ts`). POST oficializa (`:37-124`): valida presença só de atletas das duas equipes (`validateSumulaPayload :312`), mínimo de 6 presentes por equipe fora de simulação (`:59`), pelo menos 1 set, MVP da equipe vencedora (`:62-70`), placar via `validateCategoryResult` (`:72-73`, `category-match-rules.ts:19`). PUT salva andamento (`:129-186`).
- **Regras de set**: alvo `Np`, tie-break `Nt`, 2 pontos de diferença sem teto, melhor de N (`category-match-rules.ts`, `lancar/page.tsx:3556-3594`). `terceiroSetObrigatorio` é lido de `Liga` (`route.ts:308`) mas **não existe coluna** `terceiroSetObrigatorio` em `Liga` no Prisma; pode existir na configuração por categoria. A verificar no banco.
- Estado de partida e `status`: `AGENDADA`, `EM_ANDAMENTO`, `ENCERRADA` (strings livres).

### 3.2 Papeleta (lineup)
- Não existe como entidade nem como envio bloqueado pelo técnico. O que existe é a "papeleta do set" montada **pelo apontador** na tela: escalação de 6 em quadra, confirmação por equipe (`confirmLineup :578-625`), evento `set_start` "Papeleta do set N confirmada" (`:633`). Fica só como texto em `OcorrenciaPartida`.
- Não há papeleta digital do técnico no celular, envio prévio, trava após envio, nem assinatura. [AP/ausente] (agente 5 do PROMPT).

### 3.3 Rotação
- Cliente: `rotateVolleyballLineup` (`lancar/page.tsx:3511-3516`) gira os 6 ao ganhar o saque (side-out, `:441-455`); `serverIndex` fixo em P1. A formação é serializada como marcador de texto dentro da descrição do evento (`encodeRotationMarker :3351`) e restaurada ao recarregar.
- Servidor: **nenhuma validação de rotação**, de posição inicial ou de erro de rodízio. Não há detecção de "falta de rotação". Editar a formação durante o jogo é livre (`changeSlot :670-706`, só reseta confirmação).

### 3.4 Substituições
- Cliente: limite de 8 por equipe e set (`:752-756`), par bloqueado A↔B durante o set (`getAllowedSubstitutionNumbers :720-730`, `substitutionLocks :787-802`), contagem e pares restaurados do histórico ao recarregar (`countSavedSubstitutions :3401`, `restoreSubstitutionLocks :3414`). Atende o requisito aprovado de 8, vínculo e restauração [I] no cliente.
- Servidor: **sem validação**. A API aceita qualquer lista de ocorrências com tipo `substitution` (`schemas.ts:368-386`) sem contar limite nem par. Qualquer cliente com acesso à súmula pode gravar 9+ substituições.
- Não há substituição excepcional (lesão) nem registro de exceção; não há controle de "um jogador substituído volta apenas para a posição de origem" além do par.

### 3.5 Líbero
- Identificado por `posicao === 'LB'` (`lancar/page.tsx:3467`). Líbero **inicial é obrigatório** para confirmar a escalação (`:588-596`), divergindo do requisito aprovado ("líbero inicial não é requisito", `SUMULA-DIGITAL-E-CLASSIFICACAO.md`). Troca de líbero é evento `libero_exchange` (gravado como `troca_libero`, `:3072`), não consome a cota de 8 (`:753,775`), mas **cria par de bloqueio** em `substitutionLocks` (`:787-802` executa para ambos os tipos), o que o requisito proíbe ("não cria par").
- Não há regra de saque/ataque do líbero, nem redesignação de líbero, nem limite de entradas. O servidor não valida.

### 3.6 Cadastro de times e atletas
- Equipe pertence a **uma** liga (`Equipe.ligaId`, `schema.prisma:99`) e a uma categoria; não há "banco de atletas do clube" reaproveitável entre competições, nem perfil "Meu Time" persistente multi-competição. [ausente vs. PROMPT]
- Capitão/líder: `/capitao` e `api/capitao/{equipe,jogadores}/route.ts` (exigem `requirePublicRole(['equipe'])`). Atleta: `Jogador` com CPF, documento, nascimento, telefone, QR (`schema.prisma:214-240`), cadastro por link do rascunho e QR (`api/jogadores/qr/[token]/route.ts`), importação por lista ou planilha: **não existe**.
- Número de camisa único por equipe (`supabase-jogador-numero-unico.sql`); número alternativo por partida em `SumulaPresenca.numero`.

### 3.7 Inscrição em competições
- Fluxo vigente: organizador gera link por categoria (`links-categoria/route.ts:28`) → líder abre `/inscricao/categoria/[token]` → rascunho salvo em etapas (`inscricao-rapida/[token]/*`) → `finalizar` chama a RPC e cria `Equipe` + `InscricaoCampeonato` com status `APROVADA` sem fila (`team-registration-draft.ts:435`, migration `202610060002`). Idempotência e lock comprovados no roteiro local (`ROTEIRO-REVISAO-LOCAL.md`).
- Não existe "explorar competições", selo de elegibilidade, inscrição de equipe já existente em outra competição, nem competição privada por código. A equipe sempre nasce dentro de uma liga.

---

## 4. Dívida técnica, riscos de segurança e testes

### 4.1 Dívida técnica
1. **Prisma obsoleto e não usado**: `schema.prisma` ≠ banco real; `package.json` ainda tem `prisma.seed` apontando para `prisma/seed.ts`, que **não existe**. Duas fontes de verdade (Prisma, SQL) sem reconciliação.
2. **Não existe baseline de DDL reproduzível**: `supabase/migrations` mistura arquivos datados (`2026...`) e `supabase-*.sql` sem ordem; as tabelas base (`Liga`, `Equipe`, `Partida`...) vêm do `prisma db push` histórico. Não há `prisma/migrations`.
3. **Arquivo monolítico**: `sumula/[token]/lancar/page.tsx` com 3.594 linhas, regras de vôlei misturadas à UI, sem módulo de domínio testável.
4. **Regras de vôlei só no cliente** (rotação, limite de substituição, líbero, tempos, set), duplicadas em `getMatchRules`/`buildLiveSummary` (`route.ts:381-400`) e `regrasDaPartida`, com defaults divergentes (21 pontos, 3 sets) e tipos `any` em todo `sumula-access.ts`/`route.ts`.
5. **Gravação não atômica**: POST/PUT fazem `delete` + `insert` sequenciais em 5 tabelas (`route.ts:92-114,155-175`), sem transação; falha no meio deixa partida sem sets. O requisito exige atomicidade (`SUMULA-DIGITAL-E-CLASSIFICACAO.md`). Classificação roda depois e erro é só logado (`concluirPublicacao :263-272`).
6. **Sem concorrência controlada**: dois apontadores no mesmo jogo sobrescrevem um ao outro (último a gravar vence); não há versão otimista.
7. **Sem offline-first**: a única persistência local é `localStorage` para a vista da quadra e snapshot de demo (`lancar/page.tsx:347,915`). Sem service worker, sem fila de eventos, sem reenvio após reconexão (apenas 3 tentativas no envio final).
8. **Sem log de eventos imutável**: placar é fonte gravada, não derivada; desfazer ponto altera estado em memória (`:477`). Auditoria de autor limita-se a uma observação textual "Registro de placar pelo árbitro..." (`route.ts:253-258`).
9. **Tokens demo no código de produção** (`DEMO_SUMULA_TOKENS`, `route.ts:11,22,39,133`): aceitam tokens fixos sem autenticação (retornam dados fictícios, sem gravar; baixo impacto, mas é superfície).
10. **Legado LUVA vivo**: README, `setup-db.mjs` (SQLite com caminho `C:/Users/willm/...`), `BACKLOG`, `COMO-TESTAR.txt`, série Ouro/Prata, `Admin`, candidaturas de equipe, `lib/massa-qa.ts`.
11. **Pagamento simulado** em produção (`pagamento/confirmar/route.ts`), sem cobrança real.
12. Status e tipos como `String` livre (`status`, `tipo` de ocorrência) sem enum/CHECK visível.

### 4.2 Riscos de segurança (priorizados)
| # | Risco | Evidência | Severidade |
|---|---|---|---|
| S1 | **Leitura anônima de dados pessoais de atletas**: `GET /api/jogadores` seleciona `*` (inclui CPF, documentos, data de nascimento, telefones, `qrCodeToken`) via cliente anon, sem exigir sessão; para anônimos o filtro do organizador não é aplicado | `api/jogadores/route.ts:17` + `organizador-isolamento.ts:50-55` | Alta. Depende de RLS do banco (a verificar), `12-BUGS` alerta que RLS não pode ser deduzida do SQL versionado. Inclui menores de idade (LGPD). |
| S2 | `GET /api/equipes` e `GET /api/equipes/[id]` anônimos devolvem todas as equipes e atletas de todos os campeonatos (inclui `liga:Liga(*)`, com `organizadorId`, config e preços) | `api/equipes/route.ts:12-55`, `equipes/[id]/route.ts:7-16` | Média/Alta; a `13-TRIAGEM` diz que só foi fechado com sessão de organizador |
| S3 | **Credenciais em arquivos do repositório**: admin `admin@luv.com.br` com senha fixa (omitida aqui) no README, COMO-TESTAR e `setup-db.mjs:236-245,421` | `README.md:35-36`, `COMO-TESTAR.txt:120` | Alta se essa conta existir em qualquer ambiente real. Rotacionar e remover |
| S4 | Autorização do `/painel` só no cliente/página; middleware cobre `/admin` | `middleware.ts:44-70` | Média; APIs protegem, mas páginas dependem de cada `page.tsx` |
| S5 | Login sem rate limit ou lockout (admin/organizador/equipe/árbitro); só o código de jogo tem bloqueio | `api/auth/route.ts` (sem contador), vs. `arbitro/jogo/[token]/route.ts:56` | Média |
| S6 | **Cliente com service role em dezenas de rotas** (`supabase-admin`), ou seja, a RLS não protege essas rotas; toda segurança depende de cada rota chamar `exigir*`. Rotas verificadas sem checagem alguma: `api/categorias` (leitura, lista de categorias de qualquer liga), `portal/*`, `ao-vivo`, `classificacao`, `rankings` (públicas por desenho), `jogadores/qr/[token]` (público por desenho, só nome e foto) | `api/categorias/route.ts:14` | Média/Baixa por serem públicas, mas é um padrão sem política central |
| S7 | Leitura da súmula por **id numérico sequencial**: `requireSumulaTokenAccess` aceita `/^\d+$/` como `Partida.id` (`sumula-access.ts:14`) e `?consulta=1` devolve sem autenticação elenco, presenças, escala e ocorrências (`route.ts:28-31,sumulaParaConsulta`). Dados limitados (nome, número, posição), mas enumeráveis | `sumula-access.ts:14`, `route.ts:28` | Média (privacidade; usado pelo portal público) |
| S8 | Escrita da súmula só para árbitro escalado ou sessão de link; **o organizador dono não consegue corrigir pela API** (`requireArbitroPartidaAccess` exige papel `arbitro`), embora a regra aprovada preveja correção pelo organizador após 30 min | `arbitro-access.ts:28-62` | Funcional/Segurança (sem trilha de correção) |
| S9 | `JWT_SECRET` único para todos os tokens (sessão, reset, ativação, acesso de jogo); sem rotação; falta de segredo lança exceção apenas em uso (`auth.ts:10`). Token também aceito em `Authorization: Bearer` e cookie | `auth.ts:9-12,84-97` | Média |
| S10 | Webhook InfinitePay: valida assinatura, mas se `INFINITEPAY_WEBHOOK_SECRET` vazio o comportamento depende de `validateWebhookSignature` (a verificar); usa cliente anon (`supabase`) para escrever em `Pagamento`/`CandidaturaEquipe` (depende de RLS permissiva) | `api/webhooks/infinitepay/route.ts:2,6-9,48-60` | Média |
| S11 | `.env.example` contém dica de segredos e `NODE_ENV`; **`.env` ausente do clone** (bom), `.gitignore` o cobre (a conferir o conteúdo completo). Nenhum segredo real versionado foi encontrado na leitura, mas `git log --all -- .env` não retornou commits | `.env.example` | Baixo |
| S12 | Uploads de imagem/documento via Storage; políticas em `supabase-storage-uploads-elenco-quadras.sql` (não auditadas aqui) | migrations | A verificar |
| S13 | Dados de menores: CPF, documentos e fotos de rosto sem política de retenção, consentimento do responsável nem criptografia de campo | `schema.prisma:214-240` | Alta p/ LGPD |

### 4.3 Testes
Existem 12 arquivos `scripts/*.test.ts` (1.877 linhas no total em `scripts/`), executados manualmente com `ts-node`; nenhum framework (jest/vitest/playwright), nenhum `npm test` agregado, sem CI. Os scripts `package.json` usam sintaxe `set VAR=...&&` do **cmd.exe do Windows**, que não roda em Linux/macOS/Git Bash/CI.

Cobertura real:
| Teste | O que cobre | O que não cobre |
|---|---|---|
| `category-match-rules.test.ts` (23 l.) | `validateCategoryResult/Progress` (sets 21×19, 21×20...) | UI, defaults de `regrasDaPartida`, 3º set obrigatório fim a fim |
| `ponto-sumula.test.ts` (34 l.) | só formatação/parse de texto do ponto | rotação, saque, fechamento de set |
| `championship-setup.test.ts` (266 l.), `category-pricing/replication`, `pricing`, `simulacao`, `organizer-flow`, `supabase-env`, `team-registration-draft/sync` | parametrização, preço, replicação, ciclo de vida, rascunho (`team-registration-draft.test.ts` lê arquivos SQL) | autorização das rotas HTTP |
| `category-selection.test.ts`, `category-setup-state.test.ts` | RPCs em Postgres Docker local (`codex-category-test`, porta 55439) | não rodam sem esse container |

**Sem nenhum teste** para: `api/sumula/[token]` (validação de presença/MVP/atomicidade), rotação, substituições (8/par/reset por set), líbero, tempos, `requireArbitroPartidaAccess`/`requireSumulaLeitura`, `organizador-isolamento` (isolamento entre organizadores), `auth`/middleware, webhook, classificação (`recalcular_classificacao_liga` fora do harness), mata-mata, mesmas rotas anônimas de leitura (S1/S2). O `ROTEIRO-REVISAO-LOCAL.md` cita testes HTTP de isolamento e navegador, mas **os scripts correspondentes não estão no repositório** (só os `.test.ts` acima), logo não são reproduzíveis.

---

## 5. O que impede rodar localmente com um comando

Estado hoje: não há comando único. Obstáculos, em ordem:
1. **Sem banco local**: o app só roda contra Supabase (URL e chaves obrigatórias; `supabase-env.ts` exige `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`, `ALVO`, e `SERVICE_ROLE_KEY` para o admin). Sem `docker-compose.yml`, sem `supabase/config.toml`, sem `supabase start`. O Docker citado no `ROTEIRO-REVISAO-LOCAL.md` ("Docker, PostgREST e adaptador de login") é um ambiente ad hoc não versionado (`127.0.0.1:55441/__test_login`).
2. **Sem schema reproduzível**: não há `prisma/migrations`; tabelas base vêm de `prisma db push` (README diz "banco já configurado, não rode migrações"); depois ~50 SQL soltos, sem ordem declarada e com dependência de RPCs. Prisma defasado (1.1).
3. **Sem seed executável**: `package.json` declara `prisma.seed` → `prisma/seed.ts` inexistente. Seeds reais estão em `scripts/seed-*.sql` (3 arquivos, para Supabase/SQL manual) e `seed:simulacao` (`scripts/recriar-simulacao.ts`), que também exige banco ativo. `setup-db.mjs` é do SQLite da LUVA e não serve (caminho `C:/Users/willm/...`).
4. **`.env.example` incompleto/enganoso**: `DATABASE_URL`/`DIRECT_URL` pedidos, mas o runtime não usa Prisma; falta `ADMIN_EMAIL` (usado em `admin-access.ts:7`); `NEXT_PUBLIC_APP_URL` aponta 3001 enquanto `next dev` sobe na 3000; `EMAIL_FROM` ainda "LUVA Liga"; sem exemplo de `SUPABASE_SERVICE_ROLE_KEY` (nem valor local) nem de valores locais válidos.
5. **Não há criação de usuário de teste** documentada: organizador exige aprovação do admin e troca de senha; não existe script que crie admin + organizador + campeonato pronto (o admin LUVA do README é senha fixa legada).
6. **Scripts `npm` só para Windows/cmd** (`set ...&&`), sem `cross-env`; `npm test` inexistente; Node/npm sem `engines` e sem `.nvmrc`. `COMO-TESTAR.txt` ainda alerta sobre caminho com acento (o clone atual está em `Cláudia`; a ver se o Next 14 reclama).
7. **Dependências externas opcionais**: SMTP e InfinitePay devem ficar vazias (o código tolera, segundo COMO-TESTAR), mas e-mails de ativação/reset não saem, impedindo concluir o fluxo organizador sem o admin copiar a senha da tela.
8. `node_modules` ausente do clone: é preciso `npm install` (o README manda `--ignore-scripts` + `npx prisma generate`, necessário só se algo importar Prisma, o que não ocorre).

Mínimo para "um comando": `docker compose up` com Postgres + PostgREST (ou `supabase start`), aplicar um baseline SQL consolidado (schema atual dump + migrations), `seed` que cria admin, organizador liberado e um campeonato com categoria e partida, `.env.local.example` com valores locais, e scripts `npm run dev:local`/`npm test` portáveis.

---

## 6. Divergências documentação × código (para o arquiteto)
1. Líbero: requisito diz informativo e sem exigência inicial; código exige líbero inicial e cria par de bloqueio na troca (`lancar/page.tsx:588,787`).
2. Correção pós-encerramento por 30 min: requisito aprovado; código bloqueia (`route.ts:50-52`) e não há rota de correção do organizador.
3. Atomicidade da gravação: requisito aprovado; código não atômico (4.1.5).
4. Substituições: `13-TRIAGEM` afirma 8/recuperação aplicada; confirmado **só no cliente** (3.4).
5. Convite por equipe apontada: requisito vs. vagas numeradas por categoria.
6. Isolamento por categoria: id existe; texto `categoria`/`serie` ainda no schema e em índices únicos.
7. `13-TRIAGEM` diz que listar equipe/jogador "devolve só o campeonato do organizador" quando há sessão; **sem sessão devolve tudo** (S1/S2).

## 7. Implicações para o plano de evolução (resumo)
- Extrair as regras de súmula (rotação, substituição, líbero, tempo, set) para um módulo puro compartilhado cliente/servidor, com testes, antes de qualquer feature nova.
- Introduzir log de eventos append-only e gravação atômica (RPC) da súmula, com versão otimista.
- Fechar leituras anônimas (S1/S2/S7), rotacionar credenciais legadas (S3) e criar testes de isolamento entre organizadores.
- Criar baseline de banco + seed + docker para rodar e testar localmente com um comando.
- Modelar papeleta (entidade, envio pelo técnico, trava) e "banco de atletas" por clube como novas entidades; hoje não existem.
