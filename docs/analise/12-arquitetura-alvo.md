# 12. Arquitetura alvo do volei.space

Agente: `arquiteto`. Data: 2026-10-16. Somente leitura no código; este é o único arquivo escrito.
Entradas: relatórios 01 (diagnóstico), 03 (regras validáveis), 04 (gap/roadmap), 08 (negócio), `CLAUDE.md`, notas `02-ARQUITETURA` e `11-DECISOES` do vault.
Decisão do dono (vigente): **Meu Time (conta do time + banco de atletas reutilizável) é pilar central**; o convite por link do organizador, por categoria, com cadastro direto pelo líder e **sem aprovação**, continua como porta de entrada.

Legenda: `arquivo:linha` vem dos relatórios 01/04 ou de leitura direta nesta rodada. **[n/v]** = não verificado (depende do banco real, de RLS aplicada ou de código não lido). Nada foi executado.

---

## 0. Resumo e achados por prioridade

Resumo: o app é um monólito Next.js sobre Supabase, com autorização feita em cada rota (JWT próprio + cliente service role), e a súmula é um estado reescrito por delete+insert, com todas as regras de jogo só no navegador. O modelo de dados prende `Equipe` e `Jogador` a uma única liga, o que impede o Meu Time. A arquitetura alvo introduz (a) um domínio de regras puro compartilhado, (b) um log de eventos append-only gravado por RPC atômica com projeção nas tabelas atuais, (c) um módulo Time/Atleta separado da inscrição (a inscrição materializa uma cópia nas tabelas `Equipe`/`Jogador` existentes) e (d) offline-first por outbox idempotente. A migração é por expansão (colunas e tabelas novas, feature flag, sem renomear nada) e começa pelo baseline de banco.

### Crítico
- **C1. Gravação da súmula não é atômica e não há log.** POST/PUT fazem delete+insert sequencial em 5 tabelas (`src/app/api/sumula/[token]/route.ts:92-114,155-175`); desfazer ponto é estado em memória (`src/app/sumula/[token]/lancar/page.tsx:477`). Falha no meio deixa partida sem sets; sem trilha de autor. Recomendação: seção 2.1 (log de eventos + RPC).
- **C2. Regras de jogo só no cliente.** Limite/par de substituição (`lancar/page.tsx:720-756,787-802`), rotação (`:3511-3516`), líbero (`:588-596`) e fechamento de set (`:3556-3594`) não existem no servidor; o schema aceita qualquer ocorrência (`src/lib/schemas.ts:368-386`). Recomendação: domínio puro compartilhado (D-A1).
- **C3. Dados pessoais de atletas legíveis por anon, e o banco de atletas multiplica o dano.** Existem duas policies de SELECT em `Jogador`: `public_read_jogadores ... using (true)` (`supabase/migrations/supabase-producao-elenco-sumula-rls.sql:73-76`) e `luv_public_select_jogador` por status da liga (`supabase/migrations/supabase-rls-producao-permissoes-campeonatos.sql:49-62`). Policies somam por OR; se a primeira estiver aplicada, a segunda não restringe nada **[n/v: o que está aplicado no banco real]**. Somado a `GET /api/jogadores` com `select *` sem sessão (`api/jogadores/route.ts:17`; `organizador-isolamento.ts:50-55`). O gate da Fase 0 do relatório 04 (G01, G02, G09) precede qualquer entrega do Meu Time.
- **C4. O modelo de dados impede o pilar.** `Equipe.ligaId` e `Jogador.equipeId` prendem time e atleta a uma competição (`prisma/schema.prisma:99,214-240`, defasado; conferir o DDL real). Não há entidade que sobreviva entre competições.

### Importante
- **I1. Duas fontes de verdade de schema.** Prisma sem uso em runtime e defasado (sem `categoriaCampeonatoId` em `Equipe`/`Partida`); 52 arquivos em `supabase/migrations`, parte sem timestamp (`supabase-*.sql`) e sem baseline das tabelas originais (relatório 01 §1.1, §4.1.1-2, §5).
- **I2. Autorização é custom, não é RLS.** O login emite JWT próprio (`src/lib/auth.ts:55,63,178`) e as rotas usam `supabase-admin` com service role (`src/lib/supabase-admin.ts:9`), que ignora RLS. Logo RLS por organizador não é viável sem emitir JWT compatível com o Supabase; a segurança depende de cada rota chamar `exigir*` (`organizador-isolamento.ts:6-60`). Decisão D-A5.
- **I3. Sem controle de concorrência.** Dois apontadores sobrescrevem um ao outro (relatório 01 §4.1.6).
- **I4. Sem offline.** Só `localStorage` para vista da quadra e demo (`lancar/page.tsx:347,915`); envio final com 3 tentativas (`:972-985`).
- **I5. Monólito de UI.** `lancar/page.tsx` com 3.594 linhas mistura regra e UI; é o maior risco de regressão da refatoração.

### Desejável
- **D1.** Tempo real do placar hoje é polling de 2 s (`partidas/[id]/ao-vivo/LiveMatchView.tsx`); migrar para push depois do log.
- **D2.** Autorização do `/painel` no middleware (`src/middleware.ts:44-70`), defesa em profundidade.
- **D3.** Segredos JWT separados por finalidade (`auth.ts:9-12`).

---

## 1. Princípios e invariantes

1. **Servidor é a autoridade.** Toda regra de negócio e toda permissão são validadas no servidor (`CLAUDE.md`). O cliente roda o mesmo código de domínio só para UX imediata e para operar offline.
2. **Isolamento em três camadas**: (i) toda leitura/escrita passa por uma função de autorização nomeada; (ii) tabelas com dado pessoal têm RLS **deny-all** para `anon`/`authenticated` (o app usa service role), como defesa em profundidade; (iii) teste automatizado de isolamento por rota (G09).
3. **Fatos são imutáveis, estado é derivado.** Na súmula, o evento é a fonte de verdade; placar, sets e classificação são projeções.
4. **Expandir antes de contrair.** Nada é renomeado ou removido enquanto houver leitor; colunas novas nascem nullable, comportamento novo nasce atrás de flag.
5. **Cópia, não referência, na inscrição.** O organizador nunca lê o banco do time; lê a cópia criada pela inscrição.
6. **A súmula registra fatos.** O árbitro é a autoridade em quadra; regras violadas viram **violação sinalizada** (com override e motivo), não impedimento, exceto invariantes estruturais (seção 2.1.4).

