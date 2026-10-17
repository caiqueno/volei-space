// CSS da súmula impressa, embutido no componente (sem tocar em globals.css).
// Tela: folha branca centralizada. Impressão: A4 retrato, sem o botão.
export const ESTILOS_SUMULA_IMPRESSA = `
@page { size: A4 portrait; margin: 10mm; }
.si-tela { background: #e9edf5; min-height: 100vh; padding: 16px; color: #0b1426; }
.si-barra { max-width: 190mm; margin: 0 auto 12px; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.si-barra p { margin: 0; font-size: 0.875rem; color: #46556f; flex: 1 1 220px; }
.si-botao { min-height: 44px; padding: 0 20px; border-radius: 8px; border: 0; background: #ffb331; color: #1a1205; font-weight: 700; font-size: 1rem; cursor: pointer; }
.si-botao:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
.si-estado { max-width: 190mm; margin: 40px auto; text-align: center; font-size: 1rem; }
.si-folha { max-width: 190mm; margin: 0 auto; background: #fff; padding: 8mm; box-shadow: 0 2px 12px rgba(11,20,38,.18); font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.3; color: #000; }
/* O global aplica fundo escuro e cor clara a main:not(...); a folha precisa de mais especificidade para ficar branca. */
.si-tela main.si-folha { background: #fff; color: #000; }
.si-tela main.si-folha th, .si-tela main.si-folha td, .si-tela main.si-folha dd, .si-tela main.si-folha dt { color: #000; border-color: #000; }
.si-tela main.si-folha .si-cab dt, .si-tela main.si-folha .si-vazio, .si-tela main.si-folha .si-legenda, .si-tela main.si-folha .si-nota, .si-tela main.si-folha .si-rodape { color: #333; }
.si-tela main.si-folha th { background: #f3f4f6; }
.si-tela main.si-folha h2 { background: #e5e7eb; color: #000; }
.si-tela main.si-folha .si-saque { background: #d1d5db; }
.si-folha h1 { font-size: 15pt; margin: 0 0 2mm; text-align: center; text-transform: uppercase; }
.si-folha h2 { font-size: 10.5pt; margin: 4mm 0 1.5mm; padding: 1mm 2mm; background: #e5e7eb; text-transform: uppercase; break-after: avoid; }
.si-folha h3 { font-size: 10pt; margin: 0 0 1mm; }
.si-folha p { margin: 0 0 1mm; }
.si-folha table { width: 100%; border-collapse: collapse; margin-bottom: 1mm; }
.si-folha th, .si-folha td { border: 0.3mm solid #000; padding: 0.8mm 1.5mm; text-align: left; vertical-align: top; }
.si-folha th { background: #f3f4f6; font-weight: 700; }
.si-num { text-align: center !important; font-variant-numeric: tabular-nums; }
.si-duas { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.si-cab { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1mm 4mm; }
.si-cab div { border-bottom: 0.2mm solid #888; padding-bottom: 0.5mm; }
.si-cab dt { font-size: 7.5pt; text-transform: uppercase; color: #333; }
.si-cab dd { margin: 0; font-weight: 700; }
.si-set { border: 0.3mm solid #000; padding: 2mm; margin-bottom: 3mm; }
.si-set h3, .si-anexo h3 { break-after: avoid; }
.si-folha h4 { font-size: 9pt; margin: 0 0 1mm; }
.si-rolagem { overflow-x: auto; }
.si-quadro { font-size: 8pt; }
.si-quadro th, .si-quadro td { padding: 0.4mm 0.8mm; }
.si-quadro thead { display: table-header-group; }
.si-saque { background: #d1d5db; border: 0.6mm solid #000 !important; }
.si-cancelado td { text-decoration: line-through; color: #444; }
.si-tres { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; }
.si-lista { margin: 0 0 1mm; padding-left: 5mm; }
.si-legenda { font-size: 7.5pt; color: #333; }
.si-nota { display: block; font-size: 7pt; color: #333; margin-top: 0.5mm; }
.si-anexo { border-top: 0.5mm solid #000; margin-top: 3mm; padding-top: 2mm; break-before: page; }
.si-assin-curta { grid-template-columns: 1fr; max-width: 70mm; margin-top: 4mm; }
.si-set-topo { display: flex; justify-content: space-between; gap: 4mm; font-weight: 700; margin-bottom: 1mm; }
.si-cap { font-weight: 700; text-decoration: underline; }
.si-lib { font-weight: 700; }
.si-vazio { font-style: italic; color: #333; }
.si-ausente { border: 0.3mm dashed #555; padding: 1.5mm 2mm; font-style: italic; margin-bottom: 1mm; break-inside: avoid; }
.si-decisao { font-weight: 700; border: 0.3mm solid #000; padding: 0 1mm; }
.si-aviso { border: 0.5mm solid #000; padding: 1.5mm 2mm; font-weight: 700; }
.si-resultado { font-size: 14pt; font-weight: 700; text-align: center; }
.si-assin { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm 6mm; margin-top: 6mm; break-inside: avoid; }
.si-assin div { border-top: 0.3mm solid #000; padding-top: 1mm; min-height: 14mm; font-size: 8.5pt; }
.si-rodape { margin-top: 4mm; font-size: 7.5pt; color: #333; }
@media (max-width: 700px) {
  .si-folha { padding: 4mm; font-size: 9pt; overflow-x: auto; }
  .si-duas, .si-cab, .si-assin, .si-tres { grid-template-columns: 1fr; }
}
@media print {
  html, body { background: #fff !important; }
  .si-nao-imprimir, div.sticky.top-0.z-50 { display: none !important; }
  .si-tela { background: #fff; padding: 0; min-height: 0; }
  .si-folha { box-shadow: none; max-width: none; padding: 0; margin: 0; font-size: 9pt; overflow: visible; }
  .si-duas { grid-template-columns: 1fr 1fr; }
  .si-cab, .si-assin { grid-template-columns: repeat(3, 1fr); }
  .si-assin-curta { grid-template-columns: 1fr; }
  .si-tres { grid-template-columns: 1fr 1fr 1fr; }
  .si-rolagem { overflow: visible; }
  .si-nova-pagina { break-before: page; }
  .si-folha tr, .si-duas > article, .si-tres > section { break-inside: avoid; }
  .si-folha thead { display: table-header-group; }
  .si-folha h2 + .si-set { break-before: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`
