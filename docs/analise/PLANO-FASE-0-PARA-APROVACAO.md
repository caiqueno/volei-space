# Plano da Fase 0 (segurança e fundação): para aprovação

Data: 2026-10-16. Montado por backend, banco-de-dados e devops-infra. **Nada foi editado, executado ou aplicado.** Base: relatórios 04, 07, 11, 12 e 13 em `docs/analise/`. Este documento só vira trabalho depois da sua aprovação, item a item.

Regras que valem para tudo: nada em produção sem aprovação explícita; nada durante rodada com jogos; um PR por tema a partir de `teste-integrado`; cada mudança com teste e plano de reversão.

## 1. Decisões que preciso de você (travam o resto)

| # | Decisão | Recomendação | Trava |
|---|---|---|---|
| D1 | Sessões de admin antigas (sem `scope`): aceitar por 8 h ou exigir novo login? | Exigir novo login (mais seguro) | PR B1 |
| D2 | `ADMIN_EMAIL` está definido em todos os ambientes da Vercel (produção e preview)? | Confirmar no painel antes do PR B1; sem ele o login de admin passa a falhar | PR B1 |
| D3 | Store do rate limit em produção: Upstash/Vercel KV, tabela no Supabase, ou só memória? | Tabela no Supabase (sem serviço novo) | PR B2 |
| D4 | Webhook InfinitePay é legado da LUVA ou será a cobrança real? Pix "simulado" continua em produção? | Desativar o webhook (410) até existir cobrança real; ver D4b | PR B5 |
| D4b | Bloquear a confirmação de pagamento simulada em produção trava a ativação de campeonatos. Aceita? | Alternativa: manter e registrar `pagamentoOrigem='simulado'` | PR B5 |
| D5 | Fotos de jogadores em páginas públicas: bucket público separado ou URL assinada? | Bucket público separado só para foto de rosto | M2 |
| D6 | A `main` publica direto em produção na Vercel? | Verificar (Git > Production Branch) e travar promoção manual | Todos os merges |
| D7 | Homologação: manter o projeto de dev como Preview agora e criar projeto próprio (~US$ 25/mês) antes do primeiro piloto pagante ou da migração RLS? | Sim | M1/M2 em produção |
| D8 | Node 22 LTS fixado (máquina usa 24.19.0) e Supabase CLI + Docker Desktop instalados na máquina? | Sim | G06 |
| D9 | Origens autorizadas a embutir o painel em iframe (define `frame-ancestors`) | Começar só com `'self'` | M7 |
| D10 | Reescrever histórico do git para apagar a credencial antiga? | Não; rotacionar a senha basta | G03 |
| D11 | Um revisor obrigatório na `main`, sendo você a única pessoa? | Exigir PR e CI verde, sem revisor obrigatório até entrar a segunda pessoa | Proteção de branch |
| D12 | O caminho com acento ("Cláudia") quebra o Next? | Testar `npm run dev` uma vez; se quebrar, mover para `C:\dev\volei-space` | G06 |

## 2. Ordem de execução proposta

| Passo | O quê | Dono | Esforço | Depende |
|---|---|---|---|---|
| 0 | Consultas somente leitura no Supabase (seção 5.1) para confirmar o estado real | você roda, banco-de-dados interpreta | P | nada |
| 1 | G03 passos 1 a 5: confirmar e trocar a senha do admin; avaliar `JWT_SECRET`; definir `ADMIN_EMAIL` | você (produção), devops-infra prepara | P | C3 antes de trocar a senha |
| 2 | PR B1 (escopo dos JWTs, C3) | backend | M | D1, D2 |
| 3 | PR B4 (árbitros), PR B8 (URLs e erros): independentes, em paralelo | backend | P cada | nada |
| 4 | G03 passo 6: limpar credencial de README, COMO-TESTAR, setup-db.mjs, log.md e docs/analise | devops-infra | P | nada |
| 5 | G06 parte 1 (`.nvmrc`, `cross-env`, scripts, nome do pacote, CHANGELOG) e G07 (CI com gitleaks) | devops-infra | P+P | D8 |
| 6 | Proteção de branches e secret scanning | você (GitHub) | P | CI verde (passo 5) |
| 7 | PR B2 (rate limit e segredos por finalidade) e PR B3 (ativação e organizador liberado) | backend | M+P | B1, D3 |
| 8 | PR B5 (webhook e pagamento) | backend | M | D4, D4b |
| 9 | M7 cabeçalhos de segurança em Report-Only | devops-infra | P | passos 3 e 5, D9 |
| 10 | Migrations: baseline; deploy do código que sai do client anon; M1; M2; M6; M7 (banco) | banco-de-dados | G | passo 0, D5, D7, backup |
| 11 | PR B6 (súmula só por token) e PR B7 (selects mínimos) | backend + frontend | M+M | frontend no mesmo release |
| 12 | G06 parte 2 (Supabase local, seed, `reset-db`, `setup`) | devops-infra | M | baseline (passo 10) |
| 13 | Backup restaurado e ensaio de rollback cronometrado (< 10 min) | devops-infra + você | P | plano do Supabase confirmado |
| 14 | Política LGPD de menores (G10) | seguranca + você | M | nada |