---

## 2. Arquitetura alvo

### 2.1 Motor de regras da súmula no servidor com log de eventos imutável

#### 2.1.1 Visão geral

```
 Navegador (apontador)                        Servidor (Next Route Handler)              Postgres (Supabase)
 ---------------------                        ------------------------------             -------------------
 UI --comando--> reducer local (domínio puro)
      |           outbox (IndexedDB)  --POST /api/sumula/[token]/eventos {eventos[], baseSeq}-->
      |                                          autoriza (token/lease)
      |                                          carrega snapshot + eventos novos
      v                                          reaplica reducer (MESMO código)
 estado derivado                                 gera violações + estado_depois
                                                 chama RPC ---------------------------> sumula_append_eventos()
                                                                                          lock Partida FOR UPDATE
                                                                                          checa seq / idempotência
                                                                                          INSERT PartidaEvento (append-only)
                                                                                          UPSERT PartidaEstado + SetPartida,
                                                                                            OcorrenciaPartida, Partida
                                                                                          (oficialização) recalcula classificação
```

Componentes:

- **`src/domain/sumula/`** (novo; TypeScript puro, **sem imports de react, next, supabase ou node:\***). Contém: tipos de evento, `RegrasPartida` (perfil), `estadoInicial(ctx)`, `aplicar(estado, evento, regras) -> { estado, violacoes[] }`, `validarEvento`, `derivarPlacar`, `fecharSet`, `rotacionar`. É o destino de `rotateVolleyballLineup`, `getAllowedSubstitutionNumbers`, `canCloseSetByRules`, `category-match-rules.ts` e `ponto-sumula.ts`. Roda no navegador e no servidor, sem alteração.
- **Perfis de regra** (`RegrasPartida`), resolvidos no servidor a partir da categoria e **congelados na partida** quando o jogo começa (`regrasVersao`, `regrasSnapshot jsonb`). Parâmetros mínimos, vindos das decisões D1-D3, D6-D8, D10 do relatório 04: `limiteSubstituicoes` (6 padrão, 8 amador), `permiteRepetirPar`, `liberoInicialObrigatorio` (falso), `liberoRegras` (avisos), `alvoSet` (`Np`), `alvoDecisivo` (`Nt`), `melhorDe`, `terceiroSetObrigatorio`, `tempoTecnico`, `mvpObrigatorio`, `woPlacar`, `modalidade` (`indoor` | `praia`).
- **Log `PartidaEvento`** (novo, append-only) e **projeção** `PartidaEstado` (novo, 1 linha por partida, estado serializado + `seq`), mais as tabelas atuais (`Partida`, `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida`, `DestaquesPartida`) mantidas **como projeções derivadas**, para que portal, ao vivo, classificação e PDF não mudem na primeira etapa.
- **RPC `sumula_append_eventos`** (plpgsql) e **`sumula_oficializar`**: únicos escritores das tabelas de projeção para partidas no motor novo.

#### 2.1.2 Modelo do evento

Envelope (colunas de `PartidaEvento`):

| Coluna | Observação |
|---|---|
| `id uuid` PK | gerado no **cliente** (UUID v7); torna o envio idempotente |
| `partidaId` | FK; índice único `(partidaId, seq)` |
| `seq bigint` | atribuído no **servidor**, contíguo por partida |
| `tipo text` com CHECK | enum fechado (abaixo) |
| `payload jsonb` | validado por zod no servidor |
| `ocorridoEm timestamptz` | relógio do cliente (informativo) |
| `recebidoEm timestamptz` | relógio do servidor (autoridade) |
| `dispositivoId`, `clienteSeq` | ordenação local e depuração |
| `autorTipo`, `autorId` | árbitro/sessão de link/organizador (de `AcessoArbitroJogo` ou usuário), sempre derivado da sessão |
| `regrasVersao` | versão do domínio que processou |
| `revertEventoId` | para eventos de correção/reversão (aponta o evento revertido) |
| `violacoes jsonb` | regras violadas no momento, com `override` e `motivo` |

Tipos de evento (alinhados ao relatório 03): `SORTEIO`, `PAPELETA_CONFIRMADA`, `SET_INICIADO`, `PONTO` (com `origem`: ace/ataque/bloqueio/erro, `equipe`, `sacadorAntes`), `PONTO_ANULADO` (desfazer), `ROTACAO_CORRIGIDA`, `SUBSTITUICAO` (`regular|excepcional`), `LIBERO_TROCA`, `LIBERO_REDESIGNADO`, `TEMPO`, `SANCAO` (amarelo, penalidade, expulsão, desqualificação, atraso), `TROCA_LADO`, `SET_ENCERRADO`, `SET_ANULADO` (interrupção, CJ-06b), `INTERRUPCAO`, `WO`, `INCOMPLETA`, `PROTESTO`, `OBSERVACAO`, `ASSINATURA` (capitão/árbitro), `MVP_DEFINIDO`, `PARTIDA_ENCERRADA`, `CORRECAO_ORGANIZADOR` (com `motivo`).

Imutabilidade (garantia no banco, não só na API): `REVOKE UPDATE, DELETE, TRUNCATE ON "PartidaEvento"` para todos os papéis do app, mais trigger `BEFORE UPDATE OR DELETE` que lança exceção. **Desfazer ponto é um evento** (`PONTO_ANULADO` apontando o ponto), não um delete. Os cancelamentos de pontos de CJ-03/CJ-07 (rotação, substituição ilegal) são eventos de reversão que o reducer sabe aplicar (recalcula placar e sacador desde o ponto atingido), cobrindo o requisito do relatório 03 de "reversão auditável".

#### 2.1.3 Projeção e a questão do reducer em TypeScript

O reducer não roda em plpgsql. A decisão (D-A4) é: **o Node calcula, o Postgres só persiste atomicamente.** O Route Handler reaplica o log (snapshot + eventos novos) com o domínio compartilhado, obtém `estado_depois` e as linhas de projeção, e passa tudo à RPC em uma transação. O cliente nunca envia projeção. Se `regrasVersao` mudar, o estado é recomputável a partir do log (job de reprojeção), principal vantagem do log.

