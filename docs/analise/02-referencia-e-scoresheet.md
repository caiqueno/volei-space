# 02 - Referência: Data Project e-Scoresheet (e comparação com VolleyStation)

Autor: agente `engenheiro-reverso`. Data: 2026-10-16.

## 0. Escopo, método e limites

- Estudo feito **somente** por documentação pública: páginas do produto, manual do usuário (versão 2014.10.06), guia CEV de 2015 e guia da USA Volleyball. Descrição com palavras próprias, sem cópia de textos, imagens ou layouts.
- **Não** foram baixados nem executados binários, instaladores ou o REA. Os PDFs públicos foram lidos apenas como texto.
- Tudo que só seria descoberto por análise de binário aparece como **não verificado**.
- Níveis de confiança: **confirmado** (dito expressamente na fonte), **inferido** (deduzido da fonte ou das regras oficiais da FIVB, sem que a fonte o diga), **não verificado**.
- Aviso de datas: o manual é de 2014 e o guia CEV de 2015 (laptop Windows, app Android). O produto atual pode ter mudado (a página atual cita Windows 8.1 como mínimo). Tratar o comportamento como referência histórica.

### Fontes (abreviações)
- **[MAN]** Manual do e-Scoresheet 2014: https://bli.is/wp-content/uploads/2019/09/escorman.pdf
- **[CEV]** CEV Data Project Software Guidelines (2015), inclui o guia do app ES Bench + ES Referee: https://inside.cev.eu/media/eulhmot0/dataproject-software-guidelines.pdf
- **[PRD]** Página do produto: https://www.dataproject.com/Products/EN/en/Volleyball/eScoresheet
- **[WCM]** Página do Web Competition Manager: https://www.dataproject.com/Products/EU/en/Pallavolo/WCM
- **[USAV]** Guia de treinamento da USA Volleyball (apenas uma página de links, ver seção 6): https://usavolleyball.org/wp-content/uploads/2025/07/Sunshine-Volleystation-Training-Guide.pdf
- **[VS-STORE]** Ficha do app VolleyStation Score na App Store: https://apps.apple.com/us/app/1614399577
- **[RULES]** Regras oficiais FIVB (não lidas aqui; ver relatório 03). Usadas só para marcar conclusões como "inferido".

## 1. Fluxo completo da partida

