# 04 - Análise de lacunas e roadmap do volei.space

Agente: `arquiteto-produto`. Data: 2026-10-16. Somente leitura no código; cruza os relatórios 01, 02, 03 e 08 e a seção "Experiência prioritária" de `docs/PROMPT-volei-space.md` (citada como **[PROMPT]**).

Fontes pelo número: **[01]** diagnóstico do código, **[02]** referência e-Scoresheet/VolleyStation, **[03]** regras validáveis, **[08]** validação de negócio. Referências `arquivo:linha` vêm do [01] e não foram reverificadas. Itens "a verificar" do [01] (RLS, RPCs, colunas) continuam assim.

## 0. Premissas de produto (vigentes)

Decisão atual do dono (substitui a anterior "organizador primeiro"): **Meu Time é pilar central do modelo de negócio.**

1. O time (líder/técnico) tem **conta** e um **banco de atletas reutilizável** em qualquer campeonato. O organizador vê **somente as inscrições das suas competições**, nunca o banco completo do time ([PROMPT] "Privacidade entre organizadores"; invariante de `CLAUDE.md`).
2. A regra aprovada em `CLAUDE.md` **continua como uma porta de entrada**: o organizador envia o link de convite por categoria e o líder cadastra a equipe direto, sem aprovação. Esse cadastro passa a **alimentar o Meu Time**: o líder entra (ou cria conta) pelo link, a equipe e os atletas ficam no banco do time, e a inscrição na categoria é uma **cópia** da lista escolhida ([PROMPT] "Regras importantes").
3. Busca pública de competições, selo de elegibilidade e modo marketplace são **incremento do mesmo pilar**, não produto separado.
4. Ordem mantida: **Fase 0 (segurança e fundação) primeiro**. Banco de atletas, inclusive de menores, amplia o risco LGPD; por isso nenhuma entrega de Meu Time sai antes do gate da Fase 0.
5. Receita ([08 §4.1], confirmada): time e atleta **grátis** (são o funil); **organizador paga** por competição/categoria; assinatura e plano de federação depois; taxa sobre inscrição só depois de validar. O que muda em relação ao [08]: o time grátis deixa de ser só "funil de entrada do organizador" e vira **ativo recorrente da plataforma** (um banco de atletas que cresce a cada competição e dá retenção do lado do time). Monetização do lado do time (clube premium, vitrine) fica como hipótese a validar, nunca no MVP (o [08 §4.3] recomenda não cobrar o time).

Consequência para o [08]: o item "Meu Time / banco de atletas / Clube" estava em "fora do MVP" ([08 §5 itens 2 e 10]) e a pergunta [08 §8.5 item 1] (SaaS do organizador ou marketplace?) fica respondida como **híbrido, com o time como pilar**. Os riscos [08 R4 (LGPD), R7 (escopo largo)] aumentam e reaparecem nas seções 4 e 5.

Mapa de responsáveis (`.claude/agents/`): `arquiteto`, `backend`, `banco-de-dados`, `frontend`, `ux`, `designer`, `qa`, `seguranca`, `devops-infra`, `devops-app`, `regras-de-volei`, `dados-do-campeonato`, `suporte-organizacao`, `conteudo-instagram`. O primeiro listado é o dono.

Escalas: Prioridade **P0** bloqueia segurança/lançamento; **P1** MVP; **P2** depois. Esforço **P** até 3 dias, **M** 1 a 3 semanas, **G** mais de 3 semanas (ordem de grandeza, uma pessoa, sem calibragem).

---

## 1. Matriz de lacunas

"n/v" = não verificado. VolleyStation tem fonte fraca [02 §6].

### 1.1 Segurança, fundação e operação

