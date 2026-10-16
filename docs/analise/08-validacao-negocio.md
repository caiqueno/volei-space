# 08 - Validação de negócio do volei.space

Agente: `analista-negocio`. Data: 16/10/2026. Escopo: leitura do repositório e pesquisa web. Nenhum código foi alterado.

**Escala de confiança usada:** Alta (fonte primária, dado verificado), Média (fonte secundária coerente ou dado do repositório), Baixa (blog, agregador, página incompleta ou inferência minha). Tudo marcado como **HIPÓTESE** precisa ser validado em entrevista. Não encontrei pesquisa de mercado quantitativa sobre organizadores de vôlei no Brasil; os tamanhos de segmento abaixo são qualitativos de propósito.

## 0. Limites desta pesquisa (leia primeiro)

- As buscas não devolveram páginas oficiais de preço da Sympla, Even3, SporTI, VolleyStation nem de federações estaduais. Os preços abaixo vêm de terceiros e estão marcados com confiança.
- Não encontrei dado público sobre como cada federação estadual faz inscrição hoje. O que há são regulamentos (ver 2.1). O restante é hipótese a validar nas entrevistas.
- Os documentos do repositório que li: `CLAUDE.md`, `docs/PROMPT-volei-space.md` (agente 8 e seção "Experiência prioritária"), `01-PRODUTO`, `03-REGRAS-DE-NEGOCIO`, `10-ROADMAP`, `13-TRIAGEM-PRODUTO`, `modulos/INSCRICOES` e `docs/requisitos/INSCRICOES-POR-EQUIPE.md`, além da listagem de `src/app`.

## 1. Segmentos, dores e hipótese de valor

| Segmento | Quem decide / paga | Dor provável (HIPÓTESE, exceto onde há fonte) | O que faria trocar | Prioridade MVP |
|---|---|---|---|---|
| **Organizador independente / liga amadora** (arena, professor, dono de quadra, grupo de amigos que virou liga) | Uma pessoa, paga do próprio bolso ou da taxa dos times | Inscrição por WhatsApp e planilha, cobrança manual por Pix, tabela refeita à mão, súmula em papel digitada depois, briga de classificação. Estudos acadêmicos descrevem campeonatos amadores dependendo de listas impressas, planilhas e anotações espalhadas [1][2] (confiança Média) | Montar categoria, receber inscrição e publicar tabela em uma tarde, sem cobrar por jogo | **Alta (cliente do MVP)** |
| **Organização com várias categorias** (copas de clubes, festivais, sub-13 a adulto) | Organizador com equipe pequena | Mesmo problema multiplicado por categoria; elegibilidade por idade e naipe; separar tabelas | Isolamento por categoria e painel por categoria (o repositório já tem `CategoriaCampeonato`) | **Alta** |
| **Campeonato escolar / municipal** (secretaria de esportes, escola, JEBs locais) | Secretaria ou diretoria; compra por edital ou contratação direta | Termos de referência municipais pedem site 24 h com tabela, súmulas digitalizadas, classificação e estatísticas [3][4] (Média). Compra é burocrática e lenta | Atender o termo de referência com preço por evento | Média (canal, não MVP) |
| **Universitário** (atléticas, ligas universitárias, JUBs) | Atlética ou federação universitária | Cadastro de atletas em sistema próprio da confederação [5] (Baixa: um edital) e organização local por planilha | Reuso do elenco entre torneios; pouco provável trocar o sistema oficial | Baixa |
| **Torneio empresarial / confraternização** | RH ou grupo informal | Evento curto, pouco tempo, quer tabela bonita e link para compartilhar | Simplicidade extrema | Média, entra como organizador independente |
| **Clube com várias equipes** | Dirigente | Reenviar elenco a cada competição; controlar documentos de atletas menores | "Cadastrar uma vez, usar sempre" (princípio 4 do prompt) | Fase 2 (hoje o banco de atletas não é do clube no código) |
| **Federação estadual** | Diretoria; ciclo anual; processo político | Regulamentos mostram inscrição por ofício e comprovante de taxa, e confirmação só no Congresso Técnico [6] (Média). O sistema próprio pode existir ou não; não verifiquei | Integração com cadastro oficial de atletas, relatório de homologação, súmula aceita pela CBV | **Fora do MVP**; só depois de provar com organizadores |
| **Técnico / líder de equipe** | Não paga | Receber link, cadastrar 12 atletas no celular, saber o status. Dor nº 1 do funil | Menos de 5 min no celular, sem criar conta complicada | **Crítico (é o funil)**, mas não é quem paga |
| **Apontador / árbitro** | Organizador | Súmula em papel com regras de rotação e substituição | Validação em tempo real, PDF oficial | Núcleo do produto, mas depende de validação de campo |

