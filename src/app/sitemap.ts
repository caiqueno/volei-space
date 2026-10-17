import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo'
import { isSupabaseConfigured } from '@/lib/supabase-config'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'

const staticPaths = [
  '/',
  '/campeonatos',
  '/portal',
  '/classificacao',
  '/jogos',
  '/fase-mata-mata',
  '/rankings',
  '/galeria',
  '/termos-de-uso',
  '/politica-de-privacidade',
  '/politica-de-cookies',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, '')
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({ url: `${siteUrl}${path}` }))

  if (!isSupabaseConfigured) return entries

  const privadas = await idsCompeticoesPrivadas()
  const [{ data: campeonatos }, { data: equipes }] = await Promise.all([
    supabase.from('Liga').select('id,slug').eq('simulacao', false).not('slug', 'is', null),
    supabase.from('Equipe').select('slug').not('slug', 'is', null),
  ])

  const dynamicEntries: MetadataRoute.Sitemap = [
    ...(campeonatos ?? []).filter(({ id }) => !privadas.has(Number(id))).map(({ slug }) => ({ url: `${siteUrl}/campeonatos/${encodeURIComponent(slug)}` })),
    ...(equipes ?? []).map(({ slug }) => ({ url: `${siteUrl}/equipes/${encodeURIComponent(slug)}` })),
  ]

  return [...entries, ...dynamicEntries]
}