| # | Etapa | O que o software faz (em palavras próprias) | Fonte | Confiança |
|---|---|---|---|---|
| 1 | Preparação do posto | Competição vem de um arquivo central (nome, logo, fases, regulamento, times, elencos, árbitros, supervisores), atualizado antes de cada jogo. Parâmetros da competição ficam em nível central para o apontador não improvisar. Há jogos de teste com contas de treino. | [CEV], [MAN] | confirmado |
| 2 | Criar/abrir jogo | Assistente (em algumas federações): criar manual (não oficial, não enviado), carregar jogo oficial do site da federação (com login), conferir jogo oficial (testa dados e conexão) ou carregar jogo de teste. Data, número do jogo e dia vêm carregados e não editáveis em jogo oficial. | [MAN] | confirmado |
| 3 | Dados do jogo e elencos | Janela de notas do jogo; "Roster": adicionar/remover atletas, número de camisa, capitão, um ou dois líberos conforme a competição. Algumas federações exigem confirmar a lista com login e senha do time. Há botão para cadastrar atleta novo fora da base. | [MAN] | confirmado |
| 4 | Conferência pré-jogo | Apontador confere delegações, números, líbero, capitão, comissão, bandeirinhas e ginásio; imprime o formulário de resultado da competição para o supervisor. O supervisor confere antes de abrir o placar ao vivo. | [CEV] | confirmado (regra CEV, não do software em si) |
| 5 | Saque inicial e lados | Define-se quem saca (pode ser antes ou depois do line-up) e inverte-se o lado dos times com um botão "Change". | [MAN] | confirmado |
| 6 | Papeleta / line-up | Posicionar 6 atletas nas zonas 1 a 6 por arrastar, digitar número ou duplo clique (preenche na ordem de rotação). Botão para limpar tudo. Se o capitão não estiver em quadra, o sistema pede para designar um dos seis. Opção de propor o line-up do jogo anterior. Aviso se o backup não está habilitado. | [MAN] | confirmado |
| 7 | Papeleta enviada pelo banco | No app ES Bench, o técnico monta e envia o line-up; o apontador aceita na tela principal. Os line-ups devem estar visíveis ao apontador, aos árbitros e ao monitor do supervisor ao menos 12 minutos antes do jogo. O 2º árbitro confere pelo tablet; correções seguem as regras FIVB. O primeiro líbero a entrar é registrado como líbero inicial. | [CEV] | confirmado |
| 8 | Início do set | "Start set" pede o horário: oficial (calculado: duração do set anterior + intervalo) ou real. Se a diferença passa de 5 min, só o horário real é permitido. | [MAN] | confirmado |
| 9 | Rali | Atribuir ponto por botão ou tecla configurável. Se dois pontos são lançados em menos de 8 s, aparece aviso com escolhas. "Undo" desfaz a última ação com confirmação. "Replay" refaz o rali. Com vídeo ativado, "Start rally" marca cada início de rali; no guia CEV, apertar Start Rally ao apito do 1º árbitro bloqueia pedidos de tempo e desafio no app do banco. | [MAN], [CEV] | confirmado |
| 10 | Tempos | Botão por time; contador de tempos ao lado. No guia CEV: tempo de 30 s, 2 por time, contagem regressiva no LiteScore, botão desativado ao esgotar. | [MAN], [CEV] | confirmado |
| 11 | Substituições | Escolher quem sai (quadra) e quem entra (banco), por botão, tecla, lista ou arrastar. Contador por time. Se sai o capitão e não há outro designado, o sistema exige designar novo capitão. | [MAN] | confirmado |
| 12 | Lesão | Botão "Injury": escolhe time e atleta (em quadra ou líbero), confirma duas vezes e exige a substituição forçada. Se o líbero se lesiona, escolhe-se quem o substitui conforme o regulamento da federação. | [MAN] | confirmado |
| 13 | Líbero | "Libero In" por time (escolhe quem sai), "Libero Out", e "trocar líbero" para alternar entre dois líberos. Na quadra o número do líbero aparece destacado com o número de quem saiu em tamanho pequeno. Opções para o sistema sugerir a entrada (quando o adversário saca) e a saída (quando o líbero chega à linha de frente). | [MAN] | confirmado |
| 14 | Sanções | Penalidade de atraso e solicitação indevida (por time); falta, desqualificação e expulsão (por atleta ou comissão). Falta mostra cartão amarelo e dá ponto ao adversário automaticamente; expulsão/desqualificação mostra cartão vermelho e, se o atleta está em quadra, exige substituto do banco. | [MAN] | confirmado |
| 15 | Protesto | Botão por time registra o pedido com o número do set e o placar naquele momento. | [MAN] | confirmado |
| 16 | Desafio por vídeo | Opção (a partir da versão 2013): registra pedidos de verificação por time, o resultado informado pelo apontador, limite de 2 pedidos do 1º árbitro (depois o fundo fica vermelho) e gera nota automática nos comentários. Tem tratamento especial se pedido durante tempo técnico ou fim de set. | [MAN], [CEV] | confirmado |
| 17 | Fim do set | O último ponto abre resumo (placar, hora de fim, duração em minutos); confirmar inicia contagem regressiva do intervalo, interrompível. Depois pede novo line-up e novo "start set". | [MAN] | confirmado |
| 18 | Correções manuais | "Manual changes": ajustar tempos, pontos, substituições (quem entrou, quem saiu, placar), line-up atual, rotação, lados, saque, sanções, elencos e horários/duração. Todas ficam gravadas como "notas técnicas" somente leitura, visíveis na aprovação. | [MAN] | confirmado |
| 19 | Fim do jogo e aprovação | Ao fechar o último set, em federações específicas surge "Scoresheet approval": árbitro e supervisor digitam suas próprias senhas, veem as notas técnicas e podem acrescentar observações. Depois escolhe-se a pasta, o jogo é gerado, e é possível enviar ao servidor e imprimir. Em algumas federações o envio é obrigatório e há aviso se não foi enviado. | [MAN], [CEV] | confirmado |
| 20 | Assinaturas | A "assinatura" eletrônica é a senha pessoal do 1º árbitro e do supervisor (CEV: cada um deve digitar a sua; o arquivo é fechado em definitivo e enviado). O manual não menciona assinatura de capitães ou do apontador. | [CEV], [MAN] | confirmado para árbitro/supervisor; **não verificado** para capitães e apontador |
| 21 | Set de ouro (golden set) | Após o fim de um jogo, "Play Golden Set" abre um jogo "GS" já no 5º set com os mesmos dados; ao aprovar, aprova e envia também o jogo anterior. | [MAN], [CEV] | confirmado |
| 22 | Recuperação | Opção grava o jogo inteiro em pendrive após cada rali; "Restore match" retoma em outro computador. | [MAN] | confirmado |