| # | Funcionalidade | e-Scoresheet [02] | VolleyStation [02 §6] | volei.space hoje [01] | Lacuna | Pri | Esf | Responsável |
|---|---|---|---|---|---|---|---|---|
| G01 | Privacidade de dados de atletas (CPF, nascimento, telefone, QR) | Elenco vem de base central; time confirma com login [02 §1 #3] | n/v | `GET /api/jogadores` seleciona `*` sem sessão (`api/jogadores/route.ts:17`; filtro nulo para anônimo `organizador-isolamento.ts:50-55`); S1, inclui menores | Dados pessoais abertos; RLS "a verificar". **Pré-requisito do Meu Time** | **P0** | M | `seguranca`, `backend`, `banco-de-dados` |
| G02 | Leitura anônima de equipes e ligas | n/a | n/a | `GET /api/equipes` e `/[id]` devolvem tudo, com `liga:Liga(*)` (`api/equipes/route.ts:12-55`, `equipes/[id]/route.ts:7-16`); S2 | Projeção mínima pública | **P0** | P | `backend`, `seguranca` |
| G03 | Credenciais fixas legadas | n/a | n/a | admin `admin@luv.com.br` em `README.md:35-36`, `COMO-TESTAR.txt:120`, `setup-db.mjs:236-245,421`; S3 | Rotacionar e remover | **P0** | P | `seguranca`, `devops-app` |
| G04 | Súmula lida por id sequencial | n/a | Acesso por QR (inferido) | `requireSumulaTokenAccess` aceita `/^\d+$/` (`sumula-access.ts:14`); `?consulta=1` aberto (`api/sumula/[token]/route.ts:28-31`); S7 | Token opaco | **P0** | M | `backend`, `seguranca` |
| G05 | Login sem rate limit; JWT único | Senha pessoal de árbitro/supervisor [02 §5] | n/v | `api/auth/route.ts` sem contador; `auth.ts:9-12`; S5, S9 | Rate limit; segredo por finalidade. **Contas de time ampliam a superfície** | **P0** | P | `seguranca`, `backend` |
| G06 | Ambiente local com um comando e seed | n/a | n/a | Sem Docker, baseline SQL nem `prisma/seed.ts`; scripts só cmd.exe [01 §5] | `setup`, `dev`, `test`, `lint`, `build`, `reset-db` | **P0** | M | `devops-app`, `banco-de-dados` |
| G07 | CI | n/a | n/a | `.github` inexistente; 12 testes manuais [01 §4.3] | lint+test+build por PR | **P0** | P | `devops-app`, `qa` |
| G08 | Baseline de banco e RLS versionada | n/a | n/a | Prisma defasado; 52 SQLs soltos [01 §1.1, 1.5] | Esquema reproduzível | **P0** | M | `banco-de-dados`, `arquiteto` |
| G09 | Testes de isolamento entre organizadores e entre times | n/a | n/a | Sem teste de `organizador-isolamento`, auth, middleware [01 §4.3] | Suíte HTTP; passa a cobrir também "organizador não vê banco do time" | **P0** | M | `qa`, `seguranca` |
| G10 | LGPD de menores: consentimento, retenção, minimização, exclusão | Elenco central [02 §1 #1] | n/v | CPF, documentos, fotos sem política (`schema.prisma:214-240`); S13 | **Agravada** pelo banco reutilizável: política, base legal, consentimento do responsável, direito de exclusão | **P0** (política) / P1 (fluxos) | M | `seguranca`, `suporte-organizacao`, `backend`, `ux` |
| G11 | Autorização do `/painel` no middleware | n/a | n/a | só `/admin` (`middleware.ts:44-70`); S4 | Defesa em profundidade | P1 | P | `backend`, `seguranca` |
| G12 | Observabilidade, backups, homologação | Backup a cada rali [02 §1 #22] | n/v | Vercel+Supabase sem monitoramento descrito | Alertas, backup testado | P1 | M | `devops-infra` |

### 1.2 Meu Time, inscrição e operação do campeonato

Esforço de Meu Time antes ausente do roadmap. O [08 §8.1] registrou: "Meu Time / Competições do prompt ainda não existe no produto". Evidência: equipe pertence a uma única liga (`Equipe.ligaId`, `schema.prisma:99`), sem banco de atletas reutilizável nem "perfil Meu Time" multi-competição [01 §3.6]; sem "explorar competições" nem inscrição de equipe existente [01 §3.7]; só `requirePublicRole(['equipe'])` em `/capitao` (`api/capitao/*`) [01 §3.6].

| # | Funcionalidade | e-Scoresheet [02] | VolleyStation [02 §6] | volei.space hoje [01] / [PROMPT] | Lacuna | Pri | Esf | Responsável |
|---|---|---|---|---|---|---|---|---|
| T01 | **Modelo de dados Meu Time**: `Usuario`, `Clube`, `Equipe`, `MembroEquipe`, `Atleta`, `VinculoAtletaClube`, `Inscricao`, `InscricaoAtleta`, `InscricaoComissao` ([PROMPT] modelo de referência) | Base central da federação [02 §3] | n/v | Não existe; hoje `Equipe` nasce dentro da liga e `Jogador` pertence à equipe (`schema.prisma:99,214-240`) | Separar **equipe/atleta do time** de **inscrição** (cópia); identidade única do atleta (ver decisão D12) | **P1** | G | `arquiteto`, `banco-de-dados` |
| T02 | Conta do time (entrar com Google/e-mail/código, sem senha obrigatória) e papéis (responsável, outros responsáveis) | Login do time por federação [02 §1 #3] | n/v | Login por senha para admin/organizador/equipe/árbitro; ativação por e-mail [01 §1.6] | Onboarding "O que você quer fazer hoje?"; perfis múltiplos | **P1** | M | `backend`, `ux`, `seguranca` |
| T03 | **Link do organizador alimenta Meu Time** (porta de entrada aprovada) | Competição pré-carregada [02 §1 #1] | Elencos carregados por agenda [02 §6] | Link por categoria cria `Equipe` direto `APROVADA` dentro da liga (`links-categoria/route.ts:28`; `team-registration-draft.ts:435`; migration `202610060002`); rascunho por token | O link passa a: criar conta/entrar, criar a equipe **no Meu Time** e gerar a inscrição como cópia; sem aprovação | **P1** | G | `backend`, `banco-de-dados`, `frontend`, `dados-do-campeonato` |
| T04 | Área Meu Time: abas Atletas, Comissão técnica, Dados do time, Inscrições; criar time em 30 s | n/a | n/a | Não existe; `/capitao` é o mais próximo | Telas e API | **P1** | G | `frontend`, `ux`, `designer`, `backend` |
| T05 | Banco de atletas: um por um, colar lista "nome, número" | Roster manual [02 §1 #3] | n/v | Não existe importação por lista/planilha [01 §3.6]; maior ganho de tempo no celular [08 §8.4] | Parser e prévia | **P1** (colar lista) | M | `frontend`, `ux` |
| T06 | Importar planilha (modelo para baixar) | n/a | n/a | Não existe | Importação com validação | P2 | M | `backend`, `frontend` |
| T07 | Convite ao atleta (autocadastro e documentos) e autorização do responsável por menor | n/a | n/a | Cadastro por QR existe só para leitura (`api/jogadores/qr/[token]/route.ts`) [01 §3.6] | Fluxo de consentimento (decisão D13) | P2 | G | `ux`, `backend`, `seguranca` |
| T08 | Indicador de prontidão ("9 atletas, 2 sem documento") | n/a | n/a | Não existe | Cartão com atalho para o que falta | P1 | P | `frontend`, `ux` |
| T09 | Clube com várias equipes (banco do clube, `VinculoAtletaClube`) | n/a | n/a | Não existe | Camada invisível para quem tem 1 time | P2 | G | `arquiteto`, `banco-de-dados`, `ux` |
| T10 | **Assistente de inscrição em 4 passos** (time, atletas, comissão, revisar/aceitar regulamento/pagar) | n/a | n/a | Rascunho por etapas com autosave existe no fluxo do link [01 §2] | Reaproveitar o rascunho como motor do assistente; contador "mínimo/máximo/líberos"; número de camisa e capitão por inscrição | **P1** | M | `frontend`, `ux`, `backend` |
| T11 | **Inscrição = cópia da lista** + regras de elenco por competição (modelos "Padrão FIVB/CBV/Amador livre") | Roster confirmado por competição [02 §1 #3] | n/v | Não existe `InscricaoAtleta` como cópia [01 §1.5]; regras de elenco só na parametrização da categoria | Tabelas de cópia; elegibilidade por idade/naipe/limites | **P1** | G | `banco-de-dados`, `dados-do-campeonato`, `backend` |
| T12 | Um atleta em apenas um time por competição (bloqueio explicado) | Estrangeiros/regras por competição [02 §2] | n/v | Número único por equipe (`supabase-jogador-numero-unico.sql`) [01 §3.6] | Unicidade por competição, ancorada na identidade do atleta (D12) | **P1** | M | `backend`, `banco-de-dados` |
| T13 | **Isolamento: organizador vê só inscrições da sua competição** | n/a | n/a | Padrão `exigirOrganizadorDa*` consistente nas escritas; leituras anônimas abertas (S1/S2) [01 §1.7] | Visões e políticas que nunca expõem o banco do time; teste automatizado | **P0 do desenho / P1 da entrega** | M | `seguranca`, `banco-de-dados`, `qa` |
| T14 | Status da inscrição visível ao time (Rascunho, Enviada, **Pendência** pedida pelo organizador, Recusada, Lista de espera) | n/a | n/a | Equipe nasce `APROVADA` [01 §2] | Ver decisão D14: "sem aprovação" coexiste com **Pendência** por elegibilidade | P1 | M | `backend`, `ux` |
| T15 | Pedido de troca de atleta após o prazo | n/a | n/a | Não existe | `PedidoTroca` que o organizador decide | P2 | M | `backend`, `frontend` |
| T16 | Painel por categoria com alertas de elegibilidade e remoção de equipe | Validação por login do time [02 §1 #3] | n/v | Painel por categoria existe; remoção/alertas não descritos [08 §8.3 recomendação] | Revisão a posteriori sem fila de aprovação | P1 | M | `frontend`, `ux`, `backend` |
| T17 | Competições: explorar, filtros, **selo de elegibilidade** calculado sobre o banco do time | n/a | n/a | Não existe [01 §3.7] | Incremento do pilar (Fase 3), depende de T01, T11, T04 | P2 | G | `frontend`, `ux`, `backend` |
| T18 | Competição privada por link/código e pública | n/a | n/a | Parte existe (convite por token) [01 §1.6] | Flag de visibilidade e código | P2 | M | `backend` |
| T19 | Notificações (e-mail MVP; WhatsApp/push depois) | n/a | n/a | SMTP/Resend opcional (`email.ts`) [01 §1.1] | Prazo em 48 h, aprovada, pendência, jogo amanhã | P2 | M | `backend` |
| I01 | Pagamento real do organizador (cobrança de pilotos) | Licença por competição [02 §6] | Gratuito [02 §6] | Simulado (`pagamento/confirmar/route.ts:1`); webhook só legado [01 §2] | Cobrança real, Pix simples; sem split no MVP [08 §4.3] | P1 | M | `backend`, `suporte-organizacao`, `seguranca` |
| I02 | Marcação manual "pago" por inscrição | n/a | n/a | `APROVADA` sem pagamento [08 §8.3 contra 4] | Campo na `Inscricao` | P1 | P | `backend` |
| I03 | Isolamento por categoria (id) e remoção do legado `serie`/texto `categoria` | n/a | n/a | `schema.prisma:100,123,299` [01 §1.7] | Unificar; facilita a nova `Inscricao` | P1 | M | `banco-de-dados`, `dados-do-campeonato` |
| I04 | Calendário, grupos, mata-mata, classificação | WCM [02 §3] | Agenda AES [02 §6] | Implementado: `estrutura/route.ts`, `eliminatorias.ts`, `championship-operations.ts:65` [01 §2] | Sem teste de classificação fora do harness | P1 | M | `dados-do-campeonato`, `qa` |
| I05 | Portal público e ao vivo básico | Live Score, WCM [02 §3] | Placar ao vivo [02 §6] | Implementado, relê a cada 2 s [01 §2] | Tempo real em J15 | P1 | P | `frontend` |
| I06 | Escala de arbitragem completa | Árbitros do arquivo central [02 §1 #1] | n/v | Escala, candidatura, link com código [01 §2] | Fora do MVP além do existente [08 §5 item 7] | P2 | M | `suporte-organizacao`, `backend` |

### 1.3 Súmula e jogo

| # | Funcionalidade | e-Scoresheet [02] | VolleyStation [02 §6] | volei.space hoje [01] | Lacuna | Pri | Esf | Responsável |
|---|---|---|---|---|---|---|---|---|
| J01 | Motor de regras no servidor (módulo puro compartilhado) | Validação central [02 §2] | n/v | Regras só no cliente (`lancar/page.tsx`, 3.594 linhas); servidor aceita qualquer ocorrência (`schemas.ts:368-386`) [01 §4.1] | Extrair e validar no servidor | **P1** | G | `arquiteto`, `regras-de-volei`, `backend` |
| J02 | Log de eventos imutável, placar derivado, desfazer auditável | Notas técnicas imutáveis [02 §1 #18] | n/v | Delete+insert não atômico (`route.ts:92-114,155-175`); desfazer em memória (`lancar/page.tsx:477`) [01 §4.1] | Event sourcing + RPC atômica | **P1** | G | `arquiteto`, `backend`, `banco-de-dados` |
| J03 | Concorrência (dois apontadores) | Hub local [02 §5] | n/v | Último a gravar vence [01 §4.1 item 6] | Versão otimista por evento | P1 | M | `backend`, `qa` |
| J04 | Substituições: limite e par no servidor | Contador, 6 padrão, par destacado [02 §2] | n/v | 8 e par A↔B só no cliente (`lancar/page.tsx:720-756,787-802`) [01 §3.4] | Limite configurável (D1, D3) | **P1** | M | `regras-de-volei`, `backend` |
| J05 | Substituição excepcional e por lesão | "Exceptional", "Injury" [02 §1 #12] | n/v | Não existe | RG-SUB-010/011 (D4 [03]) | P1 | M | `regras-de-volei`, `backend` |
| J06 | Líbero: corrigir divergência e validações | Libero In/Out, troca de líberos [02 §1 #13] | n/v | Líbero inicial obrigatório (`lancar/page.tsx:588-596`) e par na troca (`:787-802`), contra o requisito [01 §6 item 1] | RG-LIB-005..012 como aviso configurável (D7 [03]) | **P1** | M | `regras-de-volei`, `frontend`, `backend` |
| J07 | Rotação e erro de rotação | Zonas 1 a 6, rotate manual registrado [02 §2] | n/v | Só cliente (`lancar/page.tsx:3511-3516`, `:3351`) [01 §3.3] | RG-ROT/RG-POS e reversão (CJ-03 [03]) | P1 | G | `regras-de-volei`, `backend` |
| J08 | Sets e terceiro set obrigatório | Fim de set automático [02 §2] | n/v | `category-match-rules.ts`; `terceiroSetObrigatorio` sem coluna no Prisma, a verificar [01 §3.1] | D2 [03] | P1 | M | `regras-de-volei`, `dados-do-campeonato` |
| J09 | Tempo técnico parametrizável | Só em desafio [02 §2] | n/v | 2 por set no cliente (`lancar/page.tsx:807-816`) | D8 [03] | P2 | P | `regras-de-volei` |
| J10 | Sanções e protestos | Falta dá ponto; protesto com placar [02 §1 #14-15] | n/v | Texto livre (`lancar/page.tsx:817`) | D13 [03] | P1 | M | `regras-de-volei`, `backend` |
| J11 | **Papeleta digital do técnico** (envio pelo líder logado, trava, aceite do apontador) | ES Bench, 12 min antes [02 §1 #7] | n/v | Papeleta só do apontador, texto em `OcorrenciaPartida` (`lancar/page.tsx:578-633`) [01 §3.2] | Usa **a lista da inscrição aprovada** (T11) e a conta do time (T02): com Meu Time vira natural | P2 | G | `arquiteto`, `frontend`, `ux`, `backend` |
| J12 | Offline-first | Hub local [02 §5] | n/v | Só `localStorage` (`lancar/page.tsx:347,915`) [01 §4.1 item 7] | Fila de eventos, PWA | P2 | G | `frontend`, `arquiteto`, `qa` |
| J13 | App de banco | ES Bench [02 §3] | n/v | Não existe | Banco prepara, apontador confirma [02 §5] | P2 | G | `frontend`, `ux`, `designer` |
| J14 | App do árbitro em tempo real | ES Referee [02 §3] | V-Score Referee [02 §6] | `/arbitro/jogo/[token]` [01 §1.6] | Tempo real | P2 | M | `frontend`, `backend` |
| J15 | Placar ao vivo (telão, overlay) | Live Score, LiteScore [02 §3] | Placar ao vivo [02 §6] | Polling 2 s [01 §2] | SSE/WebSocket, overlay | P2 | M | `frontend`, `devops-app` |
| J16 | Súmula oficial em PDF | Vários modelos [02 §4] | PDF, equivalência n/v [02 §6] | Não consta no [01] | PDF padrão CBV | P1 | G | `frontend`, `regras-de-volei`, `designer` |
| J17 | Assinatura/fechamento | Senha do árbitro e supervisor [02 §1 #20] | n/v | `sumulaAprovadaEm` sem assinatura (`route.ts:50-52`) | Ratificação digital (D6 [03]) | P1 | M | `backend`, `seguranca` |
| J18 | Correção pós-encerramento | "Manual changes" [02 §1 #18] | n/v | POST recusa após aprovada; organizador não corrige pela API (`route.ts:50-52`, `arbitro-access.ts:28-62`); S8 | Rota de correção com motivo | P1 | M | `backend`, `regras-de-volei` |
| J19 | Sugestão automática de MVP | n/a | n/a | Exige MVP, sugestão [AP] (`route.ts:62-70`) | D11 [03] | P2 | P | `backend` |
| J20 | Scout por fundamento e `.dvw` | Data Video; `.dvw` n/v [02 §3] | Análises [02 §6] | `player-scouts.ts` [01 §1.2] | Formato n/v [02 §7 item 4] | P2 | G | `dados-do-campeonato`, `backend` |
| J21 | Desafio por vídeo | Pedidos, limite de 2 [02 §1 #16] | Modelo Superliga | Não existe | Fase posterior | P2 | G | `arquiteto`, `frontend` |
| J22 | Set de ouro, WO, incompleta, set anulado | Golden set [02 §1 #21] | n/v | Não tratados (D9, D12, D13 [03]) | Modelo e testes | P2 | M | `regras-de-volei`, `backend` |
| J23 | Idiomas e vôlei de praia | WCM multilíngue | n/v | pt-BR; praia fora do MVP [08 §5 item 11] | [03 §4] | P2 | M | `regras-de-volei`, `frontend` |

Todas as funcionalidades de [02 §1 a §4] aparecem acima, exceto as de hardware local (LiteScore físico, pendrive, Bluetooth), cobertas por J12 e J15. A [PROMPT] "Experiência prioritária" foi decomposta em T01 a T19.

---

## 2. Onde o volei.space pode superar a referência

Todos partem das lacunas reais de [02 §5, §6, §7] e do novo pilar Meu Time. Cada um tem métrica de prova.

1. **Cadastre uma vez, use em todo campeonato (diferencial estrutural).** O e-Scoresheet depende de uma base central mantida pela federação e de roster por competição [02 §1 #3]; o VolleyStation recebe elencos da agenda do torneio [02 §6]. Aqui o banco de atletas pertence ao time e a inscrição é uma cópia. Prova: 70% ou mais dos times em segunda competição reaproveitam atletas sem recadastro; segunda inscrição em menos de 3 minutos ([PROMPT] meta).
2. **Link do organizador já cria a conta e o time.** A porta de entrada sem aprovação elimina a base central e a fila de aprovação; o líder entra pelo WhatsApp do organizador e chega à inscrição pronta. Prova: mediana do clique no link até inscrição enviada menor que 10 minutos no celular ([08 §6]).
3. **Papeleta digital sem app e sem rede local, ancorada na inscrição.** O ES Bench é APK Android em rede local [02 §3, §5]. A papeleta sai da lista aprovada do Meu Time, com número, capitão e líbero já definidos. Prova: papeleta recebida 12 minutos antes em 100% dos jogos do piloto [02 §1 #7].
4. **Validação explicada.** O motor devolve o código `RG-xxx` do [03], o artigo e a ação corretiva; o e-Scoresheet bloqueia sem documentar o motivo [02 §2]. Prova: 100% das rejeições com código e texto.
5. **Regras configuráveis por perfil (FIVB, CBV, amador).** [03 D1, D2, D10] mostra que estaduais variam; a súmula marca "formato não-FIVB". Prova: mesma suíte passa com 6 e 8 substituições.
6. **Zero instalação, multi-dispositivo e offline-first (Fase 2).** A referência é Windows+APK+IP fixo [02 §5]. Prova: 3 horas offline com dois apontadores, zero evento perdido.
7. **Log auditável e elegibilidade explicada ao time.** Antes de enviar a inscrição o time vê "faltam 2 atletas na idade" ([PROMPT]); a referência valida só no posto [02 §2]. Prova: menos de 5% das inscrições com pendência de elegibilidade no 1º envio nos pilotos.
8. **Preço acessível e time grátis.** E-Scoresheet por licença sob consulta; VolleyStation grátis, com nota baixa e sem integração a campeonato próprio [02 §6]. Prova: 3 organizadores pagantes em 90 dias [08 §6].
9. **Competição inteira no mesmo produto, mais histórico do atleta (Fase 3).** Inscrição, tabela, súmula, classificação, portal, e estatísticas por atleta ao longo das competições; concorrentes genéricos (SporTI, Copa Fácil [08 R1]) não têm regras de vôlei.

---

## 3. Roadmap em fases

Ordem obrigatória: **segurança primeiro**. Nada da Fase 1 em diante é publicado antes do gate da Fase 0. Correspondência com o [PROMPT]: Fases 0 e 1 = MVP, Fase 2 = Federação, Fase 3 = Profissional/ecossistema.

### Fase 0: segurança e fundação (bloqueia tudo)

Itens: G01 a G10 (política LGPD) e o desenho de T13 (isolamento).

| Entrega | Critério de aceite (mensurável) | Dono |
|---|---|---|
| Fim da leitura anônima (G01, G02) | `GET /api/jogadores`, `/api/equipes`, `/api/equipes/[id]` sem sessão retornam 401/403 ou só campos públicos; teste prova 0 ocorrência de CPF, documento, nascimento, telefone e `qrCodeToken` em respostas anônimas; organizador A recebe 0 registros de B | `seguranca`, `backend` |
| RLS versionada (G01, G08) | Política RLS por tabela com dado pessoal em migration; teste com chave anon lê 0 linhas de `Jogador`, `Equipe`, `InscricaoCampeonato` | `banco-de-dados`, `seguranca` |
| Credenciais (G03) | `grep` por `LuvAdmin` e `admin@luv.com.br` retorna 0; senha antiga inválida; segredos rotacionados | `seguranca`, `devops-app` |
| Súmula sem id sequencial (G04) | Rotas públicas só com token opaco de 128 bits ou mais; `GET /api/sumula/1..100` sem credencial retornam 404 | `backend` |
| Rate limit (G05) | Mais de 5 falhas em 15 min por IP/conta retornam 429; segredos de sessão e de convite separados | `seguranca` |
| Setup local (G06) | Clone limpo + `setup` + `dev` em até 15 min [PROMPT]; seed com 2 organizadores, 3 competições, 4 equipes com atletas, 1 partida; `reset-db` em menos de 2 min; roda em Windows, Git Bash, Linux | `devops-app`, `banco-de-dados` |
| Baseline de banco (G08) | Banco vazio + baseline + migrations = esquema atual sem passo manual | `banco-de-dados`, `arquiteto` |
| CI (G07) | `lint`, `test`, `build` bloqueiam merge; `npm test` agrega os testes atuais | `devops-app`, `qa` |
| Isolamento (G09) | Teste HTTP por rota sensível: organizador A não lê nem altera B; **teste negativo preparado** para "organizador não lê o banco do time" | `qa` |
| Política LGPD de menores (G10) | Documento aprovado: base legal, dados mínimos, retenção, exclusão, quem consente; sem implementação de banco de atletas antes dele | `seguranca`, `suporte-organizacao` |

**Gate:** critérios verdes no CI; `seguranca` sem achado P0 aberto do [01 §4.2] (S1, S2, S3, S7); política LGPD assinada pelo dono.

### Fase 1: MVP, rodando em duas trilhas paralelas

**Trilha 1A: Meu Time núcleo (T01 a T05, T08, T10 a T14, T16, I02, I03).** Entrega o pilar: conta do time, banco de atletas, o link do organizador alimentando o Meu Time, inscrição como cópia, isolamento.

**Trilha 1B: súmula confiável (J01 a J08, J10, J16 a J18) e cobrança (I01, I04, I05).**

| Entrega | Critério de aceite (mensurável) | Dono |
|---|---|---|
| Modelo Meu Time + migração (T01, I03) | Tabelas `Usuario`, `Equipe`, `MembroEquipe`, `Atleta`, `Inscricao`, `InscricaoAtleta`, `InscricaoComissao` criadas; equipes e jogadores existentes migrados sem perda (contagem antes = depois); `serie` removida | `arquiteto`, `banco-de-dados` |
| Conta e onboarding (T02) | Entrar com e-mail ou código; pergunta "O que você quer fazer hoje?"; 0 painel vazio no 1º acesso (teste de usabilidade) | `backend`, `ux`, `seguranca` |
| Link do organizador cria/usa Meu Time (T03) | Líder que abre `/inscricao/categoria/[token]` cria conta, equipe e inscrição `APROVADA` sem fila; com equipe existente, reaproveita atletas; reenvio idempotente (mesmo resultado); organizador vê só a inscrição | `backend`, `frontend` |
| Meu Time: telas, colar lista, prontidão (T04, T05, T08) | Teste com 5 pessoas que nunca usaram: cria o time e cadastra 10 atletas em menos de 5 min no celular, 90% sem ajuda [PROMPT, 08 §6] | `ux`, `frontend` |
| Assistente de inscrição de 4 passos e cópia da lista (T10, T11) | Mudança no banco do time não altera inscrição enviada (teste); contador mínimo/máximo/líberos; do cartão ao envio em menos de 3 min com time pronto | `frontend`, `backend`, `dados-do-campeonato` |
| Unicidade por competição (T12) | Atleta duplicado em 2 equipes da mesma competição é bloqueado com motivo; atleta em 2 competições é permitido | `backend` |
| Isolamento do banco (T13) | Teste automatizado: organizador nunca recebe atletas fora das suas inscrições; 0 vazamento nos 3 cenários (2 organizadores, 2 times) | `qa`, `seguranca` |
| Status, pendência e painel (T14, T16) | Time vê o status; organizador pede pendência com comentário e remove equipe em 1 clique (ver D14) | `backend`, `ux` |
| Motor de regras (J01) | Servidor rejeita 100% dos casos ilegais cobertos com código `RG-xxx`; regras de prioridade alta do [03 §6] cobertas a 100% | `arquiteto`, `regras-de-volei` |
| Log atômico (J02, J03) | Placar reconstruído só dos eventos coincide em 100% dos jogos de teste; falha injetada deixa 0 efeito parcial; dois apontadores geram conflito detectado | `backend`, `banco-de-dados` |
| Divergências do [03] (J04, J06, J08) | Limite de substituições configurável, padrão 6; par repetido sinalizado; líbero inicial opcional, troca sem criar par; testes com 6 e 8 | `regras-de-volei`, `backend` |
| Excepcional e sanções (J05, J10) | Contador separado, lesionado não retorna; 10 casos do [03 §5] viram testes | `regras-de-volei`, `qa` |
| Correção e fechamento (J17, J18), PDF (J16) | Correção com motivo no log; PDF de 1 jogo revisado por especialista e 1 apontador, sem campo obrigatório do guia CBV ausente | `backend`, `frontend`, `designer` |
| Cobrança real e pagamento manual (I01, I02) | 3 organizadores pilotos pagantes em 90 dias [08 §6]; 0 registro `simulado` em produção | `backend`, `suporte-organizacao` |
| LGPD em fluxo (G10 parte P1) | Termo de responsabilidade do líder (menores) registrado na conclusão; exclusão de atleta atende pedido em até 15 dias | `seguranca`, `backend` |
| Operação (G11, G12) | Homologação separada; backup restaurado em teste; plano de volta em até 10 min | `devops-infra` |

**Gate da Fase 1:** campeonato real de ponta a ponta com 2 ou mais categorias, equipes por link entrando no Meu Time, súmula validada no servidor, classificação e portal; 0 reclamação procedente de classificação [08 §6]; pelo menos 1 time inscrito em 2 competições reaproveitando o banco.

Se a capacidade não permitir paralelismo, a Trilha 1B tem precedência para J01 e J02 (a base de J11 a J15), e a Trilha 1A pode escorregar para o início da Fase 2, desde que T03 (porta de entrada) e T13 (isolamento) saiam juntos.

### Fase 2: Meu Time completo, papeleta, offline, banco, placar

Itens: T06, T07, T09, T15, T19, J09, J11 a J15, J19, J22, I06.

| Entrega | Critério de aceite (mensurável) | Dono |
|---|---|---|
| Importar planilha e convite ao atleta (T06, T07) | Planilha de 30 linhas importada com relatório de erros por linha; atleta menor só ativa com autorização do responsável registrada (D13) | `backend`, `ux`, `seguranca` |
| Clube com várias equipes (T09) | Banco do clube compartilhado entre 2 equipes; interface idêntica para quem tem 1 time (teste de usabilidade) | `arquiteto`, `ux` |
| Pedido de troca pós-prazo e notificações (T15, T19) | Organizador aprova/recusa; e-mail em 48 h do prazo enviado em 100% dos casos (teste) | `backend` |
| Papeleta digital (J11) | Envio pelo líder logado, travada após envio, aceite do apontador; 100% dos jogos do piloto com 12 min de antecedência; 0 número fora da inscrição aprovada | `arquiteto`, `frontend`, `ux` |
| Offline-first (J12) | 3 h sem rede com dois dispositivos: 0 evento perdido, sincronização em menos de 30 s | `frontend`, `qa` |
| App de banco e árbitro (J13, J14) | Pedido chega ao apontador em até 2 s; banco só prepara, apontador confirma | `frontend`, `ux` |
| Placar ao vivo (J15) | Atraso p95 abaixo de 2 s; 50 espectadores sem degradar a gravação | `frontend`, `devops-app` |
| Regras restantes (J09, J22) | Tempo técnico parametrizável; WO, WO duplo, incompleta, set anulado no modelo e testes | `regras-de-volei` |

### Fase 3: busca pública e marketplace (incremento do Meu Time), scout, desafio

Itens: T17, T18, J20, J21, J23.

| Entrega | Critério de aceite (mensurável) | Dono |
|---|---|---|
| Explorar competições e selo de elegibilidade (T17, T18) | Selo (apto / faltam N atletas / naipe) calculado no servidor sobre o banco do time, só visível ao próprio time; competição privada só por link; ativar com pelo menos 20 organizadores ativos (hipótese) [08 §5 item 10] | `frontend`, `ux`, `backend` |
| Histórico do atleta e estatística | Histórico por atleta em várias competições, só com consentimento (D13) | `dados-do-campeonato`, `seguranca` |
| Scout e `.dvw` (J20) | Arquivo importado no Data Volley por usuário real; depende do formato (n/v [02 §7 item 4]) | `dados-do-campeonato` |
| Desafio por vídeo (J21) | Pedidos, limite por equipe e nota automática [02 §1 #16] | `arquiteto`, `frontend` |
| Idiomas e praia (J23) | en/es nas telas principais; regras de praia [03 §4] no motor | `regras-de-volei` |

Resumo por fase do que é Meu Time: **F0** política LGPD e isolamento; **F1** conta, banco, link como porta de entrada, assistente, cópia, isolamento; **F2** planilha, convite ao atleta, clube multi-equipe, troca, notificações e papeleta; **F3** busca pública, selo, marketplace e histórico.

---

## 4. Decisões em aberto que dependem do dono

Sem decisão, a implementação mantém o comportamento atual e registra a pendência.

| # | Decisão | Opções | Recomendação | Origem |
|---|---|---|---|---|
| D1 | **8 ou 6 substituições por set** | fixo 8; fixo 6; configurável | **Configurável por campeonato, padrão 6**, 8 como perfil "amador". 8 gera súmula inválida em CBV/FIVB | [03 D1]; [01 §3.4] |
| D2 | **Terceiro set obrigatório** após 2x0 | proibir; permitir por organizador | **Permitir, desligado por padrão**, súmula marca "formato não-FIVB"; definir que não é decisivo | [03 D2]; [01 §3.1] |
| D3 | **Repetição do par A->B** | bloquear; permitir sinalizando | Bloquear em perfis FIVB/CBV; permitir com aviso no amador | [03 D3] |
| D4 | **Revogação e validade do link de convite** | sem expiração (hoje); expiração por data; revogação pelo organizador | **Revogação pelo organizador mais prazo opcional**; remover equipe concluída por engano; vagas contadas no servidor; sem reintroduzir aprovação. Com Meu Time: revogar o link **não** apaga a conta nem o time do líder, só impede novas inscrições; inscrições já feitas permanecem até o organizador removê-las | [08 §8.3 contra 1, §8.5 item 3] |
| D5 | **Janela de correção da súmula** | 30 min via link e depois só organizador; outra | Implementar o aprovado, com motivo registrado e ratificação dos capitães | [03 D6]; [01 §6 item 2, S8] |
| D6 | **Líbero inicial obrigatório** | obrigatório (código); opcional (requisito) | Opcional; corrigir código | [01 §6 item 1]; [03 RG-LIB-001] |
| D7 | **Tempo técnico** | não tratar; parametrizar | Parametrizar, padrão desligado em indoor | [03 D8] |
| D8 | **MVP obrigatório antes de oficializar** | sempre; configurável | Configurável, padrão ligado | [03 D11] |
| D9 | **Cobrança de inscrição das equipes pela plataforma** | só o organizador paga a plataforma; taxa sobre inscrição | Só o organizador paga no MVP; "pago" manual; taxa e split depois. **Time continua grátis** | [08 §4.3, §8.5 item 2] |
| D10 | **WO e partida incompleta na classificação** | depende do regulamento | Parametrizar; padrão FIVB 0x3 e 0x25 por set | [03 D9, D13] |
| D11 | **Vocabulário `Liga`/`ligaId`** | renomear; manter como legado | Manter no código, esconder na interface; renomear junto da migração de T01 | `CLAUDE.md` |
| D12 | **Identidade única do atleta entre times e clubes** | (a) um `Atleta` global identificado por documento/CPF; (b) um `Atleta` por time com vínculo opcional por documento; (c) por conta do próprio atleta (e-mail/telefone) | **(b) no MVP**: `Atleta` pertence ao banco do time, com identificador de documento **cifrado/hash** para detectar duplicidade na mesma competição (T12) sem revelar dados entre times; **(a)/(c) só na Fase 3**, com a conta do atleta e consentimento. Evita que organizador ou outro time descubra em que times o atleta joga. Risco: duplicatas se o documento faltar; mitigar com aviso | [PROMPT] modelo `Atleta`/`VinculoAtletaClube`; [01 §3.6] |
| D13 | **Consentimento do responsável por menor** | termo do líder; autorização do responsável pela plataforma; autorização por competição | **Piloto (F1): termo de responsabilidade do líder**, registrado com data e versão. **F2: autorização do responsável por link (T07)**, válida por temporada, revogável, exigida para convite ao atleta e para histórico (F3). Dado de menor nunca em busca pública nem em selo | [08 R4, §8.5 item 4]; [PROMPT] convite de atleta; [01 S13] |
| D14 | **Como convive "sem aprovação" com "elegibilidade"** | (a) elegibilidade só informa; (b) bloqueia o envio; (c) aprova se elegível e marca pendência se não | **(c)**: inscrição por link entra `APROVADA` quando passa nas regras automáticas (idade, naipe, limites, número duplicado); se falha, o sistema **explica antes de enviar** e permite enviar como **Pendência** em itens não bloqueantes (ex.: documento faltando), sem fila obrigatória de aprovação humana; bloqueios duros só em regras objetivas (naipe, duplicidade na competição, vagas esgotadas). O organizador revisa a posteriori e pode remover. Não reintroduz a aprovação manual da LUVA | `CLAUDE.md`; [08 §8.3, §8.4]; [PROMPT] status |
| D15 | **Vínculo atleta-clube** | só time; clube obrigatório; clube opcional invisível | **Clube opcional e invisível** para quem tem 1 time ([PROMPT]); camada de Clube só na Fase 2 (T09); vínculo mantém histórico de entrada/saída | [PROMPT] |
| D16 | **Competição privada e busca pública** | todas públicas; todas por link; escolha do organizador | Escolha do organizador, padrão **privada por link** até haver massa crítica | [PROMPT]; [08 §5 item 10] |
| D17 | **Quem é dono do atleta quando o líder sai do time** | some; transfere; fica com o clube | Transferência explícita de titularidade da conta do time; sem o líder, dados de menores são congelados e entram na política de retenção | G10 |
| D18 | **Pesquisa com usuários** antes da Fase 2 | rodar 8 entrevistas de organizadores e 4 de líderes | Executar em paralelo à Fase 0; incluir teste do fluxo "link cria conta" | [08 §9] |

---

## 5. Riscos e dependências entre fases

### 5.1 Dependências

1. **Fase 0 antes de tudo.** Banco de atletas reutilizável e de menores multiplica o impacto de S1/S2/S13 [01 §4.2]; T01 a T05 só começam a publicar depois do gate.
2. **G08 (baseline) antes de T01.** O novo modelo precisa de migração reprodutível; **G10 (política LGPD)** antes de qualquer tela que colete dado novo de atleta.
3. **G09 e T13:** o teste de isolamento do banco do time deve existir antes da primeira inscrição real.
4. **I03 (remover `serie` e unificar categoria) antes de T11**, para a `Inscricao` apontar para `categoriaCampeonatoId` limpo.
5. **T02 (conta) antes de T03 (link cria conta) e de J11 (papeleta)**: a papeleta depende da conta do time e da lista da inscrição (T11).
6. **J01 e J02 antes de J03, J11 a J15**: sem motor e log, papeleta, offline, banco e placar viram retrabalho.
7. **D12, D13 e D14 antes de fechar T01, T07, T14**: sem elas o modelo de dados e os estados da inscrição mudam depois.
8. **D1 a D3 e D6 antes de fechar J04, J06, J08.**
9. **T17 (busca pública) depende de T01, T11, T04 e de massa crítica** de organizadores [08 §5 item 10].
10. **I01 (cobrança)** é independente do motor mas depende de G05; roda em paralelo.

### 5.2 Riscos

| # | Risco | Fase | Mitigação |
|---|---|---|---|
| RK1 | Fase 0 subestimada: RLS desconhecida e service role em dezenas de rotas [01 S6] | 0 | Inventário de rotas na 1ª semana; política central de autorização |
| RK2 | **Vazamento de banco de atletas de menores** (LGPD), impacto muito alto [08 R4] | 1+ | Gate da Fase 0, minimização, documento cifrado/hash, auditoria de acesso, testes de isolamento, DPO ou responsável nomeado |
| RK3 | **Migração de `Equipe`/`Jogador` para o modelo Meu Time** quebra inscrições, classificação e súmulas existentes | 1 | Migração em duas etapas (dual-write, depois corte); contagem antes/depois; rollback em até 10 min; janela fora de rodada |
| RK4 | **Escopo largo para equipe pequena** ([08 R7]) agora com Meu Time e súmula em paralelo | 1 | Trilhas 1A/1B com gate próprio; Trilha 1A pode escorregar para a Fase 2 mantendo T03 e T13 juntos; assistente completo só na Fase 2 se necessário |
| RK5 | Atrito do **"link cria conta"**: líder desiste ao ver cadastro | 1 | Entrar sem senha (código/Google), salvar rascunho, retomada pelo mesmo link; métrica de funil por etapa [08 §6] |
| RK6 | "Sem aprovação" deixa entrar equipe indesejada ou inelegível [08 R3] | 1 | D14: regras automáticas, pendência, remoção em 1 clique, pago manual |
| RK7 | Duplicidade de atletas por falta de identidade única (D12) | 1 | Documento como chave de detecção; aviso de duplicata; fusão assistida na Fase 2 |
| RK8 | Reescrita do motor (J01) a partir de arquivo de 3.594 linhas regride a quadra | 1 | Testes de caracterização antes; entrega por regra; `qa` revisa |
| RK9 | Mudar substituições de 8 para 6 quebra expectativa de organizadores atuais | 1 | Campeonatos existentes migrados ao perfil "amador" 8; aviso |
| RK10 | Migrar jogos antigos para o log de eventos | 1 | Importar histórico como evento "snapshot"; marcar como não reconstruível |
| RK11 | Regras [M] do [03] viram teste sem confirmação | 1 | Só automatizar [V] e [G]; [M] aguarda especialista (Livro de Casos CBV não lido) |
| RK12 | Piloto não paga [08 R2]; receita depende do organizador enquanto o time é grátis | 1 | Cobrança real cedo, preço de entrada baixo; hipótese de monetização do time só após uso |
| RK13 | Ginásio sem internet antes da Fase 2 [08 R6] | 1 | Aviso claro e autosave local; teste de campo |
| RK14 | Concorrente genérico barato [08 R1] | 1 | Diferenciais 1, 2, 4, 5; entrevistas com usuários dos concorrentes |
| RK15 | Documentação de inscrição conflitante (três gerações de link) [08 §8.3 contra 7] | 0/1 | Nota única "estado vigente" por `arquiteto` e `dados-do-campeonato` antes de T03 |
| RK16 | Formato `.dvw` e protocolos do e-Scoresheet não documentados [02 §7] | 3 | Contato formal com fornecedor; sem engenharia de binário (limite do [PROMPT]) |
| RK17 | Publicar com jogos em andamento | todas | Regra do [PROMPT]; `devops-app` trava no pipeline |

---

## 6. Limites deste relatório

- Esforços são ordens de grandeza, sem calibragem com a equipe.
- Afirmações sobre o VolleyStation herdam a fraqueza das fontes [02 §6, §7 item 7].
- Nada foi executado nem reverificado no código; evidências são as do [01].
- Itens "a verificar" do [01] (RLS, `terceiroSetObrigatorio`, políticas de Storage, webhook sem segredo) devem ser confirmados por `banco-de-dados` e `seguranca` no início da Fase 0.
- Este relatório substitui a versão anterior que tratava Meu Time e busca pública como fase posterior ao MVP.
