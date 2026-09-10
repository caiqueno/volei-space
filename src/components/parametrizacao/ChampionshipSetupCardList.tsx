'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChampionshipSetupCard } from './ChampionshipSetupCard'
import type { ChampionshipSetupCardDTO } from '@/types/championship-setup'

// Lista de status dos 7 cards da Central de Parametrização. Ordem sempre
// fixa (vem já ordenada da API, na sequência lógica de construção do
// campeonato) — nunca reordenar por status. Sem lógica de sincronização,
// setTimeout artificial ou alteração de status simulada: o status vem
// sempre do backend (GET .../setup).
export function ChampionshipSetupCardList({ cards }: { cards: ChampionshipSetupCardDTO[] }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={!shouldReduceMotion}>
        {cards.map((card, index) => (
          <motion.div
            key={card.key}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
          >
            <ChampionshipSetupCard card={card} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