Observação importante: quem paga (organizador) e quem determina a conversão (líder da equipe) são pessoas diferentes. O sucesso do produto é medido no líder, o pagamento vem do organizador.

## 2. Mercado, concorrentes e alternativas

### 2.1 Como se faz hoje

- **Planilha + WhatsApp (status quo dominante, HIPÓTESE forte).** Corroborado por TCCs e estudos sobre organização amadora [1][2] (Média). Concorrente real número um: custo zero e hábito.
- **Federações estaduais:** regulamentos publicados em PDF. Exemplo do Paraná: prazo fixo de inscrição das entidades filiadas, documento oficial, naipe e categoria, comprovante da taxa; a equipe só é participante após o Congresso Técnico [6]. A federação do RN publica regulamento anual [7]. Um regulamento estadual (FNV sub-21, 2024) e o de uma copa regional estão hospedados no painel SporTI, e o segundo diz que a inscrição é feita pela plataforma [7][8]; isso indica que ao menos algumas federações e copas usam plataforma terceirizada (Média).
- **CBV (alto nível):** a Superliga 2025/26 anunciou estatística em tempo real, súmula eletrônica e desafio padronizado no modelo da VolleyStation [9] (Média, fonte jornalística). Existe guia de preenchimento de súmula em papel padronizado com CBV/COBRAV, atualizado em 2025 [10] (Baixa-Média).
- **Organizações escolares:** regulamentos dos JEBs trazem capítulo de prazos e procedimentos de inscrição [11] (Alta quanto à existência; não verifiquei o sistema).

### 2.2 Concorrentes e alternativas

| Alternativa | O que faz | Preço (referência) | Confiança | Lacuna que o volei.space pode ocupar |
|---|---|---|---|---|
| **SporTI (Multisports)** | Gestão de torneios, ligas e federações em dezenas de modalidades; "Pay" beta para boleto e cartão; declara 150 mil atletas, 5 mil equipes, 1 mil competições desde 2016 [12] | Não publicado; exige agendar treinamento e plano | Média (site oficial, sem preço) | Genérico para dezenas de modalidades; não verifiquei súmula de vôlei com regras FIVB. O concorrente direto mais forte que encontrei |
| **Copa Fácil** (app/web) | Cadastro de equipes por link de convite, tabelas, súmula/relatórios impressos, estatísticas, patrocinadores, categorias por idade e naipe, muitas modalidades [13] | Grátis para começar; assinaturas de R$ 20,90/mês a R$ 122,90/semestre e R$ 59,90 "organizador profissional" [13] | Alta (App Store) | Genérico; sem validação de regras de vôlei. **Define o teto de preço do organizador pequeno** |
| **Campeonato Fácil, Winner, Torneios (apps)** | Chaveamento e tabela | Gratuito; Winner PRO de US$ 1,49 a 4,49 por 1 a 3 meses [14] | Média | Mostram que o organizador pequeno está acostumado com valores mensais irrisórios |
| **Sympla** | Ingressos e inscrições pagas, usada em maratonas [15] | Terceiros citam 10% com mínimo de R$ 2,50 por ingresso pago, já com meio de pagamento; organizador escolhe quem paga a taxa [16] | Baixa-Média (não achei a página oficial) | Sem noção de elenco, categoria, idade ou súmula |
| **Even3** | Eventos acadêmicos; inscrição e programação | Dealroom cita modelo freemium com 10% de comissão em ingresso pago [17] | Baixa | Idem Sympla; forte no meio universitário |
| **Data Volley (Data Project)** | Scout e estatística profissional; formato `.dvw` | Página americana lista "a partir de US$ 199" sem detalhar licença [18] | Baixa | Não concorre em inscrição; é integração futura (exportação `.dvw`) |
| **VolleyStation** | Coleta de dados e gestão de competição, usada pela FIVB/Volleyball World [19] e na Superliga [9] | Sem preço público; blog diz grátis em teste, sem data [20] | Baixa | Concorrente/parceiro no topo; não atende o amador |
| **TeamSnap** (referência internacional) | Gestão de times | US$ 69,99 a 129,99 por time/ano; liga a partir de US$ 599/ano [21] | Média (agregador) | Referência de que "por time" também é viável |
| **Google Forms + Sheets + WhatsApp** | Inscrição e lista | Grátis | Alta (conhecimento geral) | Concorrente real; perde em edição, documento, prontidão e histórico |

