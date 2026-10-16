# 16 - Auditoria das regras de jogo na súmula (código real x regras priorizadas do relatório 03)

Agente: `regras-de-volei` (somente leitura). Data: 2026-10-16.
Entradas lidas: `docs/analise/03-regras-validaveis.md`, `docs/analise/02-referencia-e-scoresheet.md`, `docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md`, `docs/analise/04-gap-analysis-e-roadmap.md` (contexto) e o código abaixo.

## 0. Escopo, fontes e limites

- **Código auditado**: `src/app/sumula/[token]/lancar/page.tsx` (3.594 linhas; lidos os trechos de regra: estado 117-330, pontos 407-577, escalação 579-712, substituição/tempo/cartão 714-864, payload/envio 866-1036, abas 2107-2512, helpers 3062-3594), `src/app/sumula/[token]/page.tsx` (entrada), `src/app/partidas/[id]/ao-vivo/LiveMatchView.tsx` (só exibe `setsPorA/B`; sem regra), `src/lib/category-match-rules.ts`, `src/lib/schemas.ts` (`sumulaSchema`, 356-394), `src/lib/arbitro-access.ts`, `src/lib/ponto-sumula.ts`, e as rotas `src/app/api/sumula/[token]/route.ts`, `api/arbitro/partidas/[token]/iniciar`, `api/partidas/[id]/aprovar`, `api/partidas/[id]/ao-vivo`.
- **Fonte das regras**: os IDs `RG-*` e os artigos (FIVB 2025-2028 "[V]", Guia CBV/COBRAV fev/2025 "[G]") vêm do relatório 03. Este agente **não releu** os PDFs; onde o 03 marca **[M]**, esta auditoria repete "não verificado" e indica quem confirma (COBRAV/FMV, árbitro, Livro de Casos CBV).
- O e-Scoresheet é referência de comportamento (relatório 02), não de código.
- Regra "aprovada-pendente" (8 substituições, par repetível, terceiro set obrigatório, líbero informativo) **não** é tratada como implementada. O requisito diz "implementação pendente", mas o código já traz parte dela (8 substituições, vínculo de par); isso aparece como divergência documento x código.
- Nada foi executado (somente leitura). Os casos da seção 5 são **especificação**; nenhum foi rodado.

Legenda de caminhos (usada na tabela):
- **L** = `src/app/sumula/[token]/lancar/page.tsx`
- **R** = `src/app/api/sumula/[token]/route.ts`
- **C** = `src/lib/category-match-rules.ts`
- **S** = `src/lib/schemas.ts`

Classificações: **ERRO-OFICIAL** (erro de regra oficial: o código viola a regra FIVB/CBV sem que o requisito aprovado mande isso), **ESCOLHA-ORG** (escolha legítima do organizador, aprovada ou plausível em estadual/amador), **LACUNA** (lacuna do requisito: a regra existe e o requisito/código não trata).
Gravidade: **Crítica** (gera placar/saque errado ou impede fechar a súmula), **Alta**, **Média**, **Baixa**.

## 1. Constatações estruturais (valem para quase todas as linhas)

1. **O servidor só valida o placar dos sets.** `R:59-73` e `R:150-152` chamam `validateSumulaPayload` (jogador pertence às equipes, set duplicado, mínimo de 6 presentes) e `validateCategoryResult`/`validateCategoryProgress` (`C:19-67`). Rotação, saque, substituições, tempos, líbero e sanções **não existem no servidor**. Toda a regra de jogo vive no navegador do apontador (`L`). Qualquer cliente com o acesso à partida pode enviar o payload que quiser (`S:356-394` aceita `ocorrencias` como texto livre).
2. **Eventos são texto livre; o estado é reconstruído por regex.** `L:3351-3433` recompõe saque/rodízio de marcadores `[[ROT:...]]` dentro de `descricao`, conta substituições e tempos por `normalizeName(...).includes(nomeDaEquipe)` (`L:3389-3412`; quebra se o nome de uma equipe contém o da outra) e recria os pares lendo `sai #N ... entra #M` (`L:3414-3433`). Não há `seq`, equipe ou tipo estruturado (`prisma/schema.prisma:360-369`, `tipo` livre).
3. **Salvamento por substituição total.** O `PUT` apaga e reinsere `SetPartida`, `SumulaPresenca`, `OcorrenciaPartida` e `DestaquesPartida` a cada autosave (`R:156-171`), sem transação nem versão: dois aparelhos se sobrescrevem; uma falha entre o `delete` e o `insert` perde dados. O cliente nem confere `res.ok` (`L:917-921`).
4. **Nada é imutável.** O desfazer apaga eventos (`L:486`, `L:524`) e a formação inicial do set é sobrescrita (`L:709` descarta o evento anterior "Formação da quadra atualizada"). Não há papeleta inicial preservada nem trilha de correção (o e-Scoresheet grava edições como "notas técnicas" imutáveis, relatório 02 §5).
5. **Oficialização automática e irreversível.** Ao escolher o MVP com a partida encerrada, o envio final dispara sozinho (`L:968-987`); o servidor grava `ENCERRADA` e `sumulaAprovadaEm` na hora (`R:105-117`); depois disso o `PUT` recusa (`R:141`) e o `POST` repetido devolve "já oficial" (`R:48-50`). Não há assinatura/ratificação dos capitães (RG-FEC-002) nem a janela de correção de 30 min do requisito (cenário 7). A rota `aprovar` só atua em `PENDENTE_APROVACAO`.
6. **O requisito e o código divergem entre si em três pontos**: (a) o requisito diz "líbero inicial não é requisito para confirmar a escalação", mas `L:588-591` exige; (b) o requisito manda "interface e API seguem a mesma regra" para o terceiro set obrigatório, mas o cliente ignora `terceiroSetObrigatorio`/`setsFormato` (nenhuma ocorrência em `L`), enquanto o servidor os aplica (`C:22,36`, `R:300-310`); (c) o requisito diz "pendente", mas o código já fixa 8 substituições (`L:753`).

## 2. Tabela de auditoria (regras priorizadas do relatório 03, seção 6)

"Onde" = **S** significa: verificação obrigatória no servidor, pelo motor puro compartilhado (seção 3); o cliente usa o mesmo motor só para UX.

### 2.1 Sets, pontos e fechamento

| ID | Oficial | O que o código faz (arquivo:linha) | Divergência | Classif. | Grav. | Correção sugerida | Onde |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RG-SET-001 | Set vai ao alvo (25; 15 no decisivo) com 2 de vantagem. FIVB 6.2; Guia p.40. | Cliente fecha quando `max>=alvo` e `diff>=2` (`L:3556-3558`, prompt `L:455-463`). Servidor igual: recusa se `winner<target` ou `winner-loser<2` (`C:33`). Alvo padrão 21 e 3 sets se faltar config (`L:3562-3563`, `R:301-305`). | (a) Servidor aceita placares **inatingíveis**: 21x0, 25x5, 30x20 (acima do alvo só vale diferença exata de 2). (b) O último set em andamento não tem limite no `PUT` (`C:60-62` só exige que os anteriores estejam fechados): aceita 40x3 em andamento. (c) Default 21 não é o da regra (25/15); aceitável por config. | LACUNA (a,b); ESCOLHA-ORG (c) | Média | Em `fecharSet`: se `max==alvo` então `min<=alvo-2`; se `max>alvo` então `min==max-2`. Rejeitar no andamento qualquer placar que já devia ter encerrado. Parametrizar `alvoSet`/`alvoDecisivo` sem default silencioso. | S |
| RG-SET-002 | 24x24 e 25x24 continuam; 26x24 acaba. 6.2. | Os placares-teste do 03 passam no cliente e no servidor. Mas "Continuar jogando" (`L:2860`) cancela o prompt e **permite seguir pontuando** com o set já ganho; nada trava o set (o prompt só reabre no ponto seguinte, `L:455-463`). Ponto por cartão vermelho nem abre o prompt (`L:842-860`). | Sequência 25x23, "continuar", 26x23 é aceita no cliente e **passa no servidor** (`C:33`: 26x23 tem diferença 3). | ERRO-OFICIAL | Alta | Set encerrado vira estado terminal: o ponto seguinte é `SET_JA_ENCERRADO`. "Continuar jogando" vira "desfazer último ponto". | S |
| RG-SET-003 | Decisivo (5º set indoor) a 15 com 2 de vantagem e novo sorteio. 6.3.2, 7.1, 12.1.1; Guia p.60. | Alvo do último set só vale se `tieBreakUltimoSet` for verdadeiro (`L:3564-3567`; `C:31`); default `false`. Sem novo sorteio no último set: o saque inicial é escolha livre (`L:648-650`, `L:2360-2367`). | (a) Sem sorteio/lado no decisivo. (b) Default sem tie-break: set 3 a 21. (c) Em melhor de 3 com terceiro **obrigatório** e 2x0, o set 3 não é decisivo (sem novo sorteio nem troca aos 8; não verificado, depende do regulamento) mas o código usa `numero===maxSets` para os dois casos. | LACUNA (a,c); ESCOLHA-ORG (b) | Média | Evento `SORTEIO` obrigatório quando `set.decisivo`. `decisivo = (numero==maxSets) && sets empatados`. Perguntar ao organizador, sem default silencioso. | S |
| RG-SET-004 | Partida acaba ao vencer ceil(N/2) sets; não existe set extra (6.3.1). Terceiro obrigatório é formato do organizador (D2 do 03). | Cliente encerra ao atingir `setsToWin=floor(N/2)+1` (`L:564-576`, `L:3571`). **O cliente ignora `terceiroSetObrigatorio` e `setsFormato`.** Servidor, em modo fixo, exige `sets.length===maxSets` (`C:22,36`). `validateCategoryProgress` (usado no `PUT`) **não tem a exceção do modo fixo** (`C:56`). `C:23` aceita N par (2 e 4). | (a) Com terceiro obrigatório: o cliente encerra em 2x0 e o `POST` final é recusado ("A partida ainda não concluiu os sets exigidos", `C:36`): a súmula **não consegue ser oficializada**. (b) No modo fixo, o autosave do 3º set após 2x0 recebe 422 (`C:56`) e o cliente ignora a resposta (`L:917-921`): o set 3 nunca é salvo. (c) N par admite empate de sets. | LACUNA (requisito manda mesma regra em UI e API) | **Crítica** | Motor único `partidaEncerravel(config, sets)` para cliente e servidor; `terceiroSetObrigatorio` entra na UI. `validateCategoryProgress` aceita set após 2x0 no modo fixo. Restringir N a ímpar ou tratar par como escolha explícita do organizador. | S |
| RG-SET-006 | Troca de quadra ao fim dos sets 1-4; no decisivo, quando a líder chega a 8, sem mudar posições. 18.2.1, 18.2.2. | Só o botão manual `toggleSidesInverted` (`L:356-359`), que grava o texto "Equipes inverteram os lados". O fim do set não inverte (`L:556-577`). Não há gatilho aos 8 no decisivo. | A troca de lado não é derivada nem exigida; PDF e tela ao vivo não sabem o lado de cada equipe em cada set. | LACUNA | Média | Estado `ladoDeA` por set, invertido em `ENCERRAR_SET` (sets 1-4) e pendência `TROCA_LADO` quando a líder chega a 8 no decisivo; o evento grava o placar real. | S |
| RG-SET-007/008 | Horário de início/fim por set, duração e totais no quadro de resultados. Guia p.43,45,70-72. | Só `HH:MM` dentro do texto (`L:336`). O servidor não grava início/fim/duração; `Partida` recebe sets e pontos (`R:105-117`). | Sem horário, duração, somatório de tempos e substituições. | LACUNA | Baixa | `inicioEm/fimEm` nos eventos `INICIAR_SET`/`ENCERRAR_SET` (relógio do servidor); totais derivados no fechamento. | S |

