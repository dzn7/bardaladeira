'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle as CheckCircle2, ShieldWarning as ShieldAlert } from '@phosphor-icons/react'
import { Cartao, Chip, ListaCarregando, ListaVazia, Selo } from '@/components/admin/ui'
import { PaginacaoFinancas } from '@/features/financas/components/PaginacaoFinancas'
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
    <Cartao className="p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Pontos perdidos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pedidos sem nome do cliente ou sem contato. Toque para abrir o pedido.
          </p>
        </div>
        <Selo className="shrink-0 self-start text-xs">
          {total} {total === 1 ? 'ocorrência' : 'ocorrências'}
        </Selo>
      </div>

      {garconsComOcorrencia.length > 0 ? (
        <div
          role="group"
          aria-label="Filtrar ocorrências por garçom"
          className="mt-3 flex w-full flex-wrap items-center gap-2"
        >
          <Chip ativo={!garcomId} onClick={() => onGarcomChange(null)}>
            Todos
          </Chip>
          {(expandido ? garconsComOcorrencia : garconsComOcorrencia.slice(0, 5)).map((garcom) => (
            <Chip
              key={garcom.garcomId}
              ativo={garcomId === garcom.garcomId}
              onClick={() =>
                onGarcomChange(garcomId === garcom.garcomId ? null : garcom.garcomId)
              }
            >
              {garcom.nome}
              <span className="tabular-nums opacity-70">
                {garcom.ocorrenciasNome + garcom.ocorrenciasContato}
              </span>
            </Chip>
          ))}
          {garconsComOcorrencia.length > 5 && !expandido ? (
            <Chip onClick={() => setExpandido(true)} aria-label="Mostrar todos os garçons">
              +{garconsComOcorrencia.length - 5}
            </Chip>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        {carregando ? (
          <ListaCarregando linhas={5} />
        ) : ocorrencias.length === 0 ? (
          <ListaVazia
            icone={<CheckCircle2 />}
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
                            <Selo key={motivo} tom="alerta">
                              {ROTULO_MOTIVO[motivo]}
                            </Selo>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatarMoeda(ocorrencia.total)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-destructive">
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
                  className="flex min-h-16 w-full items-start gap-3 rounded-xl border border-border/70 p-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="h-10 w-0.5 shrink-0 self-stretch rounded-full bg-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        #{ocorrencia.numeroPedido} · {ocorrencia.garcomNome}
                      </p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                        −{formatarPontos(ocorrencia.pontosPerdidos)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {ocorrencia.nomeCliente?.trim() || 'Sem nome'} ·{' '}
                      {TIPO_ENTREGA_ROTULO[ocorrencia.tipoEntrega] ?? ocorrencia.tipoEntrega} ·{' '}
                      {formatarDataHora(ocorrencia.criadoEm)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ocorrencia.motivos.map((motivo) => (
                        <Selo key={motivo} tom="alerta">
                              {ROTULO_MOTIVO[motivo]}
                            </Selo>
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
        <p className="mt-3 flex items-start gap-1.5 text-[13px] text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Cliente identificado permite recompra, crediário e contato em caso de erro no pedido.
          </span>
        </p>
      ) : null}
    </Cartao>
  )
}