Conclusão: o espaço **não é vazio** (SporTI e Copa Fácil já existem no Brasil), mas não encontrei ninguém posicionado em "vôlei com regras e súmula validadas + inscrição guiada". Esse posicionamento é a aposta. Confiança: Baixa-Média, pois minha busca foi curta; fazer uma varredura de 2 horas em lojas de aplicativos e no Google antes da decisão.

### 2.3 Preços praticados (síntese)

- Ferramenta para organizador pequeno: R$ 20 a R$ 60/mês, ou grátis com anúncio (Copa Fácil) [13].
- Plataforma de inscrição: ~10% sobre inscrição paga, mínimo R$ 2,50 (Sympla) [16], valores de terceiros.
- Taxa de inscrição de equipe pelo organizador: único dado concreto é um edital de futebol amador de 2026 com R$ 500 por equipe [22] (Média; é outro esporte). Não achei taxa de vôlei amador com valor explícito; **perguntar nas entrevistas**.
- Custo do meio de pagamento: guias de 2026 citam Pix online entre 0% e 0,99% no Mercado Pago, variando por oferta [23] (Baixa). Cartão costuma ficar na faixa de alguns por cento; confirmar nas páginas oficiais antes de fixar preço.

## 3. Roteiro de entrevistas

Meta: 15 a 20 entrevistas de 30 min em 3 semanas, antes de abrir novas frentes grandes. Gravar com consentimento. Não demonstrar o produto nos primeiros 20 minutos.

**Amostra:** 6 organizadores independentes/ligas; 3 organizadores de copas multi-categoria; 2 secretarias/escolas; 4 técnicos/líderes de equipe; 3 apontadores/árbitros; 2 pessoas de federação estadual (1 grande, 1 pequena).

### 3.1 Organizador (liga, copa, escola)
1. Conte o último campeonato que você organizou, do primeiro contato até o troféu. Quantas equipes, categorias, jogos, dias?
2. Como as equipes se inscreveram? Por onde chegou cada informação (WhatsApp, planilha, formulário, papel)? Quantas mensagens até a lista fechar?
3. Qual foi o maior problema de inscrição (documento faltando, atleta duplicado, idade, pagamento, desistência)? O que isso custou em horas ou dinheiro?
4. Como cobra a taxa? Valor por equipe, por atleta, por categoria? Quanto fica com você? Quem paga a arbitragem?
5. Como a súmula é feita e quem digita o resultado? Já houve erro de rotação, substituição ou classificação contestada?
6. Que ferramenta já usou (planilha, Copa Fácil, SporTI, outras)? Quanto pagou? Por que parou?
7. Se existisse uma ferramenta, o que ela teria que fazer para você abandonar o que usa hoje? O que seria motivo para **não** trocar?
8. Quanto pagaria por campeonato, por categoria ou por mês? Aceitaria cobrar uma taxa pequena do time pela inscrição paga pela plataforma? Quem absorveria o custo do Pix/cartão?
9. Quem mais decide (dono da quadra, patrocinador, federação)?
10. **Teste da regra aprovada:** "Se você mandasse um link para o líder do time e ele cadastrasse o time sozinho, entrando direto no campeonato, o que te preocuparia?" (anote: time duplicado, menor sem autorização, time que não paga, vagas esgotadas, time rival se inscrevendo).

### 3.2 Técnico / líder de equipe
1. Última vez que inscreveu um time num campeonato: como foi, no celular ou no computador? Quanto tempo levou?
2. Onde estão os dados dos atletas (WhatsApp, planilha, papel)? Quem reúne documento e foto?
3. O que já deu errado (atleta barrado, número repetido, prazo perdido)?
4. Você usaria um link do organizador para criar a equipe na hora? O que o faria desistir no meio?
5. Quantas competições seu time disputa por ano? Reaproveitar o elenco entre elas seria útil?
6. Quem paga a inscrição? Pagaria por Pix na própria tela? Aceitaria uma taxa de serviço?
7. Teste de usabilidade (5 pessoas, celular, sem ajuda): "cadastre este time com 10 atletas a partir deste link". Cronometrar e anotar travas. Meta do prompt: menos de 5 min, 90% concluem sem ajuda.

### 3.3 Apontador / árbitro
1. Como é a súmula hoje (papel, planilha, tablet)? Quanto tempo sobra para fechar depois do jogo?
2. Erros mais comuns e quem corrige?
3. Há internet no ginásio? Que aparelho usa?
4. O que o sistema teria que impedir ou avisar para ajudar de verdade, e o que o irritaria (muitos toques, bloqueio indevido)?
5. Aceitaria operar a súmula sem treinamento? Em quanto tempo de aprendizado desistiria?

