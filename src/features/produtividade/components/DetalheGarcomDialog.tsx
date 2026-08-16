'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatarMoeda, formatarPercentual, formatarPontos } from '../lib/periodo'
import { taxaFechamento, taxaQualidade } from '../lib/metricas'
import type { ConfigProdutividade, GarcomProdutividade } from '../types'

type Props = {
  garcom: GarcomProdutividade | null
  config: ConfigProdutividade
  rotuloPeriodo: string
  onFechar: () => void
}

type LinhaComposicao = {
  rotulo: string
  quantidade: number
  peso: number
  total: number
  negativo?: boolean
}

export function DetalheGarcomDialog({ garcom, config, rotuloPeriodo, onFechar }: Props) {
  const router = useRouter()

  const composicao = useMemo<LinhaComposicao[]>(() => {
    if (!garcom) return []

    const criadosValidos = Math.max(garcom.pedidosCriados - garcom.pedidosCancelados, 0)

    const linhas: LinhaComposicao[] = [
      {
        rotulo: 'Pedidos criados',
        quantidade: criadosValidos,
        peso: config.pontos_pedido_criado,
        total: criadosValidos * config.pontos_pedido_criado,
      },
      {
        rotulo: 'Pedidos entregues',
        quantidade: garcom.pedidosFechados,
        peso: config.pontos_pedido_fechado,
        total: garcom.pedidosFechados * config.pontos_pedido_fechado,
      },
      {
        rotulo: 'Itens adicionados',
        quantidade: garcom.itensAdicionados,
        peso: config.pontos_item_adicionado,
        total: garcom.itensAdicionados * config.pontos_item_adicionado,
      },
      {
        rotulo: 'Pedidos editados',
        quantidade: garcom.edicoes,
        peso: config.pontos_pedido_editado,
        total: garcom.edicoes * config.pontos_pedido_editado,
      },
      {
        rotulo: 'Cadastros completos',
        quantidade: garcom.cadastrosCompletos,
        peso: config.bonus_cadastro_completo,
        total: garcom.cadastrosCompletos * config.bonus_cadastro_completo,
      },
      {
        rotulo: 'Sem nome do cliente',
        quantidade: garcom.ocorrenciasNome,
        peso: config.penalidade_nome_generico,
        total: garcom.ocorrenciasNome * config.penalidade_nome_generico,
        negativo: true,
      },
      {
        rotulo: 'Sem telefone/endereço',
        quantidade: garcom.ocorrenciasContato,
        peso: config.penalidade_contato_ausente,
        total: garcom.ocorrenciasContato * config.penalidade_contato_ausente,
        negativo: true,
      },
      {
        rotulo: 'Pedidos cancelados',
        quantidade: garcom.pedidosCancelados,
        peso: config.penalidade_pedido_cancelado,
        total: garcom.pedidosCancelados * config.penalidade_pedido_cancelado,
        negativo: true,
      },
    ]

    return linhas.filter((linha) => linha.quantidade > 0 && linha.peso > 0)
  }, [garcom, config])

  if (!garcom) return null

  const qualidade = taxaQualidade(garcom)

  return (
    <Dialog open={Boolean(garcom)} onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 p-5 pb-4 text-left">
          <div className="flex items-center gap-3">
            <AvatarUsuario
              nome={garcom.nome}
              src={garcom.avatarUrl}
              cor={garcom.corAvatar}
              size="md"
            />
            <div className="min-w-0">
              <DialogTitle className="truncate">{garcom.nome}</DialogTitle>
              <DialogDescription className="truncate">
                {rotuloPeriodo} · {formatarPontos(garcom.pontos)} pontos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { rotulo: 'Criados', valor: String(garcom.pedidosCriados) },
              { rotulo: 'Entregues', valor: formatarPercentual(taxaFechamento(garcom)) },
              { rotulo: 'Vendas', valor: formatarMoeda(garcom.vendas) },
              { rotulo: 'Sem falha', valor: formatarPercentual(qualidade) },
            ].map((item) => (
              <div key={item.rotulo} className="rounded-lg border border-border/60 bg-background p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.rotulo}
                </p>
                <p className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
                  {item.valor}
                </p>
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-medium text-foreground">Como os pontos foram formados</h3>
          <div className="mt-2 divide-y divide-border/50 rounded-lg border border-border/60">
            {composicao.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Sem movimentação registrada neste período.
              </p>
            ) : (
              composicao.map((linha) => (
                <div key={linha.rotulo} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{linha.rotulo}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {linha.quantidade} × {formatarPontos(linha.peso)} pts
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-medium tabular-nums',
                      linha.negativo ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
                    )}
                  >
                    {linha.negativo ? '−' : '+'}
                    {formatarPontos(linha.total)}
                  </span>
                </div>
              ))
            )}

            <div className="flex items-center justify-between gap-3 bg-muted/30 p-3">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatarPontos(garcom.pontos)} pts
              </span>
            </div>
          </div>

          {garcom.pedidosAbertos > 0 ? (
            <p className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              {garcom.pedidosAbertos}{' '}
              {garcom.pedidosAbertos === 1 ? 'pedido continua' : 'pedidos continuam'} sem ser
              encerrado neste período. Pedido aberto não desconta pontos, mas segura a mesa e
              o fechamento do caixa.
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shadow-none sm:h-9 sm:w-auto"
            onClick={() => router.push(`/admin/garcons/${garcom.garcomId}/pedidos`)}
          >
            Ver pedidos do garçom
          </Button>
          <Button
            type="button"
            className="h-11 w-full shadow-none sm:h-9 sm:w-auto"
            onClick={onFechar}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
