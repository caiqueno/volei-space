# 06 - Arquitetura do front-end (volei.space)

Agente: frontend. Data: 2026-10-16. Baseado no código do worktree `feat/frontend-usabilidade` (base `teste-integrado`). Legenda: **[V]** verificado no código · **[PROP]** proposta, não implementada.

## 1. Stack atual [V]

| Item | Valor (package.json) |
|---|---|
| Framework | Next.js 14.2.35, App Router, React 18 |
| Linguagem | TypeScript 5 (`npm run typecheck`) |
| Estilo | Tailwind 3.4 + `src/app/globals.css` (17,8 mil linhas, do designer) + `micro-interactions.css` |
| Animação / ícones | framer-motion 11, lucide-react |
| Dados | Supabase (`@supabase/supabase-js`) no cliente para Realtime e Storage; Prisma 5 só no servidor/migrações; rotas em `src/app/api/**` |
| Validação | zod (servidor e esquemas em `src/lib/schemas.ts`) |
| Auth | cookies/JWT (`jose`), `src/middleware.ts`, helpers em `src/lib/auth*` |
| Outros | `qrcode`, `html-to-image` (cartazes/stories), `nodemailer` |
| PWA | Só `src/app/manifest.ts` (`display: standalone`). Não há service worker nem IndexedDB [V] |

Node 22.x. `npm run build` = `prisma generate && next build`.

## 2. Estrutura dos apps [V]

Um único app Next.js com várias "áreas" por rota:

- **Público/torcedor**: `/`, `/campeonatos`, `/partidas/[id]/ao-vivo` (`LiveMatchView.tsx`), `/ao-vivo`, `/classificacao`, `/jogos`, `/rankings`, `/galeria`, `/equipes`, `/fase-mata-mata`.
- **Inscrição (líder/técnico, sem aprovação)**: `/inscricao/categoria/[token]` (porta de entrada), `/inscricao/campeonato/[token]`, `/inscricao/vaga/[token]`, `/inscricao-rapida/[token]` (rascunho + elenco, `FormularioInscricaoRapida.tsx`), `/capitao` (painel legado da equipe).
- **Organizador**: `/painel`, `/painel/campeonatos`, `/seja-membro`, componentes em `components/parametrizacao`, `components/organizador`, `components/painel`.
- **Súmula e arbitragem**: `/sumula/[token]` e `/sumula/[token]/lancar` (arquivo único de ~4,9 mil linhas com as abas Pontuação, Escalação, Tempos etc.), `/arbitro/jogo/[token]`.
- **Conta**: `/login`, `/cadastro` (agora com `EscolhaInicial` sem parâmetro), `/ativar-conta`, `/resetar-senha`, `/trocar-senha`.
- **Admin**: `/admin`.

Componentes em `src/components/*` por domínio (`sumula`, `inscricao-rapida`, `partidas`, `equipes`, `ui`...). Regras e funções puras em `src/lib/*` (um arquivo por assunto: `ponto-sumula`, `sumula-regras`, `fila-salvamento`, `desfazer-ponto-sumula`, `elegibilidade-categoria`...). O motor de regras de jogo novo fica em `src/lib/regras-volei/**` (outro agente).

Padrão adotado nesta entrega: toda decisão nova vira função pura em `src/lib/` com teste em `scripts/`, e o componente só liga estado e JSX:

| Item | Função pura | Componente |
|---|---|---|
| U1 | `atribuicao-ponto.ts` | `components/sumula/FaixaQuemFez.tsx` + `lancar/page.tsx` |
| U2 | `ao-vivo-conexao.ts` | `LiveMatchView.tsx` |
| U3/U4/U12 | `elenco-inscricao.ts` | `FormularioInscricaoRapida.tsx` |
| U8 | `contador-troca.ts` | `lancar/page.tsx` (modal de troca) |

## 3. Como o estado e a gravação funcionam hoje [V]

**Súmula.** O estado do jogo vive em `useState` dentro de `lancar/page.tsx` (placar, `scoreHistory`, `events`, escalações, controle de substituições). O envio é:

1. Efeito com *debounce* de 700 ms dispara `enfileirarSalvamento` quando muda placar, set ou quantidade de eventos.
2. `criarSalvamentoCoalescido` (`fila-salvamento.ts`) garante uma gravação por vez e só a última pendente roda.
3. `saveLiveSnapshot` faz `PUT /api/sumula/[token]` com o payload completo e um número de `versao`. Conflito 409 com versão local maior é tratado como "já superado"; até 8 tentativas.
4. A tela de erro oferece "Tentar salvar agora".

Consequência: a súmula **depende de rede para gravar**, mas a tela continua usável com o estado em memória. Recarregar a página sem rede perde o que não foi enviado. Não há persistência local (só `localStorage` para vista da quadra, sidebar e um snapshot de demonstração).

**Placar público.** `LiveMatchView` busca `/api/partidas/[id]/ao-vivo` e usa `useBancoAoVivo` (Supabase Realtime + *polling* a cada 4 s + refetch ao voltar online/visibilidade). Desde esta entrega, falha depois do primeiro carregamento mantém o último placar e mostra "Sem conexão. Tentando de novo".