### 3.4 Federação ou secretaria
1. Como as equipes se filiam e se inscrevem? Há sistema próprio ou terceirizado? Quem opera?
2. Quais documentos são obrigatórios e como são conferidos?
3. Como a súmula chega à federação e quanto tempo leva a homologação?
4. Como decide comprar software (verba, licitação, assembleia)? Ciclo e valor típico?
5. O que impediria usar uma plataforma terceira em competições pequenas, sem ferir o regulamento?

### 3.5 O que registrar
Em cada entrevista: o que paga hoje, o que irrita, o gatilho de troca, valor citado, frases literais. Sintetizar em uma matriz de padrões após cada 5 entrevistas. Critério de parar: três entrevistas seguidas sem informação nova.

## 4. Modelo de receita

### 4.1 Hipótese principal
1. **Time e atleta: grátis.** Eles são o funil, e ninguém organiza um campeonato se os times têm atrito.
2. **Organizador paga por competição (por categoria) no MVP.** O repositório já soma o preço do organizador por categoria com um valor único de ativação [`03-REGRAS-DE-NEGOCIO`]; porém o pagamento ainda é simulado e a InfinitePay não conclui cobrança [`13-TRIAGEM-PRODUTO`]. Cobrar de verdade é o primeiro teste de disposição a pagar.
3. **Assinatura do organizador** (mensal/anual) só depois que houver recorrência: quem faz 4+ competições por ano.
4. **Plano anual para federação/secretaria** depois de duas ou três competições-piloto.
5. **Taxa sobre inscrição paga pela plataforma**: avaliar como segunda perna, não como a principal.

### 4.2 Números de referência (todos HIPÓTESES a validar)

| Item | Faixa inicial a testar | Ancoragem |
|---|---|---|
| Ativação por categoria (organizador) | R$ 49 a R$ 149 por categoria | Teto do organizador pequeno ~R$ 21 a R$ 60/mês nos apps [13]; torneio multi-categoria aceita mais |
| Assinatura organizador profissional | R$ 59 a R$ 149/mês ou R$ 590 a R$ 1.490/ano | Copa Fácil "profissional" R$ 59,90 [13]; diferencial é súmula validada |
| Plano federação / secretaria | R$ 6.000 a R$ 24.000/ano, por pacote de competições | Sem fonte; só validar em entrevista; TeamSnap liga parte de US$ 599/ano [21] como piso internacional |
| Taxa sobre inscrição paga | 3% a 5% sobre o valor, mais repasse do custo do meio de pagamento | Sympla cita ~10% [16] (é teto); abaixo disso é argumento de venda |

**Exemplo de conta (ilustrativo):** categoria com 8 equipes a R$ 300 = R$ 2.400 de inscrições. Taxa de 4% = R$ 96, valor próximo ao de uma ativação de R$ 99. Ou seja, taxa e ativação rendem parecido numa categoria média; a taxa cresce com a competição e é paga "dentro" da inscrição, mas carrega risco de o organizador mover o pagamento para fora (Pix direto). Uma categoria de 6 equipes grátis (sem taxa) deve ficar na camada gratuita ou de baixo custo.

### 4.3 Justificativa e riscos do modelo
- **Por que por competição:** o uso é sazonal; assinatura mensal para quem organiza um torneio por trimestre gera cancelamento. Fora do vôlei amador, o hábito de pagar mensalmente já existe (Copa Fácil).
- **Taxa de inscrição:** alinha receita ao valor entregue, mas expõe o produto a (a) custo e burocracia de repasse (marketplace, conta de pagamento, nota fiscal, estorno), (b) fuga para Pix manual. Só entra depois de o fluxo de inscrição estar validado. **Não fazer split de pagamento no MVP.**
- **Não cobrar o time**, nem o atleta. Se o líder precisar pagar a plataforma, o funil quebra.
- **Cuidado jurídico:** cobrar taxa de menores e tratar documentos exige LGPD; há projeto de lei para isentar atletas de baixa renda de taxas de inscrição [24] (Baixa; em tramitação), sinal de sensibilidade política a taxas.

## 5. O que fica FORA do MVP

Premissa: o MVP prova uma coisa, "um organizador independente cria um campeonato com 2+ categorias, recebe equipes por link, joga e publica resultado em menos de uma semana de trabalho dele".

