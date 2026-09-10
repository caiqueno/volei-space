---
name: luva-platform
description: >
  Use esta skill sempre que o usuário quiser construir, estruturar, evoluir ou revisar
  a plataforma LUVA (Liga Única de Vôlei) — ou qualquer sistema web de gestão
  de ligas esportivas amadoras com cadastro de times, partidas, árbitros, classificação,
  súmula digital e painel administrativo. Acione também quando o usuário mencionar
  "plataforma da liga", "sistema de vôlei", "copa fácil", "gestão de campeonato",
  "tabela de classificação", "súmula digital", "cadastro de times" ou "painel de árbitros".
  Esta skill cobre desde a configuração inicial do projeto até o deploy, passando por
  schema de banco, API REST, frontend React e scripts de seed — com foco absoluto em
  organização, type safety, tratamento de erros e proteção contra regressões.
---

# LUVA Platform — Skill de Desenvolvimento

> Leia este arquivo inteiro antes de escrever qualquer código.
> Depois leia os arquivos de referência indicados em cada fase.

---

## Contexto do produto

A LUVA (Liga Única de Vôlei) é uma plataforma web para organização de ligas
amadoras de vôlei. Os princípios que guiam todas as decisões técnicas são:

1. **Organização sobre velocidade** — Estrutura correta desde o início evita retrabalho.
2. **Type safety total** — Nenhum `any` implícito. TypeScript strict em todo o projeto.
3. **Falha explícita** — Erros sempre tratados, nunca silenciados. HTTP status corretos.
4. **Operações atômicas** — Toda operação que toca múltiplas tabelas usa transação Prisma.
5. **Validação na borda** — Inputs validados com Zod antes de chegar ao banco.
6. **Progressão protegida** — Cada fase tem um checkpoint antes de avançar.

---

## Stack técnica

| Camada | Tecnologia | Versão alvo |
|---|---|---|
| Frontend | React + TypeScript + Tailwind CSS | React 18, TS 5+ |
| Backend | Next.js (App Router, Route Handlers) | Next.js 14+ |
| ORM | Prisma | 5+ |
| Banco (dev) | SQLite | — |
| Banco (prod) | PostgreSQL | 15+ |
| Auth | JWT (jose) | — |
| Validação | Zod | 3+ |
| Testes | Vitest + Testing Library | — |

> Leia `references/arquitetura.md` para a estrutura de pastas completa e convenções de nomenclatura.

---

## Fases de desenvolvimento

Execute as fases **na ordem exata**. Não avance para a próxima sem passar o checkpoint da fase atual.

---

### FASE 1 — Fundação do projeto

**Objetivo:** Repositório funcionando, banco conectado, seed rodando.

**Passos:**

1. Inicialize o projeto Next.js com TypeScript e Tailwind:
   ```bash
   npx create-next-app@latest luva --typescript --tailwind --app --src-dir --import-alias "@/*"
   ```

2. Instale as dependências essenciais:
   ```bash
   npm install prisma @prisma/client zod jose bcryptjs
   npm install -D @types/bcryptjs vitest @vitejs/plugin-react @testing-library/react
   ```

3. Inicialize o Prisma com SQLite:
   ```bash
   npx prisma init --datasource-provider sqlite
   ```

4. Cole o schema completo em `prisma/schema.prisma`.
   > Leia `references/schema-prisma.md` para o schema exato com todos os modelos e relações.

5. Rode as migrations e o seed:
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

**✅ Checkpoint Fase 1:**
- `npx prisma studio` abre sem erros
- Seed popula 8 equipes, 2 séries, 10+ partidas
- `npm run dev` inicia sem erros de TypeScript

---

### FASE 2 — Camada de dados e API

**Objetivo:** Todos os endpoints REST funcionando com validação e tratamento de erro.

**Passos:**

1. Crie o cliente Prisma singleton em `src/lib/prisma.ts`:
   ```typescript
   import { PrismaClient } from '@prisma/client'
   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
   export const prisma = globalForPrisma.prisma ?? new PrismaClient()
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
   ```

2. Crie o middleware de autenticação em `src/lib/auth.ts`.
   Nunca exponha a chave JWT no frontend. Use sempre `process.env.JWT_SECRET`.