### 2.2 Saque, rodízio, posição e correção

| ID | Oficial | O que o código faz (arquivo:linha) | Divergência | Classif. | Grav. | Correção sugerida | Onde |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RG-SAQ-001/002 | Quem ganha o rally sacando continua sem rodar; quem recebe e ganha marca, saca e roda no sentido horário (P2->P1, P1->P6, P6->P5, P5->P4, P4->P3, P3->P2). 7.6.2, 12.2.2, 6.1.3. | `logPoint` (`L:407-464`): `isSideOut = servingTeamId !== teamId` (`L:414`); só a equipe que ganha o saque roda (`L:437-451`) com `rotateVolleyballLineup` (`L:3511-3516`). **Conferi a permutação: está correta** para a ordem visual [P4,P3,P2,P5,P6,P1]. Sacador = índice 5, P1 (`L:141-142`, `L:466-475`). | Regra correta **no cliente**. Problemas: (a) o rodízio é efeito de `setState`, não evento verificável; o servidor nunca confere. (b) Não acontece quando o ponto vem de cartão (ver RG-SAN-002). (c) Após recarregar, `serverIndexA/B` voltam a 5 e o lineup vem do último `[[ROT]]` (`L:219-223`, `L:3355-3371`); um marcador defasado muda o rodízio sem aviso. | ERRO-OFICIAL (b); LACUNA (a,c) | Média | Rodízio derivado dos eventos no motor; reconstrução por replay, não por marcador de texto. | S |
| RG-POS-003 | Falta de posição: ponto e saque ao adversário, **sem** cancelar pontos. 7.5.1, 7.5.4. | Não existe evento. O apontador pode dar um ponto genérico ao adversário (`logPoint`, `L:420-424`), que roda se ele não sacava. | O efeito aritmético sai certo, mas a súmula não registra o motivo (PDF, estatística, contestação). Posições não são conferidas (RG-POS-001/002 não existem). | LACUNA | Baixa | Evento `FALTA_POSICAO{equipe}` = `PONTO` ao adversário com motivo. | S |
| RG-ROT-001..004 | Saque fora de ordem: ponto e saque ao adversário. Falta de rotação com **momento determinável**: cancelar todos os pontos da faltosa desde esse instante, manter os do adversário, +1 ao adversário (se o rally da falta já terminou, só 1 ponto). Sem momento: só ponto e saque. 7.7.1, 7.7.1.1, 7.7.2; Guia p.113-119 (nova súmula anexa). | **Não existe.** O único mecanismo é o desfazer: `undoLastPoint` (`L:477-490`) e `undoLastPointForTeam` (`L:492-533`), que **desfaz também pontos do adversário** ("também foi necessário desfazer N ponto(s) do outro time", `L:527-531`) e **apaga os eventos** (`L:486`, `L:524`). O histórico (`scoreHistory`, `L:163`) é só memória e some ao recarregar. | Usar o desfazer para "corrigir rotação" **destrói pontos legítimos do adversário** (o inverso da regra) e não deixa rastro. | LACUNA (requisito não trata); ERRO-OFICIAL se usado como sucedâneo | **Alta** | Eventos `DESCOBRIR_FALTA{tipo, equipe, desdeSeq|null}`. O motor recomputa por replay descartando **somente** os `PONTO` da equipe faltosa com `seq>=desdeSeq` e soma 1 ao adversário (log imutável, evento compensatório). "Momento exato" = primeiro saque da formação errada. Se o ponto de side-out que originou o saque conta ou não: **não verificado** (Livro de Casos CBV; COBRAV/FMV). | S |
| RG-FOR-005..009 | Papeleta com 6 jogadores da relação nominal; é a ordem de rotação do set; discrepância descoberta depois cancela pontos; jogador não registrado = perde pontos/sets. 7.3.1-7.3.5. | Confirma com 6 números distintos (`L:583`); **não confere se estão entre os validados** (`validatedA/B` só alimentam o mínimo de 6, `L:311`): lineup e banco saem do elenco inteiro (`L:3487-3503`). Edição livre até confirmar (`L:670-712`). Fallback: se ninguém foi validado, `presencas` marca **todos** presentes (`L:875-876`); a "liberação rápida" valida todos e põe o 1º como capitão (`L:361-378`). A formação inicial é sobrescrita (`L:700-710`). | Atleta não validado pode ser escalado; o servidor aceita presença "tudo true" como se fosse conferência. A papeleta original não é guardada, então RG-FOR-007/008/009 são inverificáveis. | LACUNA | Média | Evento `PAPELETA{set, equipe, posicoes[6], libero?}` imutável; só atletas com presença validada. Presença sem conferência não vale como mínimo de 6 (`R:338-341`). | S |
| RG-FOR-002/003 | Set decisivo: novo sorteio. Sets 2-4: saca primeiro quem **não** sacou primeiro no set anterior. 7.1, 12.1.2. | O saque inicial de cada set é escolha livre (`L:648-650`, `L:2360-2367`); o sorteio só existe no set 1 (`L:2552-2604`) e só decide sacar/receber, não o lado (7.1 permite escolher saque **ou** lado). | Nada impede dois sets seguidos com o mesmo sacador inicial. | LACUNA | Média | Proposta automática (alternância) com confirmação; exceção só com motivo registrado. | S |

### 2.3 Substituições e elenco

| ID | Oficial | O que o código faz (arquivo:linha) | Divergência | Classif. | Grav. | Correção sugerida | Onde |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RG-SUB-001 | 6 por set por equipe. 15.1; Guia p.47. | Constante `8` fixa: `usedSubstitutions >= 8` (`L:753-756`). Contagem em memória por set (`L:172`, `L:775-786`), reconstruída por texto (`L:3401-3412`). O servidor não confere. | 8 (aprovado no requisito, D1 do 03) contra 6 oficial; não é parâmetro; sem alerta na 7ª/8ª; sem checagem no servidor. | ESCOLHA-ORG (aprovada) | Alta se a competição for CBV/FIVB | `limiteSubstituicoes` por campeonato (padrão 6; 8 como perfil "amador") e alerta amarelo na 5ª/6ª (como o e-Scoresheet, relatório 02 §2). O servidor conta eventos por set. | S |
| RG-SUB-002 | Cada entrada e cada retorno contam 1. 15.2.2, 15.6. | Cada `executeSubstitution` soma 1 (`L:775-786`). | Conforme. Risco: a contagem se perde se o nome da equipe falhar no texto (`L:3401-3412`). | Conforme | Baixa | Contar eventos estruturados. | S |
| RG-SUB-003/004 | Titular sai **uma vez** e volta **uma vez**, só à posição anterior; reserva entra **uma vez** e só substitui o mesmo titular. 15.6.1, 15.6.2. | Mapa de vínculo `substitutionLocks` (`L:171`, `L:720-730`, `L:787-802`): A->B cria `A:B` e `B:A`; B->A é permitido; **A->B de novo também** (o vínculo permanece e o limite 8 é o único freio). | O segundo ciclo do mesmo par viola 15.6.1 (D3 do 03); é o que o requisito aprovou (linha 27). Após **recarregar**, o vínculo é reconstruído **só no sentido sai->entra** (`L:3430`; em memória grava os dois sentidos, `L:797-798`) e com os **números de camisa da partida** (`getMatchNumber`, `L:764-765`), não os do elenco usados em `lineup/bench`: o vínculo falha em silêncio. O cenário de aceite 5 do requisito ("vínculo preservado após reload") **não é atendido**. | ESCOLHA-ORG (repetição); ERRO-OFICIAL (vínculo perdido no reload) | Alta | Perfil FIVB: `permitirRepeticaoPar=false` (titular sai 1x/volta 1x; reserva entra 1x). Perfil amador: permitir e alertar. Vínculo derivado dos eventos estruturados por replay. | S |
| RG-SUB-006/007 | Pedido só com bola fora e antes do apito; no máximo um pedido de substituição por interrupção (vários jogadores no mesmo pedido), exceto forçada. 15.2.2, 15.2.3, 15.3.1. | Sem noção de rally/interrupção. Qualquer número de substituições seguidas é aceito. | Dois pedidos sem ponto entre eles passam. | LACUNA | Média | `rallySeq` aumenta a cada `PONTO`; um pedido regular por equipe por `rallySeq` (batch contado por jogador). O estado de "bola dentro/fora" é inferível pelos eventos, sem relógio. | S |
| RG-SUB-009 | Substituição ilegal descoberta após o reinício: ponto e saque ao adversário, retificar, cancelar pontos da faltosa desde a falta, nova súmula. 15.9; Guia p.51. | Não existe. A 9ª é bloqueada; a 7ª e a 8ª passam sem alerta. | Sem como lançar a descoberta tardia (CJ-07 do 03). | LACUNA | Média | `DESCOBRIR_FALTA{tipo:'SUBSTITUICAO_ILEGAL'}`. Antes do reinício vira atraso. | S |
| RG-SUB-010/011 | Excepcional por lesão/expulsão/DQ: qualquer jogador fora de quadra, exceto líbero(s) e o regular que o líbero substitui; não é regular mas entra no total; o lesionado não volta; sem rally entre pedidos. 15.7, 15.2.3; Guia p.49-50. | Não existe. Com a cota esgotada o pedido é bloqueado (`L:753-756`) sem alternativa. "Lesão" é só tipo de anotação livre (`L:115`). | O apontador fica **travado** diante de um jogador lesionado (sem saída legítima na tela). | LACUNA (D4 do 03) | Alta | `SUBSTITUICAO_EXCEPCIONAL{sai, entra, motivo}`: valida elegibilidade, não consome a cota regular, soma ao total e marca `impedidosDeVoltar`. | S |
| RG-SUB-012 | Expulso/desqualificado em quadra é substituído de imediato (legal, senão excepcional, senão equipe **incompleta**). 15.8. | O cartão vermelho só dá ponto e anota (`L:826-863`). O atleta segue na quadra e pode ser pontuado e substituído de volta. | Nenhuma consequência de elegibilidade. | LACUNA (D13 do 03) | Alta | Pendência `SUBSTITUIR_EXPULSO` que bloqueia `PONTO` até resolver; membro fora do set/da partida. | S |
| RG-ELE-001/004/005 | Elenco 12/14, número único, capitão em jogo. 4.1.1, 4.3.3, 5.1.2. | Mínimo de 6 validados no servidor (`R:338-341`, **dispensado em campeonato de simulação**, `R:59`). O máximo do elenco (`elencoQuantidadeMaxima`, existe na parametrização) não é conferido. Número ausente vira `index+1` (`L:3463`) e pode colidir. Duplicidade checada só no cliente (`L:296-302`). Capitão escolhido no pré-jogo (`L:149`, `L:393-396`) e **não** é redesignado ao sair de quadra (`executeSubstitution` não consulta `captA/B`). | Capitão pode ficar no banco sem ninguém designado; número automático pode duplicar. | LACUNA | Média | Evento `CAPITAO_EM_JOGO`; pendência quando o capitão sai. Máximo do elenco no motor. | S |

