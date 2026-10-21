# Handoff para o Cursor: branch `cursor-teste`

Estado em 2026-10-16. Tudo está **local**: nada foi enviado ao GitHub e a `main` não foi alterada (ela publica direto em produção na Vercel). Esta branch parte da `main` (c365d8a) e contém o trabalho de segurança, Meu Time, motor de regras, súmula e infraestrutura feito pelos agentes. Veja também `docs/analise/` (relatórios 01 a 24) e `docs/COMO-TESTAR.md`.

## Como rodar
```bash
git checkout cursor-teste
npm run setup        # Node 22, dependências, .env.local, Prisma
# preencha o .env.local com o Supabase de DESENVOLVIMENTO (nunca produção)
npm run dev          # http://localhost:3000
npm run typecheck && npm run test:unit && npm run build
```
Estado verificado por comando: typecheck e build passam. A suíte tem 4 falhas **anteriores a este trabalho** (`category-selection` e `category-setup-state` precisam de `DATABASE_URL`; `rls-publico.test.mjs` e `sumula-transacional.test.ts` falham na `main` pura). `npm run test:unit` para no primeiro erro; para rodar tudo, execute cada arquivo de `scripts/` (`node scripts/with-ts-node.mjs scripts/X.test.ts`).

## O que existe (e o que está desligado)
| Área | Estado | Onde |
|---|---|---|
| Segurança de login/sessão | Ligado: token de admin com `scope`, reset sem hash de senha, limite de tentativas (e-mail+IP), `ADMIN_EMAIL` obrigatório, webhook InfinitePay 410, pagamento marcado `simulado` | `src/lib/auth.ts`, `rate-limit.ts`, `api/auth/**` |
| Leituras públicas sem PII, fim do client anon no servidor, uploads assinados | Ligado no código; **o banco ainda não fecha a anon key** (migrations pendentes) | `src/lib/uploads/**`, `src/app/api/uploads/**`, `anon-client-guard.test.ts` |
| Inscrição automática | Ligado: sem aprovar/rejeitar; PATCH responde 410 | `src/lib/inscricao-status.ts`, `api/inscricoes-campeonato` |
| Meu Time (API + telas) | **Desligado por `MEU_TIME_ATIVO=1`**; precisa das migrations 0024 a 0029 aplicadas | `src/app/api/meu-time/**`, `src/app/meu-time/**` |
| Motor de regras do vôlei | Módulo puro; a tela da súmula já usa para validar/explicar substituição, líbero, sanções e tempos | `src/lib/regras-volei/**`, `src/lib/sumula-ui/**` |
| Eventos da súmula no servidor | **Desligado por `SUMULA_EVENTOS_ATIVO=1`**; precisa de `SumulaEvento` (migrations 0023 e 0029) | `src/app/api/sumula/[token]/eventos` |
| Fila offline da súmula | Biblioteca pronta e testada, **ainda não ligada à tela** | `src/lib/sumula-offline/**` |
| Súmula impressa (A4, salvar como PDF) | Ligado: `/sumula/[token]/imprimir` | `src/components/sumula-impressa/**` |
| Placar de telão/overlay | Ligado: `/placar/[id]?fundo=transparente` | `src/components/placar/**` |
| Migrations | **Nenhuma aplicada.** 29 arquivos em `supabase/pendentes/` com reversão, nunca parseados por um Postgres | `supabase/pendentes/LEIA-ME.md`, `docs/analise/16` e `22` |