Esforço total estimado: 4 a 6 semanas de uma pessoa, dominado pelas migrations (passo 10) e por G08.

## 3. Backend: 8 PRs

Todos com teste novo em `scripts/` (padrão ts-node atual), `npm run lint` e `npm run build`. Não há teste HTTP de rotas hoje: preferir testes sobre funções puras; para rotas, chamar o handler com `supabaseAdmin` mockado. Correções ao relatório 13: o reset de senha já é de uso único por efeito colateral (`reset-password` compara `senhaHash`; manter); `signAccountActivationToken` não é chamado por ninguém (A4 vira correção preventiva).

### B1. `fix/sessao-escopo-jwt` (C3, L8, M8 parcial) — esforço M
- Arquivos: `src/lib/auth.ts`, `admin-access.ts`, `src/middleware.ts` (só se a assinatura mudar; roda em Edge), `src/app/admin/layout.tsx:20`, `api/auth/route.ts`, `forgot-password`, `reset-password`, `api/organizador/ligas/[id]/finalizar/route.ts:26`, página `src/app/resetar-senha/` (token no fragmento `#token=`, coordenar com frontend).
- Mudança: `signToken` emite `scope:'admin'`; `isAdminSession` exige `scope==='admin'` e rejeita qualquer token com `purpose`; `verifyToken`/`readPublicSession` também. JWT de reset sem `senhaHash` (usar fingerprint salgado `sha256(senhaHash+salt)` truncado, mantendo o uso único; evolução futura: token aleatório de uso único guardado como hash, que exige migration). L8: sem `ADMIN_EMAIL`, `adminEmailAllowed` retorna `false`. `?admin=1` devolve "Credenciais inválidas." Tirar `token` do corpo de `loginAdmin` e o fallback Bearer (após `grep` de clientes). `Referrer-Policy: no-referrer` na página de reset.
- Testes (`scripts/auth-scope.test.ts`): token de reset e de ativação rejeitados por `isAdminSession` e `verifyToken` (cookie e Bearer); `signToken` produz `scope:'admin'` e token antigo sem scope é rejeitado; `adminEmailAllowed` falso sem `ADMIN_EMAIL`; token público não passa como admin e vice-versa; JWT de reset sem `senhaHash`.
- Risco: alto (lockout de admin por `ADMIN_EMAIL` ausente ou sessões sem scope); médio (página de reset ainda lendo `?token=`; clientes que usam Bearer).
- Aceite: `GET /api/admin/*` com o JWT do link de recuperação devolve 401; corpo do login sem `token`; sem `ADMIN_EMAIL` o login de admin falha em teste; link de reset troca a senha uma vez e falha na segunda.

### B2. `feat/rate-limit-login` (A1, G05) — esforço M — depende de B1, D3
- Arquivos: novo `src/lib/rate-limit.ts` (interface `RateLimitStore`, memória no PR, store de produção conforme D3), `api/auth/route.ts`, `forgot-password`, `reset-password`, `ativar-conta`, `auth.ts` (`getSecret(purpose)`).
- Mudança: `checkRateLimit(chave,{limite,janelaMs})` por IP e por e-mail (`x-forwarded-for`); login com mais de 5 falhas em 15 min devolve 429 com `Retry-After` (só falhas contam, sucesso zera o e-mail); forgot-password 3/h por IP e e-mail com resposta sempre igual; `bcrypt.compare` contra hash dummy quando o usuário não existe; `getSecret(purpose)` = `HMAC(JWT_SECRET, purpose)` para `session`, `password-reset`, `account-activation`; `JWT_SECRET` com 32+ caracteres, falhando fechado em produção.
- Testes (`scripts/rate-limit.test.ts`): 6ª falha vira 429 (relógio injetável); sucesso zera; janela expira; IP e e-mail independentes; segredo curto lança erro em produção; token assinado com a chave `session` falha na de `password-reset`.
- Risco: alto (IP compartilhado em ginásio bloqueando usuários: limite por IP maior que por e-mail; trocar a derivação invalida sessões e links: combinar o deploy com B1); médio (`x-forwarded-for` forjável).
- Aceite: o 6º POST com senha errada devolve 429; login correto durante bloqueio também; diferença de tempo entre e-mail existente e inexistente abaixo de tolerância medida; `JWT_SECRET` curto impede o boot em produção. Sem store compartilhado o limite só vale em instância única.

