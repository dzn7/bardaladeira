'use client'

import { CheckCircle2, Lock, Unlock, Wallet } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatarMoedaCaixa } from '@/lib/caixa-gaveta'
import { cn } from '@/lib/utils'
import type { Caixa } from '@/lib/tipos-caixa'

type Props = {
  caixa: Caixa | null
  onFechar: () => void
}

export default function ModalDetalhesCaixa({ caixa, onFechar }: Props) {
  if (!caixa) return null

  const aberto = caixa.status === 'aberto'
  const formas = caixa.fechamento_formas

  return (
    <Dialog open={Boolean(caixa)} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            {aberto ? (
              <Wallet className="h-4 w-4 text-amber-600" strokeWidth={1.6} />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" strokeWidth={1.6} />
            )}
            Sessão de caixa
          </DialogTitle>
          <DialogDescription>
            {format(new Date(caixa.data_abertura), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2.5',
              aberto ? 'border-amber-500/30 bg-amber-500/10' : 'border-border/70 bg-muted/40',
            )}
          >
            <span className="text-sm font-medium">{aberto ? 'Aberto' : 'Fechado'}</span>
            {aberto ? <Unlock className="h-4 w-4 text-amber-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Abertura</p>
              <p className="font-mono font-semibold tabular-nums">{formatarMoedaCaixa(caixa.valor_abertura)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Entradas</p>
              <p className="font-mono font-semibold tabular-nums text-emerald-600">
                {formatarMoedaCaixa(caixa.total_entradas)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Saídas</p>
              <p className="font-mono font-semibold tabular-nums text-destructive">
                {formatarMoedaCaixa(caixa.total_saidas)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Esperado (dinheiro)</p>
              <p className="font-mono font-semibold tabular-nums">{formatarMoedaCaixa(caixa.saldo_esperado)}</p>
            </div>
            {caixa.valor_fechamento != null && (
              <div>
                <p className="text-[11px] text-muted-foreground">Contado</p>
                <p className="font-mono font-semibold tabular-nums">{formatarMoedaCaixa(caixa.valor_fechamento)}</p>
              </div>
            )}
            {caixa.diferenca != null && (
              <div>
                <p className="text-[11px] text-muted-foreground">Diferença</p>
                <p
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    caixa.diferenca === 0
                      ? 'text-foreground'
                      : caixa.diferenca > 0
                        ? 'text-emerald-600'
                        : 'text-destructive',
                  )}
                >
                  {formatarMoedaCaixa(caixa.diferenca)}
                </p>
              </div>
            )}
          </div>

          {(caixa.responsavel_abertura || caixa.responsavel_fechamento) && (
            <div className="space-y-1 text-sm text-muted-foreground">
              {caixa.responsavel_abertura && <p>Abriu: {caixa.responsavel_abertura}</p>}
              {caixa.responsavel_fechamento && <p>Fechou: {caixa.responsavel_fechamento}</p>}
            </div>
          )}

          {formas && (
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Fechamento por forma</p>
              <div className="grid grid-cols-2 gap-2">
                <p>
                  Dinheiro esp.:{' '}
                  <span className="font-mono tabular-nums">{formatarMoedaCaixa(formas.dinheiro.esperado)}</span>
                </p>
                <p>
                  Dinheiro cont.:{' '}
                  <span className="font-mono tabular-nums">{formatarMoedaCaixa(formas.dinheiro.contado)}</span>
                </p>
                <p>
                  PIX:{' '}
                  <span className="font-mono tabular-nums">{formatarMoedaCaixa(formas.pix.esperado)}</span>
                </p>
                <p>
                  Cartão:{' '}
                  <span className="font-mono tabular-nums">{formatarMoedaCaixa(formas.cartao.esperado)}</span>
                </p>
              </div>
            </div>
          )}

          {caixa.observacoes && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{caixa.observacoes}</p>
          )}
        </div>

        <DialogFooter className="border-t border-border/70 px-5 py-4">
          <Button type="button" variant="outline" className="h-11 w-full" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