## O que o Cursor (ou você) precisa fazer — não dá para fazer sem navegador, conta ou produção
1. **Abrir no navegador, desktop e celular, e conferir:** súmula (+1, faixa "Quem fez?", Desfazer, substituição com contador e motivos, troca de líbero, sanções, tempos), inscrição rápida (contador, "Colar lista", botão desabilitado com motivo), Meu Time (só com a flag e as tabelas), placar de telão, súmula impressa (imprimir em A4), login/recuperação de senha, alvos de toque de 44 px.
2. **Banco (Supabase de desenvolvimento):** rodar as consultas de leitura Q1 a Q13 (`docs/analise/16`), conferir os nomes reais dos CHECKs (`Atleta_origem_check`, `SumulaEvento_tipo_check`), ensaiar as migrations pendentes em preview, gerar a baseline (`docs/analise/22`). **Ordem de publicação:** primeiro o código desta branch, depois as migrations M1 e M2 (fechar leitura pública e bucket privado), fora de rodada e com backup.
3. **Conta/segredos:** trocar a senha do administrador legado (a antiga continua no histórico do git), definir `ADMIN_EMAIL`, conferir `DATABASE_URL`/`DIRECT_URL` na Vercel (a nova validação recusa configuração de outro projeto), rodar o gitleaks no histórico.
4. **GitHub/Vercel:** proteção de branches, secret scanning, Dependabot; a `main` publica direto, então qualquer merge nela exige aprovação.
5. **Decisões de produto abertas:** (decidido: só vôlei de quadra, praia fora do escopo) foto e documento do atleta bloqueiam a inscrição ou viram pendência? rascunho de inscrição por token (upload sem rota assinada)? itens de regra sem confirmação (WO em melhor de 3, WO duplo, sanções mistas, saque em 0x0 após penalidade entre sets, placar do CJ-03) precisam de um árbitro da COBRAV (`docs/analise/23`).

## Pendências técnicas conhecidas
- Ligar a fila offline e a rota de eventos à tela da súmula; falta endpoint de lote real em produção e a decisão de quando ligar `SUMULA_EVENTOS_ATIVO`.
- A tela da súmula não tem interface para redesignação de líbero (só a função pura).
- Súmula impressa: faltam quadro de pontos com rodízio por ponto, coluna A/P/E/D das sanções, folha de controle de líbero e súmula anexa (dependem de dados que o sistema ainda não registra de forma estruturada).
- `FormularioInscricaoRapida` ainda sobe arquivos direto com a chave anon.
- Servidor ainda tem regra própria de substituição/sanção em `src/lib/sancoes.ts` e `sumula-regras.ts` (limite 8, vermelho = expulsão); precisa revalidar com o motor.
- `npm run lint` roda sem erros (só avisos antigos de `<img>` e hooks).
- Arquivos de teste que conferem texto do código-fonte (`tempos-sumula`, `lesao-sumula`, `libero-sumula`) foram atualizados para a tela nova.

## Rodada 5 (correções do QA) — já na branch
Corrigidos: assistente do Meu Time não bloqueia mais categoria sem `RegraElenco`; telas respeitam o papel (`meuPapel`); flag desligada sem laço; convite (`?convite=`) enviado e exigido quando a categoria tem link; documento de atleta com posse conferida na gravação e na leitura; `POST /membros` com resposta uniforme (202) e limite de taxa; troca excepcional e de líbero fora da cota no servidor; sanções distinguidas pelo marcador `[[SAN:…]]`; ordem do replay/impressão por função única; desfazer de sanção e de troca; "Registrar mesmo assim (decisão do árbitro)" com justificativa (`[[OVR:…]]`); link "Imprimir súmula"; testes do motor que não fixam itens sem confirmação.

Ainda abertos depois da rodada 5 (ver `docs/analise/24-qa-integracao-r3-r4.md`):
- `src/lib/presenca-oficial.ts` (~linha 124) ainda ordena por id crescente; deve usar `emOrdemCronologica` de `src/lib/sumula-ui/ordem.ts` (cuidado: a rota de presença grava em ordem cronológica, as ocorrências da tela em ordem inversa).
- Botão "Imprimir súmula" falta no painel do árbitro (`src/app/arbitro/partida/[token]/page.tsx`) e do organizador (`PainelConteudos.tsx`).
- Falta uma flag de competição **privada** em `Liga` (o convite só é exigido quando existe link na categoria).
- A suspensão automática entre partidas (`src/lib/sancoes-partida.ts`) ainda trata todo cartão vermelho antigo como expulsão; só importa quando as notas passarem a enviar `jogadorId`.
- `logoUrl` de `PUT /api/capitao/equipe` ainda aceita URL livre; documento legado de outro dono já gravado no banco exige varredura de dados.
- Os itens de regra sem confirmação continuam configuráveis e sem teste que os fixe (`docs/analise/23`).
- A pasta `.claude/worktrees/` guarda as cópias de trabalho dos agentes; pode ser apagada com `git worktree remove` quando você não precisar mais delas (as branches `feat/*` continuam existindo).