### B3. `fix/ativacao-e-organizador-liberado` (A4) — esforço P — depende de B1 (recomendado)
- Arquivos: `api/auth/ativar-conta/route.ts`, `auth.ts`, `api/inscricoes-campeonato/route.ts` (:34, :195), `api/ligas/route.ts` (:17, :99), `api/organizador/perfil/route.ts` (:13, :32), `api/portal-home/route.ts` (:7), `organizador-isolamento.ts` (helper `requireOrganizador`).
- Mudança: `releasedOnly: true` nas escritas e na criação de campeonato; copiar `trocarSenha` e `status` do banco ao JWT; recusar token de ativação se `emailVerificadoEm` já está preenchido. `perfil` GET e `portal-home`: decidir com o dono de produto (PENDENTE pode precisar ver o próprio perfil). `candidaturas/[tipo]/[id]` (dono editando a própria) provavelmente fica como está.
- Testes: PENDENTE/REJEITADO recebe 403 em `POST /api/ligas`, `POST /api/inscricoes-campeonato`, `PATCH /api/organizador/perfil`; ativação reutilizada devolve 400; JWT carrega `trocarSenha` e `status`; ATIVA continua passando.
- Risco médio (painel de organizador recém-cadastrado pode deixar de carregar algo). Aceite: 403 nas escritas listadas; reuso de token 400; sem regressão em `test:organizer-flow`.

### B4. `fix/arbitro-nao-sobrescrever` (A3) — esforço P — independente
- Arquivo: `api/organizador/arbitros/route.ts` (POST :57-85, `ensureArbitro` :129-157).
- Mudança: se existe `CandidaturaArbitro` com o e-mail e `organizadorId` nulo ou de outro organizador, devolver 409; nunca sobrescrever `senhaHash`, `nome`, `status`; `ensureArbitro` não atualiza `nome`/`aprovado` de `Arbitro` global existente. Vínculo por convite aceito pelo árbitro não existe: abrir pendência para o arquiteto.
- Testes (`scripts/organizador-arbitros.test.ts`): nulo → 409 sem `update`; de outro organizador → 409; do próprio → atualiza; e-mail novo → 201; `Arbitro` global não tem `nome` alterado.
- Risco médio. Candidaturas já adotadas indevidamente não são revertidas: pedir auditoria ao dados-do-campeonato. Aceite: nenhum caminho do POST escreve em `CandidaturaArbitro`/`Arbitro` de outro dono além do insert novo.

### B5. `fix/pagamento-e-webhook` (A5, A6) — esforço M — depende de D4, D4b
- Arquivos: `src/lib/infinitepay.ts`, `api/webhooks/infinitepay/route.ts`, `api/organizador/ligas/[id]/pagamento/confirmar/route.ts`, tela do botão "Já paguei" (localizar com grep).
- Mudança: se D4 = legado, a rota devolve 410. Se mantida: comparar tamanhos antes de `timingSafeEqual`; sem segredo, `false` em qualquer ambiente (exceto flag de dev fora de produção); trocar para `supabaseAdmin`; conferir `infinitePayId`, `amount` e que ainda não está `PAGO`; UPDATE condicional com checagem de linhas; replay responde 200 sem reprocessar; erro transitório 500. A6: em produção a confirmação simulada devolve 403 sem `PAGAMENTO_SIMULADO=1` (ou registra `pagamentoOrigem='simulado'`, coluna via banco-de-dados). Confirmar o método real de assinatura do gateway.
- Testes (`scripts/infinitepay.test.ts`): tamanho diferente → `false` sem lançar; sem segredo em produção → `false`; HMAC correto → `true`, adulterado → `false`; replay sem segunda `Equipe`; `amount` divergente ignorado; simulado 403 em produção sem flag.
- Risco: alto no A6 (piloto dependendo do Pix fake); médio no A5. Aceite: webhook sem assinatura válida 401 em produção; evento repetido não cria segunda equipe; confirmação simulada 403 em produção sem flag.

### B6. `fix/sumula-token-opaco` (M3) — esforço M — frontend no mesmo release
- Arquivos: `src/lib/sumula-access.ts` (:14), `api/sumula/[token]/route.ts` (:11, :22, :28, :39, :133); mapear antes (grep) os consumidores de `/api/sumula/` e `/partidas/[id]/ao-vivo`.
- Mudança: `requireSumulaTokenAccess` deixa de aceitar token numérico; se o portal público precisa de id, rota separada com projeção mínima só para campeonatos publicados (ou `src/lib/partida-publica.ts`); tokens demo só fora de produção; 404 idêntico para id numérico e token inexistente; manter expiração (410).
- Testes (`scripts/sumula-acesso.test.ts`): `GET /api/sumula/1` sem credencial 404; token válido 200; demo em produção 404; expirado 410; `consulta=1` sem CPF, `documentoNumero`, `dataNascimento`, telefones, `documentosUrls`, `qrCodeToken`.
- Risco alto (portal ou painel que usam o id quebram). Aceite: `GET /api/sumula/1..100` sem credencial 404; demos não respondem em produção; portal público e súmula do árbitro funcionam (teste manual).

