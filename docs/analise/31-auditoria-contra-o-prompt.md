# 31. Auditoria do código contra o `PROMPT-volei-space.md` (21/10/2026)

Método: leitura do MD e verificação no código da `cursor-teste` (busca por arquivo, rota e tabela). "Feito" quer dizer **implementado e testado na lógica**, atrás de flag e desligado por padrão. **Nada foi publicado**, e as telas novas nunca foram abertas num navegador. Itens marcados [parcial] têm a parte que falta descrita.

Legenda: ✅ feito · 🟡 parcial · ❌ não feito · ➖ fora do escopo (decisão do dono)

## 1. Módulos da plataforma final

| # | Módulo do MD | Estado | Evidência / o que falta |
|---|---|---|---|
| 1 | Meu Time e Competições (times, atletas, competições de vários organizadores, inscrições, escala de arbitragem) | 🟡 | Meu Time completo (`src/app/meu-time/**`); inscrição e aprovação por categoria; escala de arbitragem existe (legado). **Falta** explorar competições com filtros e valor (§3). |
| 2 | Papeleta digital (envio, validação, bloqueio) | ✅ | `src/lib/banco/papeleta-validacao.ts`, trigger de imutabilidade (migration 0034), tela `/banco/[token]` e pela conta. Segundo líbero incluído. |
| 3 | Súmula eletrônica (regras em tempo real) | ✅ | Motor `src/lib/regras-volei/**`, log imutável, `lancar/page.tsx`, offline-first atrás de flag. |
| 3b | "Súmula oficial sai em **PDF**" | 🟡 | Existe página A4 para **imprimir** (`/sumula/[token]/imprimir`); **não gera arquivo PDF** nem assinatura digital. Falta o PDF de verdade (gerar no servidor) e modelo fiel ao da CBV. |
| 4 | App de banco (tempo, substituição, desafio) | ✅ | `/banco/[token]` e aba Jogos do Meu Time; pedidos aceitos pelo apontador. |
| 5 | App do árbitro (consulta em tempo real) | ➖ | Existe `/arbitro/partida/[token]`, mas o dono disse que **não precisa**. Não remover `arbitro-access.ts` (o apontador usa). |
| 6 | Placar ao vivo (telão, site, overlay) | ✅ | `/ao-vivo/[id]`, `/placar/[id]?fundo=transparente` (overlay), `/partidas/[id]/ao-vivo`. |
| 7 | Scout com exportação `.dvw` | ➖ | Existe scout por toque e CSV/JSON; o dono disse que **não precisa**. `.dvw` nunca foi feito. |
| 8 | Desafio de vídeo (fase posterior) | ✅ | Fluxo registrado, opcional por ambiente; sem janela de 7 s nem lista de lances. |

## 2. "Experiência prioritária" (cadastro e inscrição)

### Princípios e onboarding
| Item | Estado | Evidência / falta |
|---|---|---|
| Entrar com **Google, e-mail ou código pelo WhatsApp, sem senha** | ❌ | Só e-mail + senha (`/login`). Nenhum login Google nem código por WhatsApp. É o maior desvio do MD. |
| Pergunta "O que você quer fazer hoje?" | ✅ | `/cadastro` sem parâmetro (`CHANGELOG`). |
| Troca de perfil no menu (mesma pessoa, vários perfis) | ❌ | Não existe seletor de perfil. |
| "Nenhum beco sem saída" (clicar em Participar sem time cria o time ali) | ✅ | Porta de entrada + "Criar meu time" volta à inscrição (R15). |
| Salva rascunho sozinho | ✅ | Rascunho do assistente de inscrição e do formulário legado. |

### Meu Time
| Item | Estado | Evidência / falta |
|---|---|---|
| Criar time em 30 s (nome, cidade, naipe, escudo) | ✅ | `CriarTime`. |
| Abas Atletas, Comissão técnica, Dados do time, Inscrições | ✅ | `DetalheTime.tsx`. |
| Dados do time: CNPJ, contato, cores, outros responsáveis | 🟡 | Só **membros com acesso** existem. **CNPJ foi retirado do escopo por decisão do dono** ("não preciso de CNPJ"); contato e cores do uniforme seguem na Rodada 17 (migration 0049 pendente). |
| Colar lista, importar planilha, link de convite, um por um | ✅ | `ImportarAtletas`, convites, CSV (R10). |
| Indicador de prontidão ("9 atletas, 2 sem documento") | ✅ | Prontidão no Meu Time. |
| Clube com várias equipes | ✅ | Clube e vínculo (R10). |
| **Foto, CPF, documento e telefone do atleta** | ❌ | Sem upload no Meu Time (assume o modelo antigo de equipe); sem CPF/telefone. **Bloqueia desligar o capitão.** |

### Competições e inscrição
| Item | Estado | Evidência / falta |
|---|---|---|
| **Explorar:** cartões com organizador, datas, cidade, vagas restantes, prazo, **valor**, **filtros** | 🟡 | Aba Campeonatos lista ofertas por equipe, **sem filtros de cidade/data/naipe**, sem vagas restantes e sem valor. |
| **Selo de elegibilidade** (✅ pode participar / ⚠️ faltam 2 atletas / ⛔ naipe) | 🟡 | Há regras de elegibilidade no servidor; o **selo no cartão** não aparece na vitrine nova. |
| Competição privada por link/código | ✅ | Visibilidade e convite (R7, R15). |
| Assistente de inscrição em 4 passos | ✅ | `AssistenteInscricao` (Confirmar time, Atletas, Comissão, Revisar). |
| Status: Rascunho → Enviada → **Em análise** → **Pendência** → Aprovada · Recusada · **Lista de espera** | 🟡 | Hoje: automática, ou solicitada → aprovada/recusada/cancelada. **Não há "Em análise" nem "Lista de espera"**, e o pedido de correção do organizador não está na fila nova. |
| Cópia própria da lista (mudar o banco não altera a inscrição enviada) | ✅ | `InscricaoAtleta`. |
| **Depois do prazo, troca vira pedido** aprovado pelo organizador | ❌ | A tabela `PedidoTroca` existe, **nenhum código a usa**. |
| Atleta não pode estar em dois times da mesma competição | ✅ | Bloqueio na inscrição. |
| Pagamento (Pix/cartão) e aceite do regulamento | 🟡 | Regulamento: sim. Pagamento: existe `PAGAMENTO_HABILITADO` e um endpoint de preço, mas está **desligado** e o webhook foi desativado por segurança. |
| Papeleta usa os atletas da inscrição aprovada | ✅ | Banco por conta depende do vínculo equipe legada ↔ time (R14b). |