### 2.4 Líbero

| ID | Oficial | O que o código faz (arquivo:linha) | Divergência | Classif. | Grav. | Correção sugerida | Onde |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RG-LIB-001 | Até 2 líberos; não obrigatório na regra geral; 2 obrigatórios em FIVB com mais de 12 jogadores. 19.1. | `confirmLineup` **exige** líbero inicial (`L:588-591`; botão desabilitado em `L:2369`), contra o requisito (linha 29). `getLiberoOptions` sem jogador `LB` oferece qualquer atleta do elenco (`L:3505-3509`) e o escolhido **sai do banco** (`L:3499`) e deixa de poder jogar. | Equipe sem líbero não inicia o set; quem usa um atleta comum como "líbero" o tira do jogo. | LACUNA (requisito diz não obrigatório) | Alta | Líbero opcional; segundo líbero (L2) previsto; remover o fallback. | S |
| RG-LIB-003/004/005/008/009 | Líbero só entra por jogador de fundo, não saca/bloqueia/ataca acima da rede; troca ilimitada, mas exige rally concluído entre trocas; troca ilegal = atraso (antes do próximo rally) ou substituição ilegal. 19.3.1, 19.3.2. | **O líbero nunca entra na quadra**: `getBenchNumbers` exclui todo `isLibero` e o líbero escolhido (`L:3495-3503`) e `executeSubstitution` só aceita quem está em `bench` (`L:744-747`). O ramo `isLiberoExchange` (`L:742`, `L:769-771`) fica **inalcançável**. `troca_libero` existe só no esquema (`S:380`). Se fosse alcançável, o par travaria o líbero (`L:787` não o exclui), contrariando "não cria par" do requisito. | Troca de líbero **não está implementada**, embora o requisito peça registro informativo. Fundo, saque e rally entre trocas: nenhuma validação. | LACUNA | Alta | Eventos `LIBERO_ENTRA`/`LIBERO_SAI`; validar fundo (P1,P5,P6), rally entre trocas, retorno só ao regular substituído ou ao L2, e que o líbero não seja o próximo sacador. Informativo: não conta substituição e não cria par. | S |
| RG-LIB-010/011/012 | Redesignação do líbero lesionado/expulso (com 1 líbero): qualquer jogador fora de quadra exceto o regular substituído; o antigo não joga mais; com 2 líberos não há redesignação. 19.4, 19.5. | Não existe. | Sem fluxo; o e-Scoresheet tem (relatório 02 §2). | LACUNA | Média | Evento `REDESIGNAR_LIBERO{novo}`. | S |

### 2.5 Tempos, atrasos e sanções

| ID | Oficial | O que o código faz (arquivo:linha) | Divergência | Classif. | Grav. | Correção sugerida | Onde |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RG-TMP-001/002 | 2 tempos de 30 s por set; só com bola fora e antes do apito. 15.1, 15.4.1. | Limite 2 (`L:811`), zera a cada set (`L:567-568`), texto "**Tempo técnico** solicitado" (`L:815`). Sem contagem de 30 s. Cota restaurada por nome da equipe no texto (`L:3389-3399`). Sem desfazer de tempo lançado por engano. | Nome errado: o evento é **tempo de descanso**; "tempo técnico" é outro conceito (RG-TMP-009: não existe nas regras indoor 2025-2028, depende do regulamento) e vai confundir contagens futuras. Duração e estado da bola não validados. | ERRO-OFICIAL (nomenclatura) | Baixa | Renomear para `TEMPO_DESCANSO`; duração parametrizável; tempo técnico como outro tipo opcional, **desligado por padrão**. | S |
| RG-TMP-007/008 | Atraso: 1ª vez advertência (R, coluna A); 2ª em diante penalidade (ponto e saque); vale para a partida inteira. 16.2. | Só um tipo de anotação "Atraso" (`L:115`) sem efeito nem contador. | Sem advertência x penalidade nem ponto automático. | LACUNA | Média | Evento `ATRASO{equipe}`; contador por partida; o 2º atraso gera `PONTO` ao adversário. | S |
| RG-SAN-001 | Conduta menor: advertência verbal, depois cartão amarelo sem consequência, registrado. 21.1. | O amarelo vira anotação com equipe/pessoa (`L:2741-2797`, `L:818-841`). | Conforme, mas sem contador progressivo por membro. | LACUNA (parcial) | Baixa | Contador por membro. | S |
| RG-SAN-002 | Conduta **grosseira, 1ª vez do membro**: penalidade = ponto **e saque** ao adversário. 21.3.1. | Qualquer "Cartão vermelho" dá +1 ao adversário (`L:826-860`); **não passa o saque nem roda a formação** (a entrada de `scoreHistory` mantém `servingTeamId`, `L:851-859`); **não abre o prompt de fim de set** se o ponto fecha o set. Com "Ambas as equipes" ignora com aviso (`L:861-862`). | (a) O saque não passa ao adversário e o rodízio não acontece quando o punido sacava; (b) o ponto vale **também em 2ª grosseira, ofensiva e agressão**, onde a regra é expulsão/desqualificação **sem ponto**; (c) desfazer o ponto não remove a anotação (`anotacoes` permanece, `L:840`, `L:891-899`). | ERRO-OFICIAL | **Crítica** (placar e saque errados) | `SANCAO` por categoria e histórico do membro (RG-SAN-003..006); penalidade = `PONTO` ao adversário **com saque e rodízio**. | S |
| RG-SAN-003..008 | 2ª grosseira = expulsão; 3ª = desqualificação; ofensiva 1ª = expulsão, 2ª = DQ; agressão = DQ direta; expulso fora do **set**, DQ fora da **partida**. 21.3.2, 21.3.3, 21.4, 5.3.2. | Sem estado de expulsão/DQ; um único tipo "vermelho"; sem contador por membro. | Nenhum membro é bloqueado; sem progressão. | LACUNA (D13 do 03) | Alta | `estado.sancoes[membro]`, `foraNoSet`, `foraNaPartida`; erros `MEMBRO_EXPULSO_NO_SET`, `MEMBRO_DESQUALIFICADO`. Combinação de categorias diferentes no mesmo membro: **não verificado** (Casebook/Livro de Casos). | S |
| RG-SAN-012 | Equipe sem jogador apto: **incompleta**; mantém pontos e sets; o adversário recebe o necessário para vencer o set/jogo. 6.4.3, 15.8; Guia p.96-102. | Não existe. | Sem fluxo. | LACUNA | Média | Evento `INCOMPLETA{equipe, escopo}` (teste 10). | S |
| (registro) | Cada cartão registrado uma vez. | `buildSumulaPayload` monta `ocorrencias` de `events` **e** de `anotacoes` (`L:891-899`); `normalizeOccurrenceType` classifica por **texto** (`L:3064`): o evento da anotação, a cópia de `anotacoes` e o evento "Ponto automático ... por cartão vermelho" viram `CARTAO_VERMELHO`. | Um cartão vermelho grava até **3** ocorrências `CARTAO_VERMELHO`; qualquer contador de sanções no servidor contaria 3. | ERRO-OFICIAL (integridade do registro) | Alta | Tipo estruturado no evento, não regex no texto; `SANCAO` e `PONTO` separados e ligados por `causaSeq`. | S |

### 2.6 WO, interrupção e fechamento

| ID | Oficial | O que o código faz (arquivo:linha) | Divergência | Classif. | Grav. | Correção sugerida | Onde |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RG-WO-001/002 | Equipe ausente/que se recusa: partida 3x0 com 25x0 por set; a tolerância vem do regulamento. 6.4.1, 6.4.2; Guia p.82-95. | Não há fluxo de WO na súmula. `W.O.` é só tipo de anotação (`L:115`); `WO` consta no esquema e em listas de status (`iniciar/route.ts:9`, `organizador/partidas/route.ts:25`), mas nada na súmula o produz. O `POST` exige ao menos 1 set, MVP da vencedora e **6 presentes por equipe** (`R:61-70`, `R:338-341`): um WO **não pode ser oficializado** por este caminho. | WO/ausência só por edição de status fora da súmula (placar 25x0 e classificação do WO **não verificados** neste relatório). WO duplo (D9) sem tratamento. | LACUNA | Alta | Evento `WO{ausentes, motivo}`; resultado derivado do regulamento, dispensando MVP e presenças. | S |
| RG-WO-005 | Incompleta no set: perde o set, mantém pontos; o adversário recebe os necessários; sem 6 aptos no set seguinte, incompleta no jogo. 6.4.3. | Não existe (ver RG-SAN-012). | idem | LACUNA | Média | idem | S |
| RG-INT-003..005 | Interrupção até 4 h na mesma quadra: continua; em outra quadra: set anulado e rejogado; mais de 4 h: partida repetida. 17.3. | Não existe. `SetPartida` é apagado e reescrito (`R:156-160`); não há "set anulado". | Sem modelo. | LACUNA (D12 do 03) | Baixa | `INTERROMPER`/`RETOMAR{mesmaQuadra}`; `ANULA` de set preservando o log. | S |
| RG-FEC-002 | Fechamento: apontador, depois capitães (ratificam o resultado), depois árbitros. 27.2.3.3, 5.1.3.1. | Auto-envio ao escolher o MVP (`L:968-987`); o servidor oficializa (`R:105-117`). Sem assinatura de ninguém; sem protesto estruturado (só anotação). | Resultado público e irreversível sem ratificação; a janela de 30 min do requisito não existe no código. | LACUNA | Alta | Estado `AGUARDANDO_ASSINATURAS` com `ASSINAR{papel}`; oficializar após as assinaturas (digital: aceite do capitão e do árbitro). Janela de correção via link: requisito, cenário 7. | S |
| RG-FEC-004 | Resultado coerente: vencedora, sets, pontos, horários, totais. 27.2.3.1. | O servidor deriva `setsPorA/B`, pontos e vencedor (`R:76-89`, `R:102-117`) e confere o MVP da vencedora (`R:63-70`). Faltam tempos, substituições e horários (RG-SET-007/008). A rota `aprovar` (organizador) recalcula **sem** `validateCategoryResult`. | OK no essencial; a aprovação pelo organizador não passa pela validação de placar. | LACUNA | Média | A aprovação passa pelo mesmo motor. | S |

