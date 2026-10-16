# 05 - UX: fluxos e personas (volei.space)

Agente: ux. Data: 2026-10-16. Somente leitura. Legenda: **[V]** verificado no código · **[AP]** aprovado e pendente · **HIP** hipótese a validar.

Fontes: `PROMPT-volei-space.md` (linhas 136-241), `01-diagnostico-volei-space.md`, `15-ux-meu-time-e-inscricao.md`, `CLAUDE.md`; código: `src/app/sumula/[token]/lancar/page.tsx`, `src/components/sumula/OrigemPontoModal.tsx`, `src/components/inscricao-rapida/FormularioInscricaoRapida.tsx`, `src/app/capitao/page.tsx`, `src/app/cadastro/page.tsx`, `src/app/login/login-screen.tsx`, `src/app/arbitro/jogo/[token]/page.tsx`, `src/app/partidas/[id]/ao-vivo/LiveMatchView.tsx`, `src/app/globals.css`.

Limites: pasta do vault (`04-FLUXOS`, `09-UI-UX`) e `docs/requisitos/*` não foram achadas neste checkout; frontend e designer devem conferir. O relatório 15 já cobre a inscrição; aqui as referências de linha de `FormularioInscricaoRapida.tsx` foram reconferidas. Sem dado de usuário real: tempos e taxas são metas ou hipóteses.

## 1. Personas (hipóteses de trabalho)

| Persona | Contexto | Dispositivo | Quer | Medo | Tarefa crítica |
|---|---|---|---|---|---|
| Apontador | Lança a súmula durante o jogo | Celular/tablet, em pé, luz ruim | Não perder ponto nem errar rotação | Travar, perder o jogo | Ponto, saque e substituição sem tirar o olho da quadra |
| Árbitro | Valida a súmula | Celular, link e código no WhatsApp | Entrar rápido no jogo certo | Código inválido | Consultar a súmula em tempo real |
| Técnico / líder | Cadastra tudo, sozinho | Celular, intervalo do treino | Inscrever sem retrabalho | Perder o cadastro | Time + 10 atletas em < 5 min; papeleta |
| Organizador | Cria e controla campeonatos | Notebook e celular | Ver o que falta e cobrar | Equipe errada, vazamento entre organizadores | Gerar link por categoria, acompanhar inscritos, publicar tabela |
| Torcedor | Acompanha de longe | Celular, rede instável | Placar atual | Placar travado | Ver o placar sem conta |
| Imprensa | Narrador/streamer | Notebook/OBS | Placar limpo | Overlay quebrar | Overlay e telão (**não existe hoje**, módulo 6 do PROMPT) |

Atleta: opcional no MVP, fora desta tabela.

## 2. Fluxos críticos

### 2.1 Súmula ao vivo em 1 toque
Meta: ponto simples em 1 toque; origem e atleta depois; desfazer em 1 toque.

Hoje [V]: todo ponto exige no mínimo 2 toques. "+1" chama `abrirOrigem` (`lancar/page.tsx:1939-1941,1971,1993`), abre `OrigemPontoModal` com pré-marcações (`OrigemPontoModal.tsx:30-31,58,69`) e exige "Registrar +1" (`:76`). Atleta errado = 3 a 4 toques. O ACE já é 1 toque (`:2720-2721`). `logPoint` sem atleta existe (`:421-424`), mas nenhum botão da tela principal o chama.

Proposto: (1) "+1" grava na hora como ponto coletivo; (2) faixa de 5 s "Ponto do Time A. Quem fez? [Saque] [Ataque] [Bloqueio]" que não bloqueia; (3) tocar na faixa abre o modal; (4) "Desfazer ponto do Time A" visível 5 s; (5) fim de set mantém `setEndPrompt` (`:456-463`).

Medidas: toques por ponto (mediana 1, p90 2); ponto até placar < 1 s; % com origem preenchida (HIP 70%); pontos desfeitos por jogo. Risco: scout incompleto se a origem for opcional; decidir com o dono.

### 2.2 Substituição em até 3 toques
Hoje [V]: ícone de troca (`:3020`, `askSubstitution :714-718`) → modal "Substituir atleta" com todo o elenco (`:3178`) → toque no que entra (`:732`) = 2 toques. Problemas: alvo de 28 a 32 px; bloqueados apagados sem motivo; sem contador "troca 3 de 8"; limite só avisa depois (`:753-755`).

Proposto: toque na camisa inteira; lista só de quem pode entrar com "Troca 3 de 8 · Time A"; seção "Não pode entrar agora" com motivo; gravação com "Desfazer" por 5 s; troca de líbero rotulada "(não conta nas 8)". Medidas: toques (mediana 2, máx. 3); erros por jogo; tempo < 8 s (HIP).