## Rodada 6 — já na branch
Feito: `presenca-oficial` ordena pelo instante gravado no registro (e pela ordem explícita quando falta); link "Imprimir súmula" nos painéis do árbitro e do organizador (só com `sumulaToken`; partida sem token não mostra o link porque os payloads não dizem se o campeonato é público); competição **privada** (`Liga.visibilidade`, migration pendente 0030 — sem a coluna tudo segue público) com convite obrigatório e fora das listas públicas (`/api/ligas`, portal, vitrine, sitemap, ao vivo); suspensão automática entre partidas lê o marcador de sanção; `logoUrl` do capitão só aceita o Storage da própria equipe; **fila offline ligada à tela em modo sombra**, atrás de `NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1` (desligada = comportamento idêntico ao de antes; o `PUT` segue sendo o oficial).

Abertos depois da rodada 6:
- `src/app/campeonatos/page.tsx`, `JogosPublicos.tsx`, `agenda-publica.ts`, `/api/equipes` e `/api/partidas` ainda consultam `Liga` direto e podem listar competição privada; as policies RLS públicas de `Liga` e `CategoriaCampeonato` também não filtram por visibilidade (decisão do banco).
- Não há tela nem rota para o organizador marcar a liga como PRIVADA nem gerar o link (`ligaSchema` não tem o campo); privada sem link emitido recusa tudo.
- Os payloads do árbitro/organizador não dizem se o campeonato está publicado (necessário para o link de impressão em partida sem token).
- Para ligar de verdade a fila + eventos: `NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1` no build, `SUMULA_EVENTOS_ATIVO=1` no servidor e as migrations 0023 e 0029 aplicadas; antes disso comparar o log com o `PUT` em jogos reais.

## Rodada 7 — competição privada completa (já na branch)
Feito: o organizador escolhe **pública ou privada** no passo "Período e limites" do wizard de inscrições (grava `Liga.visibilidade`; o campo é opcional no PATCH para o autosave não sobrescrever) e, sendo privada, vê os links de inscrição por categoria com "Copiar", "WhatsApp" e "Gerar link"; privada sem link emitido responde "peça o link ao organizador"; `/api/equipes`, `/api/partidas`, agenda pública, `?organizador=`, `/campeonatos` e jogos públicos escondem privadas de visitante (dono vê as suas, admin vê tudo; com `ligaId`/slug a privada abre, é o "link"); `campeonatoPublicado` entra nos payloads do árbitro e do painel de partidas, e o link "Imprimir súmula" aparece também em partida sem token de campeonato público; **migration pendente 0031** reescreve as policies de leitura pública (`Liga`, `CategoriaCampeonato`, `Equipe`, `Partida`, `SetPartida`, `ClassificacaoEntrada`, `Premiacao`, `Midia`, `Mensagem`, `DestaquesPartida`) e a view `jogador_publico` para esconder competição privada.

Abertos depois da rodada 7:
- A migration 0031 nunca passou por um Postgres: aplicar só depois da 0003 e da 0030, em preview, com `EXPLAIN` das leituras anônimas; verificar no banco real se há outras policies permissivas que anulariam o filtro (somam por OR). O Realtime paga a RLS por evento e por assinante.
- Os payloads de estrutura e de mata-mata do organizador ainda não trazem `campeonatoPublicado`.
- A gravação de `visibilidade` junto com outros campos do setup não é atômica (coluna ausente: as outras configurações ficam salvas e a resposta é 503).
- O cache de ids privados (30 s) só é limpo no mesmo processo.
- `buscarAgendaCampeonato` de uma liga só (acesso por id/link) e `/jogos` sem `liga` não filtram privadas.