## 3. Especificação do motor de regras proposto (pseudo-TypeScript)

Princípios: (1) **função pura** `aplicar(estado, evento, autor) -> Resultado`, sem I/O, em `src/lib/regras-sumula/` (onde hoje mora `category-match-rules.ts`), importada pelo cliente (UX otimista) e pelo servidor (autoridade); (2) **log de eventos append-only** com `seq`; o estado é sempre `replay(eventos)`; correção = evento compensatório, nunca apagar; (3) o servidor **revalida o log inteiro** no fechamento e compara com `SetPartida`/`Partida` derivados; (4) perfis de regra (`FIVB`, `CBV`, `AMADOR`) trocam limites sem trocar código; (5) toda regra devolve **código de erro estável** com o ID `RG-*`.

```ts
// ---------- entradas: configuração do campeonato/categoria ----------
type Equipe = 'A' | 'B';
type PerfilRegras = 'FIVB' | 'CBV' | 'AMADOR';

interface ConfigRegras {
  perfil: PerfilRegras;
  melhorDe: 1 | 3 | 5;                  // N ímpar (RG-SET-004)
  alvoSet: number;                      // Np, ex.: 25
  alvoDecisivo: number;                 // Nt, ex.: 15
  terceiroSetObrigatorio: boolean;      // formato do organizador (D2)
  limiteSubstituicoes: number;          // 6 padrão; 8 no perfil AMADOR (D1)
  permitirRepeticaoPar: boolean;        // false em FIVB/CBV (D3)
  temposPorSet: number;                 // 2
  duracaoTempoSeg: number;              // 30
  tempoTecnico?: { gatilho: 'SOMA' | 'PONTOS_EQUIPE'; pontos: number[] } | null; // desligado (RG-TMP-009)
  liberoObrigatorio: boolean;           // false (requisito)
  maxLiberos: 0 | 1 | 2;
  elenco: { min: number; max: number }; // 6..12 (14 em FIVB)
  toleranciaWOMin: number;              // regulamento (15/30)
  placarWO: { sets: [number, number]; pontosPorSet: [number, number] }; // FIVB 3x0 e 25x0; demais: não verificado
  exigirAssinaturas: boolean;
  severidade: Partial<Record<CodigoRegra, 'BLOQUEIA' | 'ALERTA'>>;       // por perfil
}

// ---------- estado (derivado do log; nunca persistido isoladamente) ----------
interface Posicoes { P1: number; P2: number; P3: number; P4: number; P5: number; P6: number } // número do atleta
interface EstadoEquipe {
  elenco: Map<number, { nome: string; presente: boolean; libero?: 'L1' | 'L2' }>;
  capitao: number; capitaoEmJogo: number | null;
  emQuadra: Posicoes;                   // rotação viva
  papeleta: Posicoes | null;            // IMUTÁVEL (RG-FOR-005)
  subs: {
    regulares: number;                  // conta entrada e retorno (RG-SUB-002)
    excepcionais: number;               // entram no total (RG-SUB-010)
    pares: Map<number, { reserva: number; saiu: boolean; voltou: boolean }>; // chave = titular
    reservasQueEntraram: Set<number>;
    impedidosDeVoltar: Set<number>;     // substituídos excepcionalmente (RG-SUB-011)
    ultimoPedidoRally: number | null;   // RG-SUB-007
  };
  libero: { ativo: number | null; substitui: number | null; ultimaTrocaRally: number | null;
            redesignado: boolean; foraDeJogo: Set<number> };
  tempos: number; atrasos: number;      // atrasos valem para a partida (RG-TMP-008)
  sancoes: Map<string, { amarelo: number; grosseira: number; ofensiva: number;
                         expulsoNoSet: boolean; desqualificado: boolean }>;
  incompleta: 'NAO' | 'SET' | 'JOGO';
}
interface EstadoSet {
  numero: number; decisivo: boolean; inicio?: string; fim?: string;
  placar: Record<Equipe, number>;
  sacadora: Equipe; ladoDeA: 'ESQ' | 'DIR';
  primeiroSaque: Equipe;                // RG-FOR-003
  trocaLadoPendente: boolean;           // decisivo a 8 (RG-SET-006)
  rallySeq: number;                     // +1 a cada PONTO; base de "rally concluído" (SUB-007, LIB-005)
  encerrado: boolean; vencedora?: Equipe;
}
interface EstadoJogo {
  config: ConfigRegras;
  status: 'PRE' | 'SET' | 'INTERVALO' | 'FIM' | 'WO' | 'AGUARDANDO_ASSINATURAS' | 'OFICIAL';
  equipes: Record<Equipe, EstadoEquipe>; sets: EstadoSet[]; atual: EstadoSet | null;
  setsGanhos: Record<Equipe, number>;
  pendencias: Pendencia[];              // bloqueiam PONTO até resolvidas
  log: EventoRegistrado[];
}
type Pendencia = { bloqueia: boolean } & (   // bloqueia=true impede PONTO; false só emite ALERTA
  | { tipo: 'SUBSTITUIR_EXPULSO'; equipe: Equipe; membro: number }   // RG-SUB-012 (bloqueia)
  | { tipo: 'TROCA_LADO' }                                           // RG-SET-006 (não bloqueia: se esquecida, troca-se ao notar, com o placar da hora)
  | { tipo: 'CAPITAO_EM_JOGO'; equipe: Equipe }                      // RG-ELE-005
  | { tipo: 'SORTEIO_DECISIVO' });                                   // RG-FOR-002

// ---------- eventos (entrada do motor) ----------
type Evento =
  | { t: 'SORTEIO'; vencedor: Equipe; escolhe: 'SAQUE' | 'RECEPCAO' | 'LADO' }
  | { t: 'PAPELETA'; equipe: Equipe; posicoes: Posicoes; l1?: number; l2?: number }
  | { t: 'INICIAR_SET'; numero: number; primeiroSaque: Equipe }
  | { t: 'PONTO'; para: Equipe; origem?: 'ace' | 'attack' | 'block' | 'erro'; jogador?: number; sacadorReal?: number }
  | { t: 'SUBSTITUICAO'; equipe: Equipe; trocas: Array<{ sai: number; entra: number }> }   // 1 pedido, N jogadores
  | { t: 'SUBSTITUICAO_EXCEPCIONAL'; equipe: Equipe; sai: number; entra: number;
      motivo: 'LESAO' | 'EXPULSAO' | 'DESQUALIFICACAO'; autorizadoPor: string }
  | { t: 'LIBERO_ENTRA'; equipe: Equipe; libero: number; sai: number }
  | { t: 'LIBERO_SAI'; equipe: Equipe; libero: number; entra: number }
  | { t: 'REDESIGNAR_LIBERO'; equipe: Equipe; novo: number }
  | { t: 'TEMPO'; equipe: Equipe }
  | { t: 'ATRASO'; equipe: Equipe; membro?: string }
  | { t: 'SANCAO'; equipe: Equipe; membro: string; nivel: 'MENOR' | 'GROSSEIRA' | 'OFENSIVA' | 'AGRESSAO' }
  | { t: 'LESAO'; equipe: Equipe; jogador: number }
  | { t: 'TROCA_LADO' }
  | { t: 'FALTA_POSICAO'; equipe: Equipe }                                  // ponto e saque ao adversário
  | { t: 'DESCOBRIR_FALTA';
      tipo: 'ROTACAO' | 'SAQUE_FORA_ORDEM' | 'SUBSTITUICAO_ILEGAL' | 'JOGADOR_NAO_REGISTRADO' | 'POSICAO_NA_PAPELETA';
      equipe: Equipe; desdeSeq: number | null }                              // null = momento indeterminado (RG-ROT-003)
  | { t: 'ENCERRAR_SET' }                                                     // confirma; o motor sinaliza `setEncerravel`
  | { t: 'INCOMPLETA'; equipe: Equipe; escopo: 'SET' | 'JOGO' }
  | { t: 'WO'; ausentes: Equipe[]; motivo: 'NAO_COMPARECEU' | 'RECUSOU' }
  | { t: 'INTERROMPER'; motivo: string } | { t: 'RETOMAR'; mesmaQuadra: boolean; minutos: number }
  | { t: 'PROTESTO'; equipe: Equipe; texto: string }
  | { t: 'ASSINAR'; papel: 'APONTADOR' | 'CAPITAO_A' | 'CAPITAO_B' | 'ARBITRO1' | 'ARBITRO2' }
  | { t: 'ANULA'; seqAlvo: number; motivo: string };                          // correção compensatória; nada é apagado

interface EventoRegistrado { seq: number; evento: Evento; autor: string; em: string /*relógio do servidor*/; idemId: string }

// ---------- saída ----------
type CodigoRegra =
  | 'SET_JA_ENCERRADO' | 'SET_PLACAR_INATINGIVEL' | 'SET_DECISIVO_SEM_SORTEIO' | 'PARTIDA_JA_ENCERRADA'
  | 'SAQUE_FORA_DE_ORDEM' | 'PENDENCIA_ABERTA'
  | 'SUB_LIMITE' | 'SUB_TITULAR_JA_SAIU_E_VOLTOU' | 'SUB_RESERVA_JA_ENTROU' | 'SUB_PAR_DIVERGENTE'
  | 'SUB_SEM_RALLY_ENTRE_PEDIDOS' | 'SUB_MEMBRO_IMPEDIDO' | 'SUB_EXC_INELEGIVEL' | 'SUB_EXC_NAO_RETORNA'
  | 'LIB_SO_FUNDO' | 'LIB_TROCA_SEM_RALLY' | 'LIB_NAO_SACA' | 'LIB_REDESIGNACAO_INELEGIVEL' | 'LIB_COM_DOIS_LIBEROS'
  | 'TEMPO_LIMITE' | 'MEMBRO_EXPULSO_NO_SET' | 'MEMBRO_DESQUALIFICADO' | 'ELENCO_FORA_DO_LIMITE'
  | 'ATLETA_NAO_VALIDADO' | 'EQUIPE_INCOMPLETA' | 'WO_SEM_TOLERANCIA' | 'ASSINATURA_FORA_DE_ORDEM';

interface Erro { codigo: CodigoRegra; regra: string /*ex.: 'RG-SUB-001'*/; mensagem: string; severidade: 'BLOQUEIA' | 'ALERTA' }
interface Resultado {
  ok: boolean;                          // false se existir erro BLOQUEIA
  estado: EstadoJogo;                   // inalterado se !ok
  erros: Erro[];                        // ALERTA permite seguir (perfil amador)
  derivados: {
    setEncerravel?: { vencedora: Equipe; placar: [number, number] };
    partidaEncerravel?: { vencedora: Equipe; sets: [number, number] };
    cancelados?: number[];              // seqs de PONTO cancelados por DESCOBRIR_FALTA
    pontoAutomatico?: { para: Equipe; motivoSeq: number }; // penalidade, atraso, falta de posição
  };
}

declare function aplicar(estado: EstadoJogo, evento: Evento, autor: string): Resultado;
declare function replay(config: ConfigRegras, log: EventoRegistrado[]): Resultado;   // a mesma no servidor
declare function validarFechamento(estado: EstadoJogo): Erro[];                      // 6 aptos, MVP, assinaturas, totais
declare function validarPlacarFinalDeSet(cfg: ConfigRegras, tipo: 'regular' | 'decisivo', a: number, b: number): Erro | null; // RG-SET-001, usado também pelo POST oficial
declare function seqDoUltimo(estado: EstadoJogo): number;                              // utilitário de teste
```