Divergência de regra: o código cria bloqueio de par também na troca de líbero (`:787-802`) e exige líbero inicial (`:588-591`); o requisito aprovado diz que não ([01] §3.5).

### 2.3 Onboarding
Hoje [V]: `/cadastro` sem parâmetro leva à página do organizador (`cadastro/page.tsx:157-161`); `/login` tem "escolha" e "membro" (`login-screen.tsx:93-115`) sem a pergunta "O que você quer fazer hoje?"; o painel pode abrir com "Sua conta é só para visualizar" (`painel/page.tsx:172,198`).

Proposto (HIP): (1) entrada por link de organizador: convite → "Começar" → criar time, sem pergunta; (2) entrada pelo site: uma pergunta com 3 botões (Cadastrar meu time / Organizar um campeonato / Recebi um convite); (3) nunca painel vazio; (4) árbitro e apontador entram pelo link do jogo; (5) torcedor sem onboarding.

### 2.4 Meu Time
Hoje [V]: a área não existe; há formulário rápido por link e `/capitao`; o elenco só existe dentro da inscrição. Alvo [AP] (PROMPT 166-195): abas Atletas, Comissão técnica, Dados do time, Inscrições; cartão de prontidão; 4 formas de adicionar atletas (colar lista, planilha, convite, um por um). Medidas: % de times com 6+ atletas usando "colar lista" (HIP 70%); % de times com 2+ inscrições reaproveitando o banco (HIP 50%).

### 2.5 Assistente de inscrição de 4 passos
Passos (PROMPT 197-206): confirmar o time; escolher atletas (camisa, capitão, líbero); comissão técnica; revisar e enviar. Decisão aprovada ([15] §0): o link do organizador continua a porta de entrada, o líder cadastra direto, **sem aprovação**; o desenho usa "Inscrição confirmada", "Confirmada, com pendências" e "Ajuste pedido pelo organizador", não "Aprovada/Recusada/Em análise".

Passo 2: contador fixo "10 escolhidos · mínimo 6 · máximo 14 · líberos 1 de 2"; atletas inelegíveis apagados com o motivo; "+ Novo atleta"; se o botão estiver desabilitado, a frase do motivo aparece acima dele.

## 3. Jornada atual do líder no celular [V]
1. Abre o link da categoria no WhatsApp.
2. Tela 1: só o nome da equipe, "Iniciar e salvar cadastro" (`FormularioInscricaoRapida.tsx:339`).
3. Recarrega em outra URL; em letra miúda: "Use este link para continuar o cadastro depois" (`:368`). Sem conta, o link é a única forma de voltar.
4. Tela 2: "Nome do torneio" aparece como campo bloqueado (`:336,379`).
5. "Novo jogador" abre mini-formulário de um atleta por vez (`:385-395`), repetido 10 vezes.
6. "Concluir inscrição" (`:398`); erro genérico no topo (`:312,316`).
7. Mensagem final menciona aprovação (`:354,370`), em tensão com a regra "sem aprovação".

Tempo: HIP, não medido.

## 4. Lacunas de usabilidade

### Crítico
| # | Lacuna | Onde |
|---|---|---|
| U1 | Ponto exige sempre abrir modal (mín. 2 toques); `logPoint` sem atleta não é acionado | `lancar/page.tsx:1971,1993,1939,419-424`; `OrigemPontoModal.tsx:76` |
| U2 | Falha de rede de 2 s derruba a tela do torcedor ("Partida indisponível") mesmo com dados carregados | `LiveMatchView.tsx:61-65,95-98` |
| U3 | Sem contador de elenco; mín./máx. só como erro após "Concluir" | `FormularioInscricaoRapida.tsx:398`; `team-registration-draft.ts:340,370,395-396` |
| U4 | Atletas um por vez, sem colar lista | `FormularioInscricaoRapida.tsx:385-395` |
| U5 | `/capitao` ainda exige aprovação ("Elenco aguardando aprovação"), contra a regra aprovada | `capitao/page.tsx:189,445,456,562-564` |
| U6 | Link de rascunho é a única "conta"; perder a mensagem é perder o time | `FormularioInscricaoRapida.tsx:368` |

### Alto
| # | Lacuna | Onde |
|---|---|---|
| U7 | Alvos de toque pequenos (28 a 32 px, fonte 9 a 10 px; "+1" mobile 34 a 36 px) | `globals.css:5460-5471,5629-5632,10984-10988,16663-16667,16735-16748` |
| U8 | Modal de troca lista todo o elenco, sem motivo do bloqueio nem contador | `lancar/page.tsx:3178,3190,3197-3201,752-755` |
| U9 | `/cadastro` sem parâmetro manda o técnico à página do organizador | `cadastro/page.tsx:157-161` |
| U10 | Erro técnico ao enviar foto ("Verifique o bucket ... no Supabase") | `FormularioInscricaoRapida.tsx:105` |
| U11 | Erro de "concluir" genérico, não leva ao atleta com problema | `FormularioInscricaoRapida.tsx:312,316`; `team-registration-draft.ts:406` |
| U12 | "Concluir inscrição" desabilita sem explicar | `FormularioInscricaoRapida.tsx:398` |
| U13 | Textos de aprovação na tela final | `FormularioInscricaoRapida.tsx:354,370` |
| U14 | Escalação do set trava com toasts passageiros | `lancar/page.tsx:588-591,584,321` |
| U15 | `/capitao` com termos técnicos ("CIN", "CTPS") | `capitao/page.tsx:78-79` |