## 2. Regras de validação impostas pelo software

Atenção: nem o manual nem as páginas públicas trazem a lista formal de regras de validação. O que está abaixo é o que a documentação **descreve** (confirmado) e o que se **deduz** das regras FIVB (inferido). A lista definitiva das regras fica para o relatório 03.

| Tema | O que a fonte permite concluir | Fonte | Confiança |
|---|---|---|---|
| Visão geral | O software confere as situações possíveis em cada momento e sugere as próximas ações permitidas. | [PRD] | confirmado (alegação de marketing, sem detalhe) |
| Rotação | O line-up usa zonas 1 a 6 em ordem de rotação, com "rotate line-up" disponível apenas como correção manual registrada. Que o sistema impeça saque fora de ordem **não é dito**. | [MAN] | rotação existente: confirmado; bloqueio de saque fora de ordem: inferido |
| Capitão | Capitão sempre presente em quadra (obrigatório para falar com o árbitro); exige redesignar se sai. | [MAN] | confirmado |
| Limite de substituições | Guia CEV: contador por time; alerta amarelo na 5ª; botão desativado ao chegar a 6 (ou ao máximo da competição); 5ª e 6ª devem ser avisadas ao 2º árbitro. | [CEV] | confirmado |
| Par de substituição | No app do banco, o sistema destaca automaticamente o parceiro de um jogador já substituído, indicando que só o retorno ao mesmo par é regular. | [CEV] | confirmado (destaque); regra de par: inferido de [RULES] |
| Substituição ilegal | O app do banco não permite pedir substituição ilegal; substituição pode ser negada se entram/saem atletas errados ou há atraso, com sanção de atraso. | [CEV] | confirmado |
| Substituição excepcional | Botão "Exceptional" no app do banco; página do produto lista "exceptional substitutions" entre os eventos controlados. Os critérios de elegibilidade não são descritos. | [CEV], [PRD] | existência: confirmado; critérios: não verificado |
| Substituição por lesão | Fluxo próprio de substituição forçada, inclusive do líbero. | [MAN] | confirmado |
| Líbero | Até dois líberos por elenco conforme a competição; entrada/saída registradas; sugestões automáticas opcionais; troca entre líberos; líbero lesionado substituído conforme regulamento da federação. Que a troca de líbero só ocorra após rali concluído ou que o líbero não possa sacar é **inferido** de [RULES]. | [MAN] | confirmado (funções); inferido (restrições) |
| Redesignação de líbero | Existe fluxo para escolher quem substitui o líbero lesionado. A mecânica exata (novo líbero, quem pode ser, registro) não é descrita. | [MAN] | existência: confirmado; mecânica: não verificado |
| Tempos de descanso | 2 por time, 30 s; segundo pedido do adversário na mesma paralisação é autorizado; botão desativado ao esgotar. | [CEV] | confirmado |
| Tempo técnico | O manual cita "technical timeout" apenas ao tratar o desafio por vídeo. Quando ocorre (ex.: aos 8 e 16 pontos nos sets 1 a 4 em competições FIVB) e se o software o dispara sozinho não é descrito. | [MAN] | existência: confirmado; gatilhos: não verificado (inferido de [RULES] para FIVB) |
| Set decisivo | Conhece o jogo "GS" (5º set, após o fim do jogo). Troca de lados no meio do set decisivo e placar de 15 pontos: não descritos. Parâmetros de regulamento vêm da competição central. | [MAN], [CEV] | golden set: confirmado; demais: não verificado |
| Fim de set | Declarado automaticamente pelo último ponto (regra de pontos e diferença vem do regulamento da competição). | [MAN] | confirmado (automático); detalhe da conta: inferido |
| Intervalo | Intervalo padrão de 3 min entre sets, ajustável; intervalo entre 2º e 3º set configurável por regras da federação. | [MAN] | confirmado |
| Horário | Horário oficial só pode ser usado se a diferença para o real for menor que 5 min. | [MAN] | confirmado |
| Anti-clique | Opção que bloqueia um botão por 3 s após o toque; aviso se dois pontos são lançados em menos de 8 s. | [MAN] | confirmado |
| Sanções | Falta gera ponto ao adversário automaticamente; atleta/comissão expulso ou desqualificado em quadra exige substituto. | [MAN] | confirmado |
| Estrangeiros em quadra | Página do produto afirma que controla jogadores estrangeiros em quadra (regra de competição). | [PRD] | confirmado (alegação); regra exata: não verificado |
| Rastreabilidade | Qualquer edição manual vira nota técnica imutável, mostrada na aprovação. | [MAN] | confirmado |