**Onde roda e como persiste (servidor)**
- Rota nova `POST /api/sumula/[token]/eventos` (append): autentica como hoje (`requireArbitroPartidaAccess`), carrega o log, chama `aplicar`, responde 422 com `erros[]` (código + regra) ou grava o evento com `seq` por concorrência otimista (`INSERT` com `seq = último+1`; dois aparelhos não se sobrescrevem). `idemId` evita duplicar em reenvio.
- Tabela `EventoSumula(partidaId, seq, tipo, payload jsonb, autor, criadoEm, anulaSeq)`. `SetPartida` e `Partida` passam a ser **derivados** (recalculados no servidor), nunca enviados pelo cliente. `OcorrenciaPartida` vira visão de leitura para o PDF e a tela pública.
- O `POST` oficial faz `replay` completo + `validarFechamento`; o cliente não envia placar.
- O cliente usa o mesmo módulo para UX imediata (botão desabilitado, mensagem), nunca como autoridade. `ALERTA` deixa seguir (perfil amador); `BLOQUEIA` não.
- `desdeSeq`: o apontador escolhe na linha do tempo o evento de origem; o `replay` descarta apenas os `PONTO` da equipe faltosa com `seq >= desdeSeq`, mantém os do adversário e injeta o ponto/saque do adversário (RG-ROT-002).
- Regras marcadas "não verificado" (seção 6) entram como parâmetro de perfil, não como constante.

## 4. Resumo das divergências por tipo e ordem de correção

| Prioridade | Itens | Por quê |
| --- | --- | --- |
| 1. Bloqueiam o fechamento ou falseiam placar/saque (Crítica) | RG-SET-004 (terceiro set obrigatório: UI encerra em 2x0, API recusa; autosave do 3º set cai em 422 mudo); RG-SAN-002 (cartão: ponto sem saque/rodízio, ponto indevido em 2ª grosseira/ofensiva/agressão) | A súmula não oficializa, ou oficializa errada. |
| 2. Rastro e correção (Alta) | RG-ROT-001..004 e RG-SUB-009 (sem cancelamento de pontos; o desfazer apaga pontos do adversário); RG-FEC-002 (oficialização automática sem assinaturas, sem janela de correção); registro de cartão triplicado; RG-SET-002 ("continuar jogando" após o set ganho) | Sem log imutável não há como provar nem corrigir. |
| 3. Elegibilidade (Alta) | RG-SUB-010/011/012 (excepcional, expulso em quadra); RG-LIB-001/003..005 (líbero não entra na quadra; exigência de líbero contra o requisito); RG-SAN-003..008; RG-WO-001/002 | O apontador fica sem caminho legítimo ou grava o que a regra não permite. |
| 4. Parâmetros (Alta/Média) | RG-SUB-001 (8 fixo), RG-SUB-003 (par repetível; vínculo perdido no reload), RG-SET-003 (decisivo), RG-FOR-002/003 | Escolhas do organizador viram constantes; devem virar `ConfigRegras`/perfil. |
| 5. Registro (Baixa) | RG-SET-007/008, RG-TMP nomenclatura, RG-POS-003, RG-SAN-001 | Completude do PDF e das estatísticas. |

Mapa de classificação (resumo): **ERRO-OFICIAL**: SET-002, SAN-002, "registro triplicado", vínculo perdido no reload (SUB-003), nomenclatura do tempo; **ESCOLHA-ORG** (aprovada ou plausível): 8 substituições, par repetível, alvo/tie-break por config; **LACUNA do requisito**: terceiro set UI x API, excepcional, líbero (troca/redesignação/obrigatoriedade), sanções progressivas, WO, incompleta, interrupção, assinaturas, cancelamento de pontos, tempo técnico.

## 5. Os 10 casos de jogo difíceis como testes executáveis

Formato do repositório: `scripts/*.test.ts` com `node:assert/strict`, rodado por `ts-node` (como `scripts/category-match-rules.test.ts`). Os testes abaixo são para o motor da seção 3 (arquivo sugerido: `scripts/regras-sumula.test.ts`). Nenhum foi executado: o motor ainda não existe. Para cada caso, "Dado/Quando/Então" vem como comentário; os valores são concretos.

```ts
import assert from 'node:assert/strict'
import { aplicar, perfil, jogoEm, ponto, rally, seqDoUltimo, validarPlacarFinalDeSet, validarFechamento } from '../src/lib/regras-sumula'
// jogoEm(snapshot) monta um EstadoJogo válido sem repetir os eventos; perfil('FIVB'|'CBV'|'AMADOR') devolve a ConfigRegras.
// ponto(eq, extra?) = { t:'PONTO', para: eq, ...extra };  rally(e, eq) = aplicar(e, ponto(eq)).estado  (rally concluído entre pedidos)
const caso = (nome: string, fn: () => void) => { fn(); console.log('ok -', nome) }
const erros = (r: { erros: { codigo: string }[] }) => r.erros.map((x) => x.codigo)

// Elenco padrão dos casos: quadra P1..P6 = 1..6, banco 7..13, líbero L1 = 14, L2 = 15 (quando indicado).
```

### T01 - Fim de set e vantagem de 2 (RG-SET-001/002; CJ-09)
```ts
caso('T01 fim de set com vantagem de 2', () => {
  const cfg = { ...perfil('FIVB'), melhorDe: 5 as const, alvoSet: 25 }
  // Dado alvo 25 e placar 24x23 / 24x24 / 25x24 / 29x29
  // Quando A pontua
  // Então encerra em 25x23; NÃO encerra em 25x24; encerra em 26x24; NÃO em 30x29; encerra em 31x29
  const f = (a: number, b: number) => aplicar(jogoEm({ cfg, set: 1, placar: [a, b], sacadora: 'A' }), ponto('A'))
  assert.deepEqual(f(24, 23).derivados.setEncerravel, { vencedora: 'A', placar: [25, 23] })
  assert.equal(f(24, 24).derivados.setEncerravel, undefined)           // 25x24
  assert.deepEqual(f(25, 24).derivados.setEncerravel, { vencedora: 'A', placar: [26, 24] })
  assert.equal(f(29, 29).derivados.setEncerravel, undefined)           // 30x29
  assert.deepEqual(f(30, 29).derivados.setEncerravel, { vencedora: 'A', placar: [31, 29] })
  // Dado o set já encerrável e confirmado, Quando entra outro ponto, Então erro (hoje "Continuar jogando" permite 26x23)
  let e = jogoEm({ cfg, set: 1, placar: [25, 23], sacadora: 'A' })
  e = aplicar(e, { t: 'ENCERRAR_SET' }).estado
  assert.ok(erros(aplicar(e, ponto('A'))).includes('SET_JA_ENCERRADO'))
  // Placares finais inatingíveis são recusados pelo servidor (hoje 30x20 e 21x0 passam em C:33)
  assert.equal(validarPlacarFinalDeSet(cfg, 'regular', 26, 24), null)
  assert.equal(validarPlacarFinalDeSet(cfg, 'regular', 25, 23), null)
  assert.equal(validarPlacarFinalDeSet(cfg, 'regular', 30, 28), null)
  for (const [a, b] of [[30, 20], [25, 5], [25, 24], [26, 23], [24, 22]]) {
    assert.equal(validarPlacarFinalDeSet(cfg, 'regular', a, b)?.codigo, 'SET_PLACAR_INATINGIVEL')
  }
})
```

### T02 - Rodízio no side-out e saque contínuo (RG-SAQ-001/002)
```ts
caso('T02 rodizio so de quem ganha o saque', () => {
  // Dado A sacando; A: P1=1,P2=2,P3=3,P4=4,P5=5,P6=6; B: P1=7,P2=8,P3=9,P4=10,P5=11,P6=12
  let e = jogoEm({ set: 1, placar: [0, 0], sacadora: 'A',
    A: { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, P6: 6 }, B: { P1: 7, P2: 8, P3: 9, P4: 10, P5: 11, P6: 12 } })
  // Quando A ganha o rally sacando, Então 1x0, sacador continua o 1, ninguém roda
  e = aplicar(e, ponto('A')).estado
  assert.deepEqual([e.atual!.placar.A, e.atual!.placar.B, e.atual!.sacadora], [1, 0, 'A'])
  assert.equal(e.equipes.A.emQuadra.P1, 1)
  // Quando B ganha o rally recebendo, Então 1x1, B saca e roda: P2->P1 (8), P1->P6 (7), P6->P5 (12), P5->P4 (11), P4->P3 (10), P3->P2 (9)
  e = aplicar(e, ponto('B')).estado
  assert.equal(e.atual!.sacadora, 'B')
  assert.deepEqual(e.equipes.B.emQuadra, { P1: 8, P2: 9, P3: 10, P4: 11, P5: 12, P6: 7 })
  assert.deepEqual(e.equipes.A.emQuadra, { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, P6: 6 }) // A não roda
  // Quando B ganha de novo sacando, Então não roda: continua o 8
  e = aplicar(e, ponto('B')).estado
  assert.equal(e.equipes.B.emQuadra.P1, 8)
  // Quando A recupera o saque, Então A roda: P1=2,P2=3,P3=4,P4=5,P5=6,P6=1
  e = aplicar(e, ponto('A')).estado
  assert.deepEqual(e.equipes.A.emQuadra, { P1: 2, P2: 3, P3: 4, P4: 5, P5: 6, P6: 1 })
  // Ace só vale se creditado ao sacador em P1 (hoje o cliente usa lineup[5]; o servidor nunca confere)
  assert.ok(erros(aplicar(e, ponto('A', { origem: 'ace', jogador: 5 }))).includes('SAQUE_FORA_DE_ORDEM'))
  assert.equal(aplicar(e, ponto('A', { origem: 'ace', jogador: 2 })).ok, true)
})
```

