# 31. Auditoria do código contra o `PROMPT-volei-space.md` (21/10/2026, atualizada na rodada 19)

Método: leitura do MD e verificação no código da `cursor-teste` (busca por arquivo, rota e tabela). "Feito" quer dizer **implementado e testado na lógica**, atrás de flag e desligado por padrão. **Nada foi publicado**, e as telas novas nunca foram abertas num navegador; nenhuma migration pendente (0001 a 0053) rodou num Postgres, então tudo o que depende de coluna ou tabela nova está **escrito, não comprovado**. Itens marcados [parcial] têm a parte que falta descrita.

Atualização da rodada 19: os itens entregues nas rodadas 16 a 18 (login sem senha, elenco completo, painel de inscrições, explorar competições, notificações multicanal) passaram de ❌/🟡 para ✅ ou 🟡 depois de conferir o código (arquivo, rota e teste citados em cada linha). Um ✅ aqui **não** significa "funciona em produção": significa que o código existe, tem teste de lógica e está desligado por flag.

Legenda: ✅ feito · 🟡 parcial · ❌ não feito · ➖ fora do escopo (decisão do dono)

## 1. Módulos da plataforma final

| # | Módulo do MD | Estado | Evidência / o que falta |
|---|---|---|---|
| 1 | Meu Time e Competições (times, atletas, competições de vários organizadores, inscrições, escala de arbitragem) | ✅ | Meu Time completo (`src/app/meu-time/**`); inscrição e aprovação por categoria; explorar competições com filtros, valor e selo (`src/lib/explorar-competicoes/**`, R18); escala de arbitragem existe (legado). |
| 2 | Papeleta digital (envio, validação, bloqueio) | ✅ | `src/lib/banco/papeleta-validacao.ts`, trigger de imutabilidade (migration 0034), tela `/banco/[token]` e pela conta. Segundo líbero incluído. |
| 3 | Súmula eletrônica (regras em tempo real) | ✅ | Motor `src/lib/regras-volei/**`, log imutável, `lancar/page.tsx`, offline-first atrás de flag. |
| 3b | "Súmula oficial sai em **PDF**" | 🟡 | **R19: existe o arquivo PDF gerado no servidor** (`/api/sumula/[token]/pdf`, atrás de `SUMULA_PDF_ATIVO`) e a página A4 para imprimir. O layout **não foi conferido visualmente** (sem conversor de PDF no ambiente) e não há assinatura digital nem modelo idêntico ao da CBV. |
| 4 | App de banco (tempo, substituição, desafio) | ✅ | `/banco/[token]` e aba Jogos do Meu Time; pedidos aceitos pelo apontador. |
| 5 | App do árbitro (consulta em tempo real) | ➖ | Existe `/arbitro/partida/[token]`, mas o dono disse que **não precisa**. Não remover `arbitro-access.ts` (o apontador usa). |
| 6 | Placar ao vivo (telão, site, overlay) | ✅ | `/ao-vivo/[id]`, `/placar/[id]?fundo=transparente` (overlay), `/partidas/[id]/ao-vivo`. |
| 7 | Scout com exportação `.dvw` | ➖ | Existe scout por toque e CSV/JSON; o dono disse que **não precisa**. `.dvw` nunca foi feito. |
| 8 | Desafio de vídeo (fase posterior) | ✅ | Fluxo registrado, opcional por ambiente; sem janela de 7 s nem lista de lances. |

## 2. "Experiência prioritária" (cadastro e inscrição)