## Rodada 8 — motor, servidor em modo sombra e LGPD de menores (já na branch)
Feito:
- **Motor:** fechamento com ordem de assinatura e capitão ausente (RG-FEC-002/003); jogador não registrado com perda de pontos/sets (RG-FOR-009, opção `naoRegistradoZeraSetsJaPerdidos` configurável); pedidos de tempo/substituição e novo evento `PEDIDO_INDEVIDO` (RG-TMP-003/005/006); folha de controle de líbero derivada do log (RG-LIB-014); intervalo entre sets (RG-SET-005). `scripts/regras-volei-cobertura.test.ts` lê o `03` e falha listando IDs sem teste: 97 de 97 IDs exigidos cobertos; ficam isentos os 6 itens [M], o vôlei de praia e 11 IDs de papel/PDF (lista `PENDENTES_PDF_OU_PAPEL`, que só pode encolher).
- **Servidor em modo sombra:** com `SUMULA_SERVIDOR_SOMBRA=1`, o `PUT /api/sumula/[token]` revalida as ocorrências com o motor e devolve `avisosMotor` e `divergenciaPlacar` (só avisos; nunca bloqueia nem muda o que foi gravado). Desligado = resposta idêntica à de antes. Critérios para passar a bloqueio em `docs/analise/07-arquitetura-backend.md`.
- **LGPD de menores:** consentimento do responsável (contato cifrado AES-256-GCM, chave `LGPD_CHAVE_CIFRA` obrigatória em cada ambiente), `Atleta.menor`/`consentimentoPendente`, rotas de consentimento, exclusão que anonimiza (preserva o histórico de jogos), inscrição sem bloqueio mas com aviso `ATLETA_MENOR_SEM_CONSENTIMENTO`; telas do Meu Time com bloco do responsável, selo "sem autorização", "Completar agora" e filtro. **Migration pendente 0032** (`AtletaConsentimento`, `AtletaExclusaoPedido`, `Atleta.anonimizadoEm`). Texto do termo é RASCUNHO.

**Decisões jurídicas que são do dono, com advogado** (lista completa em `docs/analise/25-lgpd-menores.md`, seção 6): base legal para dados de menores, texto final do termo, prazos de retenção, manter o nome do atleta no histórico após anonimizar, papéis de controlador/operador, DPO e ROPA, quem pode pedir exclusão, maioridade em 29/02, inscrição de menor só com aviso, compartilhamento com organizadores/árbitros e fotos públicas, comunicação de incidente à ANPD.

Abertos depois da rodada 8:
- Sombra: o motor recusa substituição excepcional enquanto houver substituição regular possível (RG-SUB-011), então deve aparecer como `erro` quando o árbitro decidiu; súmulas sem formação completa no início do set geram `SOMBRA-NAO-TRADUZIDA` (ruído de medição). Não traduzidos: redesignação de líbero, protesto, discrepância de papeleta, capitão, sacador.
- O motor não lança sozinho a `SANCAO` de atraso a partir de `PEDIDO_INDEVIDO`; `agora` e `horarioPrevisto` ainda não vêm da rota.
- Não há job de retenção/anonimização automática, rota de acesso/portabilidade do titular, verificação de que o responsável existe, nem rotação da chave de cifra; as colunas antigas de responsável em `AtletaDocumento` (0025) ficam sem uso.
- A migration 0029 (tipos de evento) precisa continuar acompanhando `PayloadPorTipo`: o teste estático `migracoes-pendentes` falha quando falta um tipo.
- 11 IDs de papel/PDF do `03` seguem sem teste até existir o gerador de PDF.

## Rodada 9 — app de banco, papeleta e súmula impressa completa (já na branch)
Feito:
- **App de banco** (`/banco/[token]`, celular, sem login: o link é a credencial, só o hash fica no banco): papeleta do set (6 titulares, líbero, capitão, validação com o motor, rascunho, envio que trava e é imutável), pedidos de tempo e substituição com polling de 3 s. Desafio de vídeo responde 501 ("fase posterior"). Tudo atrás de `BANCO_APP_ATIVO=1` (e `NEXT_PUBLIC_BANCO_APP_ATIVO=1` na tela); desligado = 404 e nenhuma requisição.
- **Apontador** (`lancar`): painel `PedidosBanco` (aceitar passa pelo motor antes de registrar; recusar), `PapeletasDoSet` (divergência com a escalação, aceitar papeleta) e `LinkBanco` (gera/copia/WhatsApp, na aba escalação).
- **Árbitro:** `/arbitro/jogo/[token]` atualiza sozinho a cada 3 s. Não é a súmula ao vivo: isso continua aberto.
- **Súmula impressa** (`/sumula/[token]/imprimir`): rodízio ponto a ponto com sacador, A/P/E/D, folha de líbero, protesto, súmula anexa, assinaturas; usa o log do motor quando `/eventos` responde (flag `SUMULA_EVENTOS_ATIVO`), senão cai nas ocorrências ("não registrado nesta versão"). Corrigido o CSS que deixava a folha escura.
- **Migrations pendentes 0033–0035** (`BancoAcesso`, `Papeleta` com trigger de imutabilidade, `PedidoBanco`). Nunca rodaram num Postgres: ensaiar em preview (trigger, unicidade do hash, anon sem acesso).

