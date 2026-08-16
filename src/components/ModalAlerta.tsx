'use client'

import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react'
import { useEffect } from 'react'

type TipoAlerta = 'sucesso' | 'erro' | 'aviso' | 'info'

type ModalAlertaProps = {
  aberto: boolean
  tipo: TipoAlerta
  titulo: string
  mensagem: string
  onFechar: () => void
}

const TIPO_CONFIG = {
  sucesso: { Icone: CheckCircle, cor: 'text-emerald-500' },
  erro: { Icone: AlertCircle, cor: 'text-destructive' },
  aviso: { Icone: AlertTriangle, cor: 'text-amber-500' },
  info: { Icone: Info, cor: 'text-muted-foreground' },
} as const

export default function ModalAlerta({ aberto, tipo, titulo, mensagem, onFechar }: ModalAlertaProps) {
  useEffect(() => {
    if (aberto) {
      const timer = setTimeout(onFechar, 5000)
      return () => clearTimeout(timer)
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  const { Icone, cor } = TIPO_CONFIG[tipo]

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[1100] px-3 pt-3 sm:px-4 sm:pt-6"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto w-full max-w-md">
        <div
          className="pointer-events-auto w-full animate-in slide-in-from-top-2 duration-200 rounded-lg border border-border/70 bg-card p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <Icone className={`h-4 w-4 shrink-0 mt-0.5 ${cor}`} strokeWidth={1.6} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{titulo}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{mensagem}</p>
            </div>
            <button
              onClick={onFechar}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
