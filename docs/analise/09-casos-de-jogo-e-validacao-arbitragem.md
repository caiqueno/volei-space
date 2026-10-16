# 09 - Casos de jogo e validação de arbitragem

Agente: regras-de-volei. Data: 2026-10-16. Somente leitura; "Atende?" vale para leitura estática (a aplicação não foi executada).

## 0. Base e limites
- Regras: `03-regras-validaveis.md` (IDs RG-*). **[V]** FIVB 2025-2028 (artigo); **[G]** Guia de Súmula CBV/COBRAV fev/2025 (página); **[M]** não verificado.
- Requisito de produto: `docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md` ("implementação pendente").
- Código: `P` = `src/app/sumula/[token]/lancar/page.tsx`; `R` = `src/app/api/sumula/[token]/route.ts`; `M` = `src/lib/category-match-rules.ts`; `S` = `src/lib/schemas.ts`.
- Não li o Livro de Casos CBV, o Casebook FIVB nem regulamentos de competição; o que depende deles é **[M]** e exige confirmação por COBRAV/FMV ou árbitro nacional antes de virar teste.

## 1. Como o código trata o jogo hoje
| Tema | Comportamento | Onde |
|---|---|---|
| Estado | Todo no navegador; servidor recebe sets finais e ocorrências em texto livre | `P` 407-464; `R` 58-123, 312-362 |
| Rodízio | Automático; sacador sempre índice 5 (posição I) | `P` 437-451, 3511-3516 |
| Falta de rotação/posição | Sem evento nem validação; o sacador é derivado | `P` 407-464 |
| Cancelar pontos | Desfazer cronológico; `undoLastPointForTeam` desfaz também pontos do outro time | `P` 477-533 |
| Substituição | Limite fixo 8 por set; par A↔B bloqueado pelo set; sem limite de saída e retorno por titular | `P` 714-805 |
| Líbero | Inicial obrigatório; sem validar fundo de quadra nem rally entre trocas; sem redesignação | `P` 588-591, 742, 3467, 3495-3503 |
| Tempos | Máx. 2 por set, grava "Tempo técnico" | `P` 807-816 |
| Cartões | Texto livre; vermelho dá +1 ponto ao adversário em toda ocorrência, sem mudar saque nem rodízio; amarelo sem efeito; sem expulsão, desqualificação ou atraso | `P` 115, 818-864 |
| Fim do set | `max >= alvo` e diferença >= 2, sem teto; alvo do último set só com tie-break habilitado | `P` 3556-3578; `M` 31-33 |
| Fim da partida | Cliente para em `setsToWin`; servidor aceita 3º obrigatório | `P` 564-576; `M` 22, 30, 36 |
| Troca de lado | Só botão manual | `P` 356-359 |
| Sorteio / saque inicial | Seleção manual por set; sem sorteio do set decisivo | `P` 648-650, 609-613 |
| Interrupção, WO, incompleta | WO só como nota e status; sem 25x0, incompleta, interrupção ou set anulado | `P` 115; `S` 372 |
| Correção após 30 min | Checagem não localizada | `R`, `sumula-access.ts` |

## 2. Casos de jogo

### CJ-01 Substituição excepcional por lesão — Atende: NÃO — Gravidade: alta
- **Dado**: set 2, equipe A com 6 substituições regulares usadas; titular #5 se lesiona; banco: #12 (nunca entrou), #3 (já entrou e saiu), líbero #9.
- **Quando**: o técnico pede a troca e o 2º árbitro constata que não há substituição legal.
- **Então**: vale a excepcional; entra qualquer jogador fora de quadra, exceto líbero(s) e o regular que o líbero substitui; #5 não volta na partida ([V] 15.7, 15.2.3, 24.2.8; [G] p.49-50). Não conta como regular, mas entra no total do set e da partida. Anotar "EQUIPE A, Nº 5 SAIU / Nº 12 ENTROU, 2º SET, PLACAR __X__" ([G] p.124). Sem ninguém no banco: recuperação de 3 min, uma vez por jogador; sem recuperação, equipe incompleta no set ([V] 17.1.2, 6.4.3).
- **Esperado no sistema**: pedido não bloqueado pelo teto de regulares, com motivo (lesão/expulsão/desqualificação); contador "excepcional" próprio; lesionado impedido de voltar; elegíveis só fora de quadra e não líbero; observação padronizada.
- **Hoje**: `P` 752-756 bloqueia acima de 8 e não há modo excepcional; `substitutionLocks` (`P` 723-728, 787-802) só deixa o par original voltar, sem barreira de "nunca mais"; sem campo de motivo, contador separado, nem fluxo de 3 min/incompleta.
- **Classificação**: lacuna do requisito (D4) + erro de regra (limite de 8, retorno do lesionado).

