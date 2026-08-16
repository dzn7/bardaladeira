'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { PaginacaoFinancas } from '@/features/financas/components/PaginacaoFinancas'
import { cn } from '@/lib/utils'
import { formatarDataHora, formatarMoeda, formatarPontos } from '../lib/periodo'
import { ROTULO_MOTIVO, type GarcomProdutividade, type OcorrenciaProdutividade } from '../types'

type Props = {
  ocorrencias: OcorrenciaProdutividade[]
  garcons: GarcomProdutividade[]
  total: number
  totalPaginas: number
  pagina: number
  itensPorPagina: number
  garcomId: string | null
  carregando: boolean
  onPaginaChange: (pagina: number) => void
  onItensPorPaginaChange: (quantidade: number) => void
  onGarcomChange: (garcomId: string | null) => void
}

const TIPO_ENTREGA_ROTULO: Record<string, string> = {
  local: 'Mesa',
  retirada: 'Retirada',
  entrega: 'Entrega',
}

export function ListaOcorrencias({
  ocorrencias,
  garcons,
  total,
  totalPaginas,
  pagina,
  itensPorPagina,
  garcomId,
  carregando,
  onPaginaChange,
  onItensPorPaginaChange,
  onGarcomChange,
}: Props) {
  const router = useRouter()
  const [expandido, setExpandido] = useState(false)

  const garconsComOcorrencia = useMemo(
    () =>
      garcons
        .filter((garcom) => garcom.ocorrenciasNome + garcom.ocorrenciasContato > 0)
        .sort((a, b) => b.pontosNegativos - a.pontosNegativos),
    [garcons],
  )

  const abrirPedido = (pedidoId: string) => {
    router.push(`/admin/pedidos?pedido=${pedidoId}`)
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">Pontos perdidos</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pedidos que saíram sem identificar o cliente ou sem contato — clique para abrir o pedido.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {total} {total === 1 ? 'ocorrência' : 'ocorrências'}
        </span>
      </div>

      {garconsComOcorrencia.length > 0 ? (
        <ToggleGroup
          type="single"
          value={garcomId ?? 'todos'}
          onValueChange={(valor) => {
            onGarcomChange(!valor || valor === 'todos' ? null : valor)
          }}
          aria-label="Filtrar ocorrências por garçom"
          className="mt-3 flex w-full flex-wrap items-center justify-start gap-2"
        >
          <ToggleGroupItem value="todos" className={CHIP_FILTRO_DEFAULT}>
            Todos
          </ToggleGroupItem>
          {(expandido ? garconsComOcorrencia : garconsComOcorrencia.slice(0, 5)).map((garcom) => (
            <ToggleGroupItem
              key={garcom.garcomId}
              value={garcom.garcomId}
              className={CHIP_FILTRO_DEFAULT}
            >
              {garcom.nome}
              <span className="ml-1 tabular-nums opacity-70">
                {garcom.ocorrenciasNome + garcom.ocorrenciasContato}
              </span>
            </ToggleGroupItem>
          ))}
          {garconsComOcorrencia.length > 5 && !expandido ? (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              +{garconsComOcorrencia.length - 5}
            </button>
          ) : null}
        </ToggleGroup>
      ) : null}

      <div className="mt-4">
        {carregando ? (
          <TabelaSkeleton linhas={5} />
        ) : ocorrencias.length === 0 ? (
          <ListaVazia
            icone={<CheckCircle2 className="h-5 w-5" />}
            titulo="Nenhuma falha no período"
            descricao="Todos os pedidos saíram com cliente identificado e contato quando necessário."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pedido</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Garçom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Canal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Motivo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {ocorrencias.map((ocorrencia) => (
                    <tr
                      key={ocorrencia.pedidoId}
                      className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/20"
                      onClick={() => abrirPedido(ocorrencia.pedidoId)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium tabular-nums text-foreground">
                          #{ocorrencia.numeroPedido}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatarDataHora(ocorrencia.criadoEm)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-foreground">{ocorrencia.garcomNome}</td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          {ocorrencia.nomeCliente?.trim() || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {TIPO_ENTREGA_ROTULO[ocorrencia.tipoEntrega] ?? ocorrencia.tipoEntrega}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {ocorrencia.motivos.map((motivo) => (
                            <span
                              key={motivo}
                              className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              {ROTULO_MOTIVO[motivo]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatarMoeda(ocorrencia.total)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-rose-600 dark:text-rose-400">
                        −{formatarPontos(ocorrencia.pontosPerdidos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {ocorrencias.map((ocorrencia) => (
                <button
                  key={ocorrencia.pedidoId}
                  type="button"
                  onClick={() => abrirPedido(ocorrencia.pedidoId)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border/70 bg-background p-3.5 text-left transition-colors hover:bg-muted/20"
                >
                  <span className="h-10 w-0.5 shrink-0 self-stretch rounded-full bg-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        #{ocorrencia.numeroPedido} · {ocorrencia.garcomNome}
                      </p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        −{formatarPontos(ocorrencia.pontosPerdidos)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {ocorrencia.nomeCliente?.trim() || 'Sem nome'} ·{' '}
                      {TIPO_ENTREGA_ROTULO[ocorrencia.tipoEntrega] ?? ocorrencia.tipoEntrega} ·{' '}
                      {formatarDataHora(ocorrencia.criadoEm)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ocorrencia.motivos.map((motivo) => (
                        <span
                          key={motivo}
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
                          )}
                        >
                          {ROTULO_MOTIVO[motivo]}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <PaginacaoFinancas
              paginaAtual={pagina}
              totalPaginas={totalPaginas}
              totalItens={total}
              itensPorPagina={itensPorPagina}
              onPaginaChange={onPaginaChange}
              onItensPorPaginaChange={onItensPorPaginaChange}
              carregando={carregando}
            />
          </>
        )}
      </div>

      {!carregando && ocorrencias.length > 0 ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Cliente identificado permite recompra, crediário e contato em caso de erro no pedido.
          </span>
        </p>
      ) : null}
    </section>
  )
}
