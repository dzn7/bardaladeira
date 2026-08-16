'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Truck, Store, MapPin, Hash } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type TipoPontoSalao = 'mesa' | 'comanda' | 'local_externo'

type PontoSalao = {
  id: string
  numero: number
  tipo: TipoPontoSalao
  status: 'livre' | 'ocupada'
  identificador: string | null
}

type DialogNovoPedidoSalaoProps = {
  pontos: PontoSalao[]
  carregando?: boolean
  className?: string
}

const URL_NOVO_PEDIDO = '/admin/pedidos/novo'

export default function DialogNovoPedidoSalao({
  pontos,
  carregando = false,
  className,
}: DialogNovoPedidoSalaoProps) {
  const [aberto, setAberto] = useState(false)
  const router = useRouter()

  const mesasLivres = useMemo(
    () =>
      pontos
        .filter((ponto) => ponto.tipo === 'mesa' && ponto.status === 'livre')
        .sort((a, b) => a.numero - b.numero),
    [pontos],
  )

  const locaisLivres = useMemo(
    () =>
      pontos
        .filter((ponto) => ponto.tipo === 'local_externo')
        .sort((a, b) => a.numero - b.numero),
    [pontos],
  )

  const irParaNovoPedido = (params?: string) => {
    setAberto(false)
    router.push(params ? `${URL_NOVO_PEDIDO}?${params}` : URL_NOVO_PEDIDO)
  }

  // Atalho N para abrir
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return
      const alvo = e.target as HTMLElement | null
      if (!alvo) return
      const editavel =
        alvo.tagName === 'INPUT' ||
        alvo.tagName === 'TEXTAREA' ||
        alvo.tagName === 'SELECT' ||
        alvo.isContentEditable
      if (editavel) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      setAberto(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" className={cn('gap-2', className)}>
          <Plus strokeWidth={1.6} className="size-4" />
          Novo pedido
          <kbd className="ml-1 hidden rounded border border-background/20 bg-background/10 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums sm:inline-block">
            N
          </kbd>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-xl border-border/70 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            Novo pedido
          </DialogTitle>
          <DialogDescription>
            Escolha onde o pedido será atendido. Você é levado direto para o lançamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Atalhos rápidos */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => irParaNovoPedido()}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/70 bg-background p-3 text-center transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <MapPin strokeWidth={1.6} className="size-4" />
              </span>
              <span className="text-xs font-medium text-foreground">Sem mesa</span>
              <span className="text-[10px] leading-tight text-muted-foreground">Escolher depois</span>
            </button>
            <button
              type="button"
              onClick={() => irParaNovoPedido()}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/70 bg-background p-3 text-center transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Truck strokeWidth={1.6} className="size-4" />
              </span>
              <span className="text-xs font-medium text-foreground">Entrega</span>
              <span className="text-[10px] leading-tight text-muted-foreground">Com endereço</span>
            </button>
            <button
              type="button"
              onClick={() => irParaNovoPedido()}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/70 bg-background p-3 text-center transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Store strokeWidth={1.6} className="size-4" />
              </span>
              <span className="text-xs font-medium text-foreground">Retirada</span>
              <span className="text-[10px] leading-tight text-muted-foreground">Balcão</span>
            </button>
          </div>

          <Separator />

          {/* Mesas livres */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Mesas livres
              </h4>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {mesasLivres.length}
              </span>
            </div>
            {carregando ? (
              <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                Carregando mesas
              </div>
            ) : mesasLivres.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                Todas as mesas estão ocupadas
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                {mesasLivres.map((mesa) => (
                  <button
                    key={mesa.id}
                    type="button"
                    onClick={() => irParaNovoPedido(`mesa=${mesa.numero}`)}
                    className="flex flex-col items-center justify-center rounded-lg border border-border/70 bg-background px-1 py-2 text-center transition-colors hover:border-foreground/15 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`Abrir pedido na ${mesa.identificador || `Mesa ${mesa.numero}`}`}
                  >
                    <Hash strokeWidth={1.6} className="size-3 text-muted-foreground" />
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {mesa.numero}
                    </span>
                    <span className="text-[9px] text-muted-foreground">Livre</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Locais parceiros */}
          {locaisLivres.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Locais parceiros livres
                </h4>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {locaisLivres.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {locaisLivres.map((local) => (
                  <button
                    key={local.id}
                    type="button"
                    onClick={() => irParaNovoPedido(`mesa=${local.numero}&local=1`)}
                    className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-left transition-colors hover:border-foreground/15 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`Abrir pedido em ${local.identificador || `Local ${local.numero}`}`}
                  >
                    <MapPin strokeWidth={1.6} className="size-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-1 text-xs font-medium text-foreground">
                      {local.identificador || `Local ${local.numero}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