### B7. `fix/selects-minimos` (M1, M4) — esforço M — depende de B6 e frontend
- Arquivos: `arbitro-access.ts` (:19), `sumula-access.ts` (:11), `api/arbitro/partidas/[token]/*`, `api/sumula/[token]/route.ts`, `api/equipes/route.ts` (:21, :40), `equipes/[id]/route.ts` (:11), `api/ligas/route.ts`, `ligas/[slug]/route.ts`, `organizador-isolamento.ts` (`ligasVisiveisAoOrganizador` devolve `null` para visitante).
- Mudança: `Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl,equipeId,qrCodeToken)`, `Arbitro(id,nome)`, colunas mínimas de `Liga`; antes de fixar a lista, levantar o que `lancar/page.tsx` e o painel realmente leem. M4 primeiro (mais simples), M1 depois, em commits separados; visitante só vê campeonatos publicados.
- Testes (`scripts/projecoes-publicas.test.ts`): constantes de seleção sem `cpf`, `documentoNumero`, `dataNascimento`, `telefone`, `telefoneEmergencia`, `documentosUrls`; `GET /api/equipes` anônimo sem essas chaves nem `organizadorId`; organizador A não recebe equipes de B.
- Risco alto no M1 (acoplamento com súmula e painel). Aceite: resposta de `/api/arbitro/partidas/[token]` sem PII; anônimo sem esses campos; súmula completa funciona num jogo de teste. Observação: isto só corrige a projeção do Node; o PostgREST com a anon key continua exposto até as migrations M1/M2 de banco.

### B8. `fix/urls-https-erros` (L3, L4) — esforço P — independente
- Arquivos: `src/lib/schemas.ts` (linhas 38, 44, 55, 132, 142, 151, 209, 210, 350, 351, 403, 438, 460, 477, 493, 494), `candidatura-edit.ts:70`, `api-response.ts:7-9`, `api/ligas/route.ts:42,130`, `ligas/[slug]/route.ts:156`; `admin/candidaturas/page.tsx:272` fica com o frontend.
- Mudança: `httpsUrl` (só `https:`); campos de upload nosso restritos ao host do Storage; valor inalterado antigo continua permitido; em produção `details` não vai ao cliente (logar no servidor).
- Testes (`scripts/schemas-url.test.ts`): `javascript:`, `data:`, `http://`, `file:` rejeitados; host do Storage passa; `''` onde já era aceito; `error()` em produção sem `details`.
- Risco médio (uploads antigos em `http` ou outro host: confirmar o host real). Aceite: nenhum schema aceita `javascript:`/`data:`; 500 em produção sem texto de erro do banco.

## 4. Infraestrutura

