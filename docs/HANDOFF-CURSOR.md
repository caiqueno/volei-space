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
5. **Decisões de produto abertas:** vôlei de praia entra? foto e documento do atleta bloqueiam a inscrição ou viram pendência? rascunho de inscrição por token (upload sem rota assinada)? itens de regra sem confirmação (WO em melhor de 3, WO duplo, sanções mistas, saque em 0x0 após penalidade entre sets, placar do CJ-03) precisam de um árbitro da COBRAV (`docs/analise/23`).

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

## Regras do projeto
Fluxo: `fix/…`, `feat/…`, `docs/…` → `teste-integrado`/`cursor-teste` → `main`. Inscrição por link de categoria, sem aprovação. Validação sempre no servidor. Isolamento entre organizadores. `CLAUDE.md` e `docs/analise/DECISOES-FASE-0.md` são a referência.
