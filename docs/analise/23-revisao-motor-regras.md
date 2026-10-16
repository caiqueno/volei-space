# 23 - Revisão do motor de regras contra FIVB 2025-2028 e Guia CBV/COBRAV

Agente: regras-de-volei (somente leitura). Data: 2026-10-16. Escopo: `src/lib/regras-volei/` e os 7 testes `scripts/regras-volei-*.test.ts`, mais `03`, `09` e `16`.

## Limites
- **Fonte primária não lida.** O PDF das Regras FIVB 2025-2028 e o do Guia CBV/COBRAV não puderam ser lidos (fetch devolve binário ou estoura o limite). Artigos e páginas citados vêm do `03` (marcados **[03]**). Fontes que abri: HTML/espelhos e regulamentos (**[pública-secundária]**, com link).
- Marcação: **FATO** (fonte vista), **FATO [03]** (afirmado pelo 03, não reconferido), **INFERÊNCIA**, **NÃO CONFIRMADO**.

## 1. Divergências do código
| # | Regra | Oficial | Código | Gravidade | Correção |
|---|---|---|---|---|---|
| 1 | RG-WO-001 (6.4.1) | Equipe ausente: partida **0-3** e **0-25 por set** | `wo-interrupcao.ts:74-85` calcula "sets necessários" e "sets que o ausente ganhou": WO aos 2x2 vira **3x2**; o teste (`regras-volei-wo-interrupcao.test.ts:28-36`) só afirma `setsA === 3` | **Alta** (classificação: 3x2 daria 1 ponto ao perdedor) | Separar `placarPartida` (3x0, ou 2x0 em melhor de 3) de `parciaisRegistrados`; testar `setsB === 0` |
| 2 | RG-WO-001 | O 25 é o set padrão; regulamentos usam 15 ou 21 | `config.ts:11` fixa `PLACAR_WO_POR_SET = 25` | Média | Usar `alvoDoSet(config, n)` |
| 3 | RG-WO-001, CJ-06(e) | Mantêm-se os sets já jogados [03] | `eventos.ts:451` descarta o set em andamento | Média | Decidir com a COBRAV; guardar o parcial para o PDF |
| 4 | RG-WO-001 | WO só enquanto a partida não terminou | `eventos.ts:448-453` aceita WO com a partida encerrada; `AMBAS` zera os sets jogados | Média | Rejeitar WO com `partidaEncerrada()` |
| 5 | RG-ROT-002 (7.7.2) | Cancelam-se os pontos da equipe faltosa **desde o momento da falta** | `rotacao.ts:135-139` cancela `seq >= momentoSeq`; o teste `regras-volei-eventos.test.ts:288-309` usa o ponto de **side-out** como momento, resultado B 0 x A 4 | **Alta** (altera placar) | Definir `momentoSeq` como o primeiro ponto do rally com o sacador errado; não afirmar o placar no teste até haver confirmação |
| 6 | RG-ROT-001/002 | Rodízio retificado após o cancelamento | `eventos.ts:364-374` não recalcula formações | Média | Replay dos pontos vivos |
| 7 | RG-SAN-001 | 03: advertência verbal e amarelo ao membro, uma vez | `sancoes.ts:127-129` devolve AMARELO para toda MENOR após a 1ª; curso FIVB (secundário) diz que o amarelo é aviso da equipe, uma vez por partida | Média (NÃO CONFIRMADO) | Tornar configurável |
| 8 | RG-SAN-009 | Sanções progressivas por membro | `sancoes.ts:72-77` conta só da mesma categoria: grosseira x2 e depois ofensiva dá expulsão; expulso por ofensiva e depois grosseira dá só penalidade | Média (NÃO CONFIRMADO) | Escalar pela pior sanção recebida ou confirmar no Casebook |
| 9 | RG-SUB-007 (15.2.2) | Um pedido pode ter vários jogadores | `substituicoes.ts:75-80,163` bloqueia a 2ª troca do mesmo pedido | Média | Aceitar `trocas[]` por pedido |
| 10 | RG-LIB-010/012 (19.4) | Com 2 líberos e um incapaz, segue com o outro | `libero.ts:170-176` bloqueia a redesignação se houver outro líbero; não há função que marque incapaz sem redesignar | Média | `declararLiberoIncapaz` |
| 11 | RG-LIB-003/004 | Líbero não saca nem vai à frente | `validarSaqueDoLibero` (`libero.ts:124`) nunca é chamada; `PONTO` não carrega o sacador | Média | Sacador no evento; chamar as validações |
| 12 | Arquitetura | Regra vale no servidor, sobre o log | `eventos.ts:342-350,377-420`: SANCAO, SUBSTITUICAO, TROCA_LIBERO, TEMPO, INTERRUPCAO entram **sem revalidar** | **Alta** (integração) | `derivarPlacar` revalida e registra `inconsistencias` |
| 13 | RG-INT-004 | Set anulado: sanções mantidas | `eventos.ts:429-438` faz `sets.pop()` e perde contadores | Baixa | Preservar o histórico de sanções |
| 14-18 | RG-SET-001, SAQ-002, SUB-001/003/004, SUB-010..012, TMP-007/008 | — | **Conformes** (a exceção sobre contar a excepcional dentro dos 6 é NÃO CONFIRMADO) | — | Manter |