### T03 - Limite de substituições, par e uma por interrupção (RG-SUB-001/002/003/004/007; D1, D3)
```ts
caso('T03 FIVB: 6 por set, titular sai e volta uma vez, reserva entra uma vez', () => {
  let e = jogoEm({ cfg: perfil('FIVB'), set: 2, placar: [3, 3], sacadora: 'B' })   // quadra 1..6, banco 7..13
  const sub = (sai: number, entra: number) => aplicar(e, { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai, entra }] })
  const faz = (sai: number, entra: number) => { const r = sub(sai, entra); assert.equal(r.ok, true); e = rally(r.estado, 'B') }
  // Quando dois pedidos seguidos sem rally entre eles, Então o segundo é indevido (RG-SUB-007)
  let r = sub(5, 12); assert.equal(r.ok, true)
  assert.ok(erros(aplicar(r.estado, { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai: 1, entra: 7 }] })).includes('SUB_SEM_RALLY_ENTRE_PEDIDOS'))
  e = rally(r.estado, 'B')
  faz(12, 5)                                            // retorno: 2ª substituição (entrada e retorno contam)
  assert.equal(e.equipes.A.subs.regulares, 2)
  assert.ok(erros(sub(5, 12)).includes('SUB_TITULAR_JA_SAIU_E_VOLTOU'))   // 2º ciclo do par: ilegal em 15.6.1
  assert.ok(erros(sub(6, 12)).includes('SUB_RESERVA_JA_ENTROU'))          // 12 já entrou uma vez no set
  faz(1, 7); faz(2, 8); faz(3, 9); faz(4, 10)           // 3ª a 6ª
  assert.equal(e.equipes.A.subs.regulares, 6)
  assert.ok(erros(sub(6, 11)).includes('SUB_LIMITE'))   // 7ª bloqueada no perfil FIVB
  // Um pedido com vários jogadores conta um por jogador (15.2.2)
  const lote = aplicar(jogoEm({ cfg: perfil('FIVB'), set: 1, placar: [0, 0], sacadora: 'A' }),
    { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai: 1, entra: 7 }, { sai: 2, entra: 8 }] })
  assert.equal(lote.estado.equipes.A.subs.regulares, 2)
})

caso('T03b AMADOR: 8 por set, par repetível com alerta, 9ª bloqueada', () => {
  let e = jogoEm({ cfg: { ...perfil('AMADOR'), limiteSubstituicoes: 8, permitirRepeticaoPar: true }, set: 2, placar: [3, 3], sacadora: 'B' })
  const faz = (sai: number, entra: number) => { const r = aplicar(e, { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai, entra }] }); assert.equal(r.ok, true); e = rally(r.estado, 'B'); return r }
  faz(5, 12); faz(12, 5)
  const repetida = faz(5, 12)                                   // 3ª: mesmo par de novo, permitido no perfil amador
  assert.ok(erros(repetida).includes('SUB_TITULAR_JA_SAIU_E_VOLTOU'))   // com severidade ALERTA
  faz(1, 7); faz(2, 8); faz(3, 9); faz(4, 10); faz(6, 11)         // 4ª a 8ª
  assert.equal(e.equipes.A.subs.regulares, 8)
  assert.ok(erros(aplicar(e, { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai: 7, entra: 1 }] })).includes('SUB_LIMITE'))   // 9ª
  // Novo set reinicia contagem e vínculos
  const intervalo = jogoEm({ cfg: e.config, set: 2, status: 'INTERVALO', subsRegulares: { A: 8 } })
  assert.equal(aplicar(intervalo, { t: 'INICIAR_SET', numero: 3, primeiroSaque: 'A' }).estado.equipes.A.subs.regulares, 0)
})
```

### T04 - Substituição excepcional por lesão (RG-SUB-010/011; CJ-01)
```ts
caso('T04 excepcional nao consome a cota, nao deixa o lesionado voltar', () => {
  // Dado A com 6 substituições regulares no set 2; líbero 14 em quadra no lugar do 4 (P6); #5 em P4; banco 7, 8, 12, 13
  const e0 = jogoEm({ cfg: perfil('FIVB'), set: 2, placar: [9, 6], sacadora: 'B',
    A: { P1: 1, P2: 2, P3: 3, P4: 5, P5: 6, P6: 14 }, liberoSubstitui: { A: 4 }, subsRegulares: { A: 6 }, banco: { A: [7, 8, 12, 13] } })
  // Quando #5 se lesiona e o apontador tenta substituição regular, Então bloqueada
  assert.ok(erros(aplicar(e0, { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai: 5, entra: 12 }] })).includes('SUB_LIMITE'))
  // Quando tenta excepcional com o líbero, ou com o regular que o líbero substitui (#4), Então inelegível
  const exc = (entra: number, sai = 5) => aplicar(e0, { t: 'SUBSTITUICAO_EXCEPCIONAL', equipe: 'A', sai, entra, motivo: 'LESAO', autorizadoPor: 'arbitro2' })
  assert.ok(erros(exc(14)).includes('SUB_EXC_INELEGIVEL'))
  assert.ok(erros(exc(4)).includes('SUB_EXC_INELEGIVEL'))
  // Quando entra o #12, Então vale: cota regular segue 6, excepcionais 1, total do set 7, #5 impedido de voltar
  const r = exc(12)
  assert.equal(r.ok, true)
  const a = r.estado.equipes.A
  assert.deepEqual([a.subs.regulares, a.subs.excepcionais, a.emQuadra.P4], [6, 1, 12])
  assert.ok(a.subs.impedidosDeVoltar.has(5))
  // Sem rally entre pedidos: segunda excepcional imediata é permitida (15.2.3)
  const r2 = aplicar(r.estado, { t: 'SUBSTITUICAO_EXCEPCIONAL', equipe: 'A', sai: 6, entra: 13, motivo: 'LESAO', autorizadoPor: 'arbitro2' })
  assert.equal(r2.ok, true)
  assert.equal(r2.estado.equipes.A.subs.regulares + r2.estado.equipes.A.subs.excepcionais, 8)
  // Quando alguém tenta devolver o #5 como substituição regular (ou excepcional), Então bloqueado
  assert.ok(erros(aplicar(rally(r2.estado, 'B'), { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai: 12, entra: 5 }] })).includes('SUB_MEMBRO_IMPEDIDO'))
})
```

### T05 - Líbero: fundo, rally entre trocas, saque e redesignação (RG-LIB-003/004/005/010/011/012; CJ-02, CJ-08)
```ts
caso('T05 troca de libero', () => {
  // Dado B (perfil CBV) com P1..P6 = 1..6, L1 = 14, banco 7; B ainda não sacou
  let e = jogoEm({ cfg: perfil('CBV'), set: 1, placar: [4, 4], sacadora: 'A' })
  // Líbero só substitui jogador de fundo (P1, P5, P6): P4 (front) é recusado
  assert.ok(erros(aplicar(e, { t: 'LIBERO_ENTRA', equipe: 'B', libero: 14, sai: 4 })).includes('LIB_SO_FUNDO'))
  // Entra pelo #6 (P6): não conta substituição, não cria par
  let r = aplicar(e, { t: 'LIBERO_ENTRA', equipe: 'B', libero: 14, sai: 6 })
  assert.equal(r.ok, true)
  assert.deepEqual([r.estado.equipes.B.emQuadra.P6, r.estado.equipes.B.subs.regulares], [14, 0])
  // Sem rally concluído, nova troca é ilegal (19.3.2.1)
  assert.ok(erros(aplicar(r.estado, { t: 'LIBERO_SAI', equipe: 'B', libero: 14, entra: 6 })).includes('LIB_TROCA_SEM_RALLY'))
  // Depois de um rally, sai e o #6 volta
  e = rally(r.estado, 'A')
  r = aplicar(e, { t: 'LIBERO_SAI', equipe: 'B', libero: 14, entra: 6 })
  assert.equal(r.ok, true)
  // Líbero não saca: B vai sacar e o P1 (#1) seria substituído pelo líbero
  let sacando = jogoEm({ cfg: perfil('CBV'), set: 1, placar: [4, 4], sacadora: 'B' })
  assert.ok(erros(aplicar(sacando, { t: 'LIBERO_ENTRA', equipe: 'B', libero: 14, sai: 1 })).includes('LIB_NAO_SACA'))
})

caso('T05b redesignacao so com um libero, nunca o regular substituido', () => {
  // Dado B com L1 = 14 (único), em P5 no lugar do #5, placar 9x6, set 2; banco 7, 8
  const e = jogoEm({ cfg: { ...perfil('CBV'), maxLiberos: 1 }, set: 2, placar: [6, 9], sacadora: 'B', liberoSubstitui: { B: 5 }, liberoEmQuadra: { B: 14 } })
  const red = (novo: number) => aplicar(e, { t: 'REDESIGNAR_LIBERO', equipe: 'B', novo })
  assert.ok(erros(red(5)).includes('LIB_REDESIGNACAO_INELEGIVEL'))     // o regular que o líbero substituía
  const ok = red(7)
  assert.equal(ok.ok, true)                                            // entra direto e imediatamente
  assert.equal(ok.estado.equipes.B.libero.ativo, 7)
  assert.ok(erros(aplicar(rally(ok.estado, 'A'), { t: 'LIBERO_ENTRA', equipe: 'B', libero: 14, sai: 6 })).includes('SUB_MEMBRO_IMPEDIDO'))  // o antigo não joga mais
  // Com dois líberos registrados não há redesignação
  const dois = jogoEm({ cfg: perfil('FIVB'), set: 2, placar: [6, 9], sacadora: 'B', liberoEmQuadra: { B: 14 }, liberos: { B: [14, 15] } })
  assert.ok(erros(aplicar(dois, { t: 'REDESIGNAR_LIBERO', equipe: 'B', novo: 7 })).includes('LIB_COM_DOIS_LIBEROS'))
})
```

