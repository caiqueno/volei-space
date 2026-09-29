'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { FormAlert } from '../../ui/FormAlert'
import PageLoading from '@/components/ui/page-loading'

const CATALOGO = [
  { codigo: 'FEMININO', nome: 'Feminino' },
  { codigo: 'FEMININO_MASTER', nome: 'Feminino Master' },
  { codigo: 'MISTO', nome: 'Misto' },
  { codigo: 'MASCULINO', nome: 'Masculino' },
  { codigo: 'MASCULINO_MASTER', nome: 'Masculino Master' },
] as const

type Item =
  | { kind: 'catalog'; key: string; codigo: string; nome: string }
  | { kind: 'existing'; key: string; id: string; nome: string }
  | { kind: 'draft'; key: string; nome: string }

function normalizar(nome: string) {
  return nome.trim().toLowerCase()
}

function payloadDoItem(item: Item): Record<string, string> {
  if (item.kind === 'catalog') return { codigo: item.codigo }
  if (item.kind === 'existing') return { id: item.id }
  return { nome: item.nome }
}

export function CategoriasWizard({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selecionadas, setSelecionadas] = useState<Item[]>([])
  const [disponiveis, setDisponiveis] = useState<Item[]>([])
  const [adicionando, setAdicionando] = useState(false)
  const [nomeNovo, setNomeNovo] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/organizador/ligas/${ligaId}/categorias?incluirRemovidas=1`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar as categorias.')
        return payload.data as Array<{ id: string; codigo: string; nome: string; removidaEm: string | null }>
      })
      .then((rows) => {
        if (cancelled) return
        const ativas = rows.filter((r) => r.removidaEm == null)
        const removidas = rows.filter((r) => r.removidaEm != null)
        const codigosConhecidos = new Set(rows.map((r) => r.codigo))

        setSelecionadas(ativas.map((r) => ({ kind: 'existing', key: r.id, id: r.id, nome: r.nome })))
        setDisponiveis([
          ...removidas.map((r) => ({ kind: 'existing' as const, key: r.id, id: r.id, nome: r.nome })),
          ...CATALOGO.filter((c) => !codigosConhecidos.has(c.codigo)).map((c) => ({ kind: 'catalog' as const, key: c.codigo, codigo: c.codigo, nome: c.nome })),
        ])
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar as categorias.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ligaId])

  const nomesEmUso = useMemo(
    () => new Set([...selecionadas, ...disponiveis].map((item) => normalizar(item.nome))),
    [selecionadas, disponiveis],
  )

  function selecionar(item: Item) {
    setDisponiveis((current) => current.filter((i) => i.key !== item.key))
    setSelecionadas((current) => [...current, item])
    setSaveError(null)
  }

  function remover(item: Item) {
    setSelecionadas((current) => current.filter((i) => i.key !== item.key))
    // Categoria ainda não salva (rascunho) só some; catálogo/já-existente
    // volta pra "disponíveis" — nunca é apagada aqui, só deixa de ser
    // enviada na próxima chamada de Avançar.
    if (item.kind !== 'draft') {
      setDisponiveis((current) => [...current, item])
    }
    setSaveError(null)
  }

  function confirmarNovaCategoria() {
    const nome = nomeNovo.trim()
    if (nome.length < 2 || nome.length > 40) {
      setAddError('O nome deve ter entre 2 e 40 caracteres.')
      return
    }
    if (nomesEmUso.has(normalizar(nome))) {
      setAddError('Já existe uma categoria com esse nome.')
      return
    }
    setSelecionadas((current) => [...current, { kind: 'draft', key: `draft:${crypto.randomUUID()}`, nome }])
    setNomeNovo('')
    setAddError(null)
    setAdicionando(false)
    setSaveError(null)
  }

  async function avancar() {
    if (selecionadas.length === 0 || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(`/api/organizador/ligas/${ligaId}/categorias`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorias: selecionadas.map(payloadDoItem) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar as categorias.')
      const primeira = (payload.data as Array<{ id: string }>)[0]
      router.push(`/painel/parametrizacao?ligaId=${ligaId}${primeira ? `&categoriaCampeonatoId=${primeira.id}` : ''}`)
    } catch (err) {
      // Erro: preserva a seleção atual na tela, não perde nada do que o
      // organizador já tinha montado.
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar as categorias.')
      setSaving(false)
    }
  }

  if (loading) return <PageLoading label="Carregando categorias..." />
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <FormAlert variant="error">{loadError}</FormAlert>
      </div>
    )
  }

  return (
    <SectionWizardLayout
      ligaId={ligaId}
      section="categorias"
      title="Quais categorias terá seu campeonato?"
      subtitle="Selecione as categorias ou adicione uma que não esteja na lista."
      autosaveStatus="idle"
    >
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Selecionadas</p>
        <div className="mt-2 flex min-h-[3.5rem] gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {selecionadas.length === 0 && (
            <p className="self-center text-sm font-semibold text-slate-400">Nenhuma categoria selecionada.</p>
          )}
          <AnimatePresence initial={false}>
            {selecionadas.map((item) => (
              <motion.span
                key={item.key}
                layout={!shouldReduceMotion}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-bold !text-white"
              >
                {item.nome}
                <button
                  type="button"
                  onClick={() => remover(item)}
                  aria-label={`Remover ${item.nome}`}
                  className="text-amber-200/70 transition hover:text-white"
                >
                  <X size={14} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Disponíveis</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {disponiveis.map((item) => (
              <motion.button
                key={item.key}
                type="button"
                layout={!shouldReduceMotion}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                onClick={() => selecionar(item)}
                aria-label={`Selecionar ${item.nome}`}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold !text-white transition hover:border-amber-400/50 hover:bg-amber-400/10"
              >
                {item.nome}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {!adicionando ? (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-300 transition hover:border-amber-400/50 hover:text-amber-200"
          >
            <Plus size={14} /> Adicionar categoria
          </button>
        ) : (
          <div className="mt-4 flex flex-wrap items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <input
              autoFocus
              value={nomeNovo}
              onChange={(event) => { setNomeNovo(event.target.value); setAddError(null) }}
              onKeyDown={(event) => { if (event.key === 'Enter') confirmarNovaCategoria() }}
              placeholder="Nome da categoria"
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm font-bold text-white outline-none placeholder:text-white/40 focus:border-amber-400"
            />
            <button type="button" onClick={confirmarNovaCategoria} className="public-primary-action rounded-full px-4 py-2.5 text-xs font-black uppercase tracking-wide">
              Adicionar
            </button>
            <button
              type="button"
              onClick={() => { setAdicionando(false); setNomeNovo(''); setAddError(null) }}
              className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            {addError && <p className="w-full text-sm font-semibold text-red-300">{addError}</p>}
          </div>
        )}
      </div>

      {saveError && (
        <div className="mt-6">
          <FormAlert variant="error">{saveError}</FormAlert>
        </div>
      )}

      <button
        type="button"
        onClick={avancar}
        disabled={selecionadas.length === 0 || saving}
        className="public-primary-action mt-6 w-full rounded-full py-3.5 text-sm font-black disabled:opacity-40"
      >
        {saving ? 'Salvando...' : 'Avançar'}
      </button>
    </SectionWizardLayout>
  )
}
