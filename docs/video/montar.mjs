// Junta as narrações ao vídeo gravado e gera docs/video/volei-space-demo.mp4 (H.264 + AAC).
// Uso: FFMPEG=<ffmpeg.exe> node docs/video/montar.mjs
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const { FFMPEG } = process.env
if (!FFMPEG) throw new Error('Defina FFMPEG')
const linha = JSON.parse(readFileSync(join(aqui, '_gravacao', 'linha-do-tempo.json'), 'utf8'))
const OFFSET_MS = Number(process.env.OFFSET_MS ?? 350) // atraso entre o início da página e o da gravação

const entradas = ['-i', join(aqui, '_gravacao', 'video.webm')]
const filtros = []
const rotulos = []
linha.forEach((f, i) => {
  entradas.push('-i', join(aqui, '_audio', `${f.id}.wav`))
  const ms = Math.max(0, f.inicioMs + OFFSET_MS)
  filtros.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`)
  rotulos.push(`[a${i}]`)
})
filtros.push(`${rotulos.join('')}amix=inputs=${linha.length}:normalize=0,volume=1.6[aud]`)

const saida = join(aqui, 'volei-space-demo.mp4')
const args = [...entradas, '-filter_complex', filtros.join(';'), '-map', '0:v', '-map', '[aud]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-y', saida]
const r = spawnSync(FFMPEG, args, { encoding: 'utf8', maxBuffer: 1 << 28 })
if (r.status !== 0) {
  console.error(String(r.stderr).slice(-2000))
  process.exit(1)
}
console.log('Vídeo com áudio:', saida)
