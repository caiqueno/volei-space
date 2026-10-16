# 13. Auditoria de segurança do volei.space

Agente: `seguranca`. Somente leitura (nenhum código, migration ou banco foi alterado; nenhum teste foi feito contra produção).
Base: branch `teste-integrado`, `docs/analise/01-diagnostico-volei-space.md` (S1 a S13) confirmado no código e nas migrations de `supabase/migrations`.
Segredos e dados pessoais estão mascarados neste arquivo (ex.: `admin@luv.***`, `Lu****26`). Nenhum valor real foi copiado.

## 0. Aviso urgente: rotacionar antes de qualquer outra ação

A conta de administrador legada da LUVA tem e-mail e senha fixos e públicos no repositório (README, COMO-TESTAR, `setup-db.mjs`; ver SEG-04). Se essa conta existir na tabela `Admin` de qualquer banco real (produção ou desenvolvimento), **troque a senha e apague a linha agora**. O histórico git já contém a senha (12 ocorrências em `git log --all -S`), então remover dos arquivos não basta.

## 1. Método e limites

- Leitura de `src/middleware.ts`, `src/lib/{auth,organizador-isolamento,sumula-access,arbitro-access,acesso-arbitro-jogo,link-inscricao-campeonato,schemas}.ts`, das 100+ rotas de `src/app/api` e dos 52 SQL de `supabase/migrations`.
- Confirmado = visto no código ou no SQL versionado. **Estado real do banco = a verificar**: o `12-BUGS` já avisa que a RLS de produção não pode ser deduzida do SQL versionado (os arquivos não têm ordem declarada e se contradizem). Por isso há uma bateria de consultas somente leitura na seção 4 para rodar no SQL Editor do Supabase (projeto de desenvolvimento primeiro).
- Padrão arquitetural que explica quase tudo: **a maioria das rotas usa `supabaseAdmin` (service role, ignora RLS)**, mas cerca de 17 rotas e várias páginas SSR usam o cliente anon (`@/lib/supabase`), cuja chave é pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Qualquer pessoa pode chamar o PostgREST do Supabase direto com essa chave e ignorar todas as validações do Next. Logo, **a segurança real dos dados é a RLS + grants + storage policies**, e o SQL versionado é permissivo.

## 2. Resumo dos achados

| ID | Gravidade | Título | Estado |
|---|---|---|---|
| SEG-01 | Crítico | PII de atletas (CPF, documento, nascimento, telefones) legível por anon via PostgREST | Confirmado no SQL; efetivo = verificar |
| SEG-02 | Crítico | Storage público com listagem, upload e update anônimos; documentos de menores em bucket público | Confirmado no SQL e no código |
| SEG-03 | Crítico | `CandidaturaOrganizador`: anon lê `senhaHash` e pode inserir organizador já `ATIVA` | Confirmado no SQL; efetivo = verificar |
| SEG-04 | Crítico | Credenciais fixas de admin no repositório e no histórico git | Confirmado |
| SEG-05 | Crítico | RLS desligada/ausente e escrita anon em tabelas centrais; tabelas com hash e token sem RLS | Confirmado no SQL; efetivo = verificar |
| SEG-06 | Alto | `GET /api/jogadores` devolve `Jogador.*` sem sessão | Confirmado |
| SEG-07 | Alto | `GET /api/rankings` e `/equipes/[slug]` expõem `Jogador(*)` publicamente | Confirmado (novo) |
| SEG-08 | Alto | Login sem limite de tentativas; enumeração de contas; JWT de admin no corpo da resposta | Confirmado |
| SEG-09 | Alto | XSS armazenado: URL `javascript:` em `<a href>` no painel admin | Confirmado (novo) |
| SEG-10 | Alto | `GET/PATCH /api/organizador/quadras`: qualquer organizador lê e aprova cadastros de todos | Confirmado (novo) |
| SEG-11 | Alto | LGPD: dados de menores sem consentimento, retenção ou exclusão | Confirmado |
| SEG-12 | Médio | `GET /api/equipes`, `/equipes/[id]`, `/classificacao`, `/ligas/[slug]`, `/ligas` devolvem `Equipe(*)` e `Liga(*)` sem filtro | Confirmado |
| SEG-13 | Médio | Súmula legível por id sequencial; `sumulaToken` previsível | Confirmado |
| SEG-14 | Médio | Código de acesso do árbitro: contagem de tentativas não atômica (burla do bloqueio) | Confirmado (novo) |
| SEG-15 | Médio | Redefinição de senha: só admin, via cliente anon, hash no JWT, host do link, token de reset aceito como sessão admin | Confirmado |
| SEG-16 | Médio | Sem rate limit/CAPTCHA em endpoints públicos que gravam e enviam e-mail | Confirmado |
| SEG-17 | Médio | Sem cabeçalhos de segurança (CSP, HSTS, frame-ancestors, nosniff) | Confirmado |
| SEG-18 | Médio | Funções `SECURITY DEFINER` sem `revoke` garantido (ordem de migrations) | Verificar |
| SEG-19 | Médio | JWT: segredo sem validação, um segredo para tudo, sem revogação, `Bearer` aceito | Confirmado |
| SEG-20 | Baixo | Validação de URL de mídia fraca (`galeria`) | Confirmado |
| SEG-21 | Baixo | Vazamento de detalhes de erro (mensagens de banco, URL, contagens) | Confirmado |
| SEG-22 | Baixo | Webhook InfinitePay: sem valor/idempotência, cliente anon, validação frouxa fora de produção | Confirmado |
| SEG-23 | Baixo | Cadastro sem verificação de e-mail permite ocupar o e-mail de outra pessoa | Confirmado |
| SEG-24 | Baixo | `ativar-conta` emite sessão sem `trocarSenha`; endpoint sem emissor | Confirmado |
| SEG-25 | Info | O que foi verificado e está correto | |

---

## 3. Achados detalhados

### SEG-01 (Crítico) PII de atletas legível por qualquer pessoa com a chave anon

- **Onde:** `supabase/migrations/supabase-producao-elenco-sumula-rls.sql:73-76` (`create policy "public_read_jogadores" on public."Jogador" ... using (true)`), mais `supabase-rls-producao-permissoes-campeonatos.sql:50-63` (política condicional por status da liga). Políticas permissivas somam (OR), então a `using (true)` vence. Não há restrição de colunas nem `revoke select` sobre `Jogador` para `anon`.
- **Dados em risco** (`prisma/schema.prisma:214-240`): `cpf`, `documentoTipo`, `documentoNumero`, `dataNascimento`, `telefone`, `telefoneEmergencia`, `documentosUrls`, `qrCodeToken`, `fotoRostoUrl`. Inclui menores de idade.
- **Cenário de ataque:** abrir o app, copiar a chave anon do JavaScript e fazer `GET https://<projeto>.supabase.co/rest/v1/Jogador?select=*` com `apikey`. Isso ignora todo o código das rotas. Com o `qrCodeToken` o atacante também pode se passar pelo atleta na validação de QR do árbitro.
- **Correção exata (aplicar nesta ordem):**
  1. Primeiro trocar no código todo uso do cliente anon que lê `Jogador` por `supabaseAdmin` com **lista explícita de colunas** (ver SEG-06 e SEG-07), senão o app público quebra.
  2. Depois rodar a migration:
```sql
-- 202610150001_fechar_pii_jogador.sql
begin;
drop policy if exists "public_read_jogadores" on public."Jogador";
drop policy if exists "luv_public_select_jogador" on public."Jogador";
revoke all on public."Jogador" from anon, authenticated;
-- leitura pública só do que é de vitrine, por view sem PII
create or replace view public.jogador_publico with (security_invoker = false) as
  select j.id, j.nome, j.numero, j.posicao, j."equipeId", j."fotoUrl", j."fotoRostoUrl"
  from public."Jogador" j
  join public."Equipe" e on e.id = j."equipeId"
  join public."Liga" l on l.id = e."ligaId"
  where j.banido = false and l.status in ('EM_BREVE','ATIVA','ENCERRADA','FINALIZADO');
revoke all on public.jogador_publico from public;
grant select on public.jogador_publico to anon, authenticated;
commit;
```
- **Teste de regressão:** teste de integração (script contra o banco local/dev) que usa **apenas** a chave anon: `GET /rest/v1/Jogador?select=cpf` deve responder 401/403 ou lista vazia; `GET /rest/v1/jogador_publico?select=*` deve responder 200 sem as colunas `cpf`, `telefone`, `dataNascimento`, `qrCodeToken`. Falhar o CI se qualquer coluna de PII aparecer.

### SEG-02 (Crítico) Storage: listagem, upload e update anônimos; documentos de identidade em bucket público

- **Onde:** `supabase-storage-uploads-elenco-quadras.sql:5-37`, `supabase-producao-elenco-sumula-rls.sql:13-48`, `supabase-admin-uploads-portal.sql:27-60`. Buckets `atleta-arquivos`, `equipe-emblemas`, `jogador-fotos`, `quadra-fotos`, `galeria-campeonato` são `public = true`, com policies `select`, `insert` e **`update`** para `anon`. O nome de uma delas admite: `atleta_arquivos_upload_publico_temporario`.
- **Uso no código:** os uploads saem direto do navegador com a chave anon (`src/app/capitao/page.tsx:336-345`, `cadastro/page.tsx:903`, `FormularioInscricaoRapida.tsx:100-106`, `GaleriaOrganizador.tsx:77`). O caminho do documento é `<candidaturaId>/documento/<Date.now()>-<nome>` (`capitao/page.tsx:336`), previsível e, pior, **listável** pela policy de `select`.
- **Cenário de ataque:**
  1. `POST /storage/v1/object/list/atleta-arquivos` com a chave anon lista todos os arquivos; baixa RG/CPF/certidão de atletas, inclusive menores.
  2. Como há `update` anônimo, sobrescreve emblemas, fotos de quadra e fotos de atleta (defacement) ou troca um documento por conteúdo falso.
  3. Insert anônimo sem limite por usuário: encher o armazenamento (custo) e hospedar imagens/PDF de terceiros no domínio do projeto.
- **Correção exata:**
  1. Documentos (`atleta-arquivos`) viram bucket **privado**; só `service_role` lê; o admin/organizador abre por URL assinada de curta duração gerada no servidor.
  2. Upload passa a ser feito por URL assinada emitida por rota autenticada (token de rascunho, sessão de capitão ou organizador), nunca por policy anônima.
```sql
-- 202610150002_storage_fechar.sql
begin;
update storage.buckets set public = false where id = 'atleta-arquivos';
drop policy if exists "atleta_arquivos_leitura_publica"            on storage.objects;
drop policy if exists "atleta_arquivos_upload_publico_temporario"  on storage.objects;
drop policy if exists "atleta_arquivos_update_publico_temporario"  on storage.objects;
drop policy if exists "luv_public_read_uploads"   on storage.objects;
drop policy if exists "luv_public_insert_uploads" on storage.objects;
drop policy if exists "luv_public_update_uploads" on storage.objects;
drop policy if exists "luv_read_public_uploads"   on storage.objects;
drop policy if exists "luv_insert_public_uploads" on storage.objects;
drop policy if exists "luv_update_public_uploads" on storage.objects;
-- imagens de vitrine (emblema, foto de jogador, galeria): bucket public = true serve por URL direta,
-- sem policy de select (sem listagem) e sem policy de escrita
commit;
```
```ts
// src/app/api/uploads/assinar/route.ts (novo; esboço)
// valida sessão/token, escolhe bucket e caminho no servidor e devolve a URL assinada de upload
const { data } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(`${escopo}/${randomUUID()}.webp`)
return success({ path: data.path, token: data.token })
// o cliente usa supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)
```
- **Teste de regressão:** com a chave anon, `list` em `atleta-arquivos` deve falhar; `upload` direto deve falhar (403) nos 5 buckets; `upload` pela rota assinada com sessão válida deve funcionar; `update` sobre arquivo existente deve falhar. Teste de unidade: o caminho gerado nunca contém o nome enviado pelo cliente.

### SEG-03 (Crítico) `CandidaturaOrganizador`: leitura de hash e auto-aprovação via PostgREST

- **Onde:** `supabase-candidaturas-organizadores.sql:149-169`: `grant select, insert, update ... to anon, authenticated`; política de insert `with check (status = 'ATIVA' and plano = 'PADRAO')`; política `"Organizador consulta proprio cadastro" for select using (true)`.
- **Cenário de ataque:**
  - Leitura: `GET /rest/v1/CandidaturaOrganizador?select=email,telefone,senhaHash` devolve e-mail, telefone e hash bcrypt de todos os organizadores (força bruta offline, spam, phishing).
  - Escrita: `POST /rest/v1/CandidaturaOrganizador` com `status:'ATIVA'`, `email` próprio e `senhaHash` bcrypt gerado localmente cria um organizador **já liberado** (`isReleasedPublicStatus('ATIVA')` é verdadeiro e `trocarSenha` tem default `false`). O fluxo de aprovação pelo admin (`PENDENTE`, `api/admin/candidaturas/[id]/aprovar`) é contornado: o atacante faz login em `/api/auth` e opera `/api/organizador/*`.
- **Correção exata:** o app atual só escreve nessa tabela pelo servidor com service role (`api/candidaturas/organizadores/route.ts:6,47`), então as policies anônimas podem sair.
```sql
-- 202610150003_candidatura_organizador_fechar.sql
begin;
drop policy if exists "Cadastro publico de organizador"        on "CandidaturaOrganizador";
drop policy if exists "Organizador consulta proprio cadastro"  on "CandidaturaOrganizador";
revoke all on "CandidaturaOrganizador" from anon, authenticated;
grant all on "CandidaturaOrganizador" to service_role;
alter table "CandidaturaOrganizador" enable row level security;
commit;
```
  Mesma correção, tabela a tabela, para `CandidaturaEquipe`, `CandidaturaArbitro`, `CandidaturaQuadra`, `ContaPublico` (ver SEG-05).
- **Teste de regressão:** com a chave anon, `select` e `insert` em `CandidaturaOrganizador` devem falhar. E2E: cadastro via `/seja-membro` continua criando `PENDENTE`; login desse e-mail retorna 403 "aguarda liberação" até o admin aprovar.

### SEG-04 (Crítico) Credenciais fixas de admin no repositório

- **Onde:** `README.md:35-36`, `COMO-TESTAR.txt:120`, `setup-db.mjs:236-245` e `:421` (e-mail `admin@luv.***`, senha `Lu****26`, mais um hash bcrypt pré-calculado em `setup-db.mjs:236-240`). `git log --all -S` encontra a senha em 12 pontos do histórico.
- **Cenário de ataque:** qualquer pessoa com acesso ao repositório (ou a um clone/fork) tenta essa credencial em `/login` ou `POST /api/auth`. Se a linha existir em `Admin`, o atacante vira admin: cria organizadores (`api/admin/organizadores`), reseta senhas, aprova candidaturas, lê todos os cadastros. Agravante: se `ADMIN_EMAIL` não estiver definido, **qualquer** linha de `Admin` é aceita (`src/lib/admin-access.ts:12-16`).
- **Correção exata:**
  1. Rotacionar/apagar: `delete from "Admin" where email ilike 'admin@luv.%';` e criar o admin real com senha forte única.
  2. Remover os valores de README/COMO-TESTAR e apagar `setup-db.mjs` (é do SQLite da LUVA, não serve mais).
  3. Tornar `ADMIN_EMAIL` obrigatório:
```ts
// src/lib/admin-access.ts
export function adminEmailAllowed(email: string) {
  const configured = configuredAdminEmail()
  if (!configured) return false // fail closed
  return email.trim().toLowerCase() === configured
}
```
  4. Se o repositório for público ou compartilhado, tratar a senha como vazada (já está no histórico).
- **Teste de regressão:** teste de unidade `adminEmailAllowed` com `ADMIN_EMAIL` vazio retorna `false`. Script de CI com `git grep -nI -E "LuvAdmin|admin@luv"` que falha se achar algo. Hook de pré-commit com detector de segredos (gitleaks).

### SEG-05 (Crítico) RLS desligada ou ausente; escrita anônima em tabelas centrais

- **Onde (SQL versionado):**
  - `supabase-organizador-campeonatos.sql:15-34`: `alter table "Liga"/"InscricaoCampeonato"/"Equipe"/"Partida"/"ClassificacaoEntrada" disable row level security` e `grant select, insert, update ... to anon, authenticated` (inclui sequences). Qualquer pessoa altera ou cria campeonatos, equipes, partidas e a tabela de classificação.
  - `supabase-fix-cadastro-rls.sql:4-6`, `supabase-cadastro-contatos-unicos.sql:15-17`, `supabase-candidaturas-quadras.sql:74`: RLS desligada em `CandidaturaEquipe`, `CandidaturaArbitro`, `CandidaturaQuadra`. O comentário em `candidaturas-quadras.sql:76-79` admite que é "padrão do protótipo". Essas tabelas têm `senhaHash`, e-mail e telefone.
  - Sem nenhum `enable row level security` no SQL versionado: `ContaPublico` (`senhaHash`, e-mail), `CodigoAcessoOrganizador` (códigos), `ClassificacaoEliminatoria`; e as criadas só pelo `prisma db push` (`ConviteEquipe` com token e e-mail do convidado, `Interessado`, etc.).
- **Evidência de que produção depende disso:** rotas gravam com o cliente anon depois de checar o dono: `api/equipes/[id]/route.ts:31,48`, `api/jogadores/route.ts:40`, `api/jogadores/[id]/route.ts:20,37`, `api/partidas/[id]/route.ts:42`, `api/partidas/[id]/aprovar/route.ts:35`, `api/equipes/route.ts:73`. Essas operações só funcionam se a RLS permitir escrita ao anon. Ou seja, ou produção está permissiva demais, ou essas rotas já estão quebradas. (Inferência, a confirmar com a seção 4.) Os arquivos também são aplicados em ordem desconhecida: a ordem alfabética coloca `rls-producao` depois de `organizador-campeonatos`, mas o grant de escrita permanece.
- **Cenário de ataque:** `PATCH /rest/v1/Partida?id=eq.1 {"setsPorA":3,...}` com a chave anon altera resultados; `PATCH /rest/v1/Liga?...{"organizadorId":"<id>"}` assume o campeonato de outro organizador; `GET /rest/v1/ContaPublico?select=*` baixa hashes.
- **Correção exata:**
  1. Trocar todas as rotas listadas acima para `supabaseAdmin` (elas já checam dono com `exigirOrganizador*`).
  2. Migration de fechamento geral:
```sql
-- 202610150004_rls_fechar_tudo.sql
begin;
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
commit;
```
  3. Reabrir só a leitura do que a vitrine precisa, preferindo views (padrão do SEG-01) ou, se o front continuar usando o cliente anon em páginas SSR, `grant select (colunas)` + policy por status da liga. O ideal é o front público ler via rotas/SSR com service role e colunas explícitas, e `anon` ficar sem acesso a tabelas.
  4. Usar `force row level security` nas tabelas com hash.
- **Teste de regressão:** teste de integração "anon não escreve": para cada tabela de `pg_tables`, `insert`/`update`/`delete` com chave anon deve falhar; "anon não lê tabelas privadas" (`Admin`, `Candidatura*`, `ContaPublico`, `CodigoAcessoOrganizador`, `ConviteEquipe`, `Pagamento`, `Interessado`, `AcessoArbitro*`, `InscricaoEquipeRascunho`). Rodar a bateria da seção 4 no CI contra o banco local e falhar se `rowsecurity = false` em qualquer tabela.

### SEG-06 (Alto) `GET /api/jogadores` sem sessão devolve `Jogador.*`

- **Onde:** `src/app/api/jogadores/route.ts:14-24`: `select('*')` com cliente anon; o filtro por organizador só é aplicado se houver sessão de organizador (`ligasVisiveisAoOrganizador` devolve `null` para anônimo, `organizador-isolamento.ts:51-56`). Confirma o S1 do diagnóstico. Hoje o resultado depende da RLS (SEG-01): se estiver aberta, qualquer um lista todos os atletas com PII; se estiver fechada, a rota retorna vazio e o painel não funciona.
- **Cenário:** `curl /api/jogadores?q=ana` retorna CPF, documento, data de nascimento e telefones.
- **Correção exata:** exigir organizador (ou admin), usar service role e listar colunas; a vitrine pública usa `/api/equipes/[id]`, que já limita colunas.
```ts
// src/app/api/jogadores/route.ts
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
const COLUNAS = 'id,nome,numero,posicao,equipeId,fotoUrl,banido'
export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof NextResponse) return auth
  const ligas = await ligasVisiveisAoOrganizador(req) // agora nunca nulo
  const { data: equipes } = await supabaseAdmin.from('Equipe').select('id').in('ligaId', ligas?.length ? ligas : [-1])
  const ids = (equipes ?? []).map((e) => e.id)
  let q = supabaseAdmin.from('Jogador').select(COLUNAS).in('equipeId', ids.length ? ids : [-1]).order('nome')
  // ... filtros equipeId / q como hoje
}
```
  Para telas que precisam de CPF/documento (organizador conferindo elenco), criar rota separada `GET /api/organizador/ligas/[id]/elenco` com `exigirOrganizadorDaLiga` e mascaramento (`***.***.***-12`).
- **Teste de regressão:** `GET /api/jogadores` sem cookie retorna 401; com organizador A, `?equipeId=<equipe do organizador B>` retorna `[]`; a resposta de organizador nunca contém `cpf`, `documentoNumero`, `dataNascimento`, `telefone`, `qrCodeToken`.

### SEG-07 (Alto) `GET /api/rankings` e `/equipes/[slug]` expõem a linha completa do jogador

- **Onde:** `src/app/api/rankings/route.ts:14` (`jogador:Jogador(*, equipe:Equipe(...))`, rota pública, devolve o objeto no ranking). `src/app/equipes/[slug]/page.tsx:76,89` (`Equipe.select('*')` e `Jogador.select('*')` no servidor com cliente anon; qualquer campo que a página passe a componentes cliente vai no payload RSC). Não estava no diagnóstico.
- **Cenário:** `curl /api/rankings` devolve CPF, nascimento e telefone dos atletas votados como MVP; a página de uma equipe pública embute a linha completa dos atletas.
- **Correção exata:**
```ts
// rankings/route.ts
.select('jogadorId, jogador:Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl,equipe:Equipe(nome,corHex,categoriaCampeonatoId))')
// equipes/[slug]/page.tsx
supabaseAdmin.from('Jogador').select('id,nome,numero,posicao,fotoUrl,fotoRostoUrl').eq('equipeId', equipe.id).eq('banido', false)
// Equipe: 'id,nome,slug,categoria,logoUrl,corHex,ligaId'
```
- **Teste de regressão:** teste de contrato que percorre as rotas públicas (`/api/rankings`, `/api/equipes`, `/api/equipes/:id`, `/api/classificacao`, `/api/portal/*`, `/api/partidas`, `/api/ao-vivo`) e falha se a resposta JSON contiver qualquer chave da lista proibida (`cpf`, `documentoNumero`, `documentoTipo`, `dataNascimento`, `telefone`, `telefoneEmergencia`, `qrCodeToken`, `documentosUrls`, `senhaHash`, `email`, `organizadorId`).