**Fora do MVP:**
1. Contas e planos para federação, integração com cadastro oficial CBV, homologação.
2. Banco de atletas do clube com várias equipes e a camada "Clube".
3. Área do atleta, convite ao atleta, autorização do responsável legal por menor (mantém-se foto/documento no formulário do líder).
4. Pagamento com split, cartão, boleto, reembolso e nota fiscal. Se houver cobrança de inscrição, só Pix simples confirmado manualmente ou link do organizador.
5. Notificações por WhatsApp (e-mail apenas).
6. Listas de espera, pedidos de troca pós-prazo, pendência com comentário (a menos que a entrevista mostre que é dor principal).
7. Escala de arbitragem completa, financeiro do árbitro, múltiplos papéis de equipe do organizador.
8. App de banco, desafio de vídeo, papeleta digital, scout com exportação `.dvw`, placar para transmissão, overlay.
9. Importação de planilha e colar lista com parser (candidato a primeira melhoria pós-MVP, ver 7.2).
10. Marketplace de competições e selo de elegibilidade nos cartões (a busca "Competições" pública só faz sentido com massa crítica de organizadores).
11. Vôlei de praia e variações de regra FIVB (confirmar com o agente de arbitragem o que a súmula já cobre).
12. Qualquer coisa herdada da LUVA: série Ouro/Prata, aprovação manual (já descartados em `13-TRIAGEM-PRODUTO`).

**Fica no MVP:** campeonato com categorias isoladas, convite por link, cadastro do líder com persistência, painel de acompanhamento por categoria, tabela/jogos, súmula com validação básica de sets, MVP e classificação, portal público, cobrança simples do organizador.

## 6. Métricas de sucesso

| Camada | Métrica | Meta inicial (HIPÓTESE) | Como medir |
|---|---|---|---|
| Ativação do líder | Tempo do clique no link até "cadastro concluído" (mediana) | < 10 min no celular; meta de teste do prompt < 5 min para 10 atletas | Eventos de funil por convite |
| Conversão | % de convites abertos que concluem | >= 60% em 7 dias | Convites gerados x concluídos |
| Abandono | Em que etapa o líder para | Nenhuma etapa com > 20% de saída | Funil por etapa |
| Sem ajuda | % de testes de usabilidade concluídos sem intervenção | >= 90% (prompt) | Teste moderado, 5 a 8 pessoas |
| Retomada | % que volta pelo mesmo link após salvar parcial | Medir; sem meta antes de ter linha de base | Sessões por convite |
| Organizador | Competições criadas por mês; % que publica tabela | 5 a 10 competições reais em 90 dias | Banco |
| Retenção do organizador | % que cria 2ª competição em 6 meses | >= 40% | Coorte |
| Produto principal | Partidas com súmula eletrônica oficializada / partidas totais | >= 70% nas competições piloto | Banco |
| Qualidade | Correções pós-oficialização por 100 jogos; erros de classificação reclamados | Tendência decrescente; meta 0 reclamação procedente | Log + feedback |
| Receita | Disposição a pagar confirmada (cobrança real realizada) | 3 organizadores pagantes em 90 dias | Pagamentos |
| Suporte | Chamados por competição | < 2 | Canal de suporte |

## 7. Riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Concorrente genérico bom e barato (Copa Fácil, SporTI) basta para o organizador | Alta | Alto | Posicionar em regras de vôlei, súmula validada e inscrição guiada; entrevistar usuários dessas ferramentas |
| R2 | Organizador não paga (hábito de grátis) | Média | Alto | Cobrança real cedo; preço de entrada baixo; provar valor no 1º campeonato |
| R3 | **Sem aprovação, entra equipe indesejada** (duplicada, fora de idade, spam, pagamento não feito) | Média | Alto | Ver seção 8: limite de vagas, link por convite, revisão a posteriori, remoção pelo organizador, aviso de elegibilidade |
| R4 | Vazamento ou má gestão de dados de menores (LGPD) | Média | Muito alto | Mínimo de dados no MVP; consentimento; isolamento por organizador (já é prioridade) |
| R5 | Súmula errada ou aceita só parcialmente por arbitragem | Média | Alto | Casos reais (agente 9), pilotos acompanhados, PDF revisado por delegado |
| R6 | Ginásio sem internet | Alta | Alto | Offline-first na súmula (prompt já pede); testar no campo |
| R7 | Escopo largo para equipe pequena (13 módulos no prompt) | Alta | Alto | Respeitar a lista de fora do MVP |
| R8 | Dependência de poucos organizadores-piloto | Média | Médio | 3 a 5 pilotos de perfis diferentes |
| R9 | Sazonalidade (calendário de campeonatos) | Média | Médio | Lançar piloto na janela de competições; modelo por competição |
| R10 | Custo e complexidade de pagamento (conta de pagamento, repasse, fiscal) | Média | Médio | Adiar split; validar com cobrança simples |
| R11 | Federações e CBV fecham o ecossistema (VolleyStation/CBV) | Baixa no amador | Médio | Foco no amador; exportação `.dvw` depois |
| R12 | Dívida técnica herdada (RLS desligado, dados de teste em produção, rótulos legados `Liga`) | Alta | Alto | Mantida em `12-BUGS` e `13-TRIAGEM`; revisar antes de abrir ao público |

