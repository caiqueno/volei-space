# 05 - Design system do volei.space

Agente: designer. Data: 2026-10-16. Base: `src/app/globals.css` (bloco `:root`), `tailwind.config.ts`. Legenda: **[V]** implementado e lido no código · **[NV]** não verificado no navegador.

## 1. Princípios
1. Legível a distância (telão, quadra, luz ruim): números grandes, contraste alto.
2. Alvo de toque mínimo de 44 px (`--vs-touch-min`); 52 px para ações de alta frequência (`--vs-touch-comfort`).
3. Nunca só cor: todo estado de erro, aviso ou ao vivo tem texto ou ícone.
4. Movimento opcional: respeitar `prefers-reduced-motion`; o placar não usa animação.
5. Três temas com os mesmos nomes de token: escuro (padrão), claro e alto contraste.

## 2. Temas
| Tema | Como ativar | Observação |
|---|---|---|
| Escuro (padrão) | sem atributo | Identidade atual. |
| Claro | `<html data-theme="light">` | Dourado vira `#9A5B00` (texto 5:1 sobre o fundo); `--vs-on-gold` vira branco. |
| Alto contraste | `<html data-theme="contrast">` | Fundo preto, bordas brancas, foco amarelo. Também aplicado parcialmente (bordas, texto secundário, foco) com `prefers-contrast: more` quando não há `data-theme`. |

Estado: **os tokens e os temas existem; ainda não há seletor de tema na interface** (cabe ao `frontend`/`ux`; basta gravar `data-theme` no `<html>`). Muitas regras antigas de `globals.css` usam cores fixas (hex), então o tema claro só ficará completo após migrar essas regras para `var(--vs-*)`. [NV]

## 3. Tokens
### 3.1 Cor (escuro / claro / contraste)
| Token | Escuro | Claro | Contraste |
|---|---|---|---|
| `--vs-bg` | #070D1A | #F6F8FC | #000000 |
| `--vs-surface` | #0F1A2E | #FFFFFF | #000000 |
| `--vs-elevated` | #16243D | #EEF2F9 | #0A0A0A |
| `--vs-border` (decorativa) | #22324F | #CBD5E4 | #FFFFFF |
| `--vs-border-strong` (controles, 3:1) | #5B7197 | #66789A | #FFFFFF |
| `--vs-text` | #F5F7FB | #0B1426 | #FFFFFF |
| `--vs-muted` | #9AA8C1 | #46556F | #E6EBF5 |
| `--vs-gold` | #FFB331 | #9A5B00 | #FFD166 |
| `--vs-on-gold` | #1A1205 | #FFFFFF | #000000 |
| `--vs-blue` | #3B82F6 | #1D4ED8 | #8CBBFF |
| `--vs-win` | #22C55E | #15803D | #4ADE80 |
| `--vs-loss` | #EF4444 | #B91C1C | #FF8A8A |
| `--vs-live` | #FF4D6D | #BE123C | #FF8FA3 |
| `--vs-focus` | #FFD166 | #1D4ED8 | #FFFF00 |

Razões estimadas (calculadas à mão, conferir com ferramenta antes de fechar): texto/fundo >= 15:1 nos três temas; `muted`/fundo >= 7:1; `gold` claro sobre `bg` claro cerca de 5:1; `on-gold` sobre `gold` >= 5:1.

### 3.2 Estados (erro, aviso, sucesso, informação)
Cada estado tem `--vs-{estado}-bg`, `--vs-{estado}-border`, `--vs-{estado}-fg`, com valores por tema. Uso: classe `.vs-state` (info) com modificador `.is-error`, `.is-warning`, `.is-success`. Campos inválidos: `aria-invalid="true"` já recebe borda e anel de erro. Regra: a mensagem de erro fica junto do campo, em texto, com `role="alert"` ou `aria-describedby`; a cor é reforço.

### 3.3 Tipografia
Famílias: `--font-sans` (corpo) e `--font-display` (títulos e números), definidas em `layout.tsx`. Escala em rem: `--vs-text-xs/sm/base/lg/xl/2xl/3xl` = 0.75, 0.875, 1, 1.125, 1.25, 1.5, 2; `--vs-text-display` (2.5 a 4.5rem); `--vs-text-scoreboard` (3.5rem a 18rem, telão). Piso de fonte: `--vs-text-min` = 0.75rem (12 px); nada abaixo disso em controle. Entrelinha: `--vs-leading-tight` 1.1, `--vs-leading-body` 1.5. Números de placar usam `tabular-nums`.

### 3.4 Espaçamento e alvo
`--vs-space-1..8` = 4, 8, 12, 16, 24, 32, 48, 64 px. `--vs-touch-min` 44 px, `--vs-touch-comfort` 52 px.