### G03. Credencial legada e segredos
Rotacionar primeiro, limpar arquivos depois (limpar sem rotacionar não protege; o valor fica no histórico).
1. Descobrir se a conta de admin padrão existe em dev e produção, pelo painel do Supabase, sem imprimir o hash. **Aprovação: você.**
2. Trocar a senha onde existir (depois do PR B1, senão o link de reset vira sessão de admin). **Aprovação: você.**
3. Avaliar o `JWT_SECRET` de produção; se parecer o placeholder, gerar outro (`openssl rand -base64 48`, gerado por você e colado direto no painel da Vercel), um por ambiente; derruba todas as sessões, fora de rodada. **Aprovação.**
4. Definir `ADMIN_EMAIL` em todos os ambientes (hoje a ausência libera qualquer e-mail). **Aprovação.**
5. Rotacionar `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `INFINITEPAY_*` só se o gitleaks indicar exposição. **Aprovação, caso a caso.**
6. Remover a credencial de `README.md`, `COMO-TESTAR.txt`, `setup-db.mjs` (preferir apagar: é legado SQLite com caminho de outra pessoa); redigir `log.md` e 5 arquivos de `docs/analise` (01, 04, 13-auditoria, 17, 18) que citam e-mail e senha como evidência.
7. Não reescrever histórico (D10).
- Aceite: busca pela senha legada (e pelo e-mail legado, só como referência) fora de `node_modules` retorna 0 nos arquivos de código e configuração; senha antiga inválida em dev e produção (você confirma); gitleaks do histórico rodado e achados classificados. Esforço P (0,5 dia, mais espera sua).

### G06. Ambiente local em um comando
- Parte 1 (sem banco): `.nvmrc` com `22` e `engines`; `cross-env` no lugar de `set X=...&&`; scripts `dev` (`next dev -p 3001`), `lint`, `typecheck` (`tsc --noEmit`), `test` (encadeia todos os `test:*` mais `category-selection`, `category-setup-state`, `supabase-env`), `build`; renomear o pacote para `volei-space`; remover `prisma.seed`; criar `CHANGELOG.md`; atualizar `README.md` e `COMO-TESTAR.txt` (hoje da LUVA); trocar `EMAIL_FROM`; validador de `JWT_SECRET` com 32+ caracteres (backend).
- Parte 2 (depende da baseline de banco): `scripts/setup.mjs` (confere Node, `npm ci`, copia `.env.example` sem sobrescrever nem imprimir valores, `prisma generate`, `supabase start` e `supabase db reset`), `reset-db` travado para recusar host não local, `supabase/config.toml`, `supabase/seed.sql` idempotente (2 organizadores, 3 competições aberta/privada/encerrada, 4 equipes com atletas, 1 partida em andamento; CPFs inválidos de teste), exceção restrita em `supabase-env.ts` para `127.0.0.1`/`localhost` só com `NODE_ENV=development`, e validar `DATABASE_URL`/`DIRECT_URL` contra `NEXT_PUBLIC_SUPABASE_URL`.
- Aceite: clone limpo + `npm run setup` + `npm run dev` abre `http://localhost:3001` em até 15 min; `reset-db` em menos de 2 min com 2/3/4/1; `npm test` passa em PowerShell, Git Bash e Linux; `reset-db` recusa URL `.supabase.co`. Esforço M (3 a 5 dias, sem contar a baseline). Aprovação: Docker Desktop, Supabase CLI, Node.

### G07. CI com gitleaks
- `.github/workflows/ci.yml` em `pull_request` para `teste-integrado` e `main` e `push` na `main`. Job `qualidade`: checkout, setup-node (`.nvmrc`), `npm ci`, `prisma generate`, `lint`, `typecheck`, `test`, `build` com variáveis dummy (nunca secrets reais em PR). Job `segredos`: checkout `fetch-depth: 0`, gitleaks sobre o histórico, `npm audit --omit=dev --audit-level=high` só como relatório no início. `permissions: contents: read`, `concurrency`, actions fixadas por versão. `.gitleaks.toml` com exceção por fingerprint (nunca o valor). Atenção: a action oficial do gitleaks pode exigir licença em organização; alternativa é rodar o binário.
- Aceite: PR com erro de lint falha e o corrigido passa; PR com segredo falso é barrado; checks obrigatórios; CI abaixo de 8 min. Esforço P. Aprovação: habilitar Actions e Dependabot, push e PR são seus.

### Proteção de branches (GitHub; tudo exige aprovação)
`main`: PR obrigatório, checks `qualidade` e `segredos`, sem push direto nem force push nem exclusão, inclui administradores, histórico linear. `teste-integrado`: PR e checks, sem force push nem exclusão. Tags `v*` protegidas. Secret scanning e push protection nativos ativos. Só aplicar depois que o CI rodar uma vez verde, senão os checks obrigatórios não aparecem para seleção. Documentar o fluxo de hotfix (branch `fix/` com PR na `main`). Aceite: `git push origin main` direto é rejeitado. Esforço P.

### M7. Cabeçalhos de segurança (`next.config.mjs`, `async headers()`)
HSTS (`max-age=63072000; includeSubDomains`, sem `preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` em reset e ativação), `Permissions-Policy` (confirmar se o QR usa câmera), `frame-ancestors 'self'` ampliado conforme D9 (o layout detecta iframe em `layout.tsx:95`), CSP primeiro em `Content-Security-Policy-Report-Only` (`script-src 'self' 'unsafe-inline'` por causa do script inline; `'unsafe-eval'` só em dev; conferir domínios do pagamento e imagens externas). Depois de 1 semana de preview sem violações novas, segundo PR troca para CSP real. Nunca publicar em dia de jogo. Aceite: cabeçalhos presentes na home e em `/api/ping`; login, painel, súmula, upload de foto e portal sem violação nova por 1 semana. Esforço P (+1 semana de observação). Reversão: revert ou Instant Rollback da Vercel (~2 min).

### Homologação e Supabase local
Adotar Supabase CLI local para desenvolvimento diário; manter o projeto de dev atual como Preview/CI; criar projeto de homologação próprio (~US$ 25/mês, premissa não verificada) antes do primeiro piloto pagante ou da migração RLS. Confirmar o plano do Supabase de produção (Free não tem backup utilizável). Custos totais estimados em `11-infraestrutura-e-operacao.md`.