### Princípios e onboarding
| Item | Estado | Evidência / falta |
|---|---|---|
| Entrar com **Google, e-mail ou código pelo WhatsApp, sem senha** | ✅ | R16, atrás de `LOGIN_SEM_SENHA_ATIVO` (+ `GOOGLE_LOGIN_ATIVO`): `src/app/api/auth/codigo/*`, `auth/google/*`, `src/lib/login-sem-senha/**`, `src/lib/mensageria/**`; testes `login-sem-senha*.test.ts`. **Falta comprovar** com provedor real: Google precisa do provedor ativado no Supabase Auth e o WhatsApp precisa de um webhook de provedor (`WHATSAPP_WEBHOOK_URL`); em dev o código sai no console. Migrations 0045 a 0047 pendentes. |
| Pergunta "O que você quer fazer hoje?" | ✅ | `/cadastro` sem parâmetro (`CHANGELOG`). |
| Troca de perfil no menu (mesma pessoa, vários perfis) | ✅ | R16: `SeletorPerfil` no layout do Meu Time, `GET /api/auth/perfis`, `POST /api/auth/perfil/trocar`. Só existe com a flag de login sem senha ligada. |
| "Nenhum beco sem saída" (clicar em Participar sem time cria o time ali) | ✅ | Porta de entrada + "Criar meu time" volta à inscrição (R15). |
| Salva rascunho sozinho | ✅ | Rascunho do assistente de inscrição e do formulário legado. |

### Meu Time
| Item | Estado | Evidência / falta |
|---|---|---|
| Criar time em 30 s (nome, cidade, naipe, escudo) | ✅ | `CriarTime`; escudo por envio assinado na R17 (`/api/meu-time/uploads/*`). |
| Abas Atletas, Comissão técnica, Dados do time, Inscrições | ✅ | `DetalheTime.tsx`. |
| Dados do time: CNPJ, contato, cores, outros responsáveis | ✅ | Contato e cores do uniforme (R17, migration 0049 pendente) e membros com acesso (`/api/meu-time/equipes/[id]/membros`). **CNPJ foi retirado do escopo por decisão do dono** ("não preciso de CNPJ"). |
| Colar lista, importar planilha, link de convite, um por um | ✅ | `ImportarAtletas`, convites, CSV (R10). |
| Indicador de prontidão ("9 atletas, 2 sem documento") | ✅ | Prontidão no Meu Time (`/api/meu-time/equipes/[id]/prontidao`, R17). |
| Clube com várias equipes | ✅ | Clube e vínculo (R10). |
| **Foto, CPF, documento e telefone do atleta** | ✅ | R17, atrás de `ELENCO_COMPLETO_ATIVO`: upload assinado de foto e documento (`/api/meu-time/uploads/*`), CPF e telefone cifrados e mostrados com máscara, hash do CPF para achar duplicidade (`src/lib/lgpd/**`). Migrations 0048 a 0050 e os três buckets do Storage precisam existir. **Ressalva:** a base legal e os prazos de retenção seguem pendentes de decisão jurídica (doc 25). |

### Competições e inscrição
| Item | Estado | Evidência / falta |
|---|---|---|
| **Explorar:** cartões com organizador, datas, cidade, vagas restantes, prazo, **valor**, **filtros** | ✅ | R18: `GET /api/meu-time/competicoes` (organizador, cidade, datas, `prazoInscricao`, `vagasRestantes`, `valorInscricao`) e filtros na tela (`src/lib/meu-time-competicoes-ui/regras.ts`); flag `EXPLORAR_COMPETICOES_ATIVO`. |
| **Selo de elegibilidade** (✅ pode participar / ⚠️ faltam 2 atletas / ⛔ naipe) | ✅ | R18: calculado no servidor em `src/lib/explorar-competicoes/selo.ts` (quantidade de atletas aptos, idade, naipe). |
| Competição privada por link/código | ✅ | Visibilidade e convite (R7, R15). |
| Assistente de inscrição em 4 passos | ✅ | `AssistenteInscricao` (Confirmar time, Atletas, Comissão, Revisar). |
| Status: Rascunho → Enviada → **Em análise** → **Pendência** → Aprovada · Recusada · **Lista de espera** | ✅ | R18 (migration 0051 pendente): `EM_ANALISE`, `CONFIRMADA_COM_PENDENCIAS`, `AJUSTE_PEDIDO`, `LISTA_ESPERA` com posição na fila; pedido de correção com conversa em `/api/meu-time/inscricoes/[id]/comentarios` (migration 0052). |
| Cópia própria da lista (mudar o banco não altera a inscrição enviada) | ✅ | `InscricaoAtleta`. |
| **Depois do prazo, troca vira pedido** aprovado pelo organizador | ✅ | R17: `src/lib/pedido-troca/**`, rotas `meu-time/inscricoes/[id]/pedidos-troca` e `organizador/pedidos-troca/[id]/decidir`; teste `elenco-pedido-troca.test.ts`. Antes do prazo a troca é livre. |
| Atleta não pode estar em dois times da mesma competição | ✅ | Bloqueio na inscrição. |
| Pagamento (Pix/cartão) e aceite do regulamento | 🟡 | Regulamento: sim. **Pix manual com comprovante (R19): feito no código**, desligado por flag (`PAGAMENTO_COMPROVANTE_ATIVO`), sem gateway. **Cartão e Pix automático: não existem** (o webhook legado foi desativado por segurança). |
| Papeleta usa os atletas da inscrição aprovada | ✅ | Banco por conta depende do vínculo equipe legada ↔ time (R14b). |