## 8. Análise crítica: fluxo atual do repositório x fluxo ideal do prompt

### 8.1 Achado principal: o "Meu Time / Competições" do prompt ainda não existe no produto

- A listagem de `src/app` mostra rotas `painel` (organizador), `inscricao/{vaga,categoria,campeonato}`, `inscricao-rapida`, `capitao`, `equipes/[slug]`, `campeonatos`. Não há `meu-time`, nem área "Competições" com busca, nem banco de atletas do time. Uma busca textual por "Meu Time" em `src/` e nas notas do vault não retornou nenhum resultado.
- O produto atual é **orientado ao organizador**: `01-PRODUTO` diz que o produto "não organiza uma liga própria" e a triagem (`13`) afirma que "o produto que vale manter é o organizador operando o próprio campeonato". O prompt (seção "Experiência prioritária") descreve outro produto: **orientado ao time** (Meu Time, marketplace de competições, atleta reaproveitado entre competições, aprovação pelo organizador).
- **Isto é uma divergência estratégica, não um detalhe de tela.** O prompt fala de "N organizadores independentes" e de equipe que se inscreve em competições alheias (modelo marketplace). O repositório e as regras aprovadas descrevem um SaaS em que o organizador traz suas equipes. Para o MVP, a segunda abordagem é a mais realista (resolve o problema do cliente que paga), e a primeira é fase 2 (precisa de massa de organizadores).

### 8.2 Comparação ponto a ponto

| Tema | Fluxo ideal do prompt | Fluxo atual / regra aprovada (repo) | Avaliação |
|---|---|---|---|
| Porta de entrada | Pergunta "O que você quer fazer hoje?" e leva direto ao fluxo | Organizador entra por `/seja-membro` (candidatura); equipe entra por link (`/inscricao/vaga/{token}`) | Atual é mais simples para o piloto. Faltam login social/WhatsApp e escolha de perfil; fase 2 |
| Cadastro de time | 30 s: nome, cidade, naipe, escudo | Líder cadastra equipe e jogadores no próprio formulário do convite | Compatível para MVP; naipe vem da categoria do convite |
| Banco de atletas | Reaproveitado entre competições; cópia por inscrição | Elenco nasce dentro da inscrição daquele campeonato; não há banco de atletas do time | **Perda de valor "cadastre uma vez"**, mas aceitável no MVP |
| Inscrição | Assistente em 4 passos com elegibilidade e contador | Formulário único com rascunho persistente, validações de número, foto, nascimento e documento conforme campeonato | Atual cobre o essencial; falta feedback de prontidão |
| Aprovação | Rascunho -> Enviada -> Em análise -> Pendência -> Aprovada/Recusada/Lista de espera | **Sem aprovação**: concluir cria equipe e inscrição `APROVADA` direto | Decisão aprovada; ver 8.3 |
| Descoberta | "Competições" pública com filtros e selo de elegibilidade; competição privada por link | Portal público e links por categoria/vaga; sem busca por times | Marketplace fica fora do MVP |
| Edição pós-envio | Livre até o prazo; depois por pedido aprovado pelo organizador | Edição "quando a configuração do campeonato permitir" e retomada pelo mesmo link | Regra aprovada é mais simples; faltam critérios de prazo (ponto em aberto) |
| Link do organizador | Não descrito; o time vai atrás da competição | Convite exclusivo, por vaga/categoria, criado **antes** de existir `Equipe` | Ótimo para o piloto: organizador já conhece os times |
| Notificações | E-mail, WhatsApp, push | Não vi no escopo | Fora do MVP, mas o organizador precisa ver o andamento por categoria |
| Isolamento | Cada organizador só vê seus times | Já é prioridade (`13`: listar equipe/jogador filtrado por dono) | Alinhado |

### 8.3 Convite por link do organizador + cadastro direto sem aprovação: prós e contras

A regra aprovada permanece válida e é **boa para o MVP**; as observações abaixo servem para proteger a operação, não para derrubá-la.

**Prós**
1. Menor atrito para o líder: um link, sem esperar resposta. Atende o princípio "nenhum beco sem saída" e a meta de tempo até a primeira inscrição.
2. Reflete como o organizador independente trabalha hoje: ele já conhece os times e os chama pelo WhatsApp (HIPÓTESE; confirmar na entrevista 3.1 itens 2 e 10).
3. Retira trabalho do organizador (aprovar 20 times é uma fila nova) e evita o "gargalo do dono".
4. Token vinculado a campeonato + categoria + convite limita o dano: o líder não acessa outra equipe nem troca a categoria.
5. Rascunho persistente e atomicidade na conclusão reduzem duplicatas.
6. Ótimo para teste rápido: cria equipes em poucos minutos e permite medir o funil.