Abertos depois da rodada 9:
- Limites de tempo/substituição são por set e conferidos só no servidor; criação de pedidos sem lock (dois simultâneos podem passar; o limite é reconferido ao decidir). Não há janela "papeleta visível 12 min antes", nem retenção de `BancoAcesso` expirado.
- Aceitar pedido: se o servidor aceitar mas a resposta falhar depois de a súmula registrar, o pedido fica pendente e aceitar de novo duplica (só há toast).
- Troca do banco entra como substituição regular (excepcional não); aceitar DESAFIO só grava a decisão.
- Rota pública de súmula não traz o log; o PDF com rodízio exige a rota `/eventos`. Config da partida na impressão é inferida dos sets. Sem hora por ponto. RG-PTO-003 (ampulheta) e RG-INT-007 (log de edição) só parciais. Sem impressão da súmula em branco.
- Tela do banco e componentes do apontador sem teste de renderização nem conferência no navegador; sem auditoria WCAG automática.
- `src/lib/arbitro-access.ts` tem `/^d+$/` sem barra (token numérico nunca filtra por id). NÃO corrigir sem decidir: faria o id da partida valer como credencial.
- Ainda não feitos do PROMPT: scout/.dvw, desafio por vídeo, offline-first ligado de verdade, notificações, convite ao atleta/importação por planilha, clube com várias equipes, protótipo navegável.

## Rodada 10 — Meu Time fase 2 e base do scout (já na branch)
Feito:
- **Meu Time fase 2** (flags `MEU_TIME_FASE2_ATIVO=1` no servidor e `NEXT_PUBLIC_MEU_TIME_FASE2_ATIVO=1` na tela, além de `MEU_TIME_ATIVO`): convite ao atleta por link (só o hash do token fica no banco; página pública `/convite-atleta/[token]`, resposta uniforme, uso único), importação de planilha CSV com prévia por linha antes de gravar (limite 60 linhas, idempotente), clube com várias equipes (usa `Clube`/`TimeClube` existentes), notificações com sino e navegação global do Meu Time (`src/app/meu-time/layout.tsx`).
- **Scout base** (`SCOUT_ATIVO=1`): `/api/scout/[token]/resumo` e `/exportar?formato=csv|json`, derivados do log da súmula (sacador, rotação, séries, side-out, pontos por set, tempos/substituições). Esquemas `scout-json-1` e `scout-csv-1`. Detalhes em `docs/analise/26-scout.md`.
- **Migrations pendentes 0036–0039** (`ConviteAtleta`, `ImportacaoAtletas`, `ClubeEquipe`+`Clube.donoUserId`, `Notificacao`). A 0038 (`ClubeEquipe`) ficou SEM USO: o backend usa o vínculo `TimeClube.clubeId`; recomenda-se não aplicá-la.

Abertos depois da rodada 10:
- Scout: ace e erro de saque não saem do log; ataque, bloqueio, defesa, levantamento, zonas e qualidade de recepção exigem lançamento manual (não existe tabela nem rota). **Formato .dvw não confirmado em fonte: nada foi implementado.**
- Contato do responsável da planilha (`responsavel_contato`) não é guardado (contato não é consentimento). Vincular equipe a outro clube move a equipe e responde 409 se o clube de origem tiver outras equipes: regra de produto a confirmar.
- Nenhuma rota chama a notificação `AJUSTE_PEDIDO` (o pedido de ajuste de inscrição está fora do que foi editado); rate limit dos convites/importação é em memória por instância; sem retenção definida para `ImportacaoAtletas.linhas`.
- Telas da fase 2 sem teste de renderização nem conferência no navegador; o item "Atletas" da navegação é só atalho para a lista de times.
- Fora do escopo por decisão do dono: vôlei de praia (o produto é só vôlei de quadra).

