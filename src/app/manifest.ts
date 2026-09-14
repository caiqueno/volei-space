import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'volei.space — Gestão de campeonatos de vôlei',
    short_name: 'volei.space',
    description: 'Crie, organize e acompanhe campeonatos de vôlei.',
    start_url: '/',
    display: 'standalone',
    background_color: '#061426',
    theme_color: '#061426',
    lang: 'pt-BR',
    icons: [
      {
        src: '/brand/volei-space_app-icon_1024x1024.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
  }
}
