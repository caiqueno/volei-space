# volei.space

Plataforma SaaS de campeonatos de vôlei de quadra: inscrição de equipes pelo Meu Time (ou por link de categoria), tabela, súmula digital, classificação e portal público. Atende vários organizadores independentes. `Liga`, `ligaId` e LUVA são nomes legados do código e não definem a identidade do produto. O produto é **só vôlei de quadra**.

## Antes de mexer no código

Leia `CLAUDE.md` e a nota do módulo em `volei.space — Plataforma de Campeonatos de Vôlei/`. Os relatórios de análise e o plano de evolução estão em `docs/analise/`.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (Postgres, Storage), Prisma (apenas tipos e validação), JWT com cookie httpOnly (`jose`), Zod.

## Início rápido (ambiente de desenvolvimento)

> **Segurança, leia primeiro.** Nunca use o banco nem as chaves de produção em desenvolvimento. As chaves ficam **só** no `.env.local` (que o Git ignora): não cole em chat, issue, print ou commit. A trava em `src/lib/supabase-env.ts` recusa combinar o alvo errado, e `SUPABASE_HOSTS_PROIBIDOS` deve conter o endereço do projeto de produção.

**Pré-requisitos:** Node.js 22 ou superior (`.nvmrc` indica 22, a versão da Vercel; um Node mais novo funciona com aviso), Git e o acesso ao projeto Supabase de **desenvolvimento** (ver "Decisão sobre o Docker" abaixo).

1. **Clone e prepare** (cerca de 3 a 5 minutos, quase tudo é o download das dependências):

   ```bash
   git clone <endereço do repositório> volei-space
   cd volei-space
   git checkout cursor-teste
   npm run setup          # confere o Node, instala as dependências, cria o .env.local e gera o Prisma Client
   ```

2. **Preencha o `.env.local`** com os valores do projeto Supabase de **DESENVOLVIMENTO** (URL, chaves, `DATABASE_URL`, `DIRECT_URL`, `ADMIN_EMAIL`, segredos de sessão). O `.env.example` explica cada variável. Peça os valores ao dono do projeto; nunca copie de produção.

3. **Banco de desenvolvimento.** Se o projeto de dev já foi preparado (é o caso do projeto do dono), pule este passo. Num projeto novo e vazio:
   - Aplique, nesta ordem, o schema base (ver `docs/analise/22-baseline-e-aplicacao.md`; ele **ainda não está versionado**, então um projeto vazio ainda não sobe sozinho), as migrations da pasta `supabase/migrations/` e depois as **pendentes** de `supabase/pendentes/migrations/` na ordem de `docs/analise/16-plano-aplicacao-migrations.md`, **sem a 0038** (redundante) e lendo o cabeçalho de cada uma (a 0022 é destrutiva). Uma por vez, no SQL Editor do projeto de **desenvolvimento**.
   - Dados de exemplo (opcional, todos inventados): cole `supabase/seed.sql` no SQL Editor. Ele cria 1 liga pública com 2 categorias, 6 equipes, 48 jogadores e 6 jogos, e pode ser repetido sem duplicar nada.

4. **Crie o administrador** (não há credencial padrão). Gere o hash bcrypt da senha no seu terminal (não compartilhe a senha) e insira no SQL Editor do dev, com o mesmo e-mail do `ADMIN_EMAIL`:

   ```bash
   node -e "require('bcryptjs').hash('SUA-SENHA-FORTE',12).then(h=>console.log(h))"
   ```

   ```sql
   insert into public."Admin" (email, "senhaHash", nome)
   values ('SEU-EMAIL@exemplo.com', 'COLE-O-HASH-AQUI', 'Administrador');
   ```

   Passo a passo completo: `docs/ROTEIRO-TESTE-LOCAL.md`, seção 0.4.