**Inscrição.** Rascunho salvo no servidor por token (autosave 700 ms em `PATCH /api/inscricao-rapida/[token]`; atletas em `POST/PATCH/DELETE .../jogadores`). A validação final (mínimo/máximo de atletas, campos obrigatórios, elegibilidade) é do servidor (`team-registration-draft.ts`); o front só antecipa o motivo.

## 4. Offline-first proposto [PROP]

Prioridade: **súmula** (quadra com sinal ruim), depois **placar público** em cache.

1. **Fila de eventos em IndexedDB (outbox)**. Cada ação (ponto, troca, tempo, desfazer) vira um evento imutável com `id` (uuid), `partidaId`, `seq` local crescente e `criadoEm`. A tela aplica o evento ao estado na hora e grava no IndexedDB antes de tentar a rede.
2. **Sincronização idempotente**. Novo endpoint (backend) aceita lote de eventos por `partidaId` e ignora ids já vistos; resposta devolve a `versao` do servidor. Hoje o `PUT` envia o estado inteiro, o que dificulta mesclar dois aparelhos; o lote de eventos resolve e permite "desfazer" como evento compensatório.
3. **Reidratação**. Ao abrir `/sumula/[token]/lancar`, ler o outbox e reaplicar eventos não confirmados antes de buscar o servidor. Evita perda por recarga.
4. **Indicador de sincronização** sempre visível: "Salvo", "Salvando", "Sem rede: 3 lances guardados neste aparelho".
5. **Service worker** (Workbox ou manual) só para: shell da súmula (HTML/JS/CSS/ícones) em *stale-while-revalidate* e `GET /api/partidas/[id]/ao-vivo` com *network-first* e cache de 60 s para o torcedor. Nunca cachear respostas autenticadas fora da súmula. Registrar apenas em produção.
6. **Conflito**: servidor é a fonte da verdade; vence o evento de menor `seq` por aparelho e `criadoEm`; divergência de placar vira aviso para o apontador, nunca sobrescrita silenciosa.
7. **Meta de testes**: simular rede cortada (Playwright `context.setOffline`) por 60 s com 10 pontos e conferir que, ao voltar, o servidor tem 10 pontos sem duplicar.

Dependências de backend: endpoint de lote idempotente e campo de id de evento. O front não deve ser o único guardião de regra (CLAUDE.md): o servidor continua validando limites de troca, placar e permissões.

## 5. Acessibilidade e responsividade [V/PROP]

- Feito nesta entrega: alvos de 44 a 48 px na faixa "Quem fez?", em "Colar lista", "Novo jogador" e "Concluir"; mensagens com `role="status"`/`aria-live`; motivo do botão desabilitado ligado por `aria-describedby`; sem animações novas (nada a ajustar para `prefers-reduced-motion`).
- Pendente (U7): alvos de 28 a 36 px e fontes de 9 a 10 px em `globals.css` (arquivo do designer). Precisa de decisão visual.
- A faixa fica `fixed` na base, com `env(safe-area-inset-bottom)`; não foi testada em tablet real.

## 6. Testes [V]

- **Unitários**: `scripts/*.test.ts|mjs`, executados com `ts-node` por `scripts/with-ts-node.mjs`. `npm run test:unit` roda todos via `scripts/run-unit.mjs` (que pula os que dependem de banco quando falta `DATABASE_URL`). Cada teste também tem um alias `test:<nome>` em package.json.
- **E2E**: Playwright (`e2e/*.spec.ts`, `playwright.config.ts`), incluindo súmula (`sumula-mesa.ts`, `sumula-ace-toque-bloqueio.spec.ts`, `sumula-troca-set.spec.ts`). `npm test` = unitários + e2e.
- **Estáticos**: `npm run lint` (next lint) e `npm run typecheck`.
- Novos nesta entrega: `elenco-inscricao`, `ao-vivo-conexao`, `atribuicao-ponto`, `contador-troca`.
- Lacuna: não há teste de componente (React Testing Library). A lógica foi mantida em funções puras justamente para ser testável sem navegador. Os fluxos visuais (faixa, colar lista, aviso sem conexão) pedem teste Playwright.

## 7. Dívida técnica observada

- `lancar/page.tsx` com ~4,9 mil linhas e componentes internos; extrair `PontuacaoTab`, `PlayerModal`, `EscalacaoTab` para `components/sumula/`.
- `globals.css` com 17,8 mil linhas misturando todas as áreas.
- `FormularioInscricaoRapida.tsx` tem JSX denso em linhas longas; extrair o painel de elenco e o painel "Colar lista".
- `/capitao` ainda gateia o elenco por `approved` no front, refletindo uma regra do servidor (`/api/capitao/jogadores` responde só para equipe vinculada). Isso é o fluxo legado; o backend deve confirmar se continua.
- `typecheck` falha neste ambiente por dependências ausentes (`@playwright/test`, `html-to-image`) no `node_modules` compartilhado; erros fora dos arquivos alterados.