#### 2.1.4 O que o servidor bloqueia e o que apenas sinaliza

Como a súmula é um registro de fatos e o app precisa funcionar offline (2.3), rejeitar tardiamente um fato real quebraria o jogo.

- **Bloqueia (invariantes estruturais, HTTP 4xx, evento não gravado):** partida já oficializada (exceto `CORRECAO_ORGANIZADOR` autorizada); atleta ou número que não pertence ao elenco da equipe na partida (já feito em `validateSumulaPayload`, `route.ts:312`); `seq`/`baseSeq` incoerente (409); evento de equipe alheia à partida; payload inválido; ator sem permissão.
- **Sinaliza (aceita com violação gravada no evento):** 9ª substituição quando o perfil é 8, repetição de par, líbero fora de regra, rotação incoerente, set fechado fora da regra de pontos, tempo excedente. A UI exige confirmação com motivo (override). O organizador vê as violações no painel e no PDF. Perfis FIVB/CBV podem marcar regras como `bloqueia`, mas **apenas online**; offline, o cliente sinaliza localmente e o servidor reconcilia na sincronização.
- **Efeito:** cobre D1/D3/D6 sem decisão rígida do dono: o que muda entre perfis é configuração, não código.

#### 2.1.5 Oficialização, correção e classificação

- `PARTIDA_ENCERRADA` só é aceito se o estado derivado satisfaz as invariantes de fechamento já existentes no POST (mínimo de presentes, ao menos 1 set, MVP quando configurado, resultado válido pela regra da categoria; `route.ts:59-73`).
- `sumula_oficializar` roda **na mesma transação**: grava `Partida` final, projeções e chama `recalcular_classificacao_liga` (`championship-operations.ts:65`). Hoje o recálculo é posterior e a falha é só logada (`concluirPublicacao`, `route.ts:263-272`).
- **Janela de correção (D5):** evento `CORRECAO_ORGANIZADOR` com `motivo`, permitido ao organizador dono da liga a qualquer momento e à sessão de link por 30 minutos após a oficialização. Cada correção é novo evento e gera nova projeção; o histórico completo fica no log. Resolve a divergência 2 do relatório 01 §6 e S8.

#### 2.1.6 Concorrência (dois apontadores)

Recomenda-se **lease de mesa** por partida (um escritor ativo): `PartidaMesa(partidaId, dispositivoId, expiraEm)` renovada por heartbeat/escrita; outro dispositivo entra em modo espelho (leitura) ou assume com confirmação. Dentro do escritor ativo, `expected_seq` na RPC detecta qualquer divergência (409 com os eventos que faltam). Evita CRDT/merge de eventos de jogo, desproporcional (D-A12).

#### 2.1.7 Segurança do endpoint

Token opaco de 128 bits ou mais para a partida (fim do id sequencial aceito em `sumula-access.ts:14`, G04); sessão de link com TTL que cubra o jogo (ver 2.3.5); limite de taxa por token; payload com limite de tamanho; `autorId` sempre derivado da sessão, nunca do corpo. Rotas demo (`DEMO_SUMULA_TOKENS`, `route.ts:11,22,39,133`) ficam fora do caminho do motor novo.

---

### 2.2 Módulo Meu Time com identidade única de atleta e isolamento

#### 2.2.1 Separação de conceitos (a decisão central)

Hoje `Equipe` e `Jogador` misturam o **time** (permanente) e a **participação na competição** (temporária). A arquitetura alvo separa:

| Conceito | Tabela | Dono | Vida |
|---|---|---|---|
| Conta | `ContaPublico` existente | pessoa | permanente |
| Time | **`Time`** (novo) | conta do time | permanente |
| Atleta (identidade única dentro do tenant Time) | **`Atleta`** (novo) | o Time | permanente |
| Vínculo time-atleta | **`TimeAtleta`** (novo): número preferido, posição, ativo, entrada/saída | o Time | permanente |
| Comissão técnica e responsáveis | **`TimeMembro`** (novo) | o Time | permanente |
| Inscrição do time numa categoria | `InscricaoCampeonato` **existente**, ganha `timeId` e `categoriaCampeonatoId` | competição | por competição |
| Participação materializada | `Equipe` + `Jogador` **existentes**, ganham `timeId` e `atletaId` nullable | competição | por competição |

**Decisão estrutural: a inscrição é uma cópia materializada nas tabelas `Equipe`/`Jogador` atuais.** Súmula, portal, classificação, QR, ranking e simulação, que leem `Equipe`/`Jogador`, **continuam funcionando sem mudança**. O Meu Time é uma camada **acima** (alimenta essas tabelas), não uma troca delas. O organizador só tem caminho de acesso às linhas materializadas da sua liga.

Campos da cópia (`Jogador`, por inscrição): nome, nascimento, número, posição, foto (referência), `docHash`, `atletaId`. O **CPF/documento completo não é copiado**, a menos que o campeonato exija documento (parametrização existente); nesse caso a cópia guarda o documento cifrado e o acesso do organizador é registrado. Isso implementa a minimização do G10 e da D12.

#### 2.2.2 Identidade única do atleta (D12 detalhada)

- **Escopo da unicidade:** o `Atleta` é único **dentro do Time** por `docHash` (índice único parcial `(timeId, docHash) WHERE docHash IS NOT NULL`). Não existe `Atleta` global na primeira etapa.
- **`docHash` = HMAC-SHA256(pepper do servidor, CPF normalizado ou documento+tipo).** O pepper vive em variável de ambiente do servidor, nunca em banco ou cliente. O hash permite detectar o mesmo atleta em dois times **dentro da mesma competição** (T12 do relatório 04) por consulta no servidor, sem revelar dados de um time ao outro: a API responde só "possível duplicidade no número X", sem identificar o outro time.
- **CPF/documento em repouso:** colunas `docEnc` (AES-256-GCM no aplicativo, chave em segredo gerido, com `keyVersion`) e `docHash`. Nunca em logs. Leitura somente por função de servidor nomeada e auditada.
- **Evolução:** reservar `Atleta.pessoaId uuid null`; quando existir conta do atleta com consentimento (Fase 3), `pessoaId` une atletas de times distintos. Sem retrabalho do modelo.
- **Menores (D13):** `Atleta.dataNascimento` determina `menor`; `consentimentoId` (FK a `ConsentimentoResponsavel`, com versão do termo, data, quem aceitou). No piloto o termo é do líder, registrado por inscrição; o campo já existe para o fluxo da Fase 2.