## 3. Integrações

| Integração | Descrição | Fonte | Confiança |
|---|---|---|---|
| Web Competition Manager (WCM) | Sistema de gestão de competições (modular, do banco de dados a um site completo). Fornece dados e elencos do jogo ao e-Scoresheet; dados de súmula (e-Scoresheet, Data Volley) fluem automaticamente de volta ao banco central; mostra estatísticas e jogos ao vivo. | [PRD], [WCM] | confirmado |
| Importação de competição | Importa competição do programa VIS (somente FIVB), a partir de pasta com os times. | [MAN] | confirmado |
| Live Score | Envia o placar em tempo real ao site da federação/liga (login e senha). Pelo guia CEV, só é aberto 59 a 30 min antes do jogo, depois da conferência do supervisor. | [MAN], [CEV], [PRD] | confirmado |
| App de banco (ES Bench) | App Android: técnico monta e envia line-up, pede substituição, tempo e desafio. O apontador aceita pedidos. Dois por jogo (um por time), fixos no banco esquerdo/direito. Conexão por Wi-Fi/LAN, Bluetooth ou cabo, com IP fixo do laptop e senha inicial. | [CEV], [PRD] | confirmado |
| App do árbitro (ES Referee) | App Android: 1º e 2º árbitros acompanham em tempo real rotação, substituições, tempos, desafios e placar; também confere line-ups. Aceita mais de dois (ex.: árbitro de vídeo ou delegado). | [CEV] | confirmado |
| Scoresheet Referee (rede local) | Compartilha line-up, tempos e substituições para qualquer dispositivo com navegador na rede local. | [MAN] | confirmado |
| Data Volley | O e-Scoresheet grava arquivo no formato do Data Video para análise; a página do produto cita leitura de line-ups do Data Volley. Exportação de estatística `.dvw` não é documentada nas fontes lidas. | [MAN], [PRD] | confirmado (arquivo Data Video, leitura de line-up); `.dvw`: não verificado |
| Data Video / vídeo | Arquivo para vídeo salvo a cada gravação, marcação de início de rali e designação do levantador. | [MAN], [PRD] | confirmado |
| LiteScore / Volley Board | Placar LED portátil: mostra placar, sets, tempos e substituições; controle remoto; botões do e-Scoresheet para mostrar sacador, inverter lados, sinal sonoro, atualizar. Soa e pisca em pedidos de tempo/substituição. | [MAN], [CEV], [PRD] | confirmado |
| TV Score | Fornece dados para gráficos de TV. | [PRD] | confirmado (só menção) |
| Compartilhar dados (Share Data) | Opção para outros programas receberem dados via nome/IP do computador. | [MAN] | confirmado (formato do protocolo: não verificado) |
| Protocolo e APIs | Formato dos arquivos de jogo, protocolo do app de banco e do upload (o guia CEV cita FTP para estatística): não documentados em nível de campos. | [CEV] | não verificado |

## 4. Formatos de saída

| Saída | Descrição | Fonte | Confiança |
|---|---|---|---|
| Súmula impressa/PDF | Imprime a súmula completa ou em branco, direto, em visualização ou PDF; "print pregame" imprime a pré-súmula. Para a liga universitária feminina americana há um modelo próprio. | [MAN] | confirmado |
| Formulários CEV | Formulário de resultado nº 12 por competição (EC-12, CL-12, EL-12, CH-12), impresso pelo apontador. | [CEV], [MAN] | confirmado |
| Prévia por set | Mostra o set no formato do formulário FIVB. | [MAN] | confirmado |
| Histórico | Relatório do jogo, filtrável por substituição, sanção e lesão; gerado automaticamente. | [MAN] | confirmado |
| Arquivo do jogo | Salvo em pasta escolhida; backup em unidade removível; recuperação após cada rali. Estrutura interna do arquivo: não verificada. | [MAN] | confirmado (existência); formato: não verificado |
| Dados ao vivo | Placar enviado ao Live Score e ao banco de dados central da competição. | [PRD] | confirmado |
| Arquivo Data Video | Cópia do jogo para uso no Data Video. | [MAN] | confirmado |

## 5. Observações de produto relevantes para o Volei Space

