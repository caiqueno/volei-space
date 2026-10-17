# 25. LGPD de atletas menores no Meu Time (Rodada 8)

Status: implementação técnica no código e migration PENDENTE (`202610170032`). Este documento descreve o que o sistema faz. **Não é parecer jurídico.** Tudo que depende de interpretação da lei está na seção 6 e precisa ser validado pelo dono com um advogado antes de produção.

Origem: 13-revisao-seguranca.md (seção "LGPD e dados de menores") e 04 (G10). Contrato: 20-contrato-meu-time.yaml (v0.3.0). Migration: `supabase/pendentes/migrations/202610170032_lgpd_menores_consentimento.sql`.

## 1. O que o sistema registra

| Dado | Onde | Observação |
|---|---|---|
| Menor de 18 anos (`menor`) | calculado no servidor a cada leitura | a partir de `Atleta.dataNascimento`; nunca vem do cliente. Sem data (atleta de lote): `menor = false` e a pendência "falta nascimento" já existe |
| Autorização do responsável | `AtletaConsentimento` | uma linha por aceite; só uma ativa por atleta (índice único parcial) |
| Nome do responsável | `AtletaConsentimento.responsavelNome` | texto; nunca vai em `Atleta` nem na lista de atletas; a rota `/consentimentos` (RESPONSAVEL/TECNICO) o mostra |
| Contato do responsável | `AtletaConsentimento.responsavelContatoCifrado` | AES-256-GCM no aplicativo; chave em `LGPD_CHAVE_CIFRA`, fora do banco; **nenhuma rota devolve o contato**; sem chave a API recusa gravar (503) |
| Versão do termo, data/hora do aceite, quem registrou | `versaoTermo`, `aceitoEm`, `registradoPor` | versão vem de `src/lib/lgpd/termo.ts` (`TERMO_VERSAO`); texto atual é rascunho |
| Revogação | `revogadoEm`, `revogadoPor` | renovar o aceite revoga o anterior |
| Pedido de exclusão | `AtletaExclusaoPedido` | quem, quando, motivo (até 500), escopo (`ANONIMIZACAO` ou `VINCULO`), `concluidoEm`; sem FK, sobrevive à anonimização |
| Marca de anonimização | `Atleta.anonimizadoEm` | |

Já existentes (0025) e **fora do fluxo novo**: `AtletaDocumento.responsavelNome`, `responsavelContatoCifrado`, `consentimentoEm`, `consentimentoVersaoTermo`. Ficam sem uso; a anonimização apaga a linha inteira de `AtletaDocumento`. Decisão de técnica pendente: remover essas colunas numa migration futura (pedir ao agente de banco).

## 2. Comportamento da API

- `Atleta` devolve `menor` e `consentimentoPendente`. Nunca devolve dado do responsável.
- `POST /atletas` e `PATCH /atletas/:id` aceitam `responsavel {nome, contato}` + `aceiteResponsavel: true` (juntos). Para adulto: 422 `RESPONSAVEL_DESNECESSARIO` (minimização).
- `GET /equipes/:id/consentimentos` e `POST|DELETE /atletas/:id/consentimento`: só RESPONSAVEL e TECNICO.
- Inscrição não bloqueia. Devolve `avisos` com texto iniciado por `ATLETA_MENOR_SEM_CONSENTIMENTO:` e `avisosDetalhe` com o código e o `atletaId`; status `CONFIRMADA_COM_PENDENCIAS`.
- `prontidao.semAutorizacaoResponsavel` conta os menores sem autorização; a mensagem passa a citar "sem autorização do responsável".
- `DELETE /atletas/:id` virou pedido de exclusão: registra o pedido, anonimiza e tira do banco do time. Anonimiza `cpfHash`, `documentoTipo`, `documentoHash`, `fotoUrl`; apaga a linha de `AtletaDocumento` (cpf, documento, telefones, caminhos) e tenta apagar os arquivos do bucket `atleta-arquivos` (falha só gera log); apaga nome e contato do responsável, mantendo a prova do aceite (versão, data, quem).
- Preserva: `Atleta.id`, `Atleta.nome`, `InscricaoAtleta` (cópias com `nomeSnapshot`), súmula e classificação.
- Se o atleta ainda está ativo em OUTRO clube, só o vínculo deste clube sai (a identidade é compartilhada); o pedido fica registrado com escopo `VINCULO` e a PII fica.
- Sem a migration 0032: menores aparecem como pendentes, gravar autorização dá 503 e o DELETE só desativa o vínculo (`anonimizado: false`).

## 3. Retenção sugerida (SUGESTÃO técnica, não validada)