#### 2.2.3 Matriz de acesso (isolamento)

| Dado | Membro do Time | Organizador da liga | Organizador de outra liga | Público/anon | Admin |
|---|---|---|---|---|---|
| `Time`, `Atleta`, `TimeAtleta`, `TimeMembro` | leitura e escrita | **nenhum acesso** | nenhum | nenhum | só suporte, auditado |
| `Equipe`/`Jogador` materializados | leitura (do próprio time) | leitura e escrita da **sua** liga | nenhum | projeção mínima (nome, número, foto, posição; sem CPF, documento, nascimento, telefone, `qrCodeToken`) | sim |
| `PartidaEvento` e projeções | leitura do próprio time | sua liga | nenhum | projeção pública de placar | sim |

Implementação:
- **Funções de autorização nomeadas e únicas** em `src/lib/authz/`: `exigirMembroDoTime(timeId)`, `exigirOrganizadorDaLiga(ligaId)` (existente), `exigirOrganizadorDaCategoria(categoriaId)`, `exigirAcessoPartida(token, escopo)`. Nenhuma rota fala com `supabaseAdmin` sem passar por uma delas; um teste de arquitetura (grep no CI) falha se uma rota importar `supabase-admin` sem `authz/` (mitiga S6 do relatório 01).
- **Tabelas novas nascem com RLS ligada e sem policy** (deny-all para `anon`/`authenticated`). Acesso só via service role em rotas autorizadas.
- **Leitura pública** por views com colunas públicas ou por rotas que montam projeção mínima. Substitui `select *` em `api/jogadores/route.ts:17` e `api/equipes/route.ts:12-55`.
- **Suíte de isolamento (G09)** com atores time A, time B, organizador X, organizador Y e anon executando as mesmas requisições e afirmando 0 linhas indevidas, incluindo o teste negativo "organizador não lê o banco do time".

#### 2.2.4 Conta do time e o link do organizador como porta de entrada

Conta: reutilizar o JWT público existente (`scope: 'public-user'`, papel `equipe`; `auth.ts:55-63`) e **consultar `TimeMembro` por requisição** (revogação imediata, token pequeno). Acesso sem senha obrigatória por **código de uso único por e-mail (OTP)** com o SMTP existente (`src/lib/email.ts`); senha e Google ficam como opção posterior (D-A8). Rate limit e segredos separados por finalidade (G05, D3) antes de abrir.

Fluxo do link (T03), sem aprovação:

```
Organizador gera link (por categoria/vaga) --> /inscricao/categoria/[token]
  Líder abre -> (a) já logado: escolhe Time ou cria; (b) novo: informa e-mail, recebe OTP,
                    cria Time leve em 1 tela (nome, cidade; naipe vem da categoria)
  Seleciona/cadastra atletas (vão para o banco do Time) -> rascunho com autosave (existente)
  Finalizar -> RPC finalizar_inscricao_meu_time(token, timeId, atletaIds[], numeros[])
       valida vagas/idade/naipe/duplicidade no servidor (D14: "explica antes",
       pendência só em itens não bloqueantes)
       cria Equipe + Jogador (cópia) + InscricaoCampeonato com status APROVADA,
       atômico e idempotente
  Time recebe status; organizador vê a inscrição e pode remover/ajustar (D4)
```

Conversão: para manter a meta de menos de 5 minutos (relatório 08 §6), a **criação da conta pode ser diferida**: o líder conclui com e-mail verificado por OTP e o Time nasce com `claimToken`, assumido ao primeiro acesso. Equipes legadas ganham `Time` por backfill e seguem o mesmo caminho de reivindicação por e-mail.

Atualização do banco após inscrever: a cópia **não retropropaga**; o time vê "o atleta mudou desde a inscrição" e decide sincronizar (ação explícita, respeitando prazo/edição da categoria). Preserva a privacidade: nenhum fluxo reverso do organizador para o Time.

---

### 2.3 Offline-first da súmula

#### 2.3.1 Escopo

Somente a **tela de lançamento** (`/sumula/[token]/lancar`), cenário do ginásio sem internet (R6 do relatório 08). Placar público e painel continuam online. Meta do relatório 04: 3 h offline, dois dispositivos, 0 evento perdido, sincronização em menos de 30 s.

#### 2.3.2 Componentes

1. **Pacote da partida** (`GET /api/sumula/[token]/pacote`): elenco, presenças, papeleta, `regrasSnapshot`, estado atual (`seq`), versão do domínio. Baixado antes do jogo e a cada reconexão.
2. **Service worker** (shell da rota de lançamento, bibliotecas e imagens do elenco), com versão de cache atrelada ao build. Biblioteca sugerida: Serwist/Workbox (n/v: compatibilidade com Next 14.2 App Router, validar em spike).
3. **IndexedDB** (via `idb`) com `pacote`, `outbox` (eventos pendentes, `status: pending|sending|acked|rejected`) e `estadoLocal` (derivado). `localStorage` fica só para preferências.
4. **Reducer local** = o mesmo domínio de 2.1; a UI só lê o estado derivado de `pacote + eventos acked + outbox`.
5. **Sincronizador**: dispara em `online`, `visibilitychange`, após cada comando e por timer com backoff exponencial. Envia lotes ordenados por `clienteSeq` com `baseSeq`. Resposta por evento: `acked(seq)`, `duplicado(id)` (idempotência, tratado como sucesso) ou `rejeitado(motivo)`. Background Sync API **não** é dependência (suporte irregular no iOS/Safari).
6. **Indicador visível**: "salvo no aparelho" / "sincronizado" / "N eventos pendentes", e aviso ao sair da página com pendências.

#### 2.3.3 Conflito

