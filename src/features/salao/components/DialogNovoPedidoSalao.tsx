'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Truck, Storefront as Store, MapPin } from '@phosphor-icons/react'
import { Botao, Gaveta } from '@/components/admin/ui'
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

  const classeAtalho =
    'flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card p-3 text-center transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'

  const atalhos = [
    { rotulo: 'Sem mesa', detalhe: 'Escolher depois', Icone: MapPin },
    { rotulo: 'Entrega', detalhe: 'Com endereço', Icone: Truck },
    { rotulo: 'Retirada', detalhe: 'No balcão', Icone: Store },
  ]

  return (
    <>
      <Botao onClick={() => setAberto(true)} className={cn('h-11 md:h-10', className)}>
        <Plus />
        Novo pedido
        <kbd className="ml-1 hidden rounded border border-background/20 bg-background/10 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums sm:inline-block">
          N
        </kbd>
      </Botao>

      <Gaveta
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo pedido"
        descricao="Escolha onde o pedido será atendido."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            {atalhos.map(({ rotulo, detalhe, Icone }) => (
              <button key={rotulo} type="button" onClick={() => irParaNovoPedido()} className={classeAtalho}>
                <Icone className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{rotulo}</span>
                <span className="text-xs leading-tight text-muted-foreground">{detalhe}</span>
              </button>
            ))}
          </div>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-foreground">Mesas livres</h3>
              <span className="text-sm tabular-nums text-muted-foreground">{mesasLivres.length}</span>
            </div>
            {carregando ? (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground">
                Carregando mesas…
              </p>
            ) : mesasLivres.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-sm text-muted-foreground">
                Todas as mesas estão ocupadas.
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {mesasLivres.map((mesa) => (
                  <button
                    key={mesa.id}
                    type="button"
                    onClick={() => irParaNovoPedido(`mesa=${mesa.numero}`)}
                    className="flex h-12 items-center justify-center rounded-lg border border-border/70 bg-card font-mono text-base font-semibold tabular-nums text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`Abrir pedido na ${mesa.identificador || `Mesa ${mesa.numero}`}`}
                  >
                    {mesa.numero}
                  </button>
                ))}
              </div>
            )}
          </section>

          {locaisLivres.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium text-foreground">Locais parceiros</h3>
                <span className="text-sm tabular-nums text-muted-foreground">{locaisLivres.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {locaisLivres.map((local) => (
                  <button
                    key={local.id}
                    type="button"
                    onClick={() => irParaNovoPedido(`mesa=${local.numero}&local=1`)}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`Abrir pedido em ${local.identificador || `Local ${local.numero}`}`}
                  >
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-1 text-sm font-medium text-foreground">
                      {local.identificador || `Local ${local.numero}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </Gaveta>
    </>
  )
}