### Médio
| # | Lacuna | Onde |
|---|---|---|
| U16 | "Nome do torneio" bloqueado parece editável | `FormularioInscricaoRapida.tsx:336,379` |
| U17 | Jargão ("Criando link", "Concluindo"); "Falha ao salvar" sem ação | `FormularioInscricaoRapida.tsx:339,374` |
| U18 | Copiar link sem tratamento de erro | `FormularioInscricaoRapida.tsx:321` |
| U19 | Remover jogador sem confirmação nem desfazer | `FormularioInscricaoRapida.tsx:284` |
| U20 | Login sem "Esqueci minha senha" | `login-screen.tsx:43` |
| U21 | Código do árbitro sem formato nem origem; erro genérico de rede | `arbitro/jogo/[token]/page.tsx:96-105,69` |
| U22 | `/inscricao-rapida` sem token vira beco ("Use o link da categoria") | `inscricao-rapida/page.tsx:8-11` |
| U23 | Ação principal do painel aprovado é "Ver página inicial" | `capitao/page.tsx:419` |

Pontos fortes a preservar: autosave do rascunho; atleta pré-selecionado no modal de ponto (`OrigemPontoModal.tsx:31`); restauração do histórico de trocas (`lancar/page.tsx:238-239`); `aria-label` nos botões de ponto e cartão; estados de link revogado/inválido na página do árbitro.

## 5. Metas de usabilidade
| Tarefa | Métrica | Meta |
|---|---|---|
| Time + 10 atletas, celular, quem nunca usou | Tempo (mediana) | < 5 min (p90 < 8) |
| Inscrição com time já cadastrado | Tempo | < 3 min |
| Conclusão sem ajuda | % | >= 90% |
| Convite aberto até inscrição enviada em 7 dias | Taxa | >= 60% (HIP) |
| Ponto simples | Toques | 1 (p90 2) |
| Substituição | Toques | <= 3 (mediana 2) |
| Desfazer ponto ou troca | Toques | 1 |
| Alvos de toque na súmula | Tamanho | >= 44 px (HIP) |
| Erros por sessão do líder | Média | < 1; nenhum erro técnico |
| Placar ao vivo | Atraso | < 3 s; sem tela de erro por falha isolada |
| Árbitro entra no jogo | Tempo | < 30 s (HIP) |
| Satisfação | 1 a 5 | Mediana >= 4 |

## 6. Como validar
1. Linha de base: 5 técnicos reais cadastram time com 10 atletas a partir da lista do WhatsApp, no próprio celular; cronometrar e contar toques.
2. Súmula: 3 apontadores em jogo simulado, tablet e celular.
3. Textos: 8 mensagens de erro, "o que você faria agora?" (meta 90%).
4. Torcedor: tela ao vivo alternando 4G e sem sinal (lacuna U2).
5. Instrumentar eventos sem dados pessoais: `convite_aberto`, `time_criado`, `lista_colada`, `inscricao_enviada`, `erro_exibido`, `ponto_registrado`, `troca_registrada`, `desfazer_usado`.

## 7. Prioridades (para frontend e designer)
**P0:** ponto em 1 toque (U1); manter último placar do torcedor (U2); contador de elenco e botão com motivo (U3, U12); colar lista (U4); retirar aprovação de `/capitao` e da tela final (U5, U13).
**P1:** modal de troca com contador e motivos, alvos maiores (U7, U8); conta leve do time ligada ao convite e destino de `/cadastro` (U6, U9); trocar mensagens técnicas (U10, U15, U16, U17); erro que leve ao atleta com problema (U11).
**P2:** login com "Esqueci minha senha" e ajuda no código do árbitro (U20, U21); remover jogador com desfazer (U18, U19); overlay para imprensa.

## 8. Perguntas ao dono do produto
1. A origem do ponto é obrigatória para o scout?
2. O líbero inicial é obrigatório? (código exige; requisito aprovado diz que não)
3. Foto e documento bloqueiam o envio ou viram pendência com prazo?
4. Login do líder: e-mail e senha, ou código por e-mail/WhatsApp (PROMPT 160)?
5. Qual dispositivo o apontador usa (celular ou tablet)?