### SEG-08 (Alto) Login: sem limite de tentativas, enumeração e token de admin no corpo

- **Onde:** `src/app/api/auth/route.ts`
  - `:64` e `:126`: `bcrypt.compare` sem contador, sem atraso, sem bloqueio por conta ou IP (admin, organizador, equipe, árbitro, quadra, público). Só o código de jogo do árbitro tem bloqueio.
  - `:43`: com `?admin=1` a resposta diz "Administrador não encontrado... existe na tabela Admin", o que confirma se um e-mail é admin. Os retornos 403 de `perfil` ("conta não é de organizador", "organizador entra com usuário atribuído") confirmam o perfil do e-mail antes de checar a senha.
  - `:132`: `success({ token, ... })` devolve o JWT do admin no JSON, anulando a proteção `httpOnly` (um XSS ou log de resposta captura o token). O JWT de admin também é aceito via `Authorization: Bearer` (`auth.ts`, `verifyToken`).
  - `:111,141,183`: `.ilike('email', email)` trata `%` e `_` como curinga (o `z.string().email()` aceita `_` e `%` no local part): com `limit(1)` pode selecionar a conta errada em colisões (não burla a senha, mas é falha lógica). Usar `.eq` com e-mail normalizado em minúsculas.
  - `:103`: `Erro ao autenticar: ${msg}` devolve mensagem interna.