## 5. Banco de dados

### 5.1 Consultas somente leitura para você colar no SQL Editor (passo 0)
Servem para confirmar o estado real antes de qualquer migration. Retornam só metadados; guardar o resultado de Q2, Q3 e Q5 fora do repositório como ponto de reversão. Não colar linhas de `Jogador`.

```sql
-- Q1. RLS por tabela
select c.relname as tabela, c.relrowsecurity as rls_ligado, c.relforcerowsecurity as rls_forcado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relrowsecurity, c.relname;

-- Q2. Policies do schema public
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd, policyname;

-- Q2b. Só as permissivas abertas
select tablename, policyname, roles, cmd, qual from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true') order by tablename;

-- Q3. Grants de tabela para anon/authenticated
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee order by grantee, table_name;

-- Q3b. Grants por coluna para anon
select table_name, column_name, grantee, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and grantee = 'anon' order by table_name, column_name;

-- Q3c. Funções expostas
select routine_name, grantee, privilege_type from information_schema.role_routine_grants
where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'public') order by routine_name;

-- Q4. Buckets
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

-- Q5. Policies do Storage
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects' order by policyname;

-- Q5b. Volume por bucket (sem nomes)
select bucket_id, count(*) as objetos from storage.objects group by bucket_id order by 2 desc;

-- Q6. Índices existentes
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname;

-- Q6b. Índices nunca usados e tamanho
select relname as tabela, indexrelname as indice, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) as tamanho
from pg_stat_user_indexes where schemaname = 'public' order by idx_scan, relname;

-- Q7. Constraints CHECK e FK
select conrelid::regclass as tabela, conname, contype, pg_get_constraintdef(oid) as def
from pg_constraint where connamespace = 'public'::regnamespace and contype in ('c','f') order by 1, 2;

-- Q8. Tipo de Pagamento.valor e resto de centavos
select data_type, numeric_precision, numeric_scale from information_schema.columns
where table_schema='public' and table_name='Pagamento' and column_name='valor';
select count(*) as linhas, max(abs(valor*100 - round(valor*100))) as maior_resto_centavos from "Pagamento";

-- Q9. Valores distintos de status (para os CHECK)
select 'Liga' t, status::text v, count(*) from "Liga" group by 2
union all select 'Partida', status::text, count(*) from "Partida" group by 2
union all select 'InscricaoCampeonato', status::text, count(*) from "InscricaoCampeonato" group by 2
union all select 'Equipe.statusEquipe', "statusEquipe"::text, count(*) from "Equipe" group by 2
order by 1, 2;

-- Q10. Migrations registradas e extensões
select * from supabase_migrations.schema_migrations order by 1;
select extname from pg_extension order by 1;

-- Q11. Triggers e funções (a linha placeholder do rascunho foi removida)
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers where trigger_schema='public' order by 1,2;
select proname, prosecdef as security_definer, proconfig
from pg_proc where pronamespace = 'public'::regnamespace and prokind = 'f' order by 1;

-- Q12. Consultas lentas (se pg_stat_statements existir)
select calls, round(mean_exec_time::numeric,1) as ms_medio, left(query,120) as query
from pg_stat_statements order by total_exec_time desc limit 20;

-- Q13. Dados sensíveis presentes (só contagem)
select count(*) filter (where "cpf" is not null) as com_cpf,
       count(*) filter (where "dataNascimento" is not null) as com_nascimento,
       count(*) filter (where "documentosUrls" is not null) as com_documentos
from "Jogador";
```
Q9 e Q13 assumem nomes de coluna vistos nos docs; se falharem, ajustar ao DDL real.

### 5.2 Ordem das migrations
| Ordem | Migration | Natureza | Risco |
|---|---|---|---|
| 0 | Baseline `202609010000_baseline.sql` (só repositório) | Normalização, sem efeito em produção | Baixo |
| 1 | **Código**: sair do client anon (rotas e páginas listadas em 5.3) | Deploy | Médio |
| 2 | M1: fechar leitura pública de PII | RLS, revoke, view | Alto |
| 3 | M2: bucket `atleta-arquivos` privado | Storage, parte destrutiva | Alto |
| 4 | M6: índices | `create index concurrently` | Baixo |
| 5 | M7: integridade | CHECK, FK, tipo de `Pagamento.valor` | Médio |

M1 e M2 vêm primeiro porque fecham o risco LGPD; M7 por último porque o `ALTER TYPE` precisa de janela e backup. Timestamps reais no momento da criação, padrão `YYYYMMDDNNNN_nome.sql`. Toda migration idempotente.