### Visão do organizador
| Item | Estado | Evidência / falta |
|---|---|---|
| Criar competição em assistente | ✅ | `/painel/parametrizacao` (informações, categorias, inscrições, calendário, pagamento, prévia). |
| Modalidade quadra **ou praia** | ➖ | Só quadra, por decisão do dono. |
| **Regras de elenco com modelos prontos** (FIVB, CBV, Amador livre) | ✅ | R17: modelos `FIVB`, `CBV`, `AMADOR_LIVRE` e `PERSONALIZADO` em `src/lib/regras-elenco/modelos.ts`, bloco "Regras de elenco" na parametrização e `GET/PUT /api/organizador/categorias/[id]/regra-elenco`. |
| **Painel de inscrições**: filtros, aprovar em 1 clique, pedir correção com comentário, ver documentos, **exportar planilha/PDF** | 🟡 | R18, flag `PAINEL_INSCRICOES_ATIVO`: `/painel/inscricoes` com filtros, decisão individual e em lote, pedido de correção com conversa, link temporário para ver documento (`documento-url`) e exportação em **CSV**. **Falta a exportação em PDF.** |
| **Equipe do organizador** com papéis (administrador, financeiro, arbitragem) | ✅ | R18: papéis `ADMINISTRADOR`, `FINANCEIRO`, `ARBITRAGEM` (mais o dono) em `src/lib/painel-inscricoes/acesso.ts`, rota `/api/organizador/equipe` e tela `/painel/equipe`. O uso dos papéis nas demais telas do painel (por exemplo, só o financeiro mexe em pagamento) ainda não foi conferido. |
| Privacidade entre organizadores | ✅ | Isolamento no servidor, testado. |

### Notificações
| Item | Estado |
|---|---|
| Notificações **dentro do app** (sino) | ✅ |
| **E-mail, WhatsApp e push** para aprovada, pendência, prazo em 48 h, tabela publicada, jogo amanhã | ✅ no código, 🟡 na operação: R18, flag `NOTIFICACOES_MULTICANAL_ATIVO` (migration 0053): preferência por canal (avisos críticos não desligam), push sem conteúdo no payload, despachante e lembretes em `/api/cron/notificacoes` e `/api/cron/lembretes`. **Nada está agendado** (falta configurar o cron com `CRON_SECRET`), o WhatsApp e o push dependem de provedor e das chaves `VAPID_*`, e nenhum envio real foi testado. |

### Navegação sugerida: `Início · Meu Time · Competições · Jogos · Perfil`
✅ no código (R16, `NavMeuTime.tsx`): com o login sem senha ligado o líder tem Início, Meu Time, Competições, Jogos e Perfil; sem a flag fica a navegação anterior (Minhas equipes, Atletas, Convites, Importar, Clube, Notificações, Campeonatos e Jogos). Não foi vista num celular.

### Metas de usabilidade
❌ Nunca foram medidas (nenhum teste com pessoas). Os tempos de 5 min e 3 min são só metas.

## 3. Fluxo, infraestrutura e "critérios de pronto"