## Rodada 11 — scout manual, desafio de vídeo, ao vivo e offline-first (já na branch)
Feito (tudo atrás de flag, desligado por padrão):
- **Offline-first** (`NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1`): a fila local vira o caminho principal de gravação por eventos (`POST /api/sumula/[token]/eventos`), com indicador Salvo/N pendentes/Sem conexão/Conflito, reconciliação de conflito de `seqEsperado`, e bloqueio do fechamento da súmula com pendências. O PUT legado continua em paralelo. O estado da tela continua derivado localmente; ler o estado do log só depois de o modo sombra provar equivalência.
- **Placar ao vivo** (`AO_VIVO_ATIVO=1` no servidor, `NEXT_PUBLIC_AO_VIVO_ATIVO=1` na tela): `/ao-vivo/[partidaId]` em tela cheia, API pública sem PII (`/api/ao-vivo/[partidaId]`, cache de 2 s, 120 req/min por IP em memória, privadas dão 404). `/arbitro/partida/[token]` atualiza a cada 3 s.
- **Scout manual** (`SCOUT_ATIVO=1`, `NEXT_PUBLIC_SCOUT_ATIVO=1`): tela `/scout/[token]` com lançamento por toque e fila local; API `/api/scout/[token]/acoes` (idempotente por `clientEventId`, anulação por DELETE); resumo e exportação agora em `scout-json-2`/`scout-csv-2`. A mini-quadra de zonas (5-6-7 / 4-3-8 / 1-2-9) é convenção provisória.
- **Desafio de vídeo** (`DESAFIO_ATIVO=1`, `NEXT_PUBLIC_DESAFIO_ATIVO=1`): banco pede desafio (cria `PedidoBanco` PENDENTE; aceitar cria o `DesafioVideo` EM_ANALISE), `PainelDesafios` no `lancar` registra e decide (mantida/revertida/cancelada). Limite por equipe por set é CONFIGURÁVEL (`DESAFIO_LIMITE_POR_SET`, padrão 2, [M], NÃO confirmado em fonte). Docs 27 e 28.
- **Migrations pendentes 0040–0041** (`ScoutAcao` com id bigint, `DesafioVideo`); nunca rodaram num Postgres.

Abertos depois da rodada 11:
- O desafio não gera o evento `DESAFIO` no log do motor; o scout manual não preenche rotação/placar na tela; scout sem edição de ação.
- Duas requisições simultâneas de desafio podem ser recusadas as duas (recontagem no servidor); rate limit do ao vivo em memória por instância.
- Telas de scout, desafio, ao vivo e o banner de conflito do offline-first sem teste de renderização e sem conferência no navegador.
- Ações descartadas na tradução da tela para a fila (atleta desconhecido, formação incompleta) não bloqueiam o fechamento.
- Formato .dvw continua não confirmado (nada implementado).

## Rodada 12 — protótipo, QA, segurança, regras e correções (já na branch)
Feito:
- **Protótipo navegável** em `/prototipo` (`NEXT_PUBLIC_PROTOTIPO_ATIVO=1`): 22 telas em 7 perfis (líder, atleta, apontador, banco, árbitro, organizador, espectador), dados de exemplo em memória, sem chamar API.
- **Três revisões** (relatórios): QA em `docs/analise/29-qa-rodada-12.md` (inclui roteiro de teste manual por perfil e a tabela das flags); segurança (0 crítico, 1 alto, 5 médios, 7 baixos) e regras de vôlei (2 altas, 7 médias, 5 baixas), todos os itens de código corrigidos nesta rodada.
- **Correções de segurança:** lista pública `/api/ao-vivo` respeita flag, limite e privadas; cota de IP consumida uma vez; links do banco com `acessoId`, listagem e revogação; convite de atleta exige que o criador ainda tenha permissão; prévia de importação expira em 72 h (máx. 5 pendentes); uuid inválido = 404; noindex para /banco, /scout, /convite-atleta.
- **Correções de regras:** retorno de substituição (B→A) no banco; capitão pode estar no banco; perfil de elenco (12/14, camisa); limites contados pelo log; zonas do scout 4-3-2 / 7-8-9 / 5-6-1 (7–9 a confirmar); súmula impressa com configuração permissiva e seção "Eventos não aplicados"; desafio opcional com estado INCONCLUSIVA (não consome); resumo e exportação do scout incluem as ações manuais e funcionam sem o log.
- **Migrations:** 0037 ganhou `expiraEm`; 0041 aceita INCONCLUSIVA; **0038 NÃO APLICAR** (redundante). Ordem de aplicação em preview: 0033, 0034, 0035, 0036, 0037, 0039, 0040, 0041 (a 0041 depende da 0035). `.env.example` e `docs/COMO-TESTAR.md` listam todas as flags.

