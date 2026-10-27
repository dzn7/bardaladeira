'use client'

import type * as React from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Botao, Gaveta, Selo } from '@/components/admin/ui'
import { formatarMoedaCaixa } from '@/lib/caixa-gaveta'
import { cn } from '@/lib/utils'
import type { Caixa } from '@/lib/tipos-caixa'

type Props = {
  caixa: Caixa | null
  onFechar: () => void
  /** Ações extras no rodapé (ex.: Excluir, Reabrir, PDF). */
  acoes?: React.ReactNode
}

function Linha({ rotulo, valor, className }: { rotulo: string; valor: string; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className={cn('font-mono text-sm font-medium tabular-nums text-foreground', className)}>{valor}</dd>
    </div>
  )
}

export default function ModalDetalhesCaixa({ caixa, onFechar, acoes }: Props) {
  if (!caixa) return null

  const aberto = caixa.status === 'aberto'
  const formas = caixa.fechamento_formas
  const diferenca = caixa.diferenca

  return (
    <Gaveta
      aberto={Boolean(caixa)}
      aoFechar={onFechar}
      titulo={
        <span className="flex items-center gap-2">
          Caixa
          <Selo tom={aberto ? 'alerta' : 'neutro'}>{aberto ? 'Aberto' : 'Fechado'}</Selo>
        </span>
      }
      descricao={format(new Date(caixa.data_abertura), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
      rodape={
        acoes ?? (
          <Botao variante="contorno" onClick={onFechar}>
            Fechar
          </Botao>
        )
      }
    >
      <div className="space-y-5">
        <dl className="divide-y divide-border/70 rounded-xl border border-border/70 px-4">
          <Linha rotulo="Abertura" valor={formatarMoedaCaixa(caixa.valor_abertura)} />
          <Linha
            rotulo="Entradas"
            valor={formatarMoedaCaixa(caixa.total_entradas)}
            className="text-emerald-600 dark:text-emerald-400"
          />
          <Linha rotulo="Saídas" valor={formatarMoedaCaixa(caixa.total_saidas)} className="text-destructive" />
          <Linha rotulo="Esperado em dinheiro" valor={formatarMoedaCaixa(caixa.saldo_esperado)} />
          {caixa.valor_fechamento != null && <Linha rotulo="Contado" valor={formatarMoedaCaixa(caixa.valor_fechamento)} />}
          {diferenca != null && (
            <Linha
              rotulo="Diferença"
              valor={formatarMoedaCaixa(diferenca)}
              className={cn(
                diferenca === 0
                  ? 'text-foreground'
                  : diferenca > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-destructive',
              )}
            />
          )}
        </dl>

        {(caixa.responsavel_abertura || caixa.responsavel_fechamento) && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {caixa.responsavel_abertura && <p>Abriu: <span className="text-foreground">{caixa.responsavel_abertura}</span></p>}
            {caixa.responsavel_fechamento && <p>Fechou: <span className="text-foreground">{caixa.responsavel_fechamento}</span></p>}
          </div>
        )}

        {formas && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Fechamento por forma</p>
            <dl className="divide-y divide-border/70 rounded-xl border border-border/70 px-4">
              <Linha rotulo="Dinheiro esperado" valor={formatarMoedaCaixa(formas.dinheiro.esperado)} />
              <Linha rotulo="Dinheiro contado" valor={formatarMoedaCaixa(formas.dinheiro.contado)} />
              <Linha rotulo="PIX" valor={formatarMoedaCaixa(formas.pix.esperado)} />
              <Linha rotulo="Cartão" valor={formatarMoedaCaixa(formas.cartao.esperado)} />
            </dl>
          </div>
        )}

        {caixa.observacoes && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Observações</p>
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{caixa.observacoes}</p>
          </div>
        )}
      </div>
    </Gaveta>
  )
}