### T06 - Sanções progressivas, ponto e saque, expulsão em quadra (RG-SAN-001..009, RG-SUB-012, RG-TMP-007/008; CJ-04)
```ts
caso('T06 penalidade passa ponto E saque; 2ª grosseira expulsa sem ponto; 3ª desqualifica', () => {
  // Dado 5x7, B sacando, #8 de A em P4 (A: P1=1,P2=2,P3=3,P4=8,P5=5,P6=6; banco 12)
  const base = jogoEm({ cfg: perfil('FIVB'), set: 1, placar: [5, 7], sacadora: 'B',
    A: { P1: 1, P2: 2, P3: 3, P4: 8, P5: 5, P6: 6 }, banco: { A: [12] } })
  // 1) 1ª grosseira de #8: ponto a B (5x8), B continua sacando sem rodar
  let r = aplicar(base, { t: 'SANCAO', equipe: 'A', membro: '#8', nivel: 'GROSSEIRA' })
  assert.deepEqual([r.estado.atual!.placar.A, r.estado.atual!.placar.B, r.estado.atual!.sacadora], [5, 8, 'B'])
  assert.deepEqual(r.estado.equipes.B.emQuadra, base.equipes.B.emQuadra)
  // 2) Penalidade contra quem SACA: A saca em 9x9 e #3 comete a 1ª grosseira: B faz 10, B ganha o saque e roda
  const sacando = jogoEm({ cfg: perfil('FIVB'), set: 1, placar: [9, 9], sacadora: 'A' })
  const r9 = aplicar(sacando, { t: 'SANCAO', equipe: 'A', membro: '#3', nivel: 'GROSSEIRA' })
  assert.deepEqual([r9.estado.atual!.placar.B, r9.estado.atual!.sacadora], [10, 'B'])
  assert.notDeepEqual(r9.estado.equipes.B.emQuadra, sacando.equipes.B.emQuadra)   // B rodou ao ganhar o saque
  // 3) A ganha o rally (6x8, A saca). 2ª grosseira de #8: expulsão SEM ponto
  let e = aplicar(r.estado, ponto('A')).estado
  assert.deepEqual([e.atual!.placar.A, e.atual!.placar.B], [6, 8])
  r = aplicar(e, { t: 'SANCAO', equipe: 'A', membro: '#8', nivel: 'GROSSEIRA' })
  assert.deepEqual([r.estado.atual!.placar.A, r.estado.atual!.placar.B], [6, 8])
  assert.equal(r.estado.equipes.A.sancoes.get('#8')!.expulsoNoSet, true)
  // 4) Em quadra, ele precisa ser substituído antes de qualquer ponto
  assert.ok(erros(aplicar(r.estado, ponto('B'))).includes('PENDENCIA_ABERTA'))
  e = aplicar(r.estado, { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai: 8, entra: 12 }] }).estado
  assert.ok(erros(aplicar(rally(e, 'B'), { t: 'SUBSTITUICAO', equipe: 'A', trocas: [{ sai: 12, entra: 8 }] })).includes('MEMBRO_EXPULSO_NO_SET'))
  // 5) No set seguinte volta a poder jogar; uma 3ª grosseira na partida é desqualificação
  e = jogoEm({ cfg: perfil('FIVB'), set: 2, placar: [2, 2], sacadora: 'A', sancoes: { A: { '#8': { grosseira: 2 } } } })
  r = aplicar(e, { t: 'SANCAO', equipe: 'A', membro: '#8', nivel: 'GROSSEIRA' })
  assert.equal(r.estado.equipes.A.sancoes.get('#8')!.desqualificado, true)
  // 6) Atraso: 1ª advertência (sem ponto); 2ª, mesmo em outro set, é penalidade com ponto e saque
  e = jogoEm({ cfg: perfil('FIVB'), set: 1, placar: [3, 3], sacadora: 'B' })
  e = aplicar(e, { t: 'ATRASO', equipe: 'A' }).estado
  assert.equal(e.atual!.placar.B, 3)
  const set3 = jogoEm({ cfg: perfil('FIVB'), set: 3, placar: [0, 0], sacadora: 'A', atrasos: { A: 1 } })
  assert.deepEqual([aplicar(set3, { t: 'ATRASO', equipe: 'A' }).estado.atual!.placar.B], [1])
  // 7) Agressão: desqualificação direta, sem passar por graus anteriores
  const ag = aplicar(jogoEm({ cfg: perfil('FIVB'), set: 1, placar: [0, 0], sacadora: 'A' }), { t: 'SANCAO', equipe: 'A', membro: 'TECNICO', nivel: 'AGRESSAO' })
  assert.equal(ag.estado.equipes.A.sancoes.get('TECNICO')!.desqualificado, true)
})
```

### T07 - Falta de rotação descoberta depois (RG-ROT-001..004; CJ-03)
```ts
caso('T07 falta de rotacao: cancela so os pontos da equipe faltosa', () => {
  // Dado B ganha o sorteio e saca; papeleta de B: P1=14. O #10 saca por engano e B faz 3 pontos seguidos
  let e = jogoEm({ cfg: perfil('FIVB'), set: 1, placar: [0, 0], sacadora: 'B',
    B: { P1: 14, P2: 9, P3: 8, P4: 7, P5: 6, P6: 10 } })
  e = aplicar(e, ponto('B')).estado; const primeiroB = seqDoUltimo(e)
  e = aplicar(e, ponto('B')).estado; e = aplicar(e, ponto('B')).estado           // 0x3
  // A recupera o saque (1x3) e faz mais 5 (6x3)
  for (let i = 0; i < 6; i++) e = aplicar(e, ponto('A')).estado
  assert.deepEqual([e.atual!.placar.A, e.atual!.placar.B], [6, 3])
  // Quando se descobre a falta, com o momento determinado (primeiro saque do #10)
  const r = aplicar(e, { t: 'DESCOBRIR_FALTA', tipo: 'ROTACAO', equipe: 'B', desdeSeq: primeiroB })
  // Então: os 3 pontos de B somem, A mantém os 6 e ganha 1 ponto e o saque: 7x0
  assert.deepEqual([r.estado.atual!.placar.A, r.estado.atual!.placar.B, r.estado.atual!.sacadora], [7, 0, 'A'])
  assert.equal(r.derivados.cancelados!.length, 3)
  assert.equal(r.estado.log.length, e.log.length + 1)                // nada foi apagado; entra um evento compensatório
  // Quando o momento NÃO pode ser determinado, Então só ponto e saque ao adversário: 7x3
  const sem = aplicar(e, { t: 'DESCOBRIR_FALTA', tipo: 'ROTACAO', equipe: 'B', desdeSeq: null })
  assert.deepEqual([sem.estado.atual!.placar.A, sem.estado.atual!.placar.B], [7, 3])
  assert.equal(sem.derivados.cancelados, undefined)
  // Falta de posição NÃO cancela nada: apenas ponto e saque
  const pos = aplicar(e, { t: 'FALTA_POSICAO', equipe: 'B' })
  assert.deepEqual([pos.estado.atual!.placar.A, pos.estado.atual!.placar.B], [7, 3])
})
```
Interpretação adotada: "momento exato" = primeiro saque feito com a formação errada; se o ponto de side-out que deu o saque a B conta ou não é **não verificado** (Livro de Casos CBV). O exemplo foi montado com B sacando desde o 0x0 para não depender dessa decisão.

### T08 - Substituição ilegal descoberta depois (RG-SUB-009, RG-FOR-008, 15.9; CJ-07)
```ts
caso('T08 substituicao ilegal: cancela os pontos de B desde a falta, A mantem os seus', () => {
  // Dado perfil FIVB, set 2, B com 6 substituições; 7ª feita em quadra sem registro quando B 9 x A 6
  let e = jogoEm({ cfg: perfil('FIVB'), set: 2, placar: [6, 9], sacadora: 'B', subsRegulares: { B: 6 } })
  e = aplicar(e, ponto('B')).estado; const origem = seqDoUltimo(e)   // primeiro ponto depois da 7ª
  for (const eq of ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'] as const) e = aplicar(e, ponto(eq)).estado
  assert.deepEqual([e.atual!.placar.A, e.atual!.placar.B], [10, 14])  // B fez 5, A fez 4 desde a 7ª
  // Quando é descoberta (jogo já reiniciado), Então: B volta a 9, A mantém 10 e ganha 1 ponto e o saque: A 11 x B 9
  const r = aplicar(e, { t: 'DESCOBRIR_FALTA', tipo: 'SUBSTITUICAO_ILEGAL', equipe: 'B', desdeSeq: origem })
  assert.deepEqual([r.estado.atual!.placar.A, r.estado.atual!.placar.B, r.estado.atual!.sacadora], [11, 9, 'A'])
  // o motor nunca soube da 7ª (não foi lançada): a quadra registrada (#6 em P6) já é a retificada
  assert.equal(r.estado.equipes.B.emQuadra.P6, 6)
  assert.equal(r.derivados.cancelados!.length, 5)                    // só os 5 pontos de B
  assert.equal(r.estado.equipes.B.subs.regulares, 6)                 // a 7ª não conta
})
```