Com lease de mesa (2.1.6), conflito real só ocorre quando o servidor tem eventos que o cliente não viu (outro dispositivo escreveu enquanto este estava offline). O servidor responde 409 com os eventos faltantes; o cliente faz **rebase**, reaplicando seus eventos pendentes sobre o estado atualizado. Se o rebase gerar violação estrutural (ex.: ponto em set já fechado pelo outro), a UI abre tela de resolução ao apontador/organizador e nada é descartado em silêncio (o evento fica `rejeitado` com motivo e visível).

#### 2.3.4 Oficialização offline

`PARTIDA_ENCERRADA` e `ASSINATURA` podem ser gravados localmente. O estado fica "encerrada no aparelho, pendente de envio" até o ack. O resultado só é público e entra na classificação após `sumula_oficializar` (online). A pendência fica visível ao organizador no painel (última sincronização do dispositivo).

#### 2.3.5 Sessão e relógio

A sessão do link precisa sobreviver ao jogo offline: TTL da sessão da súmula cobre a janela da partida mais folga (por exemplo, até 12 h), e o servidor aceita eventos de um dispositivo cuja sessão **expirou durante o período offline** se o `dispositivoId` foi autenticado dentro da janela e o evento tem `ocorridoEm` dentro dela (n/v: ajustar à política de segurança com o agente `seguranca`). O relógio do cliente é só informativo; `recebidoEm` e `seq` mandam.

#### 2.3.6 Teste

Playwright com `context.setOffline(true)`, dois contextos, reconexão em pontos aleatórios, verificação de idempotência (reenvio duplicado) e teste de propriedade do reducer (mesma sequência de eventos gera o mesmo estado no cliente e no servidor).

---

## 3. Decisões (contexto, alternativas, escolha, consequências)

### D-A1. Onde vivem as regras de jogo
Contexto: regras só no cliente (C2); o servidor aceita qualquer coisa.

| Opção | Prós | Contras |
|---|---|---|
| (a) Módulo TypeScript puro compartilhado cliente/servidor | Uma implementação; testável sem UI; permite offline; mesma linguagem do stack | Exige extrair de `lancar/page.tsx`; disciplina de pureza; versionamento do domínio |
| (b) Regras só no servidor (cada ação consulta a API) | Autoridade única | Latência a cada ponto; **inviabiliza offline**; UX pior |
| (c) Duplicar (cliente e servidor separados) | Rápido de começar | Divergência garantida (já há defaults divergentes: 21 pontos e 3 sets, relatório 01 §4.1.4) |
| (d) Regras em plpgsql/RPC | Perto dos dados; atômico | Linguagem ruim para regras de jogo, testes difíceis, não roda no cliente |

**Escolha: (a).** Consequências: cria `src/domain/sumula/` com testes unitários dirigidos pelos IDs RG-* do relatório 03 (prioridade alta primeiro); regra de dependência (domínio não importa infraestrutura) verificada no CI; `regrasVersao` gravada em cada evento.

### D-A2. Event sourcing completo, log + projeção, ou CRUD com auditoria
| Opção | Prós | Contras |
|---|---|---|
| (a) Event sourcing em todo o sistema | Histórico total | Escopo e custo desproporcionais; o resto (inscrição, setup) é CRUD sem ganho |
| (b) **Log de eventos só na súmula**, projeção síncrona transacional nas tabelas atuais | Auditoria, desfazer real, reprocessamento, offline natural; portal e classificação intactos | Duas representações (log e projeção) a manter coerentes |
| (c) CRUD atual + tabela de auditoria | Pouca mudança | Continua sem desfazer correto e sem base de offline; auditoria é "foto" e não reconstrói o jogo |

**Escolha: (b).** Consequências: projeção escrita só pela RPC; teste de coerência (reconstruir do log e comparar com a projeção) no CI e em job periódico; partidas legadas seguem como estão, sem log retroativo.

### D-A3. Regra violada: bloquear ou sinalizar
**Escolha: sinalizar com override e motivo; bloquear apenas invariantes estruturais**, configurável por perfil (2.1.4). Motivo: a súmula registra fatos, há offline, e perfis amador (8 substituições) e FIVB/CBV (6) coexistem. "Bloquear tudo" quebra o jogo real e o offline; "nunca bloquear" anula o valor do produto. Consequência: PDF e painel mostram violações; relatório de conformidade por campeonato.

### D-A4. Onde calcular a projeção
| Opção | Prós | Contras |
|---|---|---|
| (a) **Node calcula, RPC persiste atomicamente** | Reusa o domínio TS; plpgsql simples | Dois passos; a RPC confia no Node (código de servidor, não do cliente) |
| (b) Reducer reescrito em plpgsql | Tudo no banco | Duplica o domínio; testes difíceis |
| (c) Edge Function Deno chamando o domínio | Perto do banco | Mais um runtime, deploy e segredo; pouco ganho |

**Escolha: (a).** A RPC valida `expected_seq` e idempotência; o domínio permanece único.

### D-A5. RLS versus checagem na API
Contexto: o app usa JWT próprio (`auth.ts`), não Supabase Auth; o servidor usa service role (`supabase-admin.ts:9`), que ignora RLS; já existem policies de SELECT públicas em `Jogador` (`supabase-producao-elenco-sumula-rls.sql:73-76`, `using (true)`).

| Opção | Prós | Contras |
|---|---|---|
| (a) **Checagem na API (service role) + RLS deny-all nas tabelas sensíveis** | Compatível com o auth atual; um ponto de decisão testável; RLS vira rede de segurança contra uso indevido da chave anon | Segurança depende de disciplina nas rotas (mitigada por teste de arquitetura e suíte G09) |
| (b) RLS completo com JWT assinado pelo app (claims `role`, `orgId`, `timeIds`) e cliente com a chave do usuário | Defesa real no banco; menos código de autorização | Reescrever dezenas de rotas; claims de time/organizador mudam e exigem reemissão; policies complexas por join (inscrição, categoria, liga); difícil de testar; alto risco de regressão |
| (c) Migrar para Supabase Auth | Alinha com o ecossistema | Migração de usuários e fluxos (ativação, troca de senha, acessos por link); fora de escopo |