**Normalizar os 52 arquivos sem reaplicar nada** (17 com timestamp `202609220001` a `202610060002`, 35 `supabase-*.sql` sem timestamp; todos com a mesma data de modificação, então a ordem real de aplicação em produção é desconhecida e vem de Q10):
1. Mover os 35 legados para `supabase/legacy/` (fora da pasta que a CLI lê).
2. Gerar a baseline com `supabase db dump --schema public --schema-only` (mais policies e buckets) a partir de produção ou de um preview clonado; revisar removendo dados e segredos.
3. Decisão pendente: a baseline contém o estado atual completo e as 17 migrations viram "aplicadas" (recomendado), ou o estado anterior a `202609220001`.
4. Em produção, só após aprovação: `supabase migration repair --status applied 202609010000` (grava só em `supabase_migrations.schema_migrations`, não altera o schema).
5. Prova: banco vazio local + baseline + migrations novas, e `supabase db diff` contra o dump de preview deve dar vazio.

### 5.3 Por migration
**M1 (fechar PII).** Dropar `public_read_*` (`supabase-producao-elenco-sumula-rls.sql:63-111`); `revoke all` de `anon`/`authenticated` em `Jogador`, `CandidaturaEquipe/Arbitro/Quadra/Organizador`, `Pagamento`, `Admin`, `ContaPublico`, `Interessado`, `CodigoAcessoOrganizador`, `ConviteEquipe`; `enable row level security` em tudo; view `public.jogador_publico` (id, nome, numero, posicao, fotoUrl, equipeId); revogar escrita de `anon` nas tabelas de `supabase-organizador-campeonatos.sql:15-34`. Pré-requisitos: Q1 a Q3 revisadas e o código já fora do client anon e em produção. Rotas que usam o client anon e quebram (trocar por `supabaseAdmin` + checagem de sessão/dono): `api/equipes`, `equipes/[id]`, `jogadores`, `jogadores/[id]`, `jogadores/qr/[token]`, `partidas/[id]` e `/aprovar`, `mensagens`, `ligas`, `classificacao`, `rankings`, `portal/ativos`, `ping`, `auth/forgot-password` e `reset-password`, `webhooks/infinitepay`. Páginas de servidor: `equipes/[slug]/page.tsx:89` (usar `jogador_publico`), `campeonatos/[slug]` e `campeonatos`, `admin/page.tsx`, `sitemap.ts`, `lib/portal-home.ts`, `utils/slug.ts`. Clientes que importam o anon só para upload (afetados por M2): `capitao/page.tsx`, `cadastro/page.tsx`, `CandidateEditForm`, `GaleriaOrganizador`, `OrganizacaoForm`, `InformacoesWizard`, `FormularioInscricaoRapida`. Confirmar `SUPABASE_SERVICE_ROLE_KEY` na Vercel (produção e preview). Varredura final: `grep -rn "from '@/lib/supabase'"` só com o deliberadamente público. Reversão: recriar policies e grants a partir do dump de Q2/Q3; emergência: desligar RLS só nas tabelas de leitura pública, mantendo `Jogador` e `Candidatura*` fechadas. Backup: dump lógico do schema `public` e das policies; confirmar backup diário/PITR. Janela: madrugada de dia sem jogos, depois de o código estar estável por um ciclo. Aceite: chave anon lê 0 linhas de `Jogador`, `Equipe`, `InscricaoCampeonato`.

**M2 (bucket privado).** `update storage.buckets set public=false where id='atleta-arquivos'`; dropar as policies anon de `supabase-producao-elenco-sumula-rls.sql:13-48`, `supabase-admin-uploads-portal.sql:27-59`, `supabase-storage-uploads-elenco-quadras.sql:5-37`; reescrever URLs gravadas em `Jogador.fotoUrl`, `documentosUrls`, `fotoRostoUrl` para caminhos relativos, **com coluna de apoio (`fotoUrl_legado`) preenchida antes** para ser reversível. Pré-requisitos: Q4, Q5, Q5b; rota de servidor para upload (tipo e tamanho) e para URL assinada de curta duração após checar organizador dono, capitão ou árbitro escalado; D5. Quebram: uploads diretos do navegador (`capitao/page.tsx:337-345`, `FormularioInscricaoRapida.tsx:104-106`, depois `cadastro/page.tsx` e `CandidateEditForm.tsx` para os outros buckets), `<img>`/`<a>` com URL pública antiga (`admin/candidaturas/page.tsx:272`), rotas que devolvem `documentosUrls` (`api/capitao/jogadores/route.ts` 204-224, `api/arbitro/partidas/[token]`). Links já compartilhados no WhatsApp deixam de abrir: avisar. Reversão: `public=true` e recriar policies de Q5. Backup obrigatório: cópia dos objetos para armazenamento privado e cifrado fora do projeto, mais dump das colunas de URL. Janela separada de M1.