5. **Ligue as flags** que quiser testar, no `.env.local` (valor exato `1`) e reinicie o servidor; as variáveis `NEXT_PUBLIC_*` exigem reinício (ou novo build). Tudo nasce desligado:

   | Módulo | Flag de servidor |
   |---|---|
   | Meu Time (base e fase 2) | `MEU_TIME_ATIVO`, `MEU_TIME_FASE2_ATIVO` |
   | Inscrição: solicitação e aprovação; entrada pelo link | `INSCRICAO_SOLICITACAO_ATIVO`, `INSCRICAO_VIA_MEU_TIME_ATIVO` |
   | App de banco e banco pela conta | `BANCO_APP_ATIVO`, `BANCO_SESSAO_ATIVO` |
   | Desafio de vídeo e placar ao vivo | `DESAFIO_ATIVO`, `AO_VIVO_ATIVO` |
   | Súmula por eventos e offline-first | `SUMULA_EVENTOS_ATIVO` |
   | Login sem senha | `LOGIN_SEM_SENHA_ATIVO`, `GOOGLE_LOGIN_ATIVO` |
   | Elenco completo | `ELENCO_COMPLETO_ATIVO` |
   | Painel de inscrições e explorar competições | `PAINEL_INSCRICOES_ATIVO`, `EXPLORAR_COMPETICOES_ATIVO` |
   | Notificações por vários canais | `NOTIFICACOES_MULTICANAL_ATIVO` |

   As flags de tela (`NEXT_PUBLIC_*`), as dependências entre módulos e as chaves obrigatórias (por exemplo `LGPD_CHAVE_CIFRA`) estão em `docs/COMO-TESTAR.md`.

6. **Suba o servidor:**

   ```bash
   npm run dev            # http://localhost:3000
   ```

**Quanto tempo leva.** Com o projeto de dev já pronto e os valores do `.env.local` em mãos, um novato chega à página inicial em cerca de 10 a 12 minutos (clone e `npm run setup`: 3 a 5; `.env.local`: 2; `npm run dev` e primeira compilação: 1 a 2). Criar o administrador soma mais 2 a 3 minutos. **Subir um projeto Supabase novo do zero não cabe em 15 minutos** e hoje depende do schema base não versionado (ver o passo 3).

### Decisão sobre o Docker (`docker-compose.yml` não existe de propósito)

O plano original previa um `docker-compose.yml`. O dono decidiu **não criar**: o app não fala com um Postgres puro, fala com a API do Supabase (PostgREST, Auth, Storage, Realtime), então um contêiner de Postgres sozinho não faz o app rodar, e reproduzir a pilha do Supabase à mão seria manter uma cópia frágil do que a CLI já faz. As alternativas suportadas:

| Alternativa | Como | Quando usar |
|---|---|---|
| **A. Projeto Supabase de DESENVOLVIMENTO na nuvem (escolhida)** | `.env.local` aponta para o projeto de dev; migrations e seed pelo SQL Editor | Padrão. Mais rápido para começar; o banco é compartilhado e nunca é o de produção |
| **B. Supabase CLI local** | Docker Desktop + Supabase CLI, `supabase start` e `npm run reset-db` (refaz só o banco **local**; recusa qualquer alvo remoto) | Teste isolado e destrutivo. Exige a baseline do schema (`docs/analise/22`), que ainda não existe; até lá o `reset-db` não reproduz o banco |

Detalhes em `docs/analise/18-ambiente-local-e-ci.md`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run setup` | Prepara o ambiente local (Node, dependências, `.env.local`, Prisma) |
| `npm run reset-db` | Recria o banco **local** (Docker + Supabase CLI); recusa qualquer alvo remoto |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm run typecheck` | Conferência de tipos |
| `npm run test:unit` | Todos os testes de `scripts/` |
| `npm run build` | Build de produção local |

## Onde ler mais

- `docs/HANDOFF-CURSOR.md`: estado de cada área, o que está ligado e o que está desligado.
- `docs/FALTA-FAZER.md`: o que ainda falta (teste no navegador, banco, segredos, decisões).
- `docs/ROTEIRO-TESTE-LOCAL.md`: roteiro de teste por perfil, com o passo de criar o administrador.
- `docs/COMO-TESTAR.md`: fluxo clássico e a lista de flags por módulo.
- `docs/analise/31-auditoria-contra-o-prompt.md`: o que o código já cumpre do `PROMPT-volei-space.md` e o que não.
- `docs/analise/32-inventario-api.md`: todas as rotas da API, a flag que liga cada uma e quem acessa.

## Fluxo de trabalho

`fix/…`, `feat/…` ou `docs/…` → PR para `teste-integrado` → teste integrado local → PR para `main`. A `main` publica direto em produção na Vercel: nada entra nela sem aprovação, e nunca durante uma rodada com jogos em andamento.

## Banco de dados

As migrations aplicáveis ficam em `supabase/migrations/`. As da Fase 0 em diante ainda não aplicadas, com a reversão de cada uma, ficam em `supabase/pendentes/` (ver o `LEIA-ME.md` de lá e `docs/analise/16-plano-aplicacao-migrations.md`). Nenhuma das pendentes rodou num Postgres real; ensaie sempre em desenvolvimento ou preview, nunca direto em produção.