### Visão do organizador
| Item | Estado | Evidência / falta |
|---|---|---|
| Criar competição em assistente | ✅ | `/painel/parametrizacao` (informações, categorias, inscrições, calendário, pagamento, prévia). |
| Modalidade quadra **ou praia** | ➖ | Só quadra, por decisão do dono. |
| **Regras de elenco com modelos prontos** (FIVB, CBV, Amador livre) | ❌ | A tabela `RegraElenco` e a regra no servidor existem; **não há tela** para o organizador escolher modelo/ min-máx/ idade/ documentos. |
| **Painel de inscrições**: filtros, aprovar em 1 clique, pedir correção com comentário, ver documentos, **exportar planilha/PDF** | 🟡 | Fila de solicitações aprova/recusa (R14); **falta** pedido de correção com comentário, visualização de documentos e **exportação das inscrições** (a única exportação é a do scout). |
| **Equipe do organizador** com papéis (administrador, financeiro, arbitragem) | 🟡 | Existe a tabela `MembroOrganizador`; a tela e o uso no código são limitados. |
| Privacidade entre organizadores | ✅ | Isolamento no servidor, testado. |

### Notificações
| Item | Estado |
|---|---|
| Notificações **dentro do app** (sino) | ✅ |
| **E-mail, WhatsApp e push** para aprovada, pendência, prazo em 48 h, tabela publicada, jogo amanhã | ❌ — só há e-mail transacional (recuperar senha, candidaturas). Sem WhatsApp, sem push, sem tarefas agendadas. |

### Navegação sugerida: `Início · Meu Time · Competições · Jogos · Perfil`
🟡 O Meu Time tem Minhas equipes, Atletas, Convites, Importar, Clube, Notificações, Campeonatos e Jogos. **Não há "Início" nem "Perfil"** como no MD.

### Metas de usabilidade
❌ Nunca foram medidas (nenhum teste com pessoas). Os tempos de 5 min e 3 min são só metas.

## 3. Fluxo, infraestrutura e "critérios de pronto"

| Critério | Estado | Evidência / falta |
|---|---|---|
| Onze relatórios em `docs/analise/` com fontes | ✅ | Existem 01 a 31. |
| Protótipo (primeiro acesso, Meu Time, Competições, assistente, organizador, papeleta, súmula, banco, placar) | 🟡 | `/prototipo` cobre 7 perfis; **faltam** primeiro acesso, explorar competições e o assistente de inscrição. |
| Teste com 5 pessoas que nunca usaram | ❌ | Não feito. |
| Analista de negócio aprovou o MVP e a receita | ❌ | Não feito (o relatório 08 existe, sem aprovação). |
| README: clonar, `setup`, `dev` com dados de exemplo em < 15 min | 🟡 | README tem `setup` e `dev`; **o seed não roda num banco vazio** (cria equipes sem id) e não há `docker-compose.yml`. |
| `CHANGELOG`, SemVer, CI (lint/test/build) em todo PR, **plano de volta testado** | 🟡 | CHANGELOG e CI existem; `package.json` ainda se chama `luva-platform` v0.1.0; plano de volta documentado, **nunca ensaiado**. |
| **`docker-compose.yml`** (entrega do agente 11) | ❌ | Não existe. |
| Contrato da API revisado | 🟡 | `07-api-contrato.yaml` e `20-contrato-meu-time.yaml`; as rotas das rodadas 9 a 15 **não estão no YAML**. |
| Decisões de stack com alternativas | ✅ | `12-arquitetura-alvo.md`. |
| Matriz de lacunas, roadmap priorizado, 5 diferenciais | ✅ | `04-gap-analysis-e-roadmap.md`. |

## 4. Resumo

- **Implementado e funcionando só na lógica:** o núcleo do jogo (súmula, rotação, papeleta, banco, placar), o Meu Time, a inscrição (automática ou com aprovação), os convites, a importação, o clube, a LGPD de menores e a segurança.
- **Principais lacunas do MD, em ordem de impacto:**
  1. Login sem senha (Google, WhatsApp) e troca de perfil.
  2. Upload de foto/documento e CPF/telefone do atleta no Meu Time.
  3. Regras de elenco com modelos prontos, na tela do organizador.
  4. Painel de inscrições do organizador completo (correção, documentos, exportação).
  5. Pedido de troca depois do prazo (`PedidoTroca`).
  6. Explorar competições com filtros, valor, vagas e selo de elegibilidade.
  7. Notificações por e-mail, WhatsApp e push, com avisos de prazo.
  8. PDF oficial da súmula.
  9. Pagamento (hoje desligado de propósito).
  10. `docker-compose.yml`, seed que funcione em banco vazio, nome do pacote.
- **Fora do código (não dá para "implantar" daqui):** testes com pessoas, aprovação do analista, plano de volta ensaiado, migrations em produção e a decisão de publicar na `main`.