**M6 (índices).** `create index concurrently if not exists` em `Jogador(equipeId)`, `Equipe(ligaId,categoriaCampeonatoId)`, `Partida(equipeAId)`, `Partida(equipeBId)`, `Partida(ligaId,categoriaCampeonatoId,status,dataHora)`, `SumulaPresenca(jogadorId)` e `(equipeId)`, `OcorrenciaPartida(partidaId)`, `VotoMVP(categoria,serie)`, `Mensagem(ligaId,aprovada)`, `Midia(ligaId)`, `Premiacao(ligaId)`, `CandidaturaEquipe(ligaId,status)`. Pré: Q6/Q6b para tirar os que já existem; sem `begin/commit` (o runner precisa executar fora de transação, um por arquivo). Nenhuma rota quebra. Reversão: `drop index concurrently`. Baixa carga, evitar rodada.

**M7 (integridade).** `Pagamento.valor` de `Float` para `numeric(12,2)`; CHECKs `not valid` + `validate` em `Liga.status`, `Partida.status`, `InscricaoCampeonato.status`, `Equipe.categoria`, `serie`, `statusEquipe`; FK `Partida.vencedorId`; remover `convite_vaga_token_idx` e `liga_idx` se Q6b confirmar a redundância. Pré: Q7, Q8, Q9; checar órfãos em `Partida.vencedorId` antes da FK. Pode rejeitar escritas com grafia de status diferente (mapear em `api/partidas`, `api/ligas`, `api/inscricoes-campeonato`, `api/candidaturas/equipes`, `api/organizador/ligas/[id]/*`, `src/lib/championship-*.ts`); o `numeric` volta como string no driver (webhook e confirmação de pagamento). Reversão: `drop constraint` e `alter column valor type double precision`, sem recuperar precisão perdida. Backup: dump de `Pagamento` e `Partida` com contagem e checksum. Aplicar em etapas (CHECK/FK `not valid`, depois `validate`, por último o `ALTER TYPE` isolado), sem pagamento em andamento.

## 6. O que exige sua aprovação explícita
- **Produção ou segredos:** consultar/trocar a conta de admin, trocar `JWT_SECRET`, definir `ADMIN_EMAIL`, qualquer rotação de chave, rodar as consultas da seção 5.1, qualquer DDL (baseline `repair`, M1, M2, M6, M7), o deploy do código fora do client anon, publicar M7 de cabeçalhos, plano e backup do Supabase de produção. Sempre fora de rodada.
- **GitHub:** habilitar Actions, branch protection, tag protection, secret scanning, Dependabot, push e PR.
- **Vercel:** Production Branch, variáveis por ambiente, projeto de homologação.
- **Custo e ferramentas:** Supabase de homologação (~US$ 25/mês), Docker Desktop, Supabase CLI.
- **Decisões:** D1 a D12.

## 7. Gate da Fase 0 (checklist)
- [ ] Senha legada do admin: 0 ocorrências no repo (código, docs e `log.md`)
- [ ] Senha antiga inválida em dev e produção (você confirma)
- [ ] `JWT_SECRET` distinto por ambiente com 32+ caracteres; `ADMIN_EMAIL` definido em todos
- [ ] gitleaks do histórico rodado e achados classificados
- [ ] Token de reset e de ativação rejeitados como sessão (B1); corpo do login sem `token`
- [ ] Rate limit ativo no login e na recuperação (B2)
- [ ] Chave anon lê 0 linhas de `Jogador`, `Equipe`, `InscricaoCampeonato`; `atleta-arquivos` privado (M1, M2)
- [ ] `GET /api/sumula/1..100` sem credencial devolve 404 (B6)
- [ ] Organizador A não lê nem altera B (teste de isolamento por rota sensível)
- [ ] `.nvmrc`, `engines`, `cross-env`; scripts `setup`, `dev`, `test`, `lint`, `typecheck`, `build`, `reset-db` rodam em PowerShell, Git Bash e Linux
- [ ] Clone limpo + `setup` + `dev` em até 15 min; `reset-db` em menos de 2 min; seed 2/3/4/1; `reset-db` recusa host remoto
- [ ] Banco vazio + baseline + migrations = schema atual, `db diff` vazio
- [ ] CI verde num PR real e vermelho num PR com falha proposital
- [ ] `main` e `teste-integrado` protegidas; push direto na `main` rejeitado; secret scanning ativo
- [ ] Cabeçalhos de segurança presentes, CSP em Report-Only sem violação nova por 1 semana
- [ ] Decisão de homologação registrada; Vercel confirmada (produção só por promoção manual)
- [ ] Backup de produção confirmado e restauração testada em dev; ensaio de rollback abaixo de 10 min
- [ ] Política LGPD de menores aprovada (G10)
- [ ] Nenhuma publicação feita durante rodada