3. Crie o helper de resposta padronizada em `src/lib/api-response.ts`:
   - `success(data, status?)` — sempre envelopa em `{ data }`
   - `error(message, status, details?)` — sempre envelopa em `{ error, details? }`
   - Nunca retorne erros crus do Prisma para o cliente.

4. Implemente os Route Handlers na ordem abaixo. Para cada endpoint:
   - Valide o input com Zod antes de qualquer lógica
   - Use transações Prisma onde houver múltiplas escritas
   - Trate erros Prisma conhecidos (P2002 unique, P2025 not found)

   > Leia `references/api-endpoints.md` para a lista completa de endpoints, payloads e status codes esperados.

5. Implemente os serviços de cálculo em `src/services/`:
   - `classificacao.service.ts` — recalcula a tabela após cada partida
   - `confrontos.service.ts` — gera round-robin para tabela única

   > Leia `references/regras-negocio.md` para as fórmulas exatas de pontuação, desempate e geração de confrontos.

**✅ Checkpoint Fase 2:**
- Todos os endpoints respondem com status corretos usando `curl` ou Thunder Client
- Tentativa de criar partida com times inválidos retorna 422, não 500
- Tentativa de acessar `/api/admin/*` sem JWT retorna 401
- Classificação é recalculada corretamente após registrar uma partida

---

### FASE 3 — Frontend público

**Objetivo:** Todas as páginas públicas funcionando com dados reais da API.

**Páginas a implementar (nesta ordem):**

| Rota | Componente | Prioridade |
|---|---|---|
| `/` | `HomePage` | Alta — vitrine da liga |
| `/classificacao` | `ClassificacaoPage` | Alta — core do produto |
| `/jogos` | `JogosPage` | Alta |
| `/rankings` | `RankingsPage` | Média |
| `/galeria` | `GaleriaPage` | Baixa |

**Regras de UI:**

- Paleta: azul marinho `#0F2C52` (primário), branco `#FFFFFF`, amarelo âmbar `#EF9F27` (destaque)
- Mobile-first: breakpoints `sm`, `md`, `lg` do Tailwind
- Skeleton loading em todo fetch assíncrono — nunca deixe a página em branco
- Tratamento de estado vazio: exiba mensagem amigável, não erro técnico

> Leia `references/componentes-ui.md` para os componentes compartilhados, paleta completa e padrões de layout.

**✅ Checkpoint Fase 3:**
- Todas as páginas públicas renderizam sem erros no console
- Mobile (375px) e desktop (1280px) sem overflow horizontal
- Estado vazio exibido corretamente quando não há dados

---

### FASE 4 — Painel administrativo

**Objetivo:** Admin autenticado consegue operar toda a liga sem tocar no banco diretamente.

**Páginas admin:**

| Rota | Função |
|---|---|
| `/admin` | Dashboard com resumo: partidas pendentes, próximas rodadas |
| `/admin/login` | Formulário de login (usuário: `admin` / senha: `admin123` no protótipo) |
| `/admin/partidas/nova` | Registrar placar de uma partida agendada |
| `/admin/partidas` | Listagem de partidas com filtro por status |
| `/admin/equipes` | CRUD de equipes |
| `/admin/jogadores` | CRUD de jogadores com vínculo a equipe |
| `/admin/configuracoes` | Configurações da liga (nome, logo, cores, critérios de desempate) |

**Regras de segurança:**

- Todo `/admin/*` (exceto `/admin/login`) deve verificar o JWT no cookie
- JWT expira em 8 horas
- Formulários de admin: desabilite o botão de submit durante o loading para evitar double-submit
- Confirme antes de deletar qualquer entidade (modal de confirmação)
- Nunca armazene a senha em texto puro — use `bcryptjs` mesmo no protótipo

**✅ Checkpoint Fase 4:**
- Login com credenciais erradas retorna mensagem de erro, não redireciona
- Acesso a `/admin` sem login redireciona para `/admin/login`
- Registrar uma partida atualiza a classificação automaticamente na página pública
- Deletar equipe com partidas vinculadas mostra erro amigável (não quebra o banco)

---

### FASE 5 — Súmula digital via link