Qualidade dos testes: há testes que fixam comportamento **[M]** contra a própria regra do projeto (WO em melhor de 3, WO duplo, penalidade entre sets, 3º set obrigatório); só `CONFIG_ITENS_M.faltaRotacaoPontoAdversario` é lido de fato (as outras flags são decorativas); `regras-volei-eventos.test.ts:368` termina sem asserção.

## 2. Itens [M] respondíveis por fonte pública
- **WO: "25x0 por set" e "3x0" não são alternativas.** FATO [pública-secundária]: a regra FIVB registra "0-3 para a partida e 0-25 para cada set" (regulamento do UN Inter-Agency Games, que declara seguir as Regras FIVB 2025-2028: https://interagencygames.org/general-and-discipline-rules-of-the-un-inter-agency-games/volleyball-men/). Em **melhor de 3** a FIVB não define; a convenção de regulamentos é 2x0 e parcial 25x0 (ou o alvo do set): Arapiraca-AL, Curitiba/IFF (15x0), Colômbia JDLP 2025, JEAC-Acre 2024. É escolha do organizador; manter configurável. Pontos de tabela do WO: regulamento (NÃO CONFIRMADO para FMV/CBV).
- **WO duplo.** O Guia manda só a arbitragem assinar [03]; o efeito na classificação é do regulamento. O motor (`vencedor: null`) é coerente. NÃO CONFIRMADO texto FIVB/CBV específico.
- **Sanções de categorias diferentes no mesmo membro.** Os quadros públicos listam as categorias separadas e dizem que sequências mistas ficam ao critério do árbitro (https://diske.eduloop.de/loop/Misconduct_sanctions). Não há texto sobre "grosseira x2 e depois ofensiva". NÃO CONFIRMADO.
- **Quem saca em 0x0 após penalidade entre sets.** FATO: a conduta antes ou entre sets é sancionada no set seguinte (21.5). NÃO CONFIRMADO quem saca. INFERÊNCIA: define-se o sacador do set e depois aplica-se a penalidade (ponto e saque ao adversário), como o motor faz; efeito colateral: `sacouPrimeiro` continua sendo o saque inicial sorteado, o que pode afetar a alternância do set seguinte.
- **Líbero redesignado.** FATO: o líbero antigo não joga mais (19.4.2.2). Que o novo líbero não volte à linha é INFERÊNCIA (19.4.2.1).
- **Placar do CJ-03.** NÃO CONFIRMADO no Guia. INFERÊNCIA: os 11 de B são cancelados (B 0), os 13 de A permanecem e A ganha +1 e o saque (A 14 x B 0); "11X13" é o placar no momento da descoberta. A ressalva da divergência 5 (side-out) muda o resultado em 1.
- Tolerância de WO (15 ou 30 min), tempo técnico indoor e contagem de substituição por jogador ou por pedido: regulamento ou NÃO CONFIRMADO.

## 3. Semântica de WO no meio do jogo adotada pelo motor
Mantém os sets encerrados, descarta o set em andamento, lança 25x0 nos que faltam e deixa ao ausente os sets que já ganhou (resultado possível 3x2). Concorda com a fonte em manter os sets jogados, lançar 25x0 nos restantes e dar a vitória ao presente. **Diverge ou não está confirmado:** o placar de sets da partida (3x2 contra 3x0), o destino do set em andamento e o 25 fixo. Para resolver é preciso o texto do Guia p.85-86 ou um árbitro da COBRAV.

## 4. Regras do 03 sem implementação, por prioridade
**Alta:** (1) revalidar tudo na derivação do log; (2) sacador no log (RG-SAQ-003/004, ROT-001); (3) papeleta e discrepâncias (RG-FOR-006..009); (4) fechamento (RG-FEC-002/004/005, SET-007/008); (5) corrigir o WO e checar os 6 jogadores da vencedora (RG-WO-001..003); (6) substituição em lote e TMP-003/005/006.
**Média:** RG-LIB-001/004/014 e líbero incapaz; RG-ELE-001/004/005 (12 ou 14 jogadores, camisas únicas, capitão em jogo); RG-SET-006 e FOR-002/003 na derivação; RG-PRO-001..003 (protesto); RG-SUB-005/015, RG-INT-001/002, RG-PTO-003 (rally repetido sem efeito hoje).
**Baixa:** RG-FOR-010/011, INT-006/007, FEC-003 (PDF); RG-PRA-001..011 (praia, só se o produto tiver praia); RG-TMP-009; RG-POS-001/002.

O motor ainda não está ligado à tela nem ao servidor; as divergências 1, 5 e 12 são as que mais alteram placar ou classificação quando isso acontecer.

## Fontes públicas
interagencygames.org (regulamento de vôlei masculino), diske.eduloop.de (Misconduct_sanctions, Guides), beachdiske.eduloop.de (Sanctions), Volleyball Canada (conduta), regulamentos: Arapiraca-AL (VOLEIBOL.pdf), Curitiba (00389977.pdf), Colômbia JDLP 2025, JEAC-Acre 2024, Espírito Santo vôlei de praia 2022.
