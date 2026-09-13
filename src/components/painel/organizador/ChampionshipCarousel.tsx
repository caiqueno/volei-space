'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ChampionshipCard } from './ChampionshipCard'
import type { LigaCarouselItem } from './types'

const WHEEL_LOCK_MS = 550
const WHEEL_DELTA_THRESHOLD = 10
const SWIPE_THRESHOLD_PX = 50

// Estado 100% próprio do carrossel — não tem relação com o índice/estado da
// sidebar (item 1/16/36 do pedido). Reaproveita do componente-base só a
// lógica visual de active/prev/next com spring transitions; sem autoplay,
// sem FEATURES, sem Hugeicons.
export function ChampionshipCarousel({
  ligas,
  activeChampionshipId,
  onActiveChampionshipChange,
}: {
  ligas: LigaCarouselItem[]
  activeChampionshipId: number | null
  onActiveChampionshipChange: (id: number) => void
}) {
  const initialIndex = useMemo(() => {
    const found = ligas.findIndex((liga) => liga.id === activeChampionshipId)
    return found >= 0 ? found : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const wheelLockRef = useRef(false)
  const touchStartXRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const goTo = useCallback(
    (nextIndex: number) => {
      const wrapped = ((nextIndex % ligas.length) + ligas.length) % ligas.length
      setCurrentIndex(wrapped)
      onActiveChampionshipChange(ligas[wrapped].id)
    },
    [ligas, onActiveChampionshipChange],
  )

  const next = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])
  const prev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])

  // O React registra onWheel/onTouch como passive por padrão — preventDefault()
  // dentro de um handler JSX não bloqueia o scroll nativo da página (o
  // navegador ignora silenciosamente). Por isso o listener é anexado
  // manualmente ao nó do carrossel, nunca em window/document/body, com
  // { passive: false } — só assim preventDefault funciona de verdade, e só
  // dentro deste container: fora dele nunca existiu listener, então a
  // página rola normalmente.
  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    function onWheel(event: WheelEvent) {
      if (ligas.length <= 1) return
      // Bloqueia o scroll da página inteira enquanto o cursor está sobre o
      // carrossel — mesmo durante o lock de navegação, para não "vazar" um
      // pixel de scroll da página entre uma troca de card e outra.
      event.preventDefault()
      if (Math.abs(event.deltaY) < WHEEL_DELTA_THRESHOLD) return
      if (wheelLockRef.current) return
      wheelLockRef.current = true
      if (event.deltaY > 0) next()
      else prev()
      window.setTimeout(() => {
        wheelLockRef.current = false
      }, WHEEL_LOCK_MS)
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [ligas.length, next, prev])

  function handleTouchStart(event: React.TouchEvent) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartXRef.current == null) return
    const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current
    const delta = endX - touchStartXRef.current
    touchStartXRef.current = null
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    if (delta < 0) next()
    else prev()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      next()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      prev()
    }
  }

  function getCardStatus(index: number): 'active' | 'prev' | 'next' | 'hidden' {
    const len = ligas.length
    let diff = index - currentIndex
    if (diff > len / 2) diff -= len
    if (diff < -len / 2) diff += len
    if (diff === 0) return 'active'
    if (diff === -1) return 'prev'
    if (diff === 1) return 'next'
    return 'hidden'
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      className="group relative mx-auto w-full max-w-xl rounded-[2rem] outline-none transition focus-visible:ring-2 focus-visible:ring-luva-amber/50"
      aria-roledescription="carrossel de campeonatos"
    >
      <div className="relative aspect-[4/5] w-full">
        {ligas.map((liga, index) => {
          const status = getCardStatus(index)
          const isActive = status === 'active'
          const isPrev = status === 'prev'
          const isNext = status === 'next'

          return (
            <motion.div
              key={liga.id}
              initial={false}
              animate={{
                x: isActive ? 0 : isPrev ? '-14%' : isNext ? '14%' : 0,
                scale: isActive ? 1 : isPrev || isNext ? 0.88 : 0.7,
                opacity: isActive ? 1 : isPrev || isNext ? 0.45 : 0,
                zIndex: isActive ? 20 : isPrev || isNext ? 10 : 0,
                pointerEvents: isActive ? 'auto' : 'none',
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.8 }}
              className="absolute inset-0"
            >
              <ChampionshipCard liga={liga} />
            </motion.div>
          )
        })}
      </div>

      {ligas.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Campeonato anterior"
            className="absolute left-0 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#071426]/90 text-white/80 backdrop-blur transition group-hover:border-white/25 hover:border-luva-amber/60 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Próximo campeonato"
            className="absolute right-0 top-1/2 z-30 translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#071426]/90 text-white/80 backdrop-blur transition group-hover:border-white/25 hover:border-luva-amber/60 hover:text-white"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </div>
  )
}