## 4. Componentes e estados
| Componente | Estados obrigatórios | Notas |
|---|---|---|
| Botão primário (dourado) | normal, hover, foco, pressionado, desabilitado, carregando | Alvo >= 44 px; desabilitado explica o motivo em texto acima. |
| Botão de súmula (+1, ACE, desfazer, cartão, troca) | normal, foco, pressionado | U7: ver seção 5. |
| Campo de formulário | normal, foco, erro (`aria-invalid`), desabilitado, somente leitura | Somente leitura não pode parecer editável (U16 do relatório 05). |
| Aviso (`.vs-state`) | info, erro, aviso, sucesso | Ícone ou texto junto da cor. |
| Selo "Ao vivo" | ao vivo, encerrada, em breve | Cor + texto + ponto. |
| Placar/overlay | carregando, ao vivo, encerrada, reconectando, indisponível | Mantém o último placar se a rede falhar. |

## 5. U7 - súmula (implementado)
Bloco no fim de `src/app/globals.css` (as regras compactas antigas não foram apagadas; a linha 5460 etc. citada no relatório 05 já não corresponde a estes seletores neste checkout, então os seletores foram localizados pelo nome da classe). Resultado:
- Cartão amarelo/vermelho: 28 para 44 px; espaço entre eles de 5 para 8 px.
- Desfazer e ACE: 52 px mínimo. "+1": 72 px (64 px no celular), nome da equipe de 11 para 14 px.
- Troca de atleta (`.official-sub-action.is-icon`): 28 a 36 para 44 px; rótulo mínimo 12 px.
- Nome da equipe na barra 13 para 14 px; "Set N" 14 para 16 px.
- A área invisível `.official-toque-44::after` foi desligada, pois o botão já tem 44 px reais (evita sobreposição entre vizinhos).
Risco: botões maiores podem apertar o cartão de atleta em telas estreitas. [NV] Conferir em 360 px, 768 px (tablet horizontal) e 1024 px.

## 6. Placar e overlay (telão e transmissão)
Rota `/placar/[id]`, sem cabeçalho nem rodapé do site, com `robots: noindex`. Dados: `GET /api/partidas/[id]/ao-vivo`, o mesmo de `LiveMatchView`, mais `useBancoAoVivo` (Realtime com sondagem de 4 s). Só usa nome da equipe, logo, cor, sets, pontos, status e nome da liga; **não lê nem mostra atletas ou qualquer dado pessoal**. Fundo: sólido por padrão; `?fundo=transparente` deixa `html`, `body` e a raiz transparentes, para usar como fonte de navegador no OBS. Tamanhos fluidos em `vmin`; em tela vertical vira coluna. Falha de rede mantém o último placar e mostra "Reconectando".
Observações: o `Header` do site é escondido por CSS (`body:has(.placar-root)`), pois a rota não pôde alterar o `layout.tsx` (fora do escopo). Se `IndicadorDemora` aparecer, cobrir com z-index já está feito (raiz fixa em z-index máximo). [NV]

## 7. Checklist WCAG 2.2 AA
- [ ] 1.4.3 Contraste de texto >= 4,5:1 (>= 3:1 para texto grande) nos três temas.
- [ ] 1.4.11 Contraste de componentes e bordas de campo >= 3:1 (`--vs-border-strong`).
- [ ] 1.4.4 / 1.4.10 Zoom 200% e reflow a 320 px sem rolagem horizontal.
- [ ] 1.4.12 Espaçamento de texto ajustável sem perda.
- [ ] 1.4.1 Informação nunca só por cor (erro, ao vivo, vitória/derrota).
- [ ] 2.4.7 e 2.4.11 Foco visível e não coberto por barras fixas (a barra de placar da súmula é fixa: testar).
- [ ] 2.5.8 Alvo mínimo 24 px (AA); meta do projeto 44 px.
- [ ] 2.3.3 / 2.2.2 `prefers-reduced-motion` respeitado; nada pisca mais de 3 vezes por segundo.
- [ ] 3.3.1 e 3.3.3 Erros em texto, junto do campo, com sugestão.
- [ ] 4.1.3 Mensagens de status com `role="status"` ou `role="alert"`.
- [ ] 1.3.4 Funciona em retrato e paisagem (tablet na horizontal).
- [ ] Teste manual: teclado, leitor de tela (NVDA), celular 360 px, tablet 1024x768, telão 1920x1080 e 3840x2160, OBS com fundo transparente.

## 8. Pendências para outros agentes
- `frontend`: seletor de tema que grave `data-theme`; migrar cores fixas de `globals.css` para `var(--vs-*)`.
- `ux`: validar com apontadores se 44 px cabe no cartão do atleta em celular.
- Revisar contrastes com ferramenta automática (axe/Lighthouse) após subir o ambiente.