## Rodada 13 — pendências de código fechadas (já na branch)
- **Segundo líbero** (`Papeleta.libero2Id`, migration 0034 editada): gravado, validado pelo motor e devolvido nas leituras; a coluna entra no gatilho de imutabilidade.
- **Ciência de LGPD no convite:** `POST /api/convite-atleta/[token]` exige `cienciaLgpd: true` (400 `CIENCIA_OBRIGATORIA`) e grava `cienciaLgpdEm`/`cienciaVersao` ('v1-rascunho', aviso sujeito à revisão jurídica). A tela envia o campo.
- **Rate limit persistente:** rotas por token e públicas usam o limitador com `SupabaseRateLimitStore` (tabela `RateLimit`, migration 0001) com fallback em memória; leitura pública falha-aberto, escrita falha-fechado.
- **Expurgo das prévias de importação:** função SQL `expurgar_previas_importacao()` (migration 0042, NÃO agendada) e rota `/api/cron/expurgo-previas` (POST ou GET, só com `CRON_SECRET`; sem o segredo = 404). Agendar é com o Cursor/dono (Vercel cron ou pg_cron).
- **Evento DESAFIO no log da súmula:** a decisão do desafio é registrada (idempotente, só com `SUMULA_EVENTOS_ATIVO=1`); NÃO altera placar nem repete rally.
- **Scout:** o servidor preenche placar e rotação pelo log; `PATCH /api/scout/[token]/acoes/[id]` corrige ação; botão "Corrigir" na tela.
- Ordem das migrations pendentes para ensaio em preview: 0001 (RateLimit) em diante pelo doc 16; 0042 depois da 0037; **0038 não aplicar**.

Abertos depois da rodada 13:
- Prévias CONFIRMADAS e notificações sem prazo de retenção (decisão jurídica). Vercel cron não configurado.
- Desafio: sem janela de 7 s nem lista fechada de lances; consequência no placar (cancelar ponto, repetir rally) continua decisão da arbitragem, lançada à parte; limite por equipe vem de variável de ambiente, não por campeonato.
- Aceitar pedido do banco: janela entre registrar na súmula e o servidor recusar (422); a tela avisa.
- `PATCH` do scout não limpa zona/jogador. Scout e telas das rodadas 9 a 13 nunca foram abertas num navegador (roteiro no relatório 29).
- `src/lib/arbitro-access.ts` mantém `/^d+$/` DE PROPÓSITO: corrigir faria o id da partida valer como credencial.
- Itens `[M]`/não confirmados (desafio de vídeo oficial, zonas 7–9, rotação K1–K6, WO, sanções mistas) dependem de árbitro/COBRAV. Vôlei de praia está fora do escopo.

## Rodada 14 — acesso único do time, aba Campeonatos e aprovação pelo organizador (já na branch)
Decisão do dono: líder e banco da equipe são UM acesso (login do time); cada categoria escolhe `modoInscricao` AUTOMATICA (padrão) ou APROVACAO.
- **Líder** (flags `INSCRICAO_SOLICITACAO_ATIVO` / `NEXT_PUBLIC_INSCRICAO_SOLICITACAO_ATIVO`): aba Campeonatos (lista com selo de modo e situação; Inscrever ou Solicitar participação; cancelar pendente; escolher atletas quando o time passa do máximo).
- **Organizador:** seletor do modo por categoria (parametrização), fila de Solicitações em `/painel/solicitacoes` e `/admin/solicitacoes` (Aprovar/Recusar com motivo), sino e contador; aprovar cria a inscrição e notifica o líder.
- **Banco por login** (flags `BANCO_SESSAO_ATIVO` / `NEXT_PUBLIC_BANCO_SESSAO_ATIVO`, além de `BANCO_APP_ATIVO` e `MEU_TIME_ATIVO`): aba Jogos lista os jogos da equipe e abre o mesmo app de banco por `/api/banco/sessao/[partidaId]/[equipeId]`, sem link. O link por token continua como alternativa.
- **Ponte equipe do Meu Time → Equipe legada** (`Inscricao.equipeLegadoId`): criada na inscrição confirmada e na geração de calendário, com reparo ao listar jogos; sem ela o banco por login não acha o jogo.
- **Migrations pendentes 0043** (`SolicitacaoInscricao`, `CategoriaCampeonato.modoInscricao`) **e 0044** (atletas escolhidos na solicitação).
- Itens abertos da rodada 14 estão em `docs/FALTA-FAZER.md` (seção 5).