### T09 - Set decisivo e terceiro set obrigatório (RG-SET-003/004/006, RG-FOR-002; CJ-05, D2)
```ts
caso('T09a decisivo: sorteio, 15 pontos, troca de lado aos 8, contagem zerada', () => {
  // Dado melhor de 5, 2x2, alvo decisivo 15; A usou 6 substituições e 2 tempos no 4º set
  const cfg = { ...perfil('FIVB'), melhorDe: 5 as const, alvoDecisivo: 15 }
  let e = jogoEm({ cfg, set: 4, status: 'INTERVALO', setsGanhos: { A: 2, B: 2 }, subsRegulares: { A: 6 }, temposUsados: { A: 2 } })
  // Sem novo sorteio, o set 5 não começa
  assert.ok(erros(aplicar(e, { t: 'INICIAR_SET', numero: 5, primeiroSaque: 'B' })).includes('SET_DECISIVO_SEM_SORTEIO'))
  e = aplicar(e, { t: 'SORTEIO', vencedor: 'A', escolhe: 'LADO' }).estado          // A escolhe o lado; B saca
  e = aplicar(e, { t: 'INICIAR_SET', numero: 5, primeiroSaque: 'B' }).estado
  assert.deepEqual([e.equipes.A.subs.regulares, e.equipes.A.tempos], [0, 0])      // tudo por set
  // Quando a líder chega a 8 (A 8x5), Então pendência de troca de lado
  e = jogoEm({ cfg, set: 5, placar: [7, 5], sacadora: 'A', decisivo: true })
  const r8 = aplicar(e, ponto('A'))                                              // 8x5
  assert.ok(r8.estado.pendencias.some((p) => p.tipo === 'TROCA_LADO'))
  const r9 = aplicar(r8.estado, ponto('A'))                                      // esquecida: 9x5 segue, com ALERTA
  assert.equal(r9.ok, true)
  const troca = aplicar(r9.estado, { t: 'TROCA_LADO' })                          // registrada com o placar real (9x5)
  assert.equal(troca.estado.atual!.ladoDeA, 'DIR')
  assert.deepEqual(troca.estado.equipes.A.emQuadra, r9.estado.equipes.A.emQuadra) // posições intactas (18.2.2)
  // 15x14 continua; 16x14 acaba; 17x15 acaba; 15x13 acaba
  const f = (a: number, b: number) => aplicar(jogoEm({ cfg, set: 5, placar: [a, b], sacadora: 'A', decisivo: true }), ponto('A')).derivados.setEncerravel
  assert.equal(f(14, 14), undefined)
  assert.deepEqual(f(15, 14), { vencedora: 'A', placar: [16, 14] })
  assert.deepEqual(f(16, 15), { vencedora: 'A', placar: [17, 15] })
  assert.deepEqual(f(14, 13), { vencedora: 'A', placar: [15, 13] })
})

caso('T09b melhor de 3: terceiro set obrigatorio x opcional (mesmo motor na UI e na API)', () => {
  // Dado 2x0 com terceiro obrigatório, set 3 a 15: a partida NÃO encerra; 3x0 ou 2x1 são válidos
  const obrig = { ...perfil('AMADOR'), melhorDe: 3 as const, terceiroSetObrigatorio: true, alvoSet: 25, alvoDecisivo: 15 }
  let e = jogoEm({ cfg: obrig, set: 2, placar: [25, 20], sacadora: 'A', setsGanhos: { A: 1, B: 0 } })
  e = aplicar(e, { t: 'ENCERRAR_SET' }).estado
  assert.equal(e.setsGanhos.A, 2)
  assert.equal(e.status, 'INTERVALO')                                // não 'FIM' (hoje a UI encerra aqui e a API recusa)
  e = aplicar(e, { t: 'INICIAR_SET', numero: 3, primeiroSaque: 'B' }).estado     // sem sorteio (não verificado: depende do regulamento)
  const fim = (a: number, b: number) => aplicar(jogoEm({ cfg: obrig, set: 3, placar: [a, b], sacadora: 'A', setsGanhos: { A: 2, B: 0 } }), ponto('A')).derivados.partidaEncerravel
  assert.deepEqual(fim(14, 10), { vencedora: 'A', sets: [3, 0] })
  const b = aplicar(jogoEm({ cfg: obrig, set: 3, placar: [10, 14], sacadora: 'B', setsGanhos: { A: 2, B: 0 } }), ponto('B')).derivados.partidaEncerravel
  assert.deepEqual(b, { vencedora: 'A', sets: [2, 1] })
  // Dado terceiro opcional, 2x0 encerra e um 3º set é erro
  const opc = { ...obrig, terceiroSetObrigatorio: false }
  const f = aplicar(jogoEm({ cfg: opc, set: 2, placar: [25, 20], sacadora: 'A', setsGanhos: { A: 1, B: 0 } }), { t: 'ENCERRAR_SET' }).estado
  assert.equal(f.status, 'FIM')
  assert.ok(erros(aplicar(f, { t: 'INICIAR_SET', numero: 3, primeiroSaque: 'B' })).includes('PARTIDA_JA_ENCERRADA'))
})
```
### T10 - WO, WO duplo e equipe incompleta (RG-WO-001/002/005, RG-SAN-012; CJ-10)
```ts
caso('T10a WO simples e duplo', () => {
  const cfg = { ...perfil('FIVB'), melhorDe: 5 as const, toleranciaWOMin: 15, placarWO: { sets: [3, 0], pontosPorSet: [25, 0] } }
  // Dado B ausente, 14 minutos após o horário: ainda dentro da tolerância
  let e = jogoEm({ cfg, status: 'PRE', minutosAposHorario: 14 })
  assert.ok(erros(aplicar(e, { t: 'WO', ausentes: ['B'], motivo: 'NAO_COMPARECEU' })).includes('WO_SEM_TOLERANCIA'))
  // Quando passam 16 minutos, Então 3x0 com 25x0 por set; duração 0; sem exigir MVP nem 6 atletas de B
  e = jogoEm({ cfg, status: 'PRE', minutosAposHorario: 16 })
  const r = aplicar(e, { t: 'WO', ausentes: ['B'], motivo: 'NAO_COMPARECEU' })
  assert.deepEqual(r.derivados.partidaEncerravel, { vencedora: 'A', sets: [3, 0] })
  assert.deepEqual(r.estado.sets.map((s) => [s.placar.A, s.placar.B]), [[25, 0], [25, 0], [25, 0]])
  assert.deepEqual(validarFechamento(r.estado).filter((x) => x.codigo === 'ELENCO_FORA_DO_LIMITE'), [])
  // WO duplo: sem vencedora, só a arbitragem assina (classificação é do regulamento: não verificado)
  const duplo = aplicar(e, { t: 'WO', ausentes: ['A', 'B'], motivo: 'NAO_COMPARECEU' })
  assert.equal(duplo.derivados.partidaEncerravel, undefined)
  assert.equal(duplo.estado.status, 'WO')
})

caso('T10b equipe incompleta no set e depois no jogo', () => {
  // Dado melhor de 5, sets 1x1; set 3: A 9 x B 14; A só tem 6 inscritos e o #8 é desqualificado em quadra
  const cfg = { ...perfil('FIVB'), melhorDe: 5 as const }
  let e = jogoEm({ cfg, set: 3, placar: [9, 14], sacadora: 'B', setsGanhos: { A: 1, B: 1 }, elencoReduzido: { A: [1, 2, 3, 4, 5, 8] }, aptos: { A: 6 } })
  e = aplicar(e, { t: 'SANCAO', equipe: 'A', membro: '#8', nivel: 'AGRESSAO' }).estado
  assert.ok(erros(aplicar(e, ponto('B'))).includes('PENDENCIA_ABERTA'))      // sem substituto possível
  // Quando A é declarada incompleta no set, Então mantém os 9 pontos, B recebe o necessário e vence: 9x25
  let r = aplicar(e, { t: 'INCOMPLETA', equipe: 'A', escopo: 'SET' })
  assert.deepEqual([r.estado.sets[2].placar.A, r.estado.sets[2].placar.B], [9, 25])
  assert.deepEqual(r.estado.setsGanhos, { A: 1, B: 2 })
  // No set 4, A continua com 5 aptos: não pode iniciar
  const r4 = aplicar(r.estado, { t: 'INICIAR_SET', numero: 4, primeiroSaque: 'A' })
  assert.ok(erros(r4).includes('EQUIPE_INCOMPLETA'))
  // Quando é declarada incompleta no jogo, Então B recebe o que falta: set 4 em 0x25, B vence 3x1
  r = aplicar(r.estado, { t: 'INCOMPLETA', equipe: 'A', escopo: 'JOGO' })
  assert.deepEqual(r.derivados.partidaEncerravel, { vencedora: 'B', sets: [1, 3] })
  assert.deepEqual([r.estado.sets[3].placar.A, r.estado.sets[3].placar.B], [0, 25])
})
```

### Propriedades gerais (rodar sobre qualquer sequência de eventos)
- **Determinismo**: `replay(config, log)` == estado obtido evento a evento; o servidor e o cliente chegam ao mesmo placar.
- **Imutabilidade**: nenhum evento é removido; `ANULA` e `DESCOBRIR_FALTA` só acrescentam.
- **Conservação**: `placar[A] + placar[B]` = número de `PONTO` e pontos automáticos válidos menos os cancelados.
- **Idempotência**: reenviar o mesmo `idemId` não duplica.
- **Isolamento**: eventos de uma partida nunca alteram outra (a rota continua por token da partida; ver relatório de segurança).

## 6. Pontos não verificados e quem confirma

| Assunto | Situação | Quem confirma |
| --- | --- | --- |
| Ponto de side-out que deu o saque à equipe faltosa conta ou é cancelado numa falta de rotação (T07) | Não verificado | Livro de Casos de Súmula CBV; COBRAV/FMV |
| Combinação de categorias diferentes no mesmo membro (ex.: grosseira penalizada e depois ofensiva) | Não verificado | Casebook FIVB 2024; árbitro nacional |
| Quem saca em 0x0 após penalidade entre sets (RG-SAN-010) | Não verificado | Livro de Casos CBV |
| Terceiro set obrigatório (2x0): sorteio e troca aos 8? | Não verificado, depende do regulamento do organizador | Organizador / FMV |
| Placar e classificação de WO em melhor de 3 e em WO duplo (RG-WO-001/002, D9) | Não verificado | Regulamento da competição |
| Tolerância de WO (15 ou 30 min nos exemplos do Guia) | Vem do regulamento | Organizador |
| Líbero redesignado deixa de ser jogador de linha (RG-LIB, CJ-02) | Não verificado | Livro de Casos CBV |
| Tempo técnico indoor | Fora das Regras FIVB 2025-2028; só por regulamento | Organizador |
| Artigos citados (15.1, 15.6, 15.7, 19.x, 21.x etc.) | Herdados do relatório 03; não relidos nos PDFs nesta auditoria | Quem fez o 03 / COBRAV |
| Tratamento de classificação para status `WO` e leitura de `aprovar` pelo organizador | Fora do escopo lido (só `aprovar` e `iniciar` foram abertos) | `backend` / `dados-do-campeonato` |

## 7. Resumo

1. O servidor valida só o placar dos sets; toda a regra de jogo vive no navegador (`lancar/page.tsx`) e é reconstruída de texto livre.
2. Corretos hoje: rodízio e saque (permutação conferida), tempos (2 por set), contagem entrada+retorno de substituições, fim de set por alvo + 2.
3. Crítico: terceiro set obrigatório (UI encerra em 2x0, API recusa e o autosave cai em 422 mudo); cartão vermelho dá ponto sem saque/rodízio e também onde a regra é expulsão/DQ.
4. Alto: sem cancelamento de pontos (o desfazer apaga pontos do adversário e eventos), sem excepcional, sem expulsão/DQ, sem WO/incompleta, líbero nunca entra na quadra, oficialização automática sem assinaturas, vínculo de par perdido no reload.
5. Escolhas do organizador (8 substituições, par repetível) viram constantes; devem virar `ConfigRegras` com padrão FIVB/CBV (6, sem repetição).
6. Proposta: motor puro + log de eventos append-only no servidor, `SetPartida`/`Partida` derivados, 10 casos executáveis (seção 5).
