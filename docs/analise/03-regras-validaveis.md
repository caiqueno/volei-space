# 03 - Regras de jogo validáveis (Dado / Quando / Então)

Agente: `especialista-regras`. Data: 2026-10-16. Alimenta os relatórios 04 (lacunas), 09 (casos de jogo e arbitragem) e 10 (testes).

## 1. Fontes e grau de verificação

| Código | Fonte | Como foi lida |
| --- | --- | --- |
| **[V]** | FIVB *Official Volleyball Rules 2025-2028* (EN, v05, https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf) | PDF baixado e lido em texto integral. Cita-se o artigo (ex.: 15.6.1). |
| **[VP]** | FIVB *Official Beach Volleyball Rules 2025-2028* (EN, v01, https://www.fivb.com/wp-content/uploads/2025/02/FIVB-BeachVolleyball_Rules2025_2028-EN-v01.pdf) | PDF baixado e lido (artigos 4 a 7, 15, 16, 18 a 20). |
| **[G]** | *Guia de Preenchimento de Súmula de Voleibol*, CBV/COBRAV, atualizado em fev/2025 (PDF da FMV) | PDF baixado e lido inteiro (137 páginas). "p. N" é o número impresso no rodapé do slide; o texto extraído coloca o número no fim de cada página, então pode haver erro de ±1. |
| **[M]** | De memória / não verificado | Marcado em cada regra. Nenhuma regra [M] deve virar teste automatizado sem confirmação. |

Não foi possível ler: o **Livro de Casos de Súmula** da CBV (citado no Guia, itens 1.x a 4.x), o Casebook FIVB 2024 e os regulamentos específicos de competição (Superliga, estaduais). Tudo que depende deles está como [M] ou como "depende do regulamento".

Observação importante: o **tempo técnico não existe nas Regras FIVB indoor 2025-2028** (a busca no texto integral não retornou nada). Ele é regra de regulamento de competição. No vôlei de praia ele existe e é verificado [VP] (RG-TMP-010).

Legenda da coluna "Varia": **FIVB** = competições FIVB/World/Oficiais; **CBV** = competições nacionais regidas pela CBV com o Guia; **Est/Am** = estaduais e amadoras (o regulamento do organizador manda). "Igual" = não há variação documentada.

Legenda do produto: **OK** = o requisito aprovado (`docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md`) é compatível; **DIV** = diverge da regra oficial (ver seção 3); **-** = o requisito não trata do assunto.

---

## 2. Regras testáveis - indoor (quadra, 6 x 6)

### 2.1 Elenco, papeleta e abertura da súmula (RG-ELE)

- **RG-ELE-001** - Dado uma equipe indoor; Quando se monta a relação nominal; Então ela tem no máximo 12 jogadores (14 em FIVB/World/Oficiais Adulto), no máximo 1 técnico, 2 assistentes e 2 da área médica (fisioterapeuta e médico). Fonte: 4.1.1 [V]; Guia p.18, 23. Varia: FIVB 14 jogadores e 5 membros de comissão; regulamento pode incluir outras funções (preparador físico, massagista - Guia p.23). Produto: -.
- **RG-ELE-002** - Dado a relação nominal; Quando técnico e capitão assinam a súmula; Então os jogadores registrados não podem mais ser alterados e só eles podem entrar em quadra. Fonte: 4.1.3 [V]. Igual. Produto: - (definir se a escalação "trava" na assinatura).
- **RG-ELE-003** - Dado a relação nominal; Quando preenchida; Então números em ordem crescente (exceto líberos), o capitão tem o número circulado, L1 e L2 indicados antes da assinatura. Fonte: Guia p.18-21 [G]. Varia: CBV; estaduais seguem o organizador.
- **RG-ELE-004** - Dado números de camisa; Quando cadastrados; Então cada jogador tem número de 1 a 20 (FIVB amplia em competições com elencos maiores), único na equipe. Fonte: 4.3.3 [V]. Varia: FIVB amplia.
- **RG-ELE-005** - Dado o capitão da equipe; Quando ele está em quadra; Então é o capitão em jogo; se não está em quadra, técnico ou capitão designa outro jogador em quadra como capitão em jogo, até ele ser substituído, o capitão voltar ou o set acabar. Líbero pode ser capitão. Fonte: 5.1.2 e nota do cap. 5 [V]. Igual.
- **RG-ELE-006** - Dado o nome do jogador; Quando registrado na súmula manual CBV; Então primeiro nome + inicial do último sobrenome + ponto (ex.: CARLOS S.); comissão técnica com nome e último sobrenome por extenso; súmula internacional usa SOBRENOME, N. Fonte: Guia p.19, 22, 108-110 [G]. Varia: CBV vs FIVB (formato do nome). Produto: relevante para o PDF.
- **RG-ELE-007** - Dado a súmula; Quando se identificam as equipes; Então mandante à esquerda; após o sorteio, "equipe A" é a que inicia à esquerda do apontador e "B" à direita; as letras A/B são replicadas no cabeçalho, nos quadros de sets e no quadro de equipes. Fonte: Guia p.15, 17, 28, 31-34 [G]. CBV.

### 2.2 Sorteio, formação inicial e papeleta (RG-FOR)

- **RG-FOR-001** - Dado o início do jogo; Quando o 1º árbitro faz o sorteio na presença dos capitães; Então o vencedor escolhe saque/recepção OU lado da quadra, o perdedor fica com o outro. Fonte: 7.1 [V]; Guia p.27-28 [G]. Igual.
- **RG-FOR-002** - Dado set decisivo; Quando começa; Então novo sorteio. Fonte: 7.1, 12.1.1 [V]; Guia p.60 [G]. Igual.
- **RG-FOR-003** - Dado os sets 2 a 4; Quando começam; Então o saque inicial é da equipe que NÃO sacou primeiro no set anterior. Fonte: 12.1.2 [V]. Igual.
- **RG-FOR-004** - Dado cada set; Quando antes de começar; Então o técnico entrega ao 2º árbitro/apontador a papeleta (ficha de formação) preenchida e assinada (ou envia eletronicamente, que vale como oficial). Fonte: 5.2.3.1, 7.3.2 [V]; Guia p.35 [G]. Igual. Produto: papeleta digital precisa de "assinatura" equivalente.
- **RG-FOR-005** - Dado a papeleta; Quando entregue; Então deve haver exatamente 6 jogadores em posições I a VI, todos da relação nominal, e a ordem registrada é a ordem de rotação do set inteiro. Fonte: 7.3.1, 7.3.2 [V]. Igual.
- **RG-FOR-006** - Dado papeleta entregue; Quando o técnico quer mudar a formação; Então só com substituição regular (que vale como substituição do set). Fonte: 7.3.4, 15.3.2 [V]. Igual. Produto: DIV parcial (ver seção 3, item D5).
- **RG-FOR-007** - Dado discrepância entre posições em quadra e papeleta descoberta ANTES do início do set; Quando verificada pelo 2º árbitro; Então posições corrigidas conforme a papeleta, sem sanção. Se há jogador em quadra que não está na papeleta, ele é trocado, sem sanção. Se o técnico quer mantê-lo, pede substituição regular. Fonte: 7.3.5.1-7.3.5.3, 24.3.1 [V]. Igual.
- **RG-FOR-008** - Dado discrepância entre posições e papeleta descoberta DEPOIS do início; Quando o erro é descoberto; Então a equipe faltosa volta às posições corretas; pontos do adversário valem e ele ganha ponto e saque; todos os pontos da equipe faltosa desde o momento exato da falta são cancelados. Fonte: 7.3.5 (parágrafo final) [V]; Guia p.113-119 [G] (abrir nova súmula do set). Igual.
- **RG-FOR-009** - Dado jogador em quadra que não consta na relação nominal da súmula; Quando descoberto; Então adversário mantém pontos e ganha ponto e saque; equipe faltosa perde todos os pontos e/ou sets (0x25 se necessário) desde que o não registrado entrou; entrega nova papeleta e põe jogador registrado na posição. Fonte: 7.3.5.4 [V]. Igual.
- **RG-FOR-010** - Dado a abertura do set na súmula manual; Quando o 1º árbitro autoriza o primeiro saque; Então o apontador registra o horário de início, abre o saque com visto na posição I do sacador (X sobre o "S") e marca X na recepção (X sobre o "R"). Fonte: Guia p.28-30, 37 [G]. CBV (papel). Produto: o equivalente digital é o evento "início do set".
- **RG-FOR-011** - Dado 5º set; Quando começa; Então a súmula usa 3 quadros (esquerda, central, direita); tempos e substituições são lançados simultaneamente nos quadros da esquerda e da direita até a troca de lado. Fonte: Guia p.60-68 [G]. CBV papel; produto digital dispensa o layout mas o PDF deve reproduzi-lo.

### 2.3 Ordem de saque, rotação e faltas (RG-SAQ, RG-POS, RG-ROT)

- **RG-SAQ-001** - Dado a equipe que sacou e ganhou o rally; Quando o rally termina; Então o mesmo sacador (ou seu substituto) saca de novo, sem rodízio. Fonte: 12.2.2.1, 6.1.3.1 [V].
- **RG-SAQ-002** - Dado a equipe que recebia e ganhou o rally; Quando o rally termina; Então ela marca ponto, ganha o saque e roda no sentido horário (posição 2 -> 1; 1 -> 6; 6 -> 5; 5 -> 4; 4 -> 3; 3 -> 2); quem vai da posição 2 para a 1 saca. Fonte: 7.6.2, 12.2.2.2, 6.1.3.2 [V]. Igual.
- **RG-SAQ-003** - Dado o sacador; Quando executa o saque; Então deve ser o jogador da posição 1 e saque dentro de 8 segundos após o apito; saque antes do apito é cancelado e repetido. Fonte: 12, 12.4.4, 12.4.5 [V]. Igual. Observação: a súmula não registra a falta de 8 s como ocorrência separada, só o ponto.
- **RG-SAQ-004** - Dado o apontador; Quando o saque é dado por jogador fora da ordem; Então o apontador sinaliza imediatamente após o golpe de saque. Fonte: 27.2.2.2 [V]. Produto: o sistema deve sinalizar ao apontador digital antes de confirmar o ponto.
- **RG-POS-001** - Dado a equipe receptora; Quando a bola é golpeada pelo sacador; Então os 6 jogadores devem estar na ordem de rotação (cada jogador de trás mais afastado da rede que o da frente correspondente; laterais na ordem 4-3-2 e 5-6-1), medido pelos pés em contato com o solo. Fonte: 7.4, 7.4.1-7.4.3 [V]. Igual.
- **RG-POS-002** - Dado a equipe sacadora; Quando o saque é executado; Então seus jogadores (exceto o sacador) devem estar dentro da quadra, mas podem ocupar qualquer posição relativa (não há falta de posição por parte da equipe sacadora). Fonte: 7.4 [V]. Igual.
- **RG-POS-003** - Dado falta de posição; Quando o 2º árbitro apita; Então ponto e saque ao adversário; posições são retificadas. NÃO há cancelamento de pontos anteriores. Fonte: 7.5.1, 7.5.4 [V]. Igual.
- **RG-POS-004** - Dado falta do sacador e falta de posição do adversário simultâneas ao golpe; Quando se decide; Então prevalece a falta de saque (sacador). Se o saque foi correto e depois se torna falho (fora, sob a barreira, etc.), vale a falta de posição. Fonte: 7.5.2, 7.5.3, 12.7 [V]. Igual.
- **RG-POS-005** - Dado jogador em quadra por substituição ilegal; Quando o jogo é reiniciado; Então conta como falta de posição com as consequências de substituição ilegal (RG-SUB-009). Fonte: 7.5.1 [V]. Igual.
- **RG-ROT-001** - Dado saque fora da ordem de saque; Quando descoberto (o apontador usa o sinal sonoro); Então ponto e saque ao adversário; rodízio da equipe faltosa é corrigido. Fonte: 7.7.1, 12.6.1.1 [V]. Igual.
- **RG-ROT-002** - Dado falta de rotação cujo momento exato pode ser determinado; Quando é descoberta; Então todos os pontos feitos pela equipe faltosa desde esse momento são cancelados, os do adversário permanecem. Fonte: 7.7.2 [V]; Guia p.114-119 [G] (abre nova súmula do set). Igual.
- **RG-ROT-003** - Dado falta de rotação cujo momento NÃO pode ser determinado; Quando descoberta; Então não há cancelamento: só ponto e saque ao adversário. Fonte: 7.7.2 [V]. Igual.
- **RG-ROT-004** - Dado falta de rotação descoberta só depois de terminado o rally que começou com a falta; Quando decidida; Então o adversário recebe um único ponto, qualquer que tenha sido o resultado do rally jogado. Fonte: 7.7.1.1 [V]. Igual.
- **RG-ROT-005** - Dado cancelamento de pontos; Quando ocorre na súmula manual; Então uma nova súmula é aberta para o set, com as mesmas formações, horário de início, substituições e tempos transcritos, sanções transcritas em ordem, e anexada à original; observação "SEGUE SÚMULA ANEXA..."; capitães e árbitros assinam as duas. Fonte: Guia p.113-119, 122 [G]. CBV. Produto: o sistema digital precisa de log com reversão auditável e PDF com anexo.

### 2.4 Pontuação, set e partida (RG-PTO, RG-SET)

- **RG-PTO-001** - Dado um rally concluído; Quando a bola toca o chão adversário, o adversário comete falta ou recebe penalidade; Então a equipe marca 1 ponto (rally point). Fonte: 6.1.1 [V]. Igual.
- **RG-PTO-002** - Dado duas ou mais faltas sucessivas; Quando julgadas; Então só a primeira conta; faltas simultâneas de adversários = falta dupla e o rally é repetido (sem ponto). Fonte: 6.1.2.1, 6.1.2.2 [V]. Igual.
- **RG-PTO-003** - Dado o 25º ponto conquistado pela equipe que não sacava; Quando registrado; Então marca-se o ponto e circula-se, sem abrir novo saque. Em todos os sets circula-se o último ponto de cada equipe e se inutilizam em "ampulheta" os pontos não usados. Fonte: Guia p.41-44 [G]. CBV papel.
- **RG-SET-001** - Dado sets 1 a 4; Quando uma equipe chega a 25 pontos com 2 de vantagem; Então ela vence o set. 24x24 continua até a diferença de 2 (26x24, 27x25...). Fonte: 6.2 [V]; Guia p.40 [G]. FIVB=CBV. Est/Am: o organizador pode definir outro alvo (produto parametriza `Np`). Produto: OK.
- **RG-SET-002** - Dado 24x23 ou 25x24; Quando o rally termina; Então o set NÃO acaba (exige 2 de vantagem). Placares-teste: 25x23 acaba; 25x24 não; 26x24 acaba; 30x28 acaba. Fonte: 6.2 [V]. Produto: OK (sem teto, ver requisito).
- **RG-SET-003** - Dado partida em melhor de 5; Quando as equipes empatam em 2x2; Então joga-se o 5º set (decisivo) até 15 pontos com 2 de vantagem. Fonte: 6.3.2 [V]; Guia p.60 [G]. FIVB=CBV. Est/Am: melhor de 3 é comum; o set decisivo tem pontuação própria (produto: `Nt`). Produto: OK, mas DIV no "terceiro set obrigatório" (seção 3, D2).
- **RG-SET-004** - Dado a partida; Quando uma equipe vence 3 sets (melhor de 5); Então a partida termina; não existe 6º set. Em melhor de N, vence quem tem ceil(N/2) sets, e a partida acaba nesse momento. Fonte: 6.3.1 [V] (para N=5); o caso geral é extensão lógica. Produto: OK (e DIV só no terceiro obrigatório).
- **RG-SET-005** - Dado intervalo entre sets; Quando termina um set; Então o intervalo dura 3 minutos (pode ser até 10 minutos entre o 2º e 3º sets a pedido do organizador); nele as equipes trocam de quadra e entregam papeletas. Fonte: 18.1 [V]; Guia p.59 [G]. Varia: FIVB/CBV; o horário real do intervalo longo deve ser lançado.
- **RG-SET-006** - Dado sets 1 a 4; Quando termina o set; Então as equipes trocam de quadra. No set decisivo não trocam ao fim, mas trocam quando a equipe líder atinge 8 pontos, sem mudar posições. Se esquecida, a troca ocorre assim que o erro for notado, com o placar da hora. Fonte: 18.2.1, 18.2.2, 27.2.2.5 [V]; Guia p.60-68 [G]. Igual.
- **RG-SET-007** - Dado término do set; Quando o 1º árbitro encerra; Então registra-se o horário do fim; os dados do set (tempos, substituições, vitórias, pontos, duração) vão para o Quadro de Resultados logo após cada set. Fonte: Guia p.43, 45 [G]. CBV.
- **RG-SET-008** - Dado término da partida; Quando se fecha a súmula; Então: soma de tempos, substituições, sets, pontos e duração dos sets (sem intervalos); hora de início, hora de fim e duração total do jogo (com intervalos, 1 dígito de hora, ex.: 2h00); equipe vencedora e resultado em sets. Fonte: Guia p.70-72 [G]. CBV.

### 2.5 Substituições (RG-SUB)

- **RG-SUB-001** - Dado uma equipe e um set; Quando pede substituições; Então o máximo é 6 por set (por equipe); a 7ª é irregular. Fonte: 15.1 [V]; Guia p.47 [G]. FIVB=CBV. Est/Am: o regulamento pode ampliar (o produto aprovou 8; ver D1). Produto: DIV.
- **RG-SUB-002** - Dado o limite de 6; Quando conta o total; Então cada entrada e cada retorno contam como uma substituição; a substituição de vários jogadores no mesmo pedido conta uma por jogador. Fonte: 15.2.2, 15.6 [V] (a contagem por jogador deriva do controle do 2º árbitro, 24.2.7); [M] quanto ao critério de contar "por jogador" em vez de "por pedido". Produto: OK (conta entrada e retorno).
- **RG-SUB-003** - Dado jogador titular do set; Quando sai; Então só pode sair UMA vez no set e voltar UMA vez, e só à sua posição anterior. Fonte: 15.6.1 [V]. FIVB=CBV. Produto: DIV (permite repetir A->B).
- **RG-SUB-004** - Dado jogador reserva; Quando entra no lugar de um titular; Então só pode entrar uma vez por set e só pode ser substituído pelo mesmo titular. Fonte: 15.6.2 [V]. Produto: OK (terceiro atleta não substitui o par).
- **RG-SUB-005** - Dado o retorno do titular na súmula manual; Quando registrado; Então anota-se o placar e circula-se o número do substituto que sai; nessa posição não cabem mais substituições regulares, e esse reserva circulado não pode substituir outro titular. Fonte: Guia p.47-48 [G]. CBV.
- **RG-SUB-006** - Dado um pedido de substituição; Quando o jogo está parado e antes do apito de saque; Então ele é válido se feito pelo técnico (ou assistente/capitão em jogo se não há técnico) com o substituto já na zona de substituição. Fonte: 15.3.1, 15.10.3.1, 15.11.1 [V]. Igual.
- **RG-SUB-007** - Dado dois pedidos de substituição da mesma equipe; Quando pedidos na mesma interrupção ou sem rally concluído entre eles; Então o segundo é indevido (atraso), exceto substituição forçada por lesão, expulsão ou desqualificação. Vários jogadores no mesmo pedido são permitidos. Fonte: 15.2.2, 15.2.3, 15.11.1.3 [V]. Igual.
- **RG-SUB-008** - Dado substituição pedida antes do set; Quando se faz; Então ela é permitida e conta como substituição regular do set. Fonte: 15.3.2 [V]. Igual.
- **RG-SUB-009** - Dado substituição ilegal (excede 15.6 ou jogador não registrado) descoberta após reinício do jogo; Quando constatada; Então: ponto e saque ao adversário, substituição retificada, pontos da equipe faltosa desde a falta cancelados (os do adversário valem); nova súmula do set. Fonte: 15.9 [V]; Guia p.51 [G]. Igual. Se descoberta antes do reinício, é atraso (advertência/penalidade de atraso), não ponto.
- **RG-SUB-010** - Dado substituição excepcional (RG-SUB-011); Quando registrada; Então não conta como regular, mas entra no total de substituições do set e da partida; na súmula manual é anotada somente no Quadro de Observações. Fonte: 15.7 [V]; Guia p.50 [G]. Produto: DIV potencial (não definido como contar).
- **RG-SUB-011** - Dado jogador (não líbero) que não pode continuar por lesão/doença, expulsão ou desqualificação e que não pode ser substituído legalmente; Quando o 2º árbitro autoriza; Então qualquer jogador que não esteja em quadra, exceto líbero, segundo líbero e o jogador regular que o líbero substitui, entra; o jogador substituído excepcionalmente não volta mais à partida; não precisa de rally concluído entre pedidos. Fonte: 15.7, 15.2.3, 24.2.8 [V]; Guia p.49-50 [G]. Igual.
- **RG-SUB-012** - Dado jogador expulso ou desqualificado em quadra; Quando a sanção é aplicada; Então deve ser substituído imediatamente por substituição legal; se não for possível, excepcional; se não for possível, a equipe é declarada INCOMPLETA. Fonte: 15.8 [V]. Igual.
- **RG-SUB-013** - Dado lesão sem possibilidade de substituição legal nem excepcional; Quando o jogador está em quadra; Então recebe 3 minutos de recuperação, uma só vez por jogador na partida; se não se recupera, a equipe é declarada incompleta. Fonte: 17.1.2 [V]. Igual.
- **RG-SUB-014** - Dado o início de novo set; Quando começa; Então contagem de substituições e vínculos de pares reiniciam (é limite POR SET). Fonte: 15.1 [V]. Produto: OK.
- **RG-SUB-015** - Dado substituição pelo apontador; Quando a súmula manual registra; Então escreve-se o número do substituto (que entra) abaixo do titular (que sai) e o placar, primeiro os pontos da equipe solicitante. Fonte: Guia p.47 [G]. CBV.

### 2.6 Líbero (RG-LIB)

- **RG-LIB-001** - Dado a relação nominal; Quando se designa líbero; Então a equipe pode ter até 2 líberos (L1 atuante e L2) escolhidos entre os jogadores da relação nominal, registrados nas linhas próprias; em FIVB/World/Oficiais Adulto com mais de 12 jogadores, 2 líberos são obrigatórios. Líbero não é obrigatório na regra geral. Fonte: 19.1 [V]; Guia p.19-20 [G]. Varia: FIVB obriga dois com >12; CBV/Est/Am seguem regulamento. Produto: OK (líbero inicial não obrigatório).
- **RG-LIB-002** - Dado líbero(s); Quando em quadra; Então só um líbero por vez; uniforme de cor dominante diferente do restante e numerado. Fonte: 19.1, 19.2 [V]. Igual.
- **RG-LIB-003** - Dado o líbero; Quando substitui; Então só pode substituir jogador em posição de fundo (back row). Fonte: 19.3.1.1 [V]. Igual.
- **RG-LIB-004** - Dado o líbero; Quando joga; Então não pode sacar, bloquear nem tentar bloquear; não pode atacar com a bola totalmente acima da borda superior da rede (de qualquer lugar); e jogador não pode atacar acima da rede bola que vem de toque de dedos do líbero na zona de ataque dele. Fonte: 19.3.1.2-19.3.1.4, 13.3.5, 13.3.6 [V]. Igual.
- **RG-LIB-005** - Dado troca de líbero; Quando feita; Então não conta como substituição, é ilimitada, mas exige rally concluído entre duas trocas (exceções: penalidade que leva líbero à posição 4; líbero fica incapaz). Fonte: 19.3.2.1 [V]. Produto: OK (líbero informativo não consome cota), mas o produto não valida o "rally entre trocas" (lacuna de regra).
- **RG-LIB-006** - Dado o líbero atuante; Quando é trocado; Então só pode ser substituído pelo jogador regular da posição ou pelo segundo líbero; o jogador regular pode trocar com qualquer um dos líberos. Fonte: 19.3.2.2 [V]. Igual.
- **RG-LIB-007** - Dado início do set; Quando o líbero quer entrar; Então só depois de o 2º árbitro conferir a papeleta e autorizar a troca com um titular. Fonte: 19.3.2.3 [V]. Igual.
- **RG-LIB-008** - Dado troca de líbero; Quando ocorre; Então só com bola fora de jogo e antes do apito de saque, pela zona de troca de líbero; troca feita após o apito mas antes do golpe: não rejeitar, advertir o capitão; reincidência é atraso. Fonte: 19.3.2.4-19.3.2.7 [V]. Igual.
- **RG-LIB-009** - Dado troca ilegal de líbero (sem rally concluído; trocado por jogador que não é o regular nem o 2º líbero); Quando detectada antes do próximo rally; Então é corrigida e a equipe recebe sanção de atraso; se detectada após o golpe de saque, aplica-se como substituição ilegal (RG-SUB-009). Fonte: 19.3.2.9 [V]; Guia p.113 [G]. Igual.
- **RG-LIB-010** - Dado líbero ferido, doente, expulso, desqualificado ou declarado incapaz por técnico (ou assistente/capitão); Quando equipe com um só líbero; Então o técnico pode REDESIGNAR como líbero para o resto da partida qualquer jogador que não esteja em quadra, exceto o jogador regular substituído pelo líbero; comunica ao 2º árbitro. Fonte: 19.4.1, 19.4.2.1, 19.4.2.3 [V]. Igual.
- **RG-LIB-011** - Dado líbero atuante incapaz em quadra; Quando há redesignação; Então o novo líbero pode entrar direta e imediatamente; o líbero original (sujeito da redesignação) não joga mais na partida; novas redesignações são permitidas se o redesignado ficar incapaz; o capitão pode ser redesignado. Fonte: 19.4.2.2, 19.4.2.4, 19.4.2.5 [V]. Igual.
- **RG-LIB-012** - Dado equipe com dois líberos; Quando um fica incapaz; Então joga com um só e NÃO há redesignação, salvo se o restante também ficar incapaz. Se o líbero for expulso/desqualificado, o segundo entra imediatamente. Fonte: 19.4.3.1, 19.5 [V]. Igual.
- **RG-LIB-013** - Dado redesignação; Quando acontece; Então o número do novo líbero é registrado no quadro de observações da súmula e na folha de controle de líbero (modelo: REDESIGNAÇÃO DE LÍBERO, EQUIPE B, LÍBERO Nº 10 LESIONADO, NOVO LÍBERO JOGADOR Nº 2, 2º SET, PLACAR 9X6). Fonte: 19.4.2.6 [V]; Guia p.77, 120 [G]. CBV.
- **RG-LIB-014** - Dado folha de controle de líbero; Quando em jogo; Então o apontador assistente registra cada troca (nº do líbero na coluna "Líb.", nº do regular em "Troca", placar da hora, primeiro o da equipe que troca); entre dois líberos deixa "Troca" em branco; assina ao fim; os árbitros conferem mas não assinam; é anexada à súmula. Fonte: 28.2 [V]; Guia p.125-137 [G]. CBV. Produto: log de trocas de líbero é "informativo", mas o PDF deve emitir a folha.

### 2.7 Tempos (RG-TMP)

- **RG-TMP-001** - Dado uma equipe e um set; Quando pede tempo; Então o máximo é 2 tempos de 30 segundos por set; o 3º é pedido indevido. Fonte: 15.1, 15.4.1, 15.11.1.4 [V]; Guia p.46 [G]. FIVB=CBV. Est/Am: duração pode variar (FIVB permite ajuste a pedido do organizador).
- **RG-TMP-002** - Dado pedido de tempo; Quando feito; Então só com bola fora de jogo e antes do apito de saque, por técnico (ou assistente/capitão em jogo, se não há técnico); durante rally ou após apito é indevido. Fonte: 15.3.1, 15.4.1, 15.11.1 [V]. Igual.
- **RG-TMP-003** - Dado pedido(s) de tempo; Quando seguidos; Então um ou dois tempos e UM pedido de substituição podem vir na mesma interrupção, sem dois pedidos de substituição seguidos. Fonte: 15.2.1, 15.2.2 [V].
- **RG-TMP-004** - Dado pedido de tempo registrado na súmula manual; Quando lançado; Então abaixo da coluna de pontos, primeiro os pontos da equipe solicitante e depois os da outra (ex.: 3x6). Fonte: Guia p.46 [G]. CBV.
- **RG-TMP-005** - Dado primeiro pedido indevido da equipe que não atrasa o jogo; Quando ocorre; Então é rejeitado e registrado, sem consequência (X sobre a equipe, no quadro de sanções); os seguintes pedidos indevidos são atraso. Fonte: 15.11.2, 15.11.3 [V]; Guia p.52 [G]. Igual.
- **RG-TMP-006** - Dado pedido rejeitado e sancionado com advertência de atraso; Quando na mesma interrupção; Então não se pode pedir outra interrupção regular até o fim do próximo rally concluído. Fonte: 15.2.4 [V].
- **RG-TMP-007** - Dado atraso; Quando é a primeira vez na partida (qualquer tipo, qualquer membro); Então advertência por atraso (sigla R na coluna A, com equipe, set e placar). Fonte: 16.2.2 [V]; Guia p.53 [G]. Observação: FIVB internacional usa "D" (Guia p.112).
- **RG-TMP-008** - Dado segundo ou posterior atraso da mesma equipe na partida; Quando ocorre; Então é penalidade por atraso: ponto e saque ao adversário (R na coluna P e ponto do adversário circulado). Sanções de atraso valem para a partida toda e as impostas antes ou entre sets valem no set seguinte. Fonte: 16.2.1-16.2.4 [V]; Guia p.54 [G]. Igual.
- **RG-TMP-009** - Dado tempo técnico indoor; Quando o regulamento da competição o prevê; Então a duração e o gatilho (pontos) vêm do regulamento. Fonte: não consta nas Regras FIVB 2025-2028 [V - ausência]. Varia: depende do regulamento. De memória, competições de elite usam tempo técnico nos sets 1-4 em pontos fixos [M, não verificado]; o produto deve parametrizar (gatilho por soma de pontos ou pontos de uma equipe) e deixar DESLIGADO por padrão para estaduais/amadoras.

### 2.8 Sanções de conduta (RG-SAN)

- **RG-SAN-001** - Dado conduta menor; Quando ocorre; Então 1º estágio: advertência verbal pelo capitão em jogo; 2º estágio: cartão amarelo ao membro (sem sanção), registrado na coluna A do quadro de sanções (nº do jogador ou sigla da comissão, equipe, set, placar), com validade para a partida, sem consequência imediata. Fonte: 21.1 [V]; Guia p.55 [G]. Igual.
- **RG-SAN-002** - Dado conduta grosseira (rude); Quando é a PRIMEIRA do membro na partida; Então penalidade (cartão vermelho): ponto e saque ao adversário (coluna P, ponto circulado). Fonte: 21.3.1 [V]; Guia p.56 [G]. Igual.
- **RG-SAN-003** - Dado a SEGUNDA conduta grosseira do mesmo membro; Quando ocorre; Então expulsão sem outras consequências. Fonte: 21.3.2.3 [V]. Igual.
- **RG-SAN-004** - Dado a TERCEIRA conduta grosseira do mesmo membro; Quando ocorre; Então desqualificação. Fonte: 21.3.3.4 [V]. Igual.
- **RG-SAN-005** - Dado conduta ofensiva; Quando é a PRIMEIRA do membro; Então expulsão (sem sanção prévia exigida); a SEGUNDA ofensiva = desqualificação. Fonte: 21.3.2.2, 21.3.3.3, 21.4.3 [V]. Igual.
- **RG-SAN-006** - Dado agressão ou ameaça; Quando ocorre; Então desqualificação direta. Fonte: 21.3.3.2 [V]. Igual.
- **RG-SAN-007** - Dado membro expulso; Quando sanção aplicada; Então não participa pelo resto do SET e vai ao vestiário até o fim do set (coluna E); jogador em quadra é substituído (RG-SUB-012); técnico expulso perde direito de intervir no set e o assistente assume. Fonte: 21.3.2.1, 5.3.2 [V]; Guia p.57 [G]. Igual.
- **RG-SAN-008** - Dado membro desqualificado; Quando aplicada; Então não participa pelo resto da PARTIDA e vai ao vestiário (coluna D). Fonte: 21.3.3.1 [V]; Guia p.58 [G]. Igual.
- **RG-SAN-009** - Dado sanções de conduta; Quando aplicadas; Então são individuais, valem para a partida inteira e são progressivas (cada reincidência do mesmo membro tem sanção mais grave); sanções de atraso são da EQUIPE. Fonte: 21.4.1, 21.4.2, 16.2.1 [V]. Igual.
- **RG-SAN-010** - Dado conduta antes ou entre sets; Quando sancionada; Então a sanção se aplica no set seguinte (a penalidade em ponto vale no placar 0x0 do set seguinte, sempre ao adversário). Fonte: 21.5 [V]. Igual. Detalhe de quem saca em 0x0 é [M]: confirmar no Livro de Casos.
- **RG-SAN-011** - Dado a súmula; Quando registra sanção; Então a ordem do quadro de sanções segue a ordem de aplicação, cada linha com o membro, equipe, set e placar (da hora, primeiro a equipe punida). Fonte: Guia p.52-58 [G]. CBV.
- **RG-SAN-012** - Dado equipe sem jogador apto após expulsão/desqualificação/lesão; Quando não há substituição legal nem excepcional; Então a equipe é declarada INCOMPLETA para o set ou para o jogo: mantém seus pontos e sets, o adversário recebe os pontos (ou pontos e sets) necessários para vencer o set (ou a partida). Fonte: 6.4.3, 15.8 [V]; Guia p.96-102 [G]. Igual.

### 2.9 Protestos, interrupções e anotações (RG-PRO, RG-INT)

- **RG-PRO-001** - Dado discordância com decisão de aplicação ou interpretação das regras; Quando a bola está fora de jogo; Então só o capitão em jogo pode pedir esclarecimento ao 1º árbitro; se discorda, informa IMEDIATAMENTE que se reserva o direito de registrar protesto oficial ao fim da partida. Fonte: 5.1.2.1, 23.2.4 [V]; Guia p.78 [G]. Igual.
- **RG-PRO-002** - Dado protesto anunciado no momento; Quando a partida termina; Então o capitão (do time) pode confirmar e registrar protesto na súmula, com autorização do 1º árbitro; o apontador escreve ou permite que o capitão escreva o relato (o Guia sugere rascunho que o apontador transcreve). Protestos sobre fatos não anunciados na hora não são aceitos [M quanto ao não aceite; a regra exige aviso "em tempo devido"]. Fonte: 5.1.3.2, 27.2.3.2 [V]; Guia p.78, 122 [G]. Igual.
- **RG-PRO-003** - Dado protesto que o capitão decide NÃO formalizar ao fim; Quando a partida acaba; Então registra-se observação de desistência (modelo no Guia). Fonte: Guia p.122 [G]. CBV.
- **RG-PRO-004** - Dado protesto de matéria técnica (resultado, erro de apontador/árbitro); Quando analisado; Então a decisão cabe ao órgão competente do regulamento (comissão disciplinar/Tribunal); a súmula só guarda o relato. Fonte: não consta nas Regras; [M].
- **RG-INT-001** - Dado acidente grave com bola em jogo; Quando ocorre; Então árbitro para o jogo, permite assistência médica, e o rally é REPETIDO. Fonte: 17.1.1 [V]. Igual.
- **RG-INT-002** - Dado interferência externa; Quando ocorre; Então jogo parado e rally repetido. Fonte: 17.2 [V]. Igual.
- **RG-INT-003** - Dado interrupção imprevista (falta de energia, goteira etc.); Quando o total não passa de 4 horas e o jogo volta na MESMA quadra; Então o set continua com mesmo placar, jogadores (menos expulsos/desqualificados) e posições; o apontador registra início/fim da interrupção e lança nas observações (ex.: JOGO INTERROMPIDO NO 3º SET, PLACAR 13X9, POR 15 MINUTOS, ...). Fonte: 17.3.2.1 [V]; Guia p.103 [G]. Igual.
- **RG-INT-004** - Dado interrupção; Quando o jogo volta em OUTRA quadra (dentro de 4 h); Então o set interrompido é ANULADO e rejogado com os mesmos jogadores e formações iniciais (exceto expulsos/desqualificados), mantendo todas as sanções; sets já jogados mantêm o placar; nova súmula anexa e observação com tempo total de paralisação. Fonte: 17.3.2.2 [V]; Guia p.104-106 [G]. Igual.
- **RG-INT-005** - Dado interrupções cujo total passa de 4 horas; Quando ocorre; Então TODA a partida é repetida. Fonte: 17.3.3 [V]; Guia p.106 [G]. Igual.
- **RG-INT-006** - Dado quadro de observações; Quando usado; Então registra ocorrências sem campo próprio e retificações, em linguagem objetiva, ordem cronológica, sem pular linhas, usando termos da súmula ("jogador", não "atleta"); antes do sorteio usa siglas das equipes, depois "equipe A/B"; placar com os pontos da equipe A primeiro (ou da equipe em questão primeiro). Observações de atribuição do 2º árbitro (excepcionais, recuperação, redesignação, interrupção, interferência) são instruídas por ele; as demais exigem anuência do 1º árbitro. Fonte: 27.2.2.7 [V]; Guia p.76-77 [G]. CBV.
- **RG-INT-007** - Dado erro na súmula manual; Quando detectado; Então não pode haver rasura: corrige-se no quadro de observações; caneta preta, letra de forma maiúscula; o apontador mantém súmula reserva. Fonte: Guia p.5-6 [G]. CBV papel. Produto: o equivalente é log de edição com autor e hora (ver D6).

### 2.10 WO, equipe ausente, incompleta (RG-WO)

- **RG-WO-001** - Dado equipe que se recusa a jogar após ser chamada, a qualquer momento; Quando o 1º árbitro declara; Então a equipe é declarada ausente (default), e a partida termina 3x0 para o adversário com parciais 25x0 em cada set (registrado apenas nas observações, mantendo os sets já jogados no Quadro de Resultados). Exceção: ausente no 1º set - lançar 25x0 três vezes, zeros em tempos, substituições e duração, soma, vencedora e 3x0. Fonte: 6.4.1 [V]; Guia p.82-86 [G]. FIVB=CBV. Est/Am: placar de WO pode ser definido no regulamento (ex.: 2x0 em melhor de 3) [M].
- **RG-WO-002** - Dado equipe que não se apresenta no horário; Quando passa a tolerância; Então ausente com o mesmo resultado (3x0, 25x0). Tolerância: 30 minutos (exemplo do Guia p.92) e 15 minutos em W.O. duplo (exemplo do Guia p.95) - a tolerância vem do REGULAMENTO e varia. Fonte: 6.4.2 [V]; Guia p.87-95 [G]. Varia: regulamento. Produto: parametrizar.
- **RG-WO-003** - Dado WO simples; Quando a súmula é preenchida; Então: cabeçalho, quadro de equipes (só a equipe presente, tratada como "A"), quadro de aprovação; nenhum quadro de set; Quadro de Resultados com P=25 e V=1 por set para a vencedora, zeros para a perdedora, e S, T, duração = 0; observação do atraso e tolerância; assinam técnico e capitão presentes e a arbitragem. A equipe de arbitragem confere se há ao menos 6 jogadores da vencedora presentes. Fonte: Guia p.87-93 [G]. CBV.
- **RG-WO-004** - Dado WO duplo; Quando ambas as equipes faltam; Então preenche-se cabeçalho e quadro de aprovação, observação "AS EQUIPES NÃO COMPARECERAM... FORAM DECLARADAS AUSENTES", só a arbitragem assina; o efeito na classificação (nenhuma vence) é regra do regulamento. Fonte: Guia p.94-95 [G]. Varia: regulamento. Produto: DIV potencial (o requisito de classificação exige vencedor; WO duplo precisa de tratamento próprio).
- **RG-WO-005** - Dado equipe incompleta para o set; Quando declarada; Então perde o set, mantém seus pontos; o adversário recebe os pontos necessários; os sets seguintes podem ser jogados se houver 6 aptos; sem 6 aptos no set seguinte, incompleta para o jogo. Fonte: 6.4.3 [V]; Guia p.96-102 [G]. Igual.

### 2.11 Assinaturas e fechamento (RG-FEC)

- **RG-FEC-001** - Dado antes do jogo; Quando a relação nominal está pronta; Então assinam técnicos e capitães (no quadro de equipes), os capitães ainda assinam no sorteio; o técnico confere a relação antes de assinar. Fonte: 5.1.1, 5.2.2, 27.2.1.1 [V]; Guia p.27 [G]. Igual.
- **RG-FEC-002** - Dado fim do jogo; Quando a súmula é fechada; Então a ordem de assinatura é: apontador(es) primeiro, depois os capitães (agradecem aos árbitros e assinam para ratificar o resultado), depois os árbitros. Fonte: 27.2.3.3, 5.1.3.1, 24.3.3, 28.2.3.2 [V]; Guia p.75 [G]. Igual.
- **RG-FEC-003** - Dado capitão ausente ao final (por motivo que não seja recusa); Quando a súmula é assinada; Então assina o capitão em jogo, com observação do fato. Se o capitão recusa, o campo fica em branco com observação do motivo. Fonte: Guia p.73-74, 123 [G]. CBV.
- **RG-FEC-004** - Dado fechamento da partida; Quando se registra resultado; Então vencedora e resultado em sets, totais coerentes (tempos, substituições, sets, pontos), horários e duração. Fonte: 27.2.3.1 [V]; Guia p.70-72 [G]. Igual.
- **RG-FEC-005** - Dado assinaturas apostas; Quando a partida está oficializada; Então a regra não prevê alteração posterior do resultado pela equipe; correção posterior é ato administrativo do organizador. Fonte: 5.1.3.1 [V] (assinatura ratifica resultado); a "janela de 30 minutos por link" do produto não existe na regra oficial (D6).

---

## 3. Divergências entre a regra oficial e o requisito aprovado do produto

Base: `docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md`.

| # | Tema | Regra oficial | Produto aprovado | Avaliação |
| --- | --- | --- | --- | --- |
| **D1** | Limite de substituições | 6 por set (15.1; Guia p.47) | **8 por set**; a 9ª é bloqueada | DIV. Aceitável só para estaduais/amadoras se o regulamento permitir. Recomenda-se limite **configurável por campeonato** com padrão 6 e o valor 8 como opção "amador". Em competições CBV/FIVB 8 geraria súmula inválida. Testes devem rodar com 6 e com 8. |
| **D2** | Terceiro set obrigatório | Partida acaba quando uma equipe tem a maioria dos sets (6.3.1). Não existe terceiro set após 2x0 | Em melhor de 3 pode-se exigir o 3º set mesmo após 2x0 (placares finais 3x0 e 2x1) | DIV (aceitável como formato de organizador). Classificar como "formato não-FIVB": a súmula PDF para CBV/FIVB não deve permitir. Esse 3º set é jogado até `Nt`, mas em 2x0 ele não é "decisivo" (não há novo sorteio nem troca aos 8) - definir o comportamento. |
| **D3** | Repetição do par (A->B, B->A, A->B) | Titular sai uma vez e volta uma vez; reserva entra uma vez por set (15.6.1, 15.6.2) | "O mesmo par pode fazer A->B novamente, respeitando o limite" | DIV. Segundo ciclo do mesmo par é ilegal pela FIVB e vira substituição ilegal (15.9: ponto, saque, cancelamento de pontos). Manter só em modo amador, e SINALIZAR. |
| **D4** | Substituição excepcional | Não conta como regular, mas entra no total do set/partida; sem retorno do lesionado; sem exigência de rally entre pedidos (15.7) | Não definida | Lacuna. Definir contador separado, bloqueio do retorno e regra de elegibilidade (exceto líberos e o jogador regular que o líbero substitui). |
| **D5** | Substituição antes do set | Vale como regular do set (15.3.2) | Não definida | Lacuna. |
| **D6** | Janela de correção por link (30 min), depois só organizador | A regra FIVB considera a súmula assinada como ratificação do resultado (5.1.3.1); correção posterior é administrativa; protesto segue 5.1.3.2 | 30 minutos por link, depois só o organizador autenticado | Não é regra de jogo, é regra de produto. Compatível desde que haja trilha de auditoria (já prevista) e que a assinatura digital/ratificação dos capitães seja registrada. Sugerir: após a janela, a correção exige motivo registrado. |
| **D7** | Líbero | Troca não conta como substituição (19.3.2.1) mas há regras: só fundo, rally entre trocas, só com o jogador regular ou 2º líbero, redesignação | "Registro informativo; não consome cota; não cria par; não altera o controle" | OK quanto à cota. LACUNA: o produto não valida rally entre trocas, o jogador regular correspondente, a proibição de sacar/bloquear nem a redesignação. Recomendar validações como avisos configuráveis. |
| **D8** | Tempos técnicos | Não existem nas Regras indoor 2025-2028; praia tem (RG-TMP-010) | Não tratados | Lacuna: tornar o gatilho parametrizável por regulamento. |
| **D9** | Pontuação do WO e classificação | WO = 0-3 e 0-25 por set (6.4.1); Guia 3x0, 25x0 | Pontos de vencedor e perdedor por margem de sets (2 ou mais sets = mesma faixa) | Compatível para WO simples (margem 3). Lacuna: WO duplo, perdedor por WO (muitos regulamentos dão 0 ponto ou desconto) e partida interrompida/incompleta não aparecem. |
| **D10** | Alvo de pontos livre e sem teto | 25 / 15 (sets regulares / decisivo), sempre com 2 de vantagem | `Np`, `Nt` livres; sem teto | OK e superconjunto da regra. Os testes devem cobrir os valores 15, 21, 25. |
| **D11** | MVP | Não existe na regra | Obrigatório antes de oficializar | Regra de produto/competição. Não afeta validade da súmula FIVB/CBV. Sugerir tornar obrigatoriedade configurável. |
| **D12** | Set interrompido/anulado | 17.3 | Não tratado | Lacuna: o requisito diz que o envio rejeita "set adicional indevido". O set anulado e rejogado precisa de modelo de dados (súmula anexa). |
| **D13** | Sanções e incompleta | 6.4.3, 15.8, 21 | Não tratadas no requisito de súmula (existem "ocorrências") | Lacuna: sanções acumuladas, ponto da penalidade e incompleta alteram placar e vencedor do set; o motor precisa tratá-las. |

---

## 4. Vôlei de praia (FIVB 2025-2028 [VP]) - o que muda em relação ao indoor

Fonte: Official Beach Volleyball Rules 2025-2028, v01. O Guia CBV é só indoor; praia na CBV/COBRAV segue as regras de praia da FIVB e o regulamento do evento [M quanto às adaptações nacionais].

- **RG-PRA-001** - Equipe de exatamente 2 jogadores, sem banco, sem substituições, sem líbero (4.1.1, 15.2.2). Então qualquer evento de substituição/líbero deve ser rejeitado no modo praia.
- **RG-PRA-002** - Sem posições nem falta de posição (7.4.1, 7.5.1). Nenhuma validação de formação de quadra.
- **RG-PRA-003** - Ordem de saque definida pelo capitão logo após o sorteio e mantida no set; saque fora da ordem = ponto e saque ao adversário, sem cancelamento de pontos (7.6, 7.7). Quando a equipe receptora ganha o saque, os jogadores "rodam" uma posição (7.6.2).
- **RG-PRA-004** - Set: 21 pontos com 2 de vantagem (20x20 continua); partida ganha por 2 sets; set decisivo (3º) a 15 pontos com 2 de vantagem; novo sorteio no set decisivo (6.2, 6.3, 7.1.2.3).
- **RG-PRA-005** - Default/WO: 0-2 na partida e 0-21, 0-21 nos sets (6.4.1). Equipe incompleta perde o set ou a partida.
- **RG-PRA-006** - Tempos: 1 por equipe por set, 30 segundos; só o capitão pode pedir (15.1, 15.3, 15.4.1). Tempo técnico automático de 30 s quando a soma dos pontos chega a 21, apenas nos sets 1 e 2, em competições FIVB/World/Oficiais; no 3º set não há tempo técnico (15.4.2, 15.4.3). RG-TMP-010 = esta regra. Varia: regulamento de eventos nacionais/estaduais.
- **RG-PRA-007** - Atraso: máximo de 12 segundos entre o fim do rally e o apito do saque; mesma escala de advertência/penalidade por atraso (16.1.3, 16.2).
- **RG-PRA-008** - Troca de lado a cada 7 pontos (sets 1 e 2) e a cada 5 pontos (set 3), intervalo entre sets de 1 minuto (18.1.1, 18.2.1).
- **RG-PRA-009** - Sanções de conduta em praia contam POR SET para conduta grosseira: nas duas primeiras ocorrências, penalidade (ponto e saque); a terceira, expulsão. Primeira conduta ofensiva = expulsão (equipe incompleta no set); primeira agressão = desqualificação (equipe incompleta na partida) (20.3). Diferença do indoor, onde a contagem é na partida e o jogador é substituído.
- **RG-PRA-010** - Equipes não podem receber assistência/treinador em competições FIVB (4.1.4); estaduais/amadoras variam [M].
- **RG-PRA-011** - Aquecimento oficial de 3 min (5 min se não teve quadra) (7.2); o produto não precisa tratar.
- Produto: o requisito aprovado trata só de sets e classificação genéricos, parametrizáveis. Para praia faltam: dois jogadores, sem substituição/líbero, troca de lado por soma de pontos, tempo técnico por soma, 21/15.

---

## 5. Casos de jogo difíceis (insumo do relatório 09)

Cada caso descreve um cenário real, o resultado oficial esperado e o que o sistema deve fazer. Regras citadas ficam em [V] salvo indicação.

### CJ-01 Substituição excepcional por lesão
Cenário: set 2, equipe A com 6 substituições já usadas (ou, alternativa, jogador #5 já saiu e voltou uma vez). #5 (titular na posição 4) se lesiona. No banco: #12 (nunca jogou), #3 (já entrou no lugar de #7 e saiu), #9 libero.
Esperado: não há substituição legal para #5 (15.6.1: titular já usou saída e retorno; limite 6 atingido). A equipe tem direito a substituição EXCEPCIONAL (15.7): pode entrar #12 ou #3 (qualquer jogador fora de quadra, exceto líbero, segundo líbero e o jogador regular que o líbero substitui). #5 não volta mais na partida. Não conta como regular, mas entra no total de substituições do set e da partida; registrada nas observações com "EQUIPE A, Nº 5 SAIU / Nº 12 ENTROU, 2º SET, PLACAR __X__" (Guia p.124). Autorizada pelo 2º árbitro; não exige rally concluído entre pedidos (15.2.3). Se não houvesse ninguém no banco: 3 minutos de recuperação, uma vez por jogador (17.1.2); se não se recupera, equipe incompleta para o set (6.4.3) com os pontos mantidos e o adversário recebendo os necessários (Guia p.96-99).
Sistema: o 7º pedido NÃO deve ser bloqueado se for marcado como excepcional com motivo; o contador regular não aumenta; o jogador lesionado fica bloqueado para retorno; a nona substituição do produto (limite 8) não pode bloquear a excepcional.

### CJ-02 Líbero redesignado
Cenário: equipe B tem um só líbero (#10), em quadra na posição 5, placar 9x6 do 2º set. Ele se lesiona. Está no banco o jogador regular #4 (que o líbero substituiu), #2 e #8.
Esperado: o técnico informa o 2º árbitro. Pode redesignar #2 ou #8 (não o jogador regular substituído, #4, 19.4.2.1; nem alguém em quadra no momento da redesignação). O novo líbero pode entrar direta e imediatamente (19.4.2.2). #10 não joga mais na partida. Observação obrigatória e linha na folha de controle de líbero (modelo Guia p.77 e 120). Se o novo líbero também ficar incapaz: nova redesignação (19.4.2.4). Se o capitão for redesignado: permitido (19.4.2.5). Com DOIS líberos registrados e um incapaz: nenhuma redesignação, joga com o outro (19.4.3.1). Libero expulso com 2 líberos: o segundo entra imediatamente (19.5).
Sistema: redesignação NÃO consome substituição; deve registrar quem foi redesignado, setar o novo número como líbero até o fim da partida e impedir novas trocas com o antigo líbero; o jogador redesignado não pode mais atuar como jogador de linha (consequência inferida de "líbero para o resto da partida", 19.4.2.1 - confirmar no Livro de Casos [M]).

### CJ-03 Erro de rotação descoberto depois
Cenário (Guia p.114-115): equipe B recupera o saque e deveria sacar #14; sacou #10. Descobre-se depois de o rally ter sido concluído (ou quando #14 chega à posição I). Placar A 13 x B 11 no 1º set; B tinha feito 11 pontos desde o primeiro saque errado.
Esperado: falta de rotação. Cancelam-se todos os pontos de B desde o momento exato da falta (no exemplo B volta de 11 para 0); os pontos de A permanecem e A ganha um ponto e o saque (7.7.1.1). Se o rally que começou com a falta já terminou, só um ponto é dado a A, independentemente do resultado desse rally. Rodízio de B é retificado. Abre-se nova súmula do set (Guia p.113-119) com as formações, tempos, substituições e sanções transcritos e observação "SEGUE SÚMULA ANEXA REFERENTE AO 1º SET, ..., PLACAR 11X13". Se não for possível determinar o momento exato: só ponto e saque ao adversário, sem cancelamento (7.7.2).
Contraste: uma falta de POSIÇÃO é decidida na hora do golpe do saque e nunca é descoberta "depois"; seu único efeito é ponto e saque (7.5.4), sem cancelar pontos.
Sistema: o motor precisa de pontos com carimbo de evento (quem sacou, rodízio em cada ponto), permitir reversão auditável e recomputar placar e sacador.

### CJ-04 Sanções acumuladas
Cenário: no 1º set, advertência de atraso à equipe A (retardamento de tempo). No 2º set, jogador #8 de A recebe cartão amarelo (conduta menor), depois conduta grosseira (penalidade: ponto e saque a B), depois nova conduta grosseira (expulsão). No 3º set, técnico de A comete conduta ofensiva; A comete novo atraso.
Esperado: a advertência de atraso vale para a partida inteira (16.2.1.1): qualquer novo atraso de A é penalidade, ponto e saque a B, mesmo em outro set (16.2.3). #8: amarelo (21.1) sem consequência; grosseira 1 = penalidade; grosseira 2 = expulsão: sai do set (21.3.2.3), é substituído legal ou excepcionalmente de imediato (15.8) e volta a poder jogar no set seguinte; uma terceira conduta grosseira dele na partida seria desqualificação (21.3.3.4). Técnico: ofensiva (primeira) = expulsão: vai ao vestiário até o fim do ongoing set, assistente assume (21.3.2.1, 5.3.2); no set seguinte volta. Se tivesse havido agressão: desqualificação até o fim da partida.
Pontos em aberto [M]: como se combinam categorias diferentes no mesmo membro (por exemplo, conduta grosseira penalizada e depois ofensiva - a Regra 21.4.3 diz que ofensiva e agressão "não exigem sanção prévia", ou seja, vale a sanção da categoria; confirmar com o Casebook se o ofensivo após uma penalidade vira desqualificação). A regra do produto deve ser: sanção = f(categoria, nº de ocorrências do membro na partida), conforme 21.3.
Sistema: cada sanção gera registro (membro, tipo, set, placar), ponto automático ao adversário nas penalidades, bloqueio de membro expulso até o fim do set / desqualificado até o fim do jogo, e contador de atraso por equipe (partida).

### CJ-05 Set decisivo
Cenário: melhor de 5, 2x2. Intervalo, novo sorteio. A lidera 8x6.
Esperado: novo sorteio (7.1) define saque e lado; o set vai a 15 com 2 de vantagem (15x14 continua; 16x14 acaba; 17x15 acaba); aos 8 pontos da líder as equipes trocam de quadra sem alterar posições (18.2.2); se esquecerem, trocam quando notarem, sem alterar o placar; tempos e substituições do 5º set recomeçam do zero (por set). Guia p.60-68: três quadros na súmula manual, com tempos e substituições passados do quadro esquerdo ao direito; o placar da troca é lançado no quadro da direita.
Praia: set decisivo a 15, com troca de lado a cada 5 pontos, sem tempo técnico, um tempo por equipe (RG-PRA-004, 006, 008).
Estaduais com melhor de 3: o set decisivo é o 3º set, normalmente com alvo menor (`Nt`); o produto aprovou que o organizador defina `Nt` e se o 3º é obrigatório (D2). Teste: com `Nt` = 15 e 2x0, se o 3º for obrigatório, o placar final pode ser 3x0 ou 2x1; não há novo sorteio nem troca aos 8 [M - depende do regulamento].

### CJ-06 Partida interrompida
Cenário (a): falta de energia por 20 min no 2º set com 2x5, jogo retomado na mesma quadra. Esperado: set continua com placar, jogadores e posições; anotar "JOGO INTERROMPIDO NO 2º SET, PLACAR 2X5, POR 20 MINUTOS, POR MOTIVO DE FALTA DE ENERGIA" (Guia p.76-77; 17.3.2.1).
Cenário (b): goteira obriga trocar de quadra aos 13x9 do 3º set. Esperado: set anulado e rejogado do 0x0 com as mesmas formações iniciais (exceto expulsos/desqualificados) e todas as sanções mantidas; nova súmula anexa; observação com tempo total de paralisação (incluindo duração do set anulado); sets anteriores mantêm placar; capitães assinam as duas súmulas (17.3.2.2; Guia p.104-106).
Cenário (c): paralisações somam mais de 4 horas. Esperado: toda a partida é repetida (17.3.3).
Cenário (d): jogador lesionado grave com bola em jogo: parar imediatamente, assistência médica, rally repetido (17.1.1).
Cenário (e): uma equipe se recusa a continuar aos 8x7 do 5º set. Esperado: declarada ausente; resultado 3x0 para a adversária, parciais corretos 25x0 em cada set conforme observação do Guia p.85-86; mantêm-se na súmula os sets já jogados.
Sistema: precisa do estado "partida interrompida", registro de tempo de paralisação, política "continuar" vs "anular set" e vínculo de súmula anexa. O requisito aprovado rejeita "set adicional indevido": o set anulado precisa ser tratado como exceção explícita.

### CJ-07 Jogador não relacionado ou substituição ilegal descoberta depois
Cenário: equipe B já fez 6 substituições e faz a 7ª sem notar; o jogo reinicia; descoberta no placar B 14 x A 10.
Esperado: ponto e saque a A; substituição retificada; todos os pontos de B desde a 7ª substituição cancelados (15.9.2); A mantém os seus; nova súmula do set (Guia p.51). Se a descoberta ocorre antes de o jogo reiniciar, é só atraso (advertência, ou penalidade se for o 2º atraso da equipe).
Sistema com limite 8 (produto): a 9ª bloqueada; a 7ª e a 8ª em competição "FIVB/CBV" devem exibir alerta de ilegalidade.

### CJ-08 Troca ilegal de líbero
Cenário: líbero sai e outro jogador (não o regular nem o 2º líbero) entra no lugar do líbero, ou há duas trocas sem rally concluído.
Esperado: se notado antes do próximo rally, correção e sanção de atraso; se notado após o golpe de saque, mesmas consequências de substituição ilegal (19.3.2.9), com cancelamento de pontos e nova súmula (Guia p.113).

### CJ-09 Pontuação extrema e término do set
Cenário: set com alvo 25: 24x24, 25x24 (continua), 26x24 (acaba) e 30x29 (continua) e 31x29 (acaba). Protesto: o capitão avisa na hora e confirma ao fim.
Esperado: ver RG-SET-002. Protesto: ver RG-PRO-001..003.

### CJ-10 WO e equipe incompleta
Cenário: equipe C não chega após a tolerância; outra equipe fica sem jogadores aptos no 3º set após desqualificação.
Esperado: WO simples = 3x0 com 25x0 em cada set (6.4.2); WO duplo = ambas ausentes, só a arbitragem assina; equipe incompleta no jogo: perde, mantém pontos e sets (Guia p.100-102).

---

## 6. Matriz resumida de testes sugeridos para o motor de regras

Prioridade alta (afeta resultado, placar ou validade da súmula): RG-SET-001/002/003/004/006, RG-SAQ-002, RG-POS-003, RG-ROT-001..004, RG-SUB-001/003/009/011/012, RG-LIB-005/009/010/011, RG-SAN-002..008/012, RG-TMP-001/007/008, RG-WO-001/002/005, RG-INT-003..005, RG-FEC-002/004.
Prioridade média: RG-ELE-*, RG-FOR-001..009, RG-SUB-002/005/008/010, RG-LIB-001..004/006..008/012, RG-INT-001/002, RG-PRO-*.
Prioridade baixa (formatação e processo de papel, relevantes para o PDF): RG-FOR-010/011, RG-SET-007/008, RG-INT-006/007, RG-LIB-013/014, RG-FEC-003.

Fica pendente para revisão de especialista humano (COBRAV/FMV): todas as marcadas [M]; o Livro de Casos de Súmula CBV (itens 1.x a 4.x); o Casebook FIVB 2024; os regulamentos de Superliga e dos estaduais usados como alvo do produto.

---

## 7. Resumo

1. Foram lidos o texto integral das Regras FIVB indoor 2025-2028, das Regras de praia 2025-2028 e do Guia CBV/COBRAV fev/2025; Livro de Casos, Casebook e regulamentos de competição NÃO foram lidos.
2. Produzidas cerca de 130 regras testáveis com ID (RG-ELE, FOR, SAQ, POS, ROT, PTO, SET, SUB, LIB, TMP, SAN, PRO, INT, WO, FEC, PRA), todas com fonte e status [V]/[G]/[M].
3. Divergência crítica do produto: **8 substituições por set** (FIVB e Guia: 6) e **repetição do par A->B** (FIVB 15.6 só permite uma saída e um retorno por titular). Recomenda-se limite configurável com padrão 6.
4. Terceiro set obrigatório após 2x0 não existe nas regras FIVB (formato de organizador); alvos livres 15/21/25 e sem teto são um superconjunto compatível.
5. Lacunas do requisito: substituição excepcional, líbero (rally entre trocas, redesignação), sanções, set anulado/interrompido, WO duplo, tempo técnico.
6. Tempo técnico não existe no indoor FIVB 2025-2028; no praia é automático na soma de 21 pontos nos sets 1 e 2.
7. Faltas de posição só dão ponto e saque; faltas de rotação, jogador não registrado e substituição ilegal cancelam pontos (exigem nova súmula e reversão auditável no motor).
8. Dez casos difíceis estão na seção 5, prontos para o relatório 09.
9. Itens [M] devem ser confirmados antes de virar teste automatizado (pontuação de WO em melhor de 3, combinação de sanções de categorias diferentes, saque após penalidade entre sets, tolerância de WO).
