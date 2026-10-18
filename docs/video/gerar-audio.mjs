// Gera as narrações (voz masculina pt-BR, Piper) e as durações. Uso:
//   PIPER_DIR=<pasta com piper.exe> VOZ=<caminho do .onnx> FFPROBE=<ffprobe.exe> node docs/video/gerar-audio.mjs
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const { PIPER_DIR, VOZ, FFPROBE } = process.env
if (!PIPER_DIR || !VOZ || !FFPROBE) throw new Error('Defina PIPER_DIR, VOZ e FFPROBE')
const saida = join(aqui, '_audio')
mkdirSync(saida, { recursive: true })
const falas = JSON.parse(readFileSync(join(aqui, 'narracao.json'), 'utf8'))
const duracoes = {}
for (const f of falas) {
  const wav = join(saida, `${f.id}.wav`)
  const r = spawnSync(join(PIPER_DIR, 'piper.exe'), ['--model', VOZ, '--output_file', wav, '--length_scale', '1.05'], { input: f.texto + '\n', encoding: 'utf8', cwd: PIPER_DIR })
  if (r.status !== 0) throw new Error(`piper falhou em ${f.id}: ${r.stderr}`)
  const d = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' })
  duracoes[f.id] = Number(String(d.stdout).trim())
  console.log(f.id, duracoes[f.id].toFixed(1) + 's')
}
writeFileSync(join(saida, 'duracoes.json'), JSON.stringify(duracoes, null, 2))