**Contras e riscos**
1. **Link vazado ou encaminhado**: sem expiração nem revogação (a regra proíbe presumir essas regras, item 8 do requisito), qualquer pessoa com o link cria a equipe. Mitigação sem violar a regra: o convite já é por equipe apontada e o servidor conta vagas. Sugerir a decisão de produto (não implementar por pressuposição): ao menos o organizador **poder excluir uma equipe** concluída por engano.
2. **Equipe inelegível entra** (atleta fora da idade, documento ausente, naipe errado). O sistema pode validar por regra (já valida número, foto, nascimento, documento) e emitir aviso, sem aprovação humana; o organizador acompanha por categoria.
3. **Sem aprovação não há filtro de qualidade** (nome ofensivo, equipe duplicada com outro nome). Nome repetido já é rejeitado na liga [`modulos/INSCRICOES`]; duplicidade semântica não.
4. **Pagamento**: no modelo ideal do prompt a aprovação liga ao pagamento. No atual, `APROVADA` imediata sem pagamento permite equipe inscrita que não pagou. No MVP, tratar cobrança como etapa do organizador fora do sistema, ou criar campo "pago" manual, e **não** transformar de volta em aprovação.
5. **Vagas e lista de espera**: cada categoria tem `quantidadeEquipes`; o link por vaga limita naturalmente (bom), mas o link por categoria (legado) pode ultrapassar. Garantir no servidor.
6. **Menores**: cadastro direto pelo líder, sem autorização do responsável, aumenta risco de LGPD. Para o piloto, termo de responsabilidade do líder na conclusão.
7. **Documentação conflitante**: `modulos/INSCRICOES` descreve três gerações de link (campeonato, categoria, vaga) e `status: misto`; `13-TRIAGEM` registra "link por categoria" como aplicado e o convite por vaga como pendente, enquanto a nota de 6/10 diz que o link por vaga já vale. Risco de implementação divergente. Consolidar em uma única nota "estado vigente".
8. **Perda do fluxo "Pendência"**: o organizador que antes corrigia pelo sistema agora corrige por WhatsApp. Aceitar no MVP.

**Recomendação:** manter a regra aprovada; tratá-la como "inscrição imediata com validação automática e revisão a posteriori". Acrescentar, sem exigir aprovação: (a) painel por categoria com alertas de elegibilidade; (b) ação do organizador de remover/ajustar equipe; (c) marcação de pagamento manual; (d) decidir com o dono do produto, e não por suposição, sobre revogação e validade do link (hoje intencionalmente indefinidas).

### 8.4 O que adotar do prompt mesmo com a regra aprovada

Compatível com sem-aprovação e de custo baixo: indicador de prontidão ("9 atletas, 2 sem documento"), contador de mínimo/máximo e líberos, colar lista do WhatsApp (maior ganho de tempo no celular), salvamento automático (já existe), explicação do motivo de erro. Isso preserva o princípio "o sistema avisa antes de errar" sem criar fila de aprovação.

### 8.5 Perguntas em aberto para o dono do produto

1. O produto-alvo do MVP é SaaS do organizador (estado atual) ou marketplace de times (prompt)? A resposta muda o roadmap.
2. Cobrança de inscrição pela plataforma entra no MVP ou o organizador cobra por fora?
3. Qual a política de remoção de equipe e de validade do link, se alguma?
4. A autorização de menores fica com o organizador ou com a plataforma?

## 9. Próximos passos sugeridos (ordem)

1. Rodar 8 entrevistas de organizadores e 4 de líderes (seção 3) antes de investir em notificações ou banco de atletas.
2. Teste de usabilidade com 5 líderes no celular usando o link por vaga atual; medir a meta de < 5 min.
3. Cobrar de fato 3 pilotos para validar disposição a pagar (substitui o pagamento simulado).
4. Varredura de concorrentes (SporTI, Copa Fácil, apps) com demo real, para confirmar a lacuna de regras de vôlei.
5. Consolidar a documentação de inscrição em um estado vigente.

## Fontes