**Escolha: (a) agora; reavaliar (b) quando houver consumidor direto do PostgREST/Realtime pelo navegador.** Ações imediatas: substituir `public_read_jogadores using (true)` por deny-all e expor dados públicos por view ou rota de projeção mínima (G01/G02); RLS ligada sem policy em todas as tabelas novas; teste que usa a chave anon contra o banco e exige 0 linhas em `Jogador`, `Equipe`, `InscricaoCampeonato`, `Atleta`, `Time`. **Verificar o que está efetivamente aplicado** (`pg_policies`) antes de qualquer mudança **[n/v]**.

### D-A6. Identidade do atleta
Segue D12 do relatório 04, com o detalhe técnico de 2.2.2: opção (b) com `docHash` HMAC + cifra em repouso; (a) global e (c) conta do atleta ficam para a Fase 3 com `pessoaId` reservado. Contras aceitos: o mesmo atleta em dois times são dois `Atleta`; a deduplicação entre times é só por competição e sem revelar o outro time.

### D-A7. Time como entidade nova ou reutilizar `Equipe`
| Opção | Prós | Contras |
|---|---|---|
| (a) **Tabelas novas `Time`/`Atleta`; `Equipe`/`Jogador` viram a cópia da inscrição** | Não quebra nada; separa permanente de temporário; isolamento natural | Duas camadas conceituais; backfill |
| (b) Tornar `Equipe.ligaId` nullable e reusar `Equipe` como time | Menos tabelas | Mistura estados; toda consulta por liga precisa filtrar; risco de vazamento entre competições; quebra índices únicos (`schema.prisma:123`) |

**Escolha: (a).** Consequência: `Equipe.timeId` e `Jogador.atletaId` nullable; `Equipe` sem `timeId` continua sendo legado válido.

### D-A8. Conta do time
**Escolha: OTP por e-mail como padrão, conta diferida (reivindicação) para o fluxo do link; senha e login social depois.** "Senha obrigatória" derruba conversão no celular (relatório 08 §6); "só Google" exclui parte do público. Pré-requisito: rate limit e segredos separados (G05).

### D-A9. Offline: tecnologia
| Opção | Prós | Contras |
|---|---|---|
| (a) **PWA + IndexedDB outbox + reducer local** | Sem instalação; reusa o domínio; testável | Complexidade de sync e service worker; limites do iOS |
| (b) `localStorage` com fila simples | Rápido | Limite de tamanho, síncrono, frágil; sem service worker a página não carrega offline |
| (c) App nativo | Controle total | Duplicação de código, loja, atrito; contradiz "zero instalação" do relatório 04 |

**Escolha: (a).**

### D-A10. Tempo real
Primeiro o log; depois substituir o polling de 2 s por push. Opções: Supabase Realtime (broadcast de projeção pública mínima, sem dados pessoais, canal por partida) ou SSE do Route Handler. **Recomendação: Realtime em canal público de placar**, com payload gerado no servidor (sem depender de policies de linha). Fica após E4.

### D-A11. Prisma e fonte de verdade do schema
| Opção | Prós | Contras |
|---|---|---|
| (a) **Supabase migrations como única fonte; baseline por dump; tipos por `supabase gen types`; Prisma removido do runtime e do pacote** | Uma verdade; reprodutível; coerente com RPCs e RLS em SQL | Perde o `schema.prisma` como documentação (arquivado) |
| (b) Regenerar Prisma por `db pull` e voltar a usar | ORM tipado | RPCs/RLS/triggers ficam fora do Prisma; segunda ferramenta de migração competindo; o runtime nunca usou Prisma |
| (c) Manter como está | Zero esforço | Perpetua o risco I1 |

**Escolha: (a).** `prisma/schema.prisma` ganha cabeçalho "OBSOLETO, não usar" no primeiro passo e sai quando os tipos gerados cobrirem o código.

### D-A12. Concorrência entre apontadores
**Escolha: lease de mesa + `expected_seq`.** Alternativas: CRDT/merge de eventos (desproporcional; semântica de jogo não comutativa); lock pessimista longo (trava o jogo se o aparelho cair). A lease expira por heartbeat e permite assunção com confirmação.

---

## 4. Plano de migração incremental (sem quebrar o existente)

Regras: (1) **expand, migrate, contract**: só contrair quando não houver leitor; (2) todo comportamento novo atrás de **flag** (por campeonato ou por partida); (3) projeções mantêm as tabelas atuais, então portal/classificação/PDF não mudam de contrato; (4) cada etapa tem rollback; (5) nenhuma migration destrutiva sem backup testado.

### M0. Baseline e reconciliação (Prisma defasado × `supabase/migrations`)
1. **Congelar a verdade**: `supabase db dump --schema public` do ambiente de produção/homologação (o MCP do Supabase permite `list_migrations` e `list_tables`, somente leitura), mais `pg_policies`, `pg_proc` (RPCs) e índices. Registrar o diff entre o dump e a soma das migrations versionadas (itens sabidamente ausentes: `AcessoArbitroJogo`, colunas `categoriaCampeonatoId`, `tokenInscricao`, `terceiroSetObrigatorio`; relatório 01 §1.5, §3.1).
2. **Baseline**: gerar `supabase/migrations/00000000000000_baseline.sql` a partir do dump (tabelas, índices, RPCs, RLS atual). Mover os 52 arquivos antigos para `supabase/legacy-sql/` (preservados para consulta, **não executados**). Ambientes existentes: `supabase migration repair --status applied 00000000000000` para não reaplicar.
3. **Prova de reprodutibilidade**: banco vazio + baseline + migrations novas = dump atual (diff vazio), no CI com Postgres em container (resolve G06/G08 e o harness manual de `category-selection.test.ts`).
4. **Tipos**: `supabase gen types typescript` em `src/types/db.ts`; código novo usa esses tipos. `schema.prisma` marcado obsoleto; remover `prisma.seed` do `package.json` (aponta para arquivo inexistente) só depois de confirmar que nada importa `@prisma/client` (o relatório 01 §1.1 diz que nada importa).
5. Rollback: o baseline é aditivo (arquivos); nada muda no banco.

