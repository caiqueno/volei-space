# LUVA Platform 🏐

Sistema web para organização de ligas amadoras de vôlei.

## Stack

- **Next.js 14** App Router + TypeScript strict
- **Tailwind CSS** com design system LUVA (cores navy/amber/blue)
- **Prisma 5** + PostgreSQL (Supabase)
- **JWT** (jose) com cookie httpOnly
- **Zod** para validação de inputs

## Como rodar

```bash
# 1. Instalar dependências
npm install --ignore-scripts
npx prisma generate

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env e preencha DATABASE_URL e DIRECT_URL com sua senha do Supabase
# (Supabase Dashboard → Settings → Database → Connection string)

# 3. Rodar em desenvolvimento
npm run dev
```

> O banco de dados já está configurado no Supabase com schema e dados de seed.
> Não é necessário rodar migrações manualmente.

## Acesso admin

- URL: `http://localhost:3000/admin/login`
- Email: `admin@luv.com.br`
- Senha: `LuvAdmin@2026`

## Páginas públicas

| Rota | Descrição |
|------|-----------|
| `/` | Home com equipes, próximos jogos e mural |
| `/classificacao` | Tabela de classificação |
| `/jogos` | Partidas agrupadas por rodada |
| `/rankings` | MVPs e votação dos torcedores |
| `/galeria` | Fotos e vídeos |
| `/sumula/:token` | Formulário de súmula digital (árbitro) |

## Painel admin

| Rota | Descrição |
|------|-----------|
| `/admin` | Dashboard com resumo |
| `/admin/partidas` | Lista e aprovação de súmulas |
| `/admin/partidas/nova` | Criar nova partida |
| `/admin/equipes` | CRUD de equipes |
| `/admin/jogadores` | CRUD de jogadores |
| `/admin/configuracoes` | Editar dados da liga |

## API

Todos os endpoints retornam `{ data }` em sucesso ou `{ error }` em falha.

Endpoints protegidos requerem cookie `luva_token` (obtido via `POST /api/auth`).

| Endpoint | Método | Auth |
|----------|--------|------|
| `/api/auth` | POST / DELETE | — |
| `/api/ligas/:slug` | GET / PUT | PUT🔒 |
| `/api/equipes` | GET / POST | POST🔒 |
| `/api/equipes/:id` | PUT / DELETE | 🔒 |
| `/api/jogadores` | GET / POST | POST🔒 |
| `/api/jogadores/:id` | PUT / DELETE | 🔒 |
| `/api/partidas` | GET / POST | POST🔒 |
| `/api/partidas/:id/aprovar` | POST | 🔒 |
| `/api/classificacao` | GET | — |
| `/api/rankings` | GET | — |
| `/api/galeria` | GET / POST | POST🔒 |
| `/api/mensagens` | GET / POST | — |
| `/api/sumula/:token` | GET / POST | — |

## Fluxo da súmula digital

1. Admin cria partida → sistema gera token UUID com validade 24h após a partida
2. Árbitro acessa `/sumula/:token` no celular
3. Preenche: times → W.O.? → presenças → placar por set → ocorrências → revisão
4. Submete → status muda para `PENDENTE_APROVACAO`
5. Admin aprova em `/admin/partidas` → status `ENCERRADA` + classificação recalculada

## Regras de pontuação

| Resultado | Vencedor | Perdedor |
|-----------|----------|----------|
| 2×0 | 3 pts | 0 pts |
| 2×1 | 2 pts | 1 pt |
| W.O. | 3 pts | 0 pts + punição |

## Seed de desenvolvimento

O banco já contém:
- 1 liga: LUVA 2026
- 8 equipes (Masculino Ouro)
- 48 jogadores
- 10 partidas encerradas + classificação calculada
- 3 partidas agendadas com tokens de súmula
- Mensagens aprovadas no mural