[1] Trabalho UNIVAP sobre organização de partidas por WhatsApp: https://www.inicepg.univap.br/cd/INIC_2025/anais/arquivos/1147_0652_01.pdf (Média)
[2] TCC IFFar sobre campeonatos amadores com processos manuais: https://arandu.iffarroupilha.edu.br/bitstream/itemid/820/1/TCC%20MATHEUS%20NAZIAZENO%20-%202023318409.pdf (Média; li apenas o resumo retornado pela busca)
[3] Termo de referência, S. José dos Ausentes-RS: https://www.saojosedosausentes.rs.gov.br/wp-content/uploads/2025/06/TERMO-DE-REFERENCIA.pdf (Média)
[4] Termo de referência, Xanxerê-SC: https://xanxere.sc.gov.br/uploads/sites/92/2025/03/TERMO_DE_REFERENCIA.pdf (Média)
[5] Edital UFAC com cadastro no sistema da CBDU: https://www3.ufac.br/proex/2023/edital-ndeg06-2023-pro-esporte-jubs/edital-ndeg06-2023-pro-esporte-jubs.pdf (Baixa)
[6] Regulamento dos Campeonatos Paranaenses 2022: https://voleiparana.com.br/wp-content/uploads/2022/02/Regulamento-Campeonatos-Paranaenses-2022.pdf (Média)
[7] Regulamento Estadual FNV sub-21 feminino 2024 (hospedado em painel SporTI): https://painel.sporti.com.br//Documentos/2024/estadual-fnv-sub-21-feminino-2024/Regulamento/estadual-fnv-sub-21-feminino-2024.pdf (Média)
[8] Regulamento VI Copa Planalto (inscrição pela plataforma SporTI): https://painel.sporti.com.br//Documentos/2020/vi-copa-planalto/Regulamento/vi-copa-planalto.pdf (Média)
[9] Máquina do Esporte, panorama Superliga 2025/26: https://maquinadoesporte.com.br/volei/superliga-de-volei-2025-2026-o-panorama-comercial-e-dos-negocios-da-nova-temporada-do-torneio/ (Média)
[10] Guia de súmula padronizada (FMVolei): https://www.fmvolei.org.br/_files/ugd/ad26ed_54cec6b53a2b4c209604c6b0e0fbf99e.pdf (Baixa-Média; só vi a descrição na busca)
[11] Regulamento Geral JEBs Sub-14 2026 (CBDE): https://www.cbde.org.br/wp-content/uploads/2026/06/Regulamento-Geral-JEBs-Sub-14-2026.pdf (Alta quanto à existência do capítulo de inscrição)
[12] SporTI: https://www.sporti.com.br (Média)
[13] Copa Fácil, App Store Brasil: https://apps.apple.com/BR/app/id1444543396 (Alta)
[14] Winner e Campeonato Fácil, App Store: https://apps.apple.com/BR/app/id1453673502 e https://apps.apple.com/us/app/id6746036505 (Média)
[15] Sympla em maratona de BH: https://diariodocomercio.com.br/variedades/maratona-bh-inscricoes-abertas/ (Média)
[16] Taxa Sympla (terceiros): https://vocepergunta.com/library/artigo/read/425154-qual-a-taxa-do-sympla (Baixa)
[17] Even3 (Dealroom, comissão ~10%): https://app.dealroom.co/companies/even3 ; texto patrocinado InfoMoney: https://www.infomoney.com.br/patrocinados/%25marca%25/startup-chega-a-marca-de-100-mil-usuarios-com-plataforma-que-ajuda-a-organizar-eventos-cientificos (Baixa)
[18] Data Volley (Data Project): https://dataproject.com/Products/US/en/Pallavolo/DataVolley (Baixa quanto ao tipo de licença)
[19] FIVB e VolleyStation: https://sportbusiness.com/news/fivb-volleyball-world-tap-volleystation-as-data-collection-provider (Média)
[20] Blog VolleyStation: https://blog.volleystation.com/?p=119 (Baixa; sem data)
[21] TeamSnap (Capterra): https://www.capterra.co.uk/software/123208/teamsnap (Média)
[22] Edital 05/2026 futebol amador, São Gotardo-MG (R$ 500 por equipe): https://www.saogotardo.mg.gov.br/anexos/6a0710cb66c08_Edital_05_2026_-_Campeonato_Muncipal_de_Futebol_Amador_2026.pdf (Média, esporte diferente)
[23] Gateways no Brasil 2026: https://www.paritydeals.com/blog/best-payment-gateways-brazil-2026/ (Baixa)
[24] PL 4375/2024, isenção de taxas para atletas de baixa renda: https://www.camara.leg.br/enquetes/2469307 (Baixa)

Documentos internos citados: `CLAUDE.md`, `docs/PROMPT-volei-space.md`, `docs/requisitos/INSCRICOES-POR-EQUIPE.md`, e as notas `01-PRODUTO`, `03-REGRAS-DE-NEGOCIO`, `10-ROADMAP`, `13-TRIAGEM-PRODUTO`, `modulos/INSCRICOES` do vault "volei.space — Plataforma de Campeonatos de Vôlei".