**Objetivo:** 2º árbitro recebe link único, preenche súmula no celular, admin aprova antes de publicar.

**Fluxo técnico:**

1. Admin cria a partida → sistema gera `token` UUID único
2. Link: `https://luva.app/sumula/[token]`
3. Árbitro acessa, vê os times, preenche set a set
4. Submit → partida fica com status `PENDENTE_APROVACAO`
5. Admin aprova → status muda para `ENCERRADA` e classificação é recalculada

**Campos da súmula condensada:**

- Times confirmados (readonly, puxados do token)
- Atletas presentes (checklist por time)
- Placar por set (máximo 5 sets, inputs numéricos com validação de range)
- Ocorrências / cartões (opcional, texto livre)
- W.O. (toggle — se marcado, bloqueia campos de placar)

**Validações obrigatórias na súmula:**

- Set válido: placar vencedor ≥ 25 (ou ≥ 15 no tie-break), diferença ≥ 2
- Não permitir mais de 3 sets no formato melhor de 3
- Token inválido ou expirado → tela de erro clara

**✅ Checkpoint Fase 5:**
- Link funciona em mobile sem instalar nada
- Placar inválido (ex: 24×20) exibe erro inline antes do submit
- Após aprovação, resultado aparece na classificação pública
- Token já usado mostra "Súmula já encerrada"

---

### FASE 6 — Seed, README e entregáveis finais

**Objetivo:** Projeto demonstrável com dados realistas, pronto para rodar com 3 comandos.

**Seed deve incluir:**
- 1 liga ativa: "LUVA 2026 — 1ª Temporada"
- 5 categorias: Feminino Ouro, Feminino Prata, Masculino Ouro, Masculino Prata, Misto
- 8 equipes na categoria Masculino Ouro
- 10 partidas encerradas com placares realistas
- 3 partidas agendadas (status `AGENDADA`)
- 1 usuário admin (email: `admin@luva.app`, senha hash de `admin123`)

> Use o script em `scripts/seed.ts` como base. Adapte os dados conforme necessário.

**README mínimo:**

```markdown
## Como rodar

1. `npm install`
2. Copie `.env.example` para `.env`
3. `npx prisma migrate dev`
4. `npx prisma db seed`
5. `npm run dev`

Acesse http://localhost:3000
Admin: admin@luva.app / admin123
```

**✅ Checkpoint Fase 6 (final):**
- `git clone` + 5 comandos do README = sistema rodando
- Seed não falha em ambiente limpo
- `npm run build` sem erros de TypeScript
- Todas as páginas públicas têm dados visíveis sem interação manual

---

## Proteções transversais

Estas regras se aplicam a **todas** as fases, sem exceção:

### Nunca faça isso:
- `catch (e) { console.log(e) }` sem relançar ou responder com erro
- Retornar o stack trace do Prisma para o cliente
- Usar `as any` para escapar de um erro de tipo
- Fazer múltiplas escritas no banco sem transação
- Armazenar JWT no `localStorage` (use cookie httpOnly)
- Deletar dados sem confirmação do usuário

### Sempre faça isso:
- Valide com Zod antes de qualquer lógica de negócio
- Use `prisma.$transaction()` em operações compostas
- Retorne erros com `{ error: string, details?: unknown }`
- Tipifique explicitamente o retorno de todas as funções de serviço
- Adicione `try/catch` em todo Route Handler
- Documente cada endpoint com um comentário de uma linha acima

---

## Arquivos de referência

| Arquivo | Quando ler |
|---|---|
| `references/arquitetura.md` | Início da Fase 1 — estrutura de pastas e convenções |
| `references/schema-prisma.md` | Fase 1 — antes de criar o schema |
| `references/api-endpoints.md` | Fase 2 — antes de criar os Route Handlers |
| `references/regras-negocio.md` | Fase 2 — antes de implementar serviços |
| `references/componentes-ui.md` | Fase 3 — antes de criar o primeiro componente |
| `scripts/seed.ts` | Fase 6 — base para o script de seed |

---

## Ordem de leitura recomendada ao iniciar

1. Este arquivo (SKILL.md) — leia completo
2. `references/arquitetura.md`
3. `references/schema-prisma.md`
4. Só então comece a escrever código