## Rodadas 15 a 19 — líder único, login sem senha, elenco completo, painel, notificações, PDF e pagamento (já na branch)
Decisões do dono desta fase: um perfil só para o time (líder, inclui o banco); inscrição por categoria automática ou com aprovação; **só quadra, sem scout nem árbitro, sem CNPJ**; sem gateway de pagamento (Pix manual com comprovante).
- **R15 — inscrição dentro do líder** (`INSCRICAO_VIA_MEU_TIME_ATIVO`): os links do organizador viram porta de entrada para o Meu Time; `/capitao` redireciona; paridade em `docs/analise/30`.
- **R16 — login sem senha** (`LOGIN_SEM_SENHA_ATIVO`): código de 6 dígitos por e-mail (e WhatsApp só para telefone já cadastrado), Google via Supabase Auth, troca de perfil, onboarding. Migrations 0045–0047. Detalhes e variáveis no `.env.example`.
- **R17 — elenco completo** (`ELENCO_COMPLETO_ATIVO`): upload assinado de escudo, foto e documento; CPF e telefone cifrados (em `AtletaDocumento`) com leitura só mascarada; dados do time (e-mail, telefone, cores, escudo; sem CNPJ); regras de elenco com modelos (FIVB, CBV, amador livre, personalizado; valores sem fonte marcados `[M]`); pedido de troca depois do prazo. Migrations 0048–0050.
- **R18 — painel, explorar, notificações** (`PAINEL_INSCRICOES_ATIVO`, `EXPLORAR_COMPETICOES_ATIVO`, `NOTIFICACOES_MULTICANAL_ATIVO`): estados Em análise e Lista de espera (promoção automática), pedir correção com comentário, exportação CSV sem PII, equipe do organizador com papéis, vitrine com selo de elegibilidade (valor e cidade da competição NÃO têm fonte no banco: vêm vazios), avisos por e-mail, WhatsApp e push sem conteúdo, lembretes (prazo 48 h, jogo amanhã, tabela publicada). Migrations 0051–0053. Os crons `/api/cron/notificacoes` e `/api/cron/lembretes` NÃO estão agendados.
- **R19 — PDF e pagamento** (`SUMULA_PDF_ATIVO`, `PAGAMENTO_COMPROVANTE_ATIVO`): PDF da súmula gerado no servidor sem biblioteca (layout nunca visto: sem conversor no ambiente); Pix manual com comprovante confirmado pelo organizador (aprovar exige pagamento confirmado ou isento). Migrations 0054–0055. Seed fictício que roda em banco vazio, README e CHANGELOG atualizados, inventário de rotas em `docs/analise/32` com teste.
- **Total de migrations pendentes: 55** (0001–0055, **sem a 0038**). Ordem e ensaio em `docs/analise/16`.
- **Novas variáveis:** `.env.example` (login sem senha, elenco, painel, explorar, notificações, VAPID, `CRON_SECRET`, PDF, pagamento).

Abertos depois da rodada 19 (lista completa em `docs/FALTA-FAZER.md` e `docs/analise/31`):
- Nada das rodadas 9 a 19 foi aberto num navegador, e nenhuma migration rodou num Postgres. O PDF não teve o layout conferido.
- Falta agendar os crons e o expurgo, gerar as chaves VAPID e `CRON_SECRET`, e configurar Google (OAuth no Supabase) e o webhook de WhatsApp.
- Telefone para WhatsApp vem do cadastro da conta (texto); falta armazenamento cifrado próprio. Valor e cidade da competição sem coluna. Cartão e Pix automático não existem.
- O conselho (`founder/board.md`) votou 3 FUND IF, nota média 4,7: o risco é nunca ter operado um campeonato real. Próximo passo de negócio: piloto pequeno com observação em quadra.

## Regras do projeto
Fluxo: `fix/…`, `feat/…`, `docs/…` → `teste-integrado`/`cursor-teste` → `main`. Inscrição por categoria: modo AUTOMATICA (padrão) ou APROVACAO (organizador aprova), escolhido pelo organizador; link de convite continua para competição privada. Validação sempre no servidor. Isolamento entre organizadores. `CLAUDE.md` e `docs/analise/DECISOES-FASE-0.md` são a referência.