### CJ-02 Líbero redesignado — Atende: NÃO — Gravidade: média
- **Dado**: equipe B com um só líbero (#10) na posição V, 9x6 no 2º set; ele se lesiona; o regular que substituía é #4; no banco #2 e #8.
- **Então**: pode ser redesignado #2 ou #8, nunca #4 nem alguém em quadra ([V] 19.4.2.1); entra direta e imediatamente; #10 não joga mais ([V] 19.4.2.2); nova redesignação se o redesignado ficar incapaz (19.4.2.4); o capitão pode ser redesignado (19.4.2.5); com dois líberos registrados e um incapaz não há redesignação (19.4.3.1). Registro: "REDESIGNAÇÃO DE LÍBERO, EQUIPE B, LÍBERO Nº 10 LESIONADO, NOVO LÍBERO JOGADOR Nº 2, 2º SET, PLACAR 9X6" ([V] 19.4.2.6; [G] p.77, 120). Que o redesignado "não joga mais como linha" é inferência de 19.4.2.1: **[M]**.
- **Esperado**: operação "redesignar líbero" sem consumir substituição, validando o candidato, trocando o número até o fim da partida, bloqueando o antigo e registrando observação e folha de controle.
- **Hoje**: não existe; `getLiberoOptions` só oferece outro jogador quando não há líbero cadastrado (`P` 3505-3509); líbero inicial definido por set (`P` 652-668), não no meio do set; o banco exclui líberos (`P` 3495-3503) (não verificado em execução).
- **Classificação**: lacuna do requisito (D7).

### CJ-03 Erro de rotação descoberto depois — Atende: NÃO — Gravidade: alta
- **Dado**: 1º set; B recupera o saque e deveria sacar #14, mas saca #10; descoberto com A 13 x B 11, B com 11 pontos desde o saque errado.
- **Então**: com momento determinável, cancelam-se **todos os pontos da equipe faltosa desde o momento exato**; os do adversário permanecem ([V] 7.7.2; [G] p.114-119). A recebe ponto e saque e o rodízio de B é retificado (7.7.1). Se o erro só aparece depois do rally que começou com a falta, o adversário recebe um único ponto (7.7.1.1). Sem momento determinável: só ponto e saque. Nova súmula do set, com observação "SEGUE SÚMULA ANEXA... PLACAR 11X13" ([G] p.113-119, 122). O placar exato após a correção deve ser confirmado com a COBRAV **[M]**.
- **Esperado**: evento "falta de rotação" com campo "momento (ponto nº)"; reversão seletiva (remove pontos de B posteriores, preserva os de A, reaplica rodízio e sacador); auditoria e "súmula anexa" no PDF.
- **Hoje**: o desfazer (`P` 477-533) opera cronologicamente e `undoLastPointForTeam` remove também pontos do outro time (toast da linha 529 admite), o oposto de 7.7.2; o sacador é derivado, então o sistema nunca vê saque fora de ordem (`P` 407-464, RG-SAQ-004); `changeSlot` reescreve o evento "Formação da quadra atualizada" (`P` 700-710); sem "súmula anexa" no modelo.
- **Classificação**: erro de regra (reversão) + lacuna (detecção). RG-ROT-001 a 005.

### CJ-04 Sanções acumuladas — Atende: NÃO/PARCIAL — Gravidade: alta
- **Dado**: set 1, A recebe advertência de atraso; set 2, #8 de A recebe amarelo, depois grosseira, depois nova grosseira; set 3, técnico de A comete conduta ofensiva e A comete novo atraso.
- **Então**: atraso: advertência vale para a partida toda; novo atraso é penalidade (ponto e saque) ([V] 16.2.1, 16.2.3; [G] p.53-54). #8: amarelo sem consequência (21.1); 1ª grosseira é penalidade (21.3.1); 2ª é expulsão do **set** com substituição imediata (legal, depois excepcional, 15.8) e volta no set seguinte (21.3.2.3); 3ª na partida é desqualificação (21.3.3.4). Técnico: 1ª ofensiva é expulsão do set e o assistente assume ([V] 21.3.2.1, 5.3.2); 2ª seria desqualificação. Condutas são individuais, valem na partida e são progressivas; as de atraso são da equipe ([V] 21.4). Combinação de categorias diferentes no mesmo membro e quem saca em 0x0 após penalidade entre sets: **[M]**. Penalidade antes ou entre sets aplica-se no set seguinte ([V] 21.5).
- **Esperado**: sanção em função de (categoria, ocorrências do membro); ponto ao adversário só nas penalidades; bloqueio de expulso até o fim do set e de desqualificado até o fim do jogo; contador de atraso por equipe; quadro de sanções em ordem ([G] p.52-58).
- **Hoje**: só o vermelho gera ponto (`P` 818-864), em toda ocorrência, quando a 2ª e a 3ª deveriam ser expulsão e desqualificação sem ponto; o ponto é lançado mas o saque não muda (omissão de "ponto **e saque**", 21.3.1, 7.5.1); amarelo só texto; sem atraso, expulsão, desqualificação, bloqueio ou sanção entre sets; vermelho a "Equipe / comissão" sem seleção gera toast de erro (`P` 862) mas o `note` ainda é salvo (não verificado).
- **Classificação**: lacuna (D13) + erro de regra no vermelho.

### CJ-05 Set de desempate — Atende: PARCIAL — Gravidade: média
- **Dado**: melhor de 5, 2x2; novo sorteio; A lidera 8x6.
- **Então**: novo sorteio no set decisivo ([V] 7.1, 12.1.1; [G] p.60); alvo 15 com 2 de vantagem; troca de quadra quando a líder atinge 8, sem alterar posições (esquecida: troca ao notar, com o placar da hora) ([V] 18.2.2, 27.2.2.5); tempos e substituições recomeçam (15.1). Em estaduais melhor de 3, o 3º set é o decisivo com alvo `Nt` configurável; se for "3º set obrigatório" após 2x0, não é decisivo **[M]**.
- **Esperado**: alvo correto; aviso de troca aos 8; registro do sorteio; contadores zerados.
- **Hoje**: SIM alvo com 2 de vantagem sem teto (`P` 3556-3578; `M` 31-33) e contadores por set (`P` 564-577, 752). PARCIAL: alvo do último set só com `tieBreakUltimoSet` (padrão `false`, `P` 3564-3567; `R` 305), então o 5º set pode sair com 21 se o organizador esquecer a opção (avisar na parametrização). NÃO: sem troca de lado automática (`P` 356-359) nem sorteio do set 5 (`P` 648-650, 609-613). Em melhor de 3 com 3º obrigatório o servidor aceita (`M` 22, 30, 36) mas o cliente encerra em 2x0 (`P` 564): divergência cliente x servidor.
- **Classificação**: lacuna (D2, D12) + escolha legítima do organizador.

### CJ-06 Partida interrompida — Gravidade: alta para (b), (c), (e); baixa para (a), (d)
- **(a)** Falta de energia por 20 min no 2º set (2x5), mesma quadra. Oficial: continua com placar, jogadores e posições; anota "JOGO INTERROMPIDO NO 2º SET, PLACAR 2X5, POR 20 MINUTOS, POR MOTIVO DE FALTA DE ENERGIA" ([V] 17.3.2.1; [G] p.76-77, 103). Código: PARCIAL (observação livre `P` 115, estado no navegador; sem campos de início/fim; retomada em outro dispositivo não verificada).
- **(b)** Goteira obriga trocar de quadra aos 13x9 do 3º set. Oficial: set **anulado e rejogado** do 0x0 com as mesmas formações iniciais (exceto expulsos/desqualificados), sanções mantidas, nova súmula anexa, observação com o tempo total ([V] 17.3.2.2; [G] p.104-106). Código: NÃO (sem "anular set"; `validateCategoryResult` rejeita sequência fora de ordem; `substituirOcorrencias` regrava por partida, `R` 195-215; o requisito rejeita "set adicional indevido", logo o set anulado vira exceção a modelar).
- **(c)** Paralisações somam mais de 4 h. Oficial: repete-se a partida inteira ([V] 17.3.3; [G] p.106). Código: NÃO.
- **(d)** Acidente grave com bola em jogo. Oficial: para o jogo, assistência, rally repetido sem ponto ([V] 17.1.1). Código: PARCIAL (basta não lançar ponto; sem evento "rally repetido").
- **(e)** Equipe se recusa a continuar aos 8x7 do 5º set. Oficial: equipe declarada ausente, 3x0 com parciais 25x0 nos sets não jogados, mantendo os já jogados ([V] 6.4.1; [G] p.82-86). Código: NÃO (status `WO` existe em `PartidaCard.tsx` e `championship-podium.ts:14`, mas `validateCategoryResult` exige sets completos; só há a nota "W.O." `P` 115; faltam 25x0 automático, WO no meio do jogo, WO duplo e tolerância, RG-WO-001 a 005, D9).
- Tolerância de WO (30 ou 15 min nos exemplos do Guia p.92 e p.95) é escolha do organizador; pontuação do WO em melhor de 3 é **[M]**.
- **Classificação**: lacuna (D9, D12).

### CJ-07 Substituição ilegal descoberta depois — Atende: NÃO — Gravidade: crítica para CBV/FIVB
- **Dado**: B já usou 6 substituições e faz a 7ª sem notar; erro aparece com B 14 x A 10.
- **Então**: ponto e saque para A; substituição retificada; todos os pontos de B desde a 7ª são cancelados e os de A permanecem; nova súmula do set ([V] 15.9; [G] p.51). Se detectada antes do reinício, é só atraso (advertência; penalidade no 2º) ([V] 15.9, 16.2).
- **Esperado**: em modo FIVB/CBV o 7º pedido é bloqueado ou alertado; fluxo de retificação do CJ-03.
- **Hoje**: `P` 752-756 deixa passar até 8 sem alerta e bloqueia só a 9ª. O requisito aprovado ("8 por set") diverge da FIVB e do Guia, ambos com 6 (D1; [V] 15.1; [G] p.47). Só vale em estaduais/amadoras se o regulamento permitir; em CBV/FIVB a súmula com 7 ou 8 é inválida. Recomendação: limite configurável por campeonato, padrão 6, 8 como "amador" com alerta de ilegalidade.
- **Classificação**: erro de regra (padrão) + escolha do organizador (opção).

### CJ-08 Troca ilegal de líbero — Atende: NÃO — Gravidade: média
- **Dado**: o líbero sai e entra alguém que não é o regular nem o 2º líbero; ou duas trocas sem rally concluído; ou o líbero entra na posição de frente.
- **Então**: visto antes do próximo rally, correção e atraso; visto após o golpe de saque, vale como substituição ilegal (ponto, saque, cancelamento) ([V] 19.3.2.9; [G] p.113). O líbero só substitui jogador de fundo (19.3.1.1); exige rally concluído entre trocas (19.3.2.1); só com bola fora de jogo e antes do apito (19.3.2.4-19.3.2.7); não saca nem bloqueia (19.3.1.2-19.3.1.4).
- **Hoje**: trata a troca de líbero como substituição comum sem verificações (`P` 742, 769-775); o requisito aprova "registro informativo" (D7), que não gera cota (correto) mas omite as validações; o resumo conta trocas de líbero como substituições (`P` 1813, 1849), divergindo de 19.3.2.1 e de RG-SET-008 ([G] p.70-72); saque do líbero na posição I não é bloqueado (não verificado).
- **Classificação**: lacuna + erro de contagem.

### CJ-09 Término do set e protesto — Atende: SIM (set) / NÃO (protesto) — Gravidade: baixa (set), média (protesto)
- 24x24, 25x24, 26x24, 30x29, 31x29: 25x24 e 30x29 continuam; 26x24 e 31x29 encerram ([V] 6.2; RG-SET-001/002). `canCloseSetByRules` (`P` 3556-3558) e `M` 31-33 coincidem.
- Protesto: capitão avisa na hora, confirma ao fim com autorização do 1º árbitro, súmula registra relato ou desistência ([V] 5.1.2.1, 5.1.3.2, 23.2.4, 27.2.3.2; [G] p.78, 122). Não há fluxo nem tipo em `noteTypes` (`P` 115). Lacuna (RG-PRO).

### CJ-10 WO e equipe incompleta — Atende: NÃO — Gravidade: alta
- WO simples: 3x0 com 25x0 por set; só a equipe presente no quadro de equipes ([V] 6.4.1-6.4.2; [G] p.87-93). WO duplo: só a arbitragem assina ([G] p.94-95); efeito na classificação é do regulamento. Incompleta no set ou jogo: perde, mantém seus pontos e sets, e o adversário recebe o necessário ([V] 6.4.3, 15.8; [G] p.96-102).
- Hoje: ver CJ-06(e); a pontuação por margem de sets (D9) cobre o WO simples 3x0, não o duplo nem a incompleta. Lacuna.

## 3. Validação do PDF por delegado técnico CBV/FIVB
Não encontrei geração de PDF no código; esta seção é de **requisitos**. Recomenda-se que um delegado da COBRAV/FMV valide o primeiro protótipo. Para ser aceito, o PDF precisa de:
1. Cabeçalho, equipes A/B, relação nominal (12 jogadores; 14 em FIVB/Mundial), capitão circulado e líberos indicados ([G] p.15-23; [V] 4.1.1, 4.3.3).
2. Papeleta por set com formação inicial e sacador ([G] p.35; [V] 7.3).
3. Quadro de pontos com rodízio e sacador por ponto e saque inicial por set ([G] p.28-45).
4. Tempos e substituições em ordem e com placar ([G] p.46-51).
5. Quadro de sanções em ordem, coluna A/P/E/D e placar ([G] p.52-58).
6. Observações de substituição excepcional, redesignação de líbero, interrupção e retificações ([G] p.76-77, 120, 124).
7. Folha de controle de líbero anexa ([V] 28.2; [G] p.125-137).
8. Quadro de resultados com totais, horários e duração ([G] p.70-72).
9. Súmula anexa quando houver cancelamento de pontos ([G] p.113-119).
10. Assinaturas: apontador, capitães, árbitros ([V] 27.2.3.3, 5.1.3.1; [G] p.75).
11. Nenhuma rasura: correção só por observação com autoria e hora ([G] p.5-6; o log de edição é o equivalente digital).

Reprovaria hoje: itens 3 (rodízio por ponto só como marcador textual `[[ROT:...]]`, `P` 3351-3353), 5, 6, 7 e 9. MVP obrigatório (`R` 62-71) e janela de 30 min são regras de produto e não invalidam a súmula (D6, D11).

## 4. Divergências código x regra
| ID | Regra oficial | Produto hoje | Gravidade | Correção sugerida |
|---|---|---|---|---|
| RG-SUB-001 | 6 por set ([V] 15.1) | 8, bloqueia a 9ª (`P` 753-755) | Crítica (CBV/FIVB) | Limite por campeonato, padrão 6 |
| RG-SUB-003 | Uma saída e um retorno por titular ([V] 15.6.1) | Par reutilizável (`P` 787-802) | Alta | Bloquear o 2º ciclo em modo oficial |
| RG-SUB-010/011 | Excepcional fora do regular; lesionado não volta ([V] 15.7) | Inexistente | Alta | Modo excepcional com motivo e contador |
| RG-SUB-009 | Ilegal: ponto, saque, cancelamento ([V] 15.9) | Sem detecção | Alta | Evento de retificação |
| RG-LIB-001..014 | Regras de líbero ([V] 19) | Inicial obrigatório (`P` 588-591), sem redesignação | Média | Tornar opcional; redesignação e validações |
| RG-ROT-001..005 | Reversão seletiva ([V] 7.7) | Desfazer cronológico que apaga pontos do adversário (`P` 492-533) | Alta | Estornar por equipe e momento |
| RG-POS-003 | Falta de posição: ponto e saque | Sem registro | Média | Evento "falta de posição" |
| RG-SAN-001..012 | Escala de sanções ([V] 21) | Só vermelho = ponto, sem saque (`P` 818-864) | Alta | Motor de sanções por membro |
| RG-TMP-007/008 | Atraso ([V] 16.2) | Só nota | Média | Contador por equipe |
| RG-TMP-001 | 2 tempos de 30 s ([V] 15.4.1) | Grava "Tempo técnico" (`P` 815) | Baixa | Renomear para "Tempo" |
| RG-SET-003/D2 | Maioria dos sets ([V] 6.3.1) | Servidor aceita 3º obrigatório; cliente encerra (`P` 564 x `M` 22) | Média | Cliente seguir `terceiroSetObrigatorio` |
| RG-SET-006 | Troca aos 8 ([V] 18.2.2) | Manual | Média | Alerta automático |
| RG-FOR-002 | Novo sorteio no decisivo ([V] 7.1) | Sem etapa | Baixa | Passo de sorteio no 5º set |
| RG-INT-003..005 | Interrupção, set anulado ([V] 17.3) | Inexistente | Alta | Estado "interrompida" e set anulado |
| RG-WO-001..005 | WO 3x0 com 25x0 ([V] 6.4) | Só nota e status | Alta | Fluxo de WO e incompleta |
| RG-SET-008 | Soma sem trocas de líbero ([G] p.70-72) | Resumo conta (`P` 1813, 1849) | Baixa | Excluir `libero_exchange` do total |
| RG-SET-001/002 | 25 com 2 de vantagem, sem teto | Atende | — | Manter e cobrir com testes |
| RG-SAQ-002 | Rodízio horário | Atende | — | Manter e cobrir com testes |
| RG-FEC-005/D6 | Assinatura ratifica; correção posterior administrativa | Janela de 30 min não localizada | Média | Não tratar como implementado |

## 5. Casos para virar testes (para qa)
Prioridade alta: CJ-01, CJ-03, CJ-04, CJ-06 (b)(c)(e), CJ-07. Rodar com limite 6 (CBV/FIVB) e 8 (amador) quando envolver substituição.

Pendentes de especialista humano (COBRAV/FMV ou árbitro): todos os **[M]** — pontuação de WO em melhor de 3, combinação de sanções de categorias diferentes, quem saca em 0x0 após penalidade entre sets, placar exato do CJ-03 após retificação, condição do redesignado como líbero e tolerância de WO.

## 6. Observações finais
- O requisito `SUMULA-DIGITAL-E-CLASSIFICACAO.md` é "aprovado, implementação pendente"; nenhum item pendente é tratado aqui como pronto.
- As 8 substituições são a divergência com maior risco de súmula inválida em CBV/FIVB; em estaduais/amadoras vale se o regulamento permitir. A decisão é do produto/organizador, não do apontador.
- O e-Scoresheet foi usado apenas como referência de comportamento via `02-referencia-e-scoresheet.md`; nenhum texto, imagem ou layout da Data Project foi copiado.