- Contato e nome do responsável: apagar quando o atleta completar 18 anos ou no fim da temporada em que foi usado, o que vier depois; hoje **não há job automático**.
- Prova do aceite (versão, data, quem, sem dados do responsável): manter pelo prazo prescricional que o advogado indicar.
- Pedido de exclusão (auditoria): manter pelo mesmo prazo.
- CPF/documento/foto: apagar a pedido ou ao fim da finalidade (campeonato encerrado), conforme decisão da seção 6.

## 4. Direitos do titular

Atendidos (tecnicamente):
- Eliminação/anonimização a pedido, com registro (item 2). O pedido hoje entra pelo líder da equipe (RESPONSAVEL/TECNICO), não diretamente pelo titular ou responsável.
- Revogação do consentimento (`DELETE .../consentimento`), registrada.
- Minimização: não coleta dado de responsável de maior de idade; contato nunca sai da API.

NÃO atendidos ainda:
- Acesso e portabilidade: não há rota/relatório para o titular ou responsável receber os dados. Falta fluxo de atendimento (canal, verificação de identidade do solicitante).
- Correção pelo titular: só o líder da equipe edita.
- Confirmação de que o responsável é de fato responsável: o sistema guarda a declaração do líder da equipe; **não há verificação** (e-mail/SMS de confirmação, documento). O contato é cifrado mas não é usado para nada ainda.
- Anonimização do nome do atleta no histórico (mantido de propósito, ver 6).
- Retenção automática e eliminação por prazo (sem job).
- Apagar atleta de outro clube ou em bases de organizador: as cópias em `InscricaoAtleta` e dados em tabelas legadas (`Jogador`, `Equipe`) **não** são tocadas por esta rota.
- Notificação do responsável quando o atleta é cadastrado; aviso de incidente; ROPA e DPO na política de privacidade.
- Dados de menores em tabelas/bucket legados (C2 do 13) continuam fora deste escopo.

## 5. Operação

- Definir `LGPD_CHAVE_CIFRA` (32 bytes aleatórios em base64) em cada ambiente antes de liberar o cadastro de responsável. Perder a chave inutiliza os contatos gravados; rotação de chave não está implementada (`chaveVersao` já existe na tabela para isso).
- Aplicar a 0032 depois da 0025, conforme docs 16 e 22.
- O texto do termo (`TERMO_TEXTO_RASCUNHO`) é rascunho: a tela deve mostrá-lo, mas não deve ir a produção sem a validação abaixo. Mudou o texto: subir `TERMO_VERSAO`.

## 6. Decisões jurídicas pendentes (dono + advogado)

O sistema NÃO decide nada disto; os valores atuais são provisórios.

1. **Base legal** do tratamento de dados de menores (consentimento específico de um dos pais/responsável, art. 14 §1º da LGPD, ou outra hipótese) e se vale para todos os campos (nome, nascimento, foto, documento).
2. **Texto do termo** de autorização e a quem ele se dirige; se basta declaração do líder da equipe ou se é preciso verificar o responsável (e como).
3. **Prazo de retenção** de: dados do atleta, dados do responsável, prova do aceite, auditoria de exclusão, súmulas e histórico esportivo.
4. **Nome do atleta no histórico**: a anonimização atual mantém o nome para preservar súmula e classificação. Confirmar se isso é aceitável quando o pedido de exclusão vem de menor ou responsável, ou se o nome deve virar iniciais/pseudônimo.
5. **Papel de cada parte** (controlador/operador): plataforma, organizador do campeonato, clube/equipe; quem responde ao titular.
6. **DPO/encarregado**: nomear e publicar o canal na política de privacidade; ROPA (registro das operações).
7. **Quem pode solicitar a exclusão** (o líder da equipe, o responsável, o próprio atleta ao fazer 18 anos) e o prazo de resposta.
8. **Maioridade**: convenção técnica para nascidos em 29/02 (maioridade em 01/03 nos anos não bissextos) e se o atleta que completa 18 anos precisa renovar o aceite por conta própria.
9. **Inscrever menor sem autorização**: hoje permitido com aviso (decisão de produto aprovada). Confirmar o risco de manter assim.
10. **Compartilhamento com organizadores/árbitros** dos dados de menores e fotos publicadas em páginas públicas.
11. **Incidente de segurança**: política de comunicação à ANPD e aos titulares.

## 7. Testes

`npm run test:lgpd-menores` (rotas, cifra, idade, anonimização, tolerância à migration ausente) e `scripts/migracoes-pendentes.test.ts` (estrutura da 0032). Não executam SQL.