- **Cenário:** credential stuffing e força bruta ilimitada contra `/api/auth`, principalmente contra senhas temporárias e contra a conta de admin.
- **Correção exata:** tabela de tentativas com limite por e-mail e por IP, resposta uniforme, sem token no corpo.
```sql
create table if not exists "LoginTentativa" (
  chave text primary key,            -- 'email:<sha256>' ou 'ip:<ip>'
  falhas int not null default 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table "LoginTentativa" enable row level security;
revoke all on "LoginTentativa" from anon, authenticated;

create or replace function public.login_registrar_falha(p_chave text, p_limite int, p_janela interval)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare r "LoginTentativa";
begin
  insert into "LoginTentativa"(chave, falhas) values (p_chave, 1)
  on conflict (chave) do update set
    falhas = case when "LoginTentativa".atualizado_em < now() - p_janela then 1 else "LoginTentativa".falhas + 1 end,
    atualizado_em = now()
  returning * into r;
  if r.falhas >= p_limite then
    update "LoginTentativa" set bloqueado_ate = now() + p_janela where chave = p_chave;
    return now() + p_janela;
  end if;
  return null;
end $$;
revoke all on function public.login_registrar_falha(text,int,interval) from public, anon, authenticated;
grant execute on function public.login_registrar_falha(text,int,interval) to service_role;
```
```ts
// src/app/api/auth/route.ts (esboço)
const chaveEmail = `email:${sha256(email)}`
const chaveIp = `ip:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido'}`
if (await estaBloqueado(chaveEmail) || await estaBloqueado(chaveIp)) return error('Muitas tentativas. Tente novamente em 15 minutos.', 429)
// em qualquer falha (conta inexistente, senha errada): login_registrar_falha(chaveEmail, 5, '15 minutes') e (chaveIp, 30, '15 minutes')
// resposta sempre: error('Credenciais inválidas.', 401)
// remover `token` do corpo: success({ admin: {...}, redirectTo: '/admin' })
```
  Alternativa mais simples para o primeiro corte: Upstash Ratelimit/Vercel KV no `middleware.ts` para `POST /api/auth`.
- **Teste de regressão:** 6 tentativas erradas seguidas para o mesmo e-mail retornam 429 na 6ª, e a 7ª com a senha certa também retorna 429 até o fim da janela; resposta idêntica (corpo e tempo aproximado) para e-mail inexistente e senha errada; `POST /api/auth` de admin não contém a chave `token` no JSON; `?admin=1` não revela se o e-mail existe.

### SEG-09 (Alto) XSS armazenado no painel admin por URL `javascript:`

- **Onde:** `src/app/admin/candidaturas/page.tsx:272` renderiza `<a href={file.url} target="_blank">` com URLs vindas dos cadastros: `diplomaUrl`, `fotosUrls`, `documentosUrls`, `fotoRostoUrl` (`:344-352`). Essas URLs entram por rotas públicas sem login (`api/candidaturas/arbitros`, `quadras`, `equipes`) validadas só com `z.string().url()` (`src/lib/schemas.ts:55,438,477,494`), e `new URL('javascript:alert(1)')` é válido para o Zod.
- **Cenário:** o atacante cadastra um árbitro com `diplomaUrl = "javascript:fetch('/api/admin/organizadores',{method:'PATCH',...})"`. Quando o admin abre a candidatura e clica em "Certificado", o script roda na origem do app com a sessão do admin: cria organizadores, redefine senhas, aprova candidaturas, lê dados pessoais.
- **Correção exata:** (a) validar esquema no servidor; (b) defesa na renderização.
```ts
// src/lib/schemas.ts
export const urlHttps = z.string().url().refine((v) => /^https:\/\//i.test(v), 'Use um link https.')
// trocar z.string().url() por urlHttps em diplomaUrl, emblemaUrl, logoUrl, capaUrl, fotoUrl, fotoRostoUrl, fotosUrls, documentosUrls, thumbUrl, url
// idealmente: refine que o host termina em .supabase.co e o caminho começa com /storage/v1/object/public/
```
```tsx
// admin/candidaturas/page.tsx
const seguro = /^https:\/\//i.test(file.url) ? file.url : '#'
<a href={seguro} target="_blank" rel="noopener noreferrer"> ...
```
  Varredura nos dados existentes: consulta 7 da seção 4.
- **Teste de regressão:** teste de unidade do schema: `javascript:`, `data:`, `http:` e `//host` são rejeitados; E2E (Playwright) com candidatura cujo link é `javascript:window.__xss=1`: o link no admin não deve executar e `window.__xss` permanece indefinido.

### SEG-10 (Alto) `organizador/quadras`: leitura e aprovação sem escopo

- **Onde:** `src/app/api/organizador/quadras/route.ts:20-25` (GET lista **todos** os `CandidaturaQuadra` com e-mail, telefone, instagram, endereço) e `:40-46` (PATCH `APROVAR`/`REMOVER` qualquer `id`, sem vínculo com o organizador). Qualquer organizador liberado vira operador global.
- **Cenário:** organizador A aprova ou rejeita fornecedores de qualquer outro e exporta a lista de contatos de todos. Se a aprovação de fornecedor é do admin (o `admin/candidaturas/[id]/aprovar` já cobre `quadra`), é escalação de privilégio horizontal.
- **Correção exata:** mover a mutação para admin e limitar as colunas no GET.
```ts
// route.ts
.select('id,nome,estrutura,bairro,fotosUrls,status') // sem e-mail/telefone/instagram para o organizador
// PATCH: remover a rota ou exigir requireAuth (admin) em vez de requirePublicRole(['organizador'])
```
- **Teste de regressão:** com sessão de organizador, `PATCH /api/organizador/quadras` responde 403; `GET` não traz `email` nem `telefone`.

### SEG-11 (Alto, LGPD) Dados de menores sem consentimento, retenção ou exclusão

- **Onde:** `prisma/schema.prisma:214-240` e `src/lib/schemas.ts:484-500` coletam CPF, documento, nascimento, telefones e **fotos de rosto/documentos** (inclusive de menores). Busca por `consentimento|responsavelLegal|lgpd|retencao|aceite` em schema e migrations: **zero resultados**. Não há campo de base legal, de aceite do responsável pelo menor, de data de coleta, de política de retenção, nem rota de exclusão ou exportação do titular (`DELETE` só existe para organizador/capitão remover atleta, e não apaga os arquivos do storage). Soma com SEG-01/02 (exposição pública).
- **Cenário:** incidente com dados de menores sem consentimento do responsável é infração à LGPD (art. 14, tratamento de dados de crianças e adolescentes) e gera obrigação de comunicação à ANPD; sem trilha de consentimento não há como provar a base legal.
- **Correção exata:**
```sql
alter table "Jogador"
  add column if not exists "menorDeIdade" boolean generated always as (
    "dataNascimento" is not null and "dataNascimento" > (current_date - interval '18 years')
  ) stored,
  add column if not exists "consentimentoEm" timestamptz,
  add column if not exists "consentimentoPorNome" text,
  add column if not exists "consentimentoPorDocumentoHash" text, -- hash, nunca o documento
  add column if not exists "consentimentoVersaoTermo" text,
  add column if not exists "anonimizadoEm" timestamptz;
-- regra: menor sem consentimentoEm não pode ser escalado em súmula nem ter dado exibido
```
  Fluxo: no cadastro do atleta (`inscricao-rapida` e `capitao`), calcular a idade no servidor; se menor, exigir nome e aceite do responsável e gravar a versão do termo; bloquear `finalizar` sem isso. Política de retenção (ex.: anonimizar documentos e telefones 12 meses após o fim do campeonato) como rotina agendada; rota de exclusão/anonimização por solicitação do titular que também remova os objetos do storage; registrar o encarregado (DPO) e o aviso de privacidade em `politica-de-privacidade`. A coluna gerada com `current_date` não é imutável no Postgres e será recusada; usar uma view ou calcular no servidor (ajuste a validar pelo `banco-de-dados`).
- **Teste de regressão:** unidade da regra de idade (17 anos e 364 dias = menor); `POST` de atleta menor sem consentimento retorna 422; rotina de anonimização zera `cpf`, `documentoNumero`, `telefone*`, `documentosUrls` e remove os arquivos; teste confirma que o arquivo deixa de existir no bucket.

### SEG-12 (Médio) Respostas públicas com `Equipe(*)` e `Liga(*)`

- **Onde:** `src/app/api/equipes/route.ts:21,40` (`Equipe(*, liga:Liga(*))`, sem filtro de status da liga e sem sessão), `equipes/[id]/route.ts:10-14` (id numérico sequencial), `classificacao/route.ts:16` (`Equipe(*)`), `ligas/[slug]/route.ts:12-16` (`select('*')` com service role: ignora RLS e devolve campeonatos não publicados e de teste), `ligas/route.ts:27-31` (`Liga(*)` na lista pública), `categorias/route.ts:18` (por `ligaId`, sem filtro de publicação).
- **Dados expostos:** `organizadorId` (id interno de conta), configuração de pagamento/regras, `quadraInfo`, `lider`, `tecnico`, `diasDisponiveis`, ligas `EM_BREVE` e de teste. Enumeração por id sequencial (IDOR de leitura).
- **Correção exata:** listas de colunas por contexto e filtro por status publicável.
```ts
const EQUIPE_PUBLICA = 'id,nome,slug,categoria,categoriaCampeonatoId,logoUrl,corHex,ligaId'
const LIGA_PUBLICA   = 'id,nome,nomeCurto,slug,status,subtitulo,descricao,logoUrl,capaUrl,dataInicio,dataFim,formato,categoriasConfig'
// ligas/[slug]: .in('status', ['EM_BREVE','ATIVA','ENCERRADA','FINALIZADO']).eq('simulacao', false)
// categorias: validar que a liga é pública antes de listar
```
  O painel do organizador usa rotas próprias já autenticadas (`api/organizador/*`), que continuam com `*`.
- **Teste de regressão:** o teste de contrato do SEG-07 cobre estas rotas; adicionar caso "liga com `simulacao=true` ou fora dos status públicos retorna 404 para anônimo".

### SEG-13 (Médio) Súmula lida por id sequencial; `sumulaToken` previsível

- **Onde:** `src/lib/sumula-access.ts:14-16` e `src/lib/arbitro-access.ts:44-46,73-75` aceitam `/^\d+$/` como `Partida.id`. `GET /api/sumula/<id>?consulta=1` (`api/sumula/[token]/route.ts:28-30`) devolve **sem autenticação** elenco (nome, número, posição), presenças, escala (nome do árbitro) e ocorrências de qualquer partida. Além disso, as partidas geradas pelo sistema recebem token determinístico: `luv-<ligaId>-g<grupo>-r<n>-<equipeA>-<equipeB>` (`organizador/ligas/[id]/estrutura/route.ts:407`, `mata-mata/route.ts:150`, `championship-operations.ts:190`), adivinhável por quem conhece ids de equipe. A escrita continua protegida (exige árbitro escalado ou sessão de link com código), então o impacto é de **privacidade/enumeração**, não de adulteração.
- **Cenário:** loop de 1 a N em `/api/sumula/<n>?consulta=1` colhe nomes de atletas (possivelmente menores) e escalas de árbitros de todos os campeonatos, inclusive os ocultos/de teste (o ao-vivo esconde teste, a súmula por id não).
- **Correção exata:**
```ts
// sumula-access.ts: remover o ramo numérico dos três pontos; links internos usam sumulaToken
// gerar sumulaToken sempre com crypto.randomUUID() (trocar os três geradores 'luv-...')
```
```sql
-- migration de rotação: tokens determinísticos viram aleatórios
update "Partida" set "sumulaToken" = gen_random_uuid()::text where "sumulaToken" like 'luv-%';
-- avisar organizadores: links já impressos/compartilhados deixam de valer
```
  O portal público (que hoje usa o id) passa a usar `/partidas/[id]/ao-vivo` (já público por desenho e filtrado por campeonato de teste), não a súmula.
- **Teste de regressão:** `GET /api/sumula/1?consulta=1` retorna 404; token `luv-1-g1-r1-2-3` retorna 404; `sumulaToken` de partida criada tem formato UUID; `/api/sumula/<uuid>?consulta=1` de campeonato de teste retorna 404 para anônimo.

### SEG-14 (Médio) Código de acesso do árbitro: bloqueio de tentativas burlável por concorrência

- **Onde:** `src/app/api/arbitro/jogo/[token]/route.ts:46-61`. A rota lê `tentativasFalhas` (`carregar`), compara o código e grava `tentativasFalhas + 1` num `update` separado. Várias requisições simultâneas leem o mesmo valor e todas passam pelo `bcrypt.compare` antes de qualquer bloqueio. O código tem mínimo de 4 caracteres (`acesso-arbitro-jogo.ts:53`), então um PIN numérico de 4 dígitos (10 mil combinações) pode cair com rajadas paralelas. (Ressalva: o atacante precisa do link, 32 hex, que o organizador envia ao árbitro.) Efeito colateral: quem tem o link pode travar o árbitro por 15 min de propósito.
- **Correção exata:** incremento atômico no banco e mínimo maior.
```sql
create or replace function public.arbitro_registrar_falha(p_acesso uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare ate timestamptz;
begin
  update "AcessoArbitroJogo"
     set "tentativasFalhas" = "tentativasFalhas" + 1,
         "bloqueadoAte" = case when "tentativasFalhas" + 1 >= 5 then now() + interval '15 minutes' else "bloqueadoAte" end
   where id = p_acesso
   returning "bloqueadoAte" into ate;
  return ate;
end $$;
revoke all on function public.arbitro_registrar_falha(uuid) from public, anon, authenticated;
grant execute on function public.arbitro_registrar_falha(uuid) to service_role;
```
  Código: chamar a RPC (operação atômica) e rechecar o bloqueio depois; subir o mínimo do código para 6 caracteres alfanuméricos ou gerar o código no servidor; atraso fixo de cerca de 300 ms na resposta errada. (Ajustar o tipo de `p_acesso` ao tipo real de `AcessoArbitroJogo.id`.)
- **Teste de regressão:** teste de concorrência: 50 `POST` paralelos com código errado resultam em no máximo 5 respostas 401 e as demais 429; contador final igual a 5.

### SEG-15 (Médio) Redefinição de senha

- **Onde e problemas:**
  1. Só existe para `Admin` (`api/auth/forgot-password/route.ts:20`, `reset-password/route.ts:23`). Organizador, árbitro, equipe e público não têm fluxo; o suporte entrega senha temporária por tela do admin (`admin/candidaturas/[id]/reenviar/route.ts`, a resposta devolve a senha ao admin, aceitável se vista uma vez, mas sem e-mail ao titular).
  2. Ambas as rotas usam o cliente **anon** (`import { supabase }`, `forgot-password:3`, `reset-password:4`) para ler e atualizar `Admin`. Com `Admin` com RLS ligada e sem policy (`rls-producao:21`) elas falham silenciosamente (o fluxo parece funcionar: resposta genérica). Se, ao contrário, `Admin` estiver sem RLS, o anon lê `senhaHash` e troca a senha do admin diretamente. Nos dois casos está errado.
  3. O token de reset embute `senhaHash` no payload do JWT (`forgot-password:30`): o payload do JWT é legível (base64), então o hash bcrypt do admin vai no e-mail e nos logs de URL.
  4. O link usa `process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin` (`:32`): sem a variável, depende do cabeçalho `Host` (envenenamento do link).
  5. O token de reset (`{purpose, adminId, email, senhaHash}`, sem `scope`) **passa em `isAdminSession`** (`admin-access.ts:18-23` só exige `adminId` e e-mail permitido) e portanto é aceito como sessão de admin por `verifyToken` e por `middleware.ts:62-66` durante 30 min.
  6. Sem limite de pedidos de reset (e-mail em massa ao admin).
- **Correção exata:** tabela de tokens de uso único, hash do token em repouso, cliente service role, `scope` verificado em `verifyToken`.
```sql
create table if not exists "SenhaResetToken" (
  id uuid primary key default gen_random_uuid(),
  "contaTipo" text not null,            -- 'admin' | 'organizador' | 'arbitro' | 'equipe'
  "contaId" text not null,
  "tokenHash" text not null unique,     -- sha256 do token enviado
  "expiraEm" timestamptz not null,
  "usadoEm" timestamptz,
  "criadoEm" timestamptz not null default now()
);
alter table "SenhaResetToken" enable row level security;
revoke all on "SenhaResetToken" from anon, authenticated;
```
```ts
// auth.ts: sessão de admin exige scope explícito e rejeita tokens com purpose
export async function signToken(payload: JWTPayload) {
  return new SignJWT({ ...payload, scope: 'admin' }) /* ... */
}
// verifyToken e middleware: if (payload.scope !== 'admin' || payload.purpose) return null
// forgot-password: token = randomBytes(32).toString('base64url'); gravar sha256; base URL só de NEXT_PUBLIC_APP_URL (falhar se ausente)
// reset-password: buscar por sha256(token), checar expiraEm e usadoEm, marcar usadoEm na mesma transação, trocar senha, invalidar sessões (SEG-19)
// aplicar o mesmo fluxo para organizador/árbitro/equipe, resposta sempre genérica e com rate limit (SEG-08)
```
- **Teste de regressão:** token de reset enviado como `Authorization: Bearer` em `/api/admin/organizadores` retorna 401 e `/admin` redireciona ao login; token usado duas vezes na segunda retorna 400; token expirado retorna 400; o e-mail não contém hash; sem `NEXT_PUBLIC_APP_URL` a rota falha em vez de usar `Host`.

### SEG-16 (Médio) Sem rate limit/CAPTCHA em endpoints públicos

- **Onde:** nenhuma ocorrência de rate limit, captcha ou turnstile no repositório. Endpoints públicos que gravam, criam conta, geram hash bcrypt (CPU) ou enviam e-mail: `api/candidaturas/{equipes,arbitros,quadras,organizadores,publico}`, `api/inscricao-rapida` (cria rascunho), `inscricao-rapida/[token]/*`, `api/interessados`, `api/auth`, `auth/forgot-password`. `convites-equipe` envia e-mail com texto livre (`mensagem`, escapado em HTML) para qualquer endereço usando a conta do organizador: relé de spam com o domínio da plataforma.
- **Cenário:** inundar a base de cadastros (`CandidaturaEquipe` já nasce `ATIVA`, `candidaturas/equipes/route.ts:63`, com sessão emitida) e a fila de aprovação do admin; criar milhares de rascunhos/equipes `APROVADA` por meio de um link de categoria vazado (`finalizar_inscricao_equipe_rascunho` não limita por IP); esgotar a cota do provedor de e-mail; DoS por bcrypt.
- **Correção exata:** limitador no `middleware.ts` (ou Vercel Firewall/Upstash) por IP e por rota, mais Turnstile nos formulários públicos.
```ts
// middleware.ts (esboço com Upstash)
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
const limites: Record<string, Ratelimit> = {
  '/api/auth': new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, '10 m') }),
  '/api/candidaturas': new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, '1 h') }),
  '/api/inscricao-rapida': new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(30, '10 m') }),
  '/api/interessados': new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, '1 h') }),
}
// incluir '/api/:path*' no matcher e responder 429 com Retry-After
```
  Também: limite de convites por organizador por dia; teto de equipes por link de categoria (`quantidadeEquipes` já existe; validar dentro da RPC de finalização).
- **Teste de regressão:** 11ª chamada a `/api/auth` em 10 min retorna 429; 6º `POST /api/candidaturas/arbitros` do mesmo IP em 1 h retorna 429; convite 51 do dia retorna 429.

### SEG-17 (Médio) Cabeçalhos de segurança ausentes

- **Onde:** `next.config.mjs` não define `headers()`. Sem CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS explícito nem `frame-ancestors`. `layout.tsx:95` tem script que detecta iframe (`painel-embed`), então há uso embutido; defina quais origens podem embutir. O middleware só põe `X-Robots-Tag`. O middleware também **não protege** `/painel`, `/capitao`, `/sumula/*/lancar`; elas dependem de verificação no cliente (`localStorage luva_session`) e de cada API (as APIs conferem, então o dado fica protegido, mas a casca da página é servida a qualquer um).
- **Correção exata:**
```js
// next.config.mjs
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",               // remover 'unsafe-inline' com nonce quando possível
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join('; ')
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
    ] }]
  },
  // ...restante da config atual
}
```
  Para páginas autenticadas, validar a sessão no `middleware` (cookie `luva_token` com `jwtVerify` e `tipo` esperado) e redirecionar a `/login` antes de servir `/painel` e `/capitao`.
- **Teste de regressão:** teste que faz `fetch` à home e a `/api/ping` e confere a presença e o valor de cada cabeçalho; E2E: acessar `/painel` sem cookie redireciona para `/login`.

### SEG-18 (Médio, verificar) Funções `SECURITY DEFINER` e `revoke`

- **Onde:** as migrations `2026...` fazem `revoke all ... from public, anon, authenticated` e `grant ... to service_role` (correto). Mas versões antigas de `recalcular_classificacao_liga` (`supabase-parametrizacao-campeonato.sql:225-228`, `supabase-fix-pontuacao-classificacao.sql`, `supabase-fix-classificacao-exclui-mata-mata.sql`, `supabase-recalcular-classificacao-liga-atomico.sql`) e `finalizar_inscricao_equipe_rascunho` (`supabase-inscricao-equipe-rascunho.sql:88-236`) são `SECURITY DEFINER` e dependem do `revoke` que vem em arquivo separado. `create or replace` preserva o ACL já existente, então o resultado depende da ordem: se um arquivo antigo for aplicado **depois** do novo em banco limpo, ou se a função for recriada com `drop`, o `PUBLIC` volta a ter `EXECUTE` e o `anon` pode chamar `POST /rest/v1/rpc/...` (ex.: forçar recálculo de classificação de qualquer liga; as funções de criação de formulário recebem `p_organizador_id` por parâmetro e confiariam no chamador). O default do Supabase também concede `EXECUTE` a `anon`.
- **Correção exata:** bloco geral já incluído na migration do SEG-05 (`revoke execute on all functions ... from public, anon, authenticated` e `alter default privileges`). Reaplicar após **toda** migration de função. Padronizar um baseline único (diagnóstico 4.1.2).
- **Teste de regressão:** consulta 4 da seção 4 deve retornar zero linhas com `anon_exec = true`; no CI, `has_function_privilege('anon', oid, 'execute')` falso para todas as funções do schema `public`.

### SEG-19 (Médio) JWT e sessão

- **Onde:** `src/lib/auth.ts:9-12` (`getSecret`) só checa existência de `JWT_SECRET`: `.env.example` traz o valor de exemplo `troque-por-uma-string-segura-de-32-chars`; se alguém copiar o exemplo para produção, qualquer pessoa forja sessão de admin. O mesmo segredo assina sessão, reset, ativação e cookie do árbitro (`acesso-arbitro-jogo.ts:32-36`). Expiração fixa de 8 h sem revogação: `DELETE /api/auth` só limpa o cookie; trocar senha ou revogar organizador não derruba sessões existentes; a sessão de organizador mantém `status` e `trocarSenha` congelados no token (um organizador rejeitado continua autorizado até 8 h). O cookie `luva_token` é `httpOnly`, `secure` em produção, `sameSite=lax` (adequado); falta prefixo `__Host-`. `Authorization: Bearer` é aceito em paralelo ao cookie. Não há proteção CSRF explícita além de `SameSite=Lax` (as rotas aceitam `req.json()` sem checar `Content-Type` nem `Origin`).
- **Correção exata:**
```ts
function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32 || /troque-por|exemplo|changeme/i.test(secret)) {
    throw new Error('JWT_SECRET ausente ou fraco')
  }
  return new TextEncoder().encode(secret)
}
// chaves derivadas por finalidade: HKDF(JWT_SECRET, 'sessao' | 'reset' | 'arbitro')
// sessões: claim `jti` + tabela "SessaoRevogada" ou campo "sessaoVersao" na conta; comparar a cada requisição crítica
// middleware: rejeitar POST/PUT/PATCH/DELETE com Origin diferente do host (proteção CSRF)
```
- **Teste de regressão:** subir a aplicação com `JWT_SECRET` curto ou igual ao exemplo falha; token de organizador com `jti` revogado recebe 401; `POST /api/organizador/...` com `Origin: https://evil.example` recebe 403.

### SEG-20 (Baixo) Validação de URL de mídia

- **Onde:** `api/galeria/route.ts:9-14,45-46` e `organizador/ligas/[id]/galeria/[midiaId]/route.ts:6-12` verificam só se a URL **contém** a substring `/galeria-campeonato/ligas/<id>/`. `https://evil.example/x?/galeria-campeonato/ligas/5/a.png` passa e fica gravada em `Midia.url` e pode virar `capaUrl` da liga (conteúdo externo na vitrine, rastreador). O prefixo do caminho de storage é sempre derivado do `ligaId` próprio, então não há exclusão de arquivo de outro campeonato. As demais URLs (`logoUrl`, `capaUrl`, `fotoUrl`...) usam `z.string().url()` (ver SEG-09).
- **Correção:** validar `new URL(url).host` contra o host do Supabase e `pathname.startsWith('/storage/v1/object/public/galeria-campeonato/ligas/<id>/')`.
- **Teste:** `url` com host externo ou com a substring só na query retorna 422.

### SEG-21 (Baixo) Vazamento de detalhes de erro

- **Onde:** `api/auth/route.ts:103` (`Erro ao autenticar: ${msg}`), `api/ligas/route.ts` (`error('Erro ao buscar campeonatos', 500, err.message)`), `organizador/quadras:25,48`, `organizador/perfil:49`, `classificacao/manual`, `pagamento/confirmar:34`, `inscricao-rapida/*` (`errorDetail(err)` devolvido ao cliente), `candidaturas/[tipo]/[id]:53,106`, `api/ping/route.ts:13-27` (público: URL do projeto Supabase, alvo, contagem de equipes e mensagem de erro do banco). Revela nomes de tabela, colunas e restrições.
- **Correção:** devolver mensagem genérica com `requestId`, registrar o detalhe só no log do servidor; reduzir `/api/ping` a `{ok:true}` (detalhe só com token de monitoramento).
- **Teste:** forçar um erro de banco e verificar que o corpo não contém o texto do erro original; `/api/ping` não contém `url` nem `equipes`.

### SEG-22 (Baixo) Webhook InfinitePay

- **Onde:** `api/webhooks/infinitepay/route.ts` e `lib/infinitepay.ts:59-77`. Sem `INFINITEPAY_WEBHOOK_SECRET`, a validação passa quando `NODE_ENV !== 'production'` (execução local/CI aceita qualquer corpo). `timingSafeEqual` lança exceção se os tamanhos diferem (resposta 500). Não confere `amount` contra o valor esperado, não é idempotente (replay reexecuta), usa cliente **anon** para criar `Equipe` e atualizar `Pagamento` (depende de RLS permissiva, ver SEG-05), e `external_id` vem do corpo. Fluxo é legado (equipe por candidatura paga).
- **Correção:** segredo obrigatório (falha fechada), comparar com comprimento igual, checar `amount`, tabela de eventos com `payload.id` único, usar service role.
```ts
if (!webhookSecret) return false // sem exceção por ambiente
const a = Buffer.from(signature, 'hex'), b = Buffer.from(expected, 'hex')
return a.length === b.length && timingSafeEqual(a, b)
```
- **Teste:** sem segredo, qualquer chamada retorna 401; assinatura de tamanho diferente retorna 401 (não 500); o mesmo `payload.id` duas vezes só processa uma.

### SEG-23 (Baixo) Cadastro sem verificação de e-mail

- **Onde:** `api/candidaturas/{equipes,arbitros,quadras,publico}` criam a conta e `equipes` já emite sessão `ATIVA` (`equipes/route.ts:63,114`). `findCadastroDuplicate` bloqueia o e-mail se existir. Qualquer um cadastra o e-mail de outra pessoa e impede o cadastro real (ocupação de e-mail) ou recebe convites destinados a ela. Senha com mínimo de 8 sem checagem de força.
- **Correção:** estado `EMAIL_PENDENTE` até clicar em link de verificação (token de uso único, ver SEG-15), só então `ATIVA`; checar senhas contra lista de comuns.
- **Teste:** conta recém-criada não consegue chamar `/api/capitao/*` até verificar o e-mail.

### SEG-24 (Baixo) `ativar-conta` emite sessão sem passar por troca de senha

- **Onde:** `src/app/api/auth/ativar-conta/route.ts:38-44` assina sessão de organizador com o `status` do banco e **sem** `trocarSenha`; o link (`signAccountActivationToken`, 24 h, reutilizável) não é emitido por nenhum código atual (só definido em `auth.ts`), portanto é código morto exposto como endpoint.
- **Correção:** remover a rota e a função, ou, se for reaproveitar, tornar o token de uso único e herdar `trocarSenha` da conta.
- **Teste:** a rota não existe (404).

### SEG-25 (Info) Verificado e correto

- Todas as rotas de escrita de campeonato usam `exigirOrganizadorDaLiga/Equipe/Jogador/Partida`, `requireOwnedLigaForSetup`, `ligaDoOrganizador`, `partidaDoOrganizador` ou comparação `liga.organizadorId === auth.userId`: `equipes`, `jogadores`, `partidas` (POST, PUT e `aprovar`), `galeria` (POST e DELETE), `links-categoria`, `link-inscricao`, `vagas-inscricao`, `categoria-inicial`, `estrutura`, `calendario`, `mata-mata`, `finalizar`, `pagamento`, `setup/*`, `acesso-arbitro`, `classificacao/manual`, `resultados-manuais`, `inscricoes-campeonato` (PATCH), `convites-equipe`. Capitão: `playerBelongsToTeam` + `.eq('equipeId', ...)`. `candidaturas/[tipo]/[id]`: `auth.userId === id`. Todas as rotas `api/admin/*` e `mensagens` (POST/PUT/DELETE) exigem `requireAuth`.
- Escrita da súmula exige link ativo com sessão de código, ou sessão de árbitro liberado **e** escalado; valida atletas pertencentes às duas equipes, MVP da vencedora, placar pelas regras. Súmula oficializada não reabre.
- Convites de rascunho: UUID v4 (122 bits); tokens de categoria, campeonato, vaga e acesso do árbitro: `randomBytes(16)` (128 bits). QR do atleta: UUID sem hífens, endpoint público devolve só nome e foto. Cookie de sessão `httpOnly`, `secure`, `sameSite=lax`. E-mails escapam HTML (`email.ts`, `escapeHtml`). Sem `eval`; os dois `dangerouslySetInnerHTML` (`layout.tsx:91,95`) são JSON-LD escapado e script estático. Redirecionamento pós-login só aceita caminhos `/admin` (`login-screen.tsx:49-50`, `middleware.ts:29`), sem open redirect. `.env` fora do git (`.gitignore`); nenhum segredo real foi encontrado em arquivo versionado além da credencial legada do SEG-04. A chave `service_role` só aparece em `supabase-admin.ts` (servidor). Bloqueio de 5 tentativas e 15 min do código do árbitro existe (só falha na concorrência, SEG-14).
- Tokens demo `token-demo-1-luva2026` (`sumula/[token]/route.ts:11`) retornam dados fictícios sem gravar: baixo risco; remover na saída para produção.

---

## 4. Consultas de verificação do banco (somente leitura)

Rodar no SQL Editor do Supabase, primeiro no projeto de desenvolvimento. Elas dizem o estado efetivo que o SQL versionado não consegue provar.

```sql
-- 1) Tabelas sem RLS (qualquer linha aqui com dado sensível = crítico)
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by rowsecurity, tablename;

-- 2) Políticas efetivas de public e storage
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage') order by schemaname, tablename, cmd;

-- 3) Grants para anon/authenticated em tabelas
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
group by 1,2 order by 1,2;

-- 4) Funções SECURITY DEFINER executáveis por anon
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef order by 2 desc, 1;

-- 5) Buckets e seus limites
select id, public, file_size_limit, allowed_mime_types from storage.buckets;

-- 6) Admin: quantas linhas e se a conta legada existe (não imprimir hash)
select id, email, "criadoEm" from "Admin" order by id;

-- 7) URLs com esquema perigoso já gravadas (SEG-09)
select 'arbitro' as t, id::text from "CandidaturaArbitro" where "diplomaUrl" is not null and "diplomaUrl" <> '' and "diplomaUrl" !~* '^https://'
union all select 'jogador', id::text from "Jogador" where "fotoRostoUrl" is not null and "fotoRostoUrl" <> '' and "fotoRostoUrl" !~* '^https://';
```

Também executar o Security Advisor do Supabase no painel e registrar o resultado.

## 5. Ordem de correção

### P0, nesta semana, na ordem (bloqueiam a publicação)
1. **SEG-04** Rotacionar/apagar a conta de admin legada; tornar `ADMIN_EMAIL` obrigatório; limpar README/COMO-TESTAR/`setup-db.mjs`. (horas)
2. **Seção 4** Rodar as consultas de verificação e anotar o estado real (decide a urgência de 3 a 6). (1 h)
3. **SEG-06 e SEG-07 (código)** Remover leitura anônima de `Jogador(*)` em `api/jogadores`, `api/rankings`, `equipes/[slug]/page.tsx`; trocar os usos do cliente anon nas rotas listadas no SEG-05 por `supabaseAdmin` com colunas explícitas. Pré-requisito do fechamento do banco.
4. **SEG-01, SEG-03, SEG-05 (SQL)** Fechar RLS e grants (migrations 0001, 0003, 0004), com a view `jogador_publico` para a vitrine.
5. **SEG-02** Fechar o storage (documentos em bucket privado, upload por URL assinada, sem `update` anônimo).
6. **SEG-09** Validar URLs `https` no schema e na renderização; varrer dados existentes.

### P1, próximas duas semanas
7. **SEG-08** Rate limit e bloqueio no login; resposta uniforme; remover `token` do corpo.
8. **SEG-15** Reset de senha com token de uso único para todos os perfis; `scope: 'admin'` em `verifyToken` e no middleware.
9. **SEG-10** Fechar `organizador/quadras`.
10. **SEG-13** Remover leitura de súmula por id; tokens aleatórios e rotação.
11. **SEG-11** Consentimento do responsável e política de retenção para menores (começar pelo modelo de dados e pelo bloqueio no cadastro).
12. **SEG-16** Rate limit/CAPTCHA nos endpoints públicos; teto de equipes por link.
13. **SEG-12** Colunas explícitas e filtro de status nas rotas públicas de equipe/liga/categoria.

### P2, próximo mês
14. **SEG-14** Contador atômico do código do árbitro. 15. **SEG-17** CSP e cabeçalhos, middleware para `/painel` e `/capitao`. 16. **SEG-19** Validação do `JWT_SECRET`, segredos por finalidade, revogação de sessão, checagem de `Origin`. 17. **SEG-18** Baseline único de migrations com `revoke` padrão e CI com a bateria da seção 4.

### P3, backlog
18. **SEG-20 a SEG-24** (validação de mídia, erros genéricos e `/api/ping`, webhook, verificação de e-mail, remover `ativar-conta`).

## 6. Suíte de regressão sugerida (resumo)

Criar `scripts/seguranca/*.test.ts` (ou Playwright API) rodando contra o Supabase local, e incluir no CI (`docs/analise/18-ambiente-local-e-ci.md`):
- `anon-nao-le-pii.test.ts`: chave anon em todas as tabelas privadas e em `Jogador` (SEG-01/03/05).
- `anon-nao-escreve.test.ts`: `insert/update/delete` anon em todas as tabelas e buckets (SEG-02/05).
- `contrato-respostas-publicas.test.ts`: lista de chaves proibidas em todas as rotas públicas (SEG-06/07/12).
- `isolamento-organizador.test.ts`: organizador A contra recursos de B em cada rota de escrita e leitura (SEG-10 e regressão do SEG-25).
- `login-bloqueio.test.ts` e `acesso-arbitro-concorrencia.test.ts` (SEG-08/14).
- `urls-seguras.test.ts` e `reset-token.test.ts` (SEG-09/15).
- Varredura de segredos (gitleaks) e `git grep` das credenciais legadas no pre-commit (SEG-04).