### M1. Rede de segurança do comportamento atual (antes de tocar na súmula)
Testes de **caracterização** (golden) das funções que serão extraídas: `rotateVolleyballLineup`, `getAllowedSubstitutionNumbers`, `countSavedSubstitutions`, `restoreSubstitutionLocks`, `canCloseSetByRules`, `validateCategoryResult`, `encodeRotationMarker`. Registram o comportamento **atual**, inclusive os desvios documentados (líbero inicial obrigatório, par criado na troca de líbero), marcados "divergente do requisito" para corrigir só na etapa de regras. Adicionar runner de teste e `npm test` portátil (`cross-env`); CI com lint + test + build (G07).

### M2. Extração do domínio (sem mudança de contrato)
Mover as funções acima para `src/domain/sumula/`; `lancar/page.tsx` e `route.ts` passam a importá-las. Mesmas entradas e saídas; golden tests continuam verdes. Em seguida, corrigir os desvios (líbero, par) **com testes dos RG-LIB/RG-SUB** e o perfil de regras (D1-D3, D6). Rollback: reverter o commit; a UI continua funcional porque o contrato é o mesmo.

### M3. Log de eventos em paralelo (shadow, depois cutover por flag)
1. Migration (expand): `PartidaEvento`, `PartidaEstado`, `PartidaMesa`, coluna `Partida.motor text default 'v1'`, RPCs `sumula_append_eventos` e `sumula_oficializar`, REVOKE/trigger de imutabilidade, RLS ligada sem policy.
2. Novo endpoint `POST /api/sumula/[token]/eventos` e `GET .../pacote`, **ao lado** dos `POST/PUT /api/sumula/[token]` atuais, que continuam intactos para `motor = 'v1'`.
3. `Partida.motor = 'v2'` só é atribuído por flag no **campeonato de simulação/teste** (`campeonato-teste.ts`, `simulacao.ts` já existem) e depois a campeonatos piloto. Partidas `v1` não são migradas (sem log retroativo; o relatório 03 não exige).
4. Em partida `v2`, as rotas antigas respondem 409 "use o motor novo", evitando escrita dupla; em `v1`, o endpoint novo responde 409.
5. Teste de coerência log × projeção; teste de reenvio idempotente sob carga.
6. Rollback: voltar a flag para `v1` em partidas **não iniciadas**; partida `v2` em curso termina em `v2` (não trocar de motor no meio do jogo).

### M4. Meu Time (expand, backfill, contract parcial)
1. **Pré-requisitos**: Fase 0 verde (G01, G02, G05, G09, G10); baseline (M0); I03 (remover `serie`, unificar categoria) desejável antes de a inscrição apontar para `categoriaCampeonatoId` limpo.
2. Expand: `Time`, `TimeMembro`, `Atleta`, `TimeAtleta`, `ConsentimentoResponsavel`, `AuditoriaAcessoDocumento`; colunas nullable `Equipe.timeId`, `Jogador.atletaId`, `Jogador.docHash`, `InscricaoCampeonato.timeId`. Todas as tabelas novas com RLS ligada e sem policy.
3. Backfill **idempotente e reexecutável** (script com `dry-run`): para cada `Equipe` existente cria `Time` (não reivindicado) e para cada `Jogador` cria `Atleta`, deduplicando por `docHash` dentro do time. Registra contagens e conflitos; não altera `Equipe`/`Jogador` além de preencher as chaves novas.
4. Nova RPC `finalizar_inscricao_meu_time` **reaproveitando o corpo** de `finalizar_inscricao_equipe_rascunho` (`team-registration-draft.ts:435`, migration `202610060002`); a RPC antiga permanece para o fluxo sem conta enquanto a flag `inscricao_meu_time` não for geral.
5. Fluxo do link com conta/OTP atrás da flag, por campeonato. Rollback: desligar a flag; o fluxo antigo segue operando (tabelas novas ficam sem uso, não destrutivo).
6. Contract: apenas `NOT NULL`/FK nas tabelas novas; `Equipe.timeId` permanece nullable por causa do legado. A coluna `serie` e o texto `categoria` saem em I03, separado.

### M5. Offline em fatias
(1) pacote da partida + cache de leitura; (2) outbox IndexedDB com envio idempotente (já suportado pelo endpoint de M3); (3) service worker do shell; (4) teste de 3 h. Cada fatia atrás de flag, começando por modo "salvar localmente além de enviar" (sem remover o envio online), validado em campo antes de depender dele.

### M6. Tempo real
Substituir o polling de 2 s por push só depois de M3 estável; manter o polling como fallback por uma versão.

---

## 5. Ordem de implementação com dependências

Referências: IDs G/J/T/I e D do relatório 04. Esforço P ≤ 3 dias, M 1 a 3 semanas, G > 3 semanas (uma pessoa, ordem de grandeza, sem calibragem).