- O fluxo usa **o laptop do apontador como hub local**; o banco e os árbitros ligam-se a ele pela rede do ginásio. É um desenho que sobrevive sem internet, mas depende de infraestrutura (roteador, IP fixo, Bluetooth classe 1). [CEV] confirmado.
- O substituto só é "aceito" pelo apontador depois que entra na zona de substituição; o pedido oficial é a entrada do jogador na zona, não o toque no app. [CEV] confirmado. Requisito: o app do banco **prepara**, o apontador **confirma**.
- Rali em andamento bloqueia tempo e desafio no banco, mas permite preparar substituição. [CEV] confirmado.
- Senhas pessoais de árbitro e supervisor funcionam como assinatura; digitadas pela própria pessoa. [CEV] confirmado.
- Edições manuais são sempre rastreadas. Bom requisito de auditoria. [MAN] confirmado.
- Limitações visíveis: Windows apenas, apps Android antigos instalados por APK, rede local manual. [CEV], [PRD] confirmado (datas de 2015; o produto atual pode ter mudado).

## 6. Comparação resumida com VolleyStation

Fontes sobre o VolleyStation são **fracas**: o guia da USA Volleyball [USAV] é só uma página que aponta para app, slides, vídeo e perguntas frequentes (Google Slides/Drive, não lidos). A ficha da loja [VS-STORE] e uma busca complementar dão o restante.

| Aspecto | e-Scoresheet (Data Project) | VolleyStation Score | Confiança sobre VolleyStation |
|---|---|---|---|
| Plataforma | Windows (laptop do apontador) + apps Android de banco e árbitro | App móvel (iOS e Android) | confirmado ([USAV], [VS-STORE]) |
| Custo | Licença por competição/liga (preço sob consulta; uma página dos EUA cita taxa anual) | Gratuito na loja | confirmado ([VS-STORE]); preço do e-Scoresheet pode estar defasado |
| Foco | Federações e competições oficiais FIVB/CEV | Torneios de clubes (ex.: Sunshine Classic da USAV, todas as quadras) | confirmado ([USAV]) |
| Súmula em PDF | Sim, vários modelos | Sim, a loja afirma gerar PDF da súmula | confirmado (existência); equivalência com modelo oficial: não verificado |
| Integração com agenda/elenco | WCM da própria Data Project | Integração com agendamento AES; oficiais acessam jogos por QR code com elencos já carregados | confirmado ([VS-STORE]); QR: inferido (relato de imprensa) |
| Placar ao vivo e estatística | Live Score, LiteScore, Data Volley | Placar ao vivo e análises por time/jogo/atleta | confirmado ([VS-STORE]) |
| App de banco / árbitro | ES Bench e ES Referee | Existe "V-Score Referee" na loja; app de banco: não localizado | confirmado (app do árbitro, só nome); demais: não verificado |
| Regras de validação (líbero, substituições, tempo técnico) | Parcialmente documentadas (seção 2) | Nenhuma documentação pública encontrada | não verificado |
| Offline | Tolerante (hub local), mas exige rede para envio | Não verificado | não verificado |
| Qualidade percebida | Maturidade em eventos FIVB/CEV | Avaliações modestas na loja (cerca de 2,6 de 5 em 42 notas) e relatos de instabilidade | confirmado (nota); causas: não verificado |

Leitura: o e-Scoresheet é referência de **profundidade de regras e integração oficial**; o VolleyStation é referência de **acessibilidade (gratuito, celular, QR, agenda)**. O Volei Space pode juntar as duas coisas, mas precisa de especificação própria das regras (relatório 03).

## 7. Lacunas a registrar (não verificado)

1. Algoritmo real de validação de rotação, saque fora de ordem e posições.
2. Critérios exatos da substituição excepcional e mecânica da redesignação de líbero.
3. Disparo do tempo técnico e troca de lados no set decisivo.
4. Formato dos arquivos do jogo, do upload e da exportação `.dvw` (só seria descoberto por análise de binário ou contrato com o fornecedor).
5. Assinatura de capitães e do apontador na súmula eletrônica.
6. Versão atual do produto (as fontes são de 2014/2015 e o catálogo atual pode incluir tablets e novos fluxos).
7. Regras de validação do VolleyStation e conteúdo dos slides e vídeo de treinamento da USAV.

Sugestão: pedir o manual atual e o guia dos apps à Data Project/Genius Sports e o guia de mesa ao VolleyStation, antes de fechar a especificação.
