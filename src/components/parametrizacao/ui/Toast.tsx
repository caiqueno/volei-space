'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type ToastVariant = 'error' | 'success' | 'info'

type ToastInput = {
  title?: string
  message: string
  variant?: ToastVariant
}

type ToastItem = ToastInput & { id: string; variant: ToastVariant }

// Mesma paleta de FormAlert.tsx (border-*/bg-*/text-* por variante) — não
// existe nenhuma lib de toast neste projeto (sonner/react-toastify/etc.
// ausentes, confirmado), então isto reaproveita as cores/tipografia já
// estabelecidas em vez de inventar uma paleta nova.
const VARIANTS: Record<ToastVariant, { icon: typeof AlertTriangle; classes: string }> = {
  error: { icon: AlertTriangle, classes: 'border-red-400/30 bg-red-500/10 text-red-100' },
  success: { icon: CheckCircle2, classes: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' },
  info: { icon: Info, classes: 'border-sky-400/30 bg-sky-500/10 text-sky-100' },
}

const AUTO_DISMISS_MS = 4200

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

// Renderizado via portal em document.body (mesmo motivo do DatePickerInput:
// `.luva-card{overflow:hidden}` cortaria um toast fixed dentro do card) e
// montado uma única vez em painel/parametrizacao/[secao]/page.tsx, acima de
// todos os wizards de seção — assim qualquer seção pode chamar useToast()
// sem prop-drilling (o Provider precisa envolver quem CHAMA o hook, não ser
// filho de quem chama — por isso não vive dentro de SectionWizardLayout,
// que é renderizado PELO wizard, não o inverso).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  // `typeof document !== 'undefined'` no render diverge entre SSR (sem
  // document) e o 1º render client-side (já tem document) — causa hydration
  // mismatch. O padrão seguro é só montar o portal depois do mount real.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: ToastInput) => {
      const variant = toast.variant ?? 'error'
      setToasts((current) => {
        // Evita empilhar o mesmo aviso duas vezes (ex.: usuário clica
        // "Continuar" repetidas vezes enquanto a data ainda está inválida).
        const alreadyShown = current.some((item) => item.title === toast.title && item.message === toast.message && item.variant === variant)
        if (alreadyShown) return current
        const id = `toast-${++idRef.current}`
        window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
        return [...current, { id, variant, title: toast.title, message: toast.message }]
      })
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] grid gap-2">
            {toasts.map((toast) => {
              const { icon: Icon, classes } = VARIANTS[toast.variant]
              return (
                <div
                  key={toast.id}
                  role="alert"
                  className={`flex w-full max-w-sm gap-3 rounded-xl border p-4 shadow-lg shadow-slate-950/30 ${classes}`}
                >
                  <Icon className="mt-0.5 shrink-0" size={18} />
                  <div className="min-w-0 flex-1">
                    {toast.title && <p className="text-xs font-black uppercase tracking-[0.14em]">{toast.title}</p>}
                    <p className="mt-1 text-sm font-bold">{toast.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="Fechar aviso"
                    className="shrink-0 text-current opacity-60 transition hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const showToast = useContext(ToastContext)
  if (!showToast) throw new Error('useToast deve ser usado dentro de <ToastProvider>.')
  return showToast
}