| Critério | Estado | Evidência / falta |
|---|---|---|
| Onze relatórios em `docs/analise/` com fontes | ✅ | Existem 01 a 32 (o 32 é o inventário das rotas da API). |
| Protótipo (primeiro acesso, Meu Time, Competições, assistente, organizador, papeleta, súmula, banco, placar) | 🟡 | `/prototipo` cobre 7 perfis; **faltam** primeiro acesso, explorar competições e o assistente de inscrição. |
| Teste com 5 pessoas que nunca usaram | ❌ | Não feito. |
| Analista de negócio aprovou o MVP e a receita | ❌ | Não feito (o relatório 08 existe, sem aprovação). |
| README: clonar, `setup`, `dev` com dados de exemplo em < 15 min | 🟡 | R19: README refeito (Node 22+, `setup`, `.env.local` do dev, migrations, administrador, flags, `dev`) e `supabase/seed.sql` reescrito para rodar num banco vazio (1 liga, 2 categorias, 6 equipes, 48 jogadores, 6 jogos, `npm run test:seed`). **Nenhum dos dois foi executado por um novato nem por um Postgres.** Com o projeto de dev pronto leva cerca de 10 a 12 minutos; um projeto Supabase vazio ainda não sobe sozinho por falta da baseline do schema (doc 22). |
| `CHANGELOG`, SemVer, CI (lint/test/build) em todo PR, **plano de volta testado** | 🟡 | CHANGELOG (com as rodadas 9 a 19), CI e nome `volei-space` no `package.json` (a versão segue `0.1.0`) existem; plano de volta documentado, **nunca ensaiado**. |
| **`docker-compose.yml`** (entrega do agente 11) | ➖ | Decisão do dono: não criar. Usa-se o projeto Supabase de DESENVOLVIMENTO na nuvem ou o Supabase CLI local (README e `18-ambiente-local-e-ci.md`). |
| Contrato da API revisado | 🟡 | Inventário completo das 196 rotas em `32-inventario-api.md`, com teste que falha se uma rota nova não for listada; `07-api-contrato.yaml` cobre os eventos da súmula e, em resumo (flag, acesso, sem schema de corpo), as rotas das rodadas 15 a 18; `20-contrato-meu-time.yaml` cobre o Meu Time. As demais rotas das rodadas 9 a 14 não têm OpenAPI. |
| Decisões de stack com alternativas | ✅ | `12-arquitetura-alvo.md`. |
| Matriz de lacunas, roadmap priorizado, 5 diferenciais | ✅ | `04-gap-analysis-e-roadmap.md`. |

## 4. Resumo

- **Implementado e funcionando só na lógica:** o núcleo do jogo (súmula, rotação, papeleta, banco, placar), o Meu Time, a inscrição (automática ou com aprovação), os convites, a importação, o clube, a LGPD de menores e a segurança; e, desde as rodadas 16 a 18, o login sem senha com troca de perfil, o elenco completo (foto, documento, CPF, regras de elenco e pedido de troca), o painel de inscrições do organizador, explorar competições e as notificações por vários canais. Tudo atrás de flag, desligado, sem migration aplicada e sem ter sido aberto num navegador.
- **O que ainda falta do MD, em ordem de impacto:**
  1. Conferir o PDF da súmula gerado no servidor (layout, equipes lado a lado, logotipo) e a exportação do painel de inscrições em PDF (hoje só CSV).
  2. Pagamento por cartão e Pix automático (o Pix manual com comprovante já existe, desligado por flag).
  3. Comprovar na prática o que depende de terceiros: provedor de WhatsApp, push (`VAPID_*`), Google no Supabase Auth e o cron de lembretes (nada agendado).
  4. Protótipo sem primeiro acesso, explorar competições e assistente de inscrição.
  5. Uso dos papéis da equipe do organizador (financeiro, arbitragem) nas telas do painel.
  6. Testes de usabilidade com pessoas, aprovação do analista de negócio e plano de volta ensaiado.
  7. Baseline do schema, para um projeto Supabase novo subir sem ajuda (doc 22).
- **Resolvido na rodada 19:** seed que roda em banco vazio, README de início rápido, nome do pacote `volei-space` e o inventário das rotas. `docker-compose.yml` ficou fora por decisão do dono.
- **Fora do código (não dá para "implantar" daqui):** testes com pessoas, aprovação do analista, plano de volta ensaiado, migrations em produção, decisões jurídicas de LGPD e a decisão de publicar na `main`.