| Etapa | Entrega | Depende de | Libera | Gate de saída | Dono | Esf |
|---|---|---|---|---|---|---|
| **E0** | Fase 0 de segurança: G01-G05 (leitura anônima, credenciais, token opaco, rate limit), RLS deny-all | nada | tudo | 0 PII em resposta anon; `GET /api/sumula/1..100` sem credencial = 404 | `seguranca`, `backend` | M |
| **E1** | Baseline + tipos + ambiente local + CI (M0, G06-G08) | E0 em paralelo | E3, E4, E7 | Banco vazio + baseline = dump; `npm test` verde no CI | `banco-de-dados`, `devops-app` | M |
| **E2** | Política LGPD de menores (G10) e decisões D1-D3, D6, D12-D14 do dono | nada | E3 (perfil), E7 | Documento aprovado; decisões registradas em `11-DECISOES` | dono, `seguranca` | P |
| **E3** | Caracterização + extração do domínio puro + perfil de regras (M1, M2; J01 parte 1, J04, J06, J08) | E1; E2 (perfil) | E4, E5 | Golden + RG-* de prioridade alta verdes; domínio sem imports de infra | `regras-de-volei`, `backend`, `qa` | G |
| **E4** | Log de eventos, RPCs, endpoint v2, lease (M3; J02, J03) | E1, E3 | E5, E6, E11, E14 | Reprojeção = projeção; reenvio idempotente; imutabilidade comprovada por teste | `backend`, `banco-de-dados` | G |
| **E5** | Cliente de lançamento refatorado para reducer + comandos (quebra de `lancar/page.tsx`) | E3, E4 | E11 | Partida completa em `v2` no campeonato de simulação; paridade de resultado com `v1` | `frontend`, `backend` | G |
| **E6** | Correção do organizador e janela de 30 min; fechamento + classificação atômicos (D5, S8) | E4 | piloto | Correção cria evento; classificação recalculada na mesma transação | `backend` | M |
| **E7** | Modelo Meu Time: tabelas, cifra, `docHash`, backfill, `authz/` (M4 passos 1-3; T01, T12, T13) | E0, E1, E2 | E8, E9, E10 | Suíte de isolamento incluindo "organizador não lê banco do time"; backfill sem perda | `banco-de-dados`, `backend`, `seguranca` | G |
| **E8** | Conta do time (OTP, rate limit, segredos por finalidade, reivindicação) (T02, G05) | E7 | E9 | Login sem senha; 429 após 5 falhas | `backend`, `seguranca`, `ux` | M |
| **E9** | Link do organizador alimenta Meu Time: `finalizar_inscricao_meu_time`, estados D14, remoção pelo organizador D4 (T03, T10, T14) | E7, E8 | piloto Meu Time | Usabilidade: menos de 5 min, 90% sem ajuda; cópia não retropropaga | `backend`, `frontend`, `dados-do-campeonato` | G |
| **E10** | Área Meu Time (atletas, comissão, dados, inscrições; colar lista) (T04, T05, T08) | E7, E8 | E13 | Criar time em 30 s; prontidão visível | `frontend`, `ux`, `designer` | G |
| **E11** | Offline fatias 1-2: pacote + outbox + sincronização (M5) | E4, E5 | E12 | Sem rede por 30 min, 0 evento perdido, reenvio duplicado sem efeito | `frontend`, `backend`, `qa` | M |
| **E12** | Service worker + teste de 3 h com dois dispositivos (J12) | E11 | lançamento offline | 0 evento perdido; sync < 30 s | `frontend`, `qa` | M |
| **E13** | Papeleta digital do técnico a partir da lista da inscrição (J11) | E4, E9, E10 | - | Envio com trava e aceite do apontador | `frontend`, `backend`, `ux` | G |
| **E14** | Tempo real do placar público (D-A10) | E4 | - | Latência < 2 s sem polling | `frontend`, `backend` | P |

### Grafo de dependências e trilhas paralelas

```
E0 (segurança) --+--> E1 (baseline/CI) --+--> E3 (domínio) --> E4 (log/RPC) --> E5 (cliente) --> E11 --> E12
                 |                       |                        |--> E6 (correção)
                 |                       |                        +--> E14 (tempo real)
E2 (LGPD/decisões) ----------------------+----------------------------------------------+
                 +-----------------------+--> E7 (modelo Meu Time) --> E8 (conta) --> E9 (link -> Time) --> E10 (área) --> E13 (papeleta)
```

- **Trilha A (súmula):** E3, E4, E5, E11, E12, com E6 e E14 saindo de E4.
- **Trilha B (Meu Time):** E7, E8, E9, E10, depois E13 (que junta as duas trilhas).
- **Caminho crítico até um piloto completo:** E0, E1, E3, E4, E5 e, em paralelo, E7, E8, E9. O Meu Time (pilar) e a súmula validada (diferencial) avançam juntos; a única convergência antes do piloto é E1.
- **Ordem proibida:** nada de E7 antes do gate de E0 e da política de E2 (agrava C3 e S13); nada de E11/E12 antes de E4 (sem idempotência e `seq` o offline perde ou duplica fatos); nada de E13 antes de E4 e E10.
- **Se houver uma pessoa só:** E0, E1, E3, E4, E5, E7, E8, E9, E10, E11, E12, E13, E14, nessa ordem; E2 e E6 entram sempre que houver espera.

---

## 6. Riscos de arquitetura

| # | Risco | Mitigação |
|---|---|---|
| A1 | Refatorar `lancar/page.tsx` (3.594 linhas) regride o jogo | Caracterização antes (M1); flag por partida; piloto em simulação; testes de propriedade do reducer |
| A2 | Divergência entre projeção e log | RPC única escritora; teste de reconstrução em CI e job periódico; alarme |
| A3 | Domínio TS no cliente defasado por service worker em cache | `regrasVersao` no evento; servidor rejeita versão incompatível com 426 e o cliente atualiza o service worker; o pacote carrega a versão |
| A4 | Banco real diferente do versionado (RLS, colunas, RPCs) | M0 antes de tudo; `pg_policies` e dump como entrada; nenhuma migration sem diff do ambiente |
| A5 | Lease de mesa trava o jogo se o aparelho do apontador cair | Heartbeat curto, expiração automática, assunção com confirmação do organizador |
| A6 | Cifra e `docHash`: perda do pepper ou da chave | Segredos em gestor, rotação com `keyVersion`, backup da chave separado do banco |
| A7 | Escopo largo para equipe pequena (relatório 08 R7) | Duas trilhas independentes; cada etapa tem gate e pode ser entregue sozinha; offline e papeleta depois do piloto |
| A8 | Conta diferida cria times "fantasma" | Expiração do `claimToken`, política de retenção (G10), aviso ao organizador de inscrição de time não reivindicado |

## 7. Limites desta análise

- **Não verificado:** estado real do banco (policies aplicadas, colunas `categoriaCampeonatoId`/`terceiroSetObrigatorio`, RPCs), compatibilidade de Serwist/Workbox com Next 14.2, política de TTL de sessão offline, desempenho do `FOR UPDATE` por partida sob carga.
- Referências `arquivo:linha` dos relatórios 01 e 04 não foram todas relidas; as de RLS e `schemas.ts` foram conferidas nesta rodada.
- Itens [M] do relatório 03 (regras não confirmadas) não devem virar bloqueio no motor; entram como `sinaliza` até revisão humana (COBRAV/FMV).
- Esta análise não altera `CLAUDE.md` nem as notas do vault; ao decidir, registrar D-A1 a D-A12 em `11-DECISOES` no formato contexto, opções, escolha, consequências.
