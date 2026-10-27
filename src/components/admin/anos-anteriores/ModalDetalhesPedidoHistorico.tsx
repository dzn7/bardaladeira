'use client'

import { MapPin, Phone, CreditCard, Clock, User } from '@phosphor-icons/react'
import { Botao, Gaveta, Lista, Secao, Selo } from '@/components/admin/ui'
import type { PedidoHistorico } from '@/lib/tipos-anos-anteriores'

type ModalDetalhesPedidoHistoricoProps = {
  pedido: PedidoHistorico | null
  aberto: boolean
  onFechar: () => void
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatarDataHora = (data: string): string => {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  })
}

type Tom = 'neutro' | 'primario' | 'sucesso' | 'alerta' | 'perigo'

export const tomStatusPedidoHistorico = (status: string): Tom => {
  switch (status?.toLowerCase()) {
    case 'pendente':
      return 'alerta'
    case 'preparando':
    case 'em preparo':
      return 'primario'
    case 'pronto':
      return 'sucesso'
    case 'cancelado':
      return 'perigo'
    default:
      return 'neutro'
  }
}

export const rotuloTipoPedidoHistorico = (tipo: string) =>
  tipo === 'entrega' ? 'Entrega' : tipo === 'local' ? 'No local' : 'Retirada'

export default function ModalDetalhesPedidoHistorico({
  pedido,
  aberto,
  onFechar
}: ModalDetalhesPedidoHistoricoProps) {
  return (
    <Gaveta
      aberto={aberto && !!pedido}
      aoFechar={onFechar}
      largura="lg"
      titulo={pedido ? pedido.nome_cliente : 'Pedido'}
      descricao={pedido ? `Pedido #${pedido.id.slice(0, 8).toUpperCase()} · ${formatarDataHora(pedido.created_at)}` : undefined}
      rodape={<Botao variante="contorno" onClick={onFechar}>Fechar</Botao>}
    >
      {pedido && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Selo tom={tomStatusPedidoHistorico(pedido.status)} className="capitalize">{pedido.status}</Selo>
            <Selo>{rotuloTipoPedidoHistorico(pedido.tipo_entrega)}</Selo>
            {pedido.mesa && <Selo>Mesa {pedido.mesa}</Selo>}
            {pedido.bairro && <Selo>{pedido.bairro}</Selo>}
          </div>

          <Secao titulo="Cliente">
            <Lista>
              <li className="flex items-center gap-3 px-4 py-3 text-sm">
                <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium text-foreground">{pedido.nome_cliente}</span>
              </li>
              {pedido.telefone && (
                <li className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-foreground">{pedido.telefone}</span>
                </li>
              )}
              {pedido.endereco && (
                <li className="flex items-start gap-3 px-4 py-3 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-foreground">{pedido.endereco}</span>
                </li>
              )}
              <li className="flex items-center gap-3 px-4 py-3 text-sm">
                <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-foreground">{formatarDataHora(pedido.created_at)}</span>
              </li>
              <li className="flex items-center gap-3 px-4 py-3 text-sm">
                <CreditCard className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-foreground">{pedido.forma_pagamento || 'Não informado'}</span>
              </li>
            </Lista>
          </Secao>

          <Secao titulo="Itens">
            {pedido.itens && pedido.itens.length > 0 ? (
              <Lista>
                {pedido.itens.map((item, index) => (
                  <li key={item.id || index} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.quantidade}x {item.nome_item || 'Produto'}
                      </p>
                      {item.adicionais && item.adicionais.length > 0 && (
                        <p className="mt-0.5 text-[13px] text-muted-foreground">
                          {item.adicionais.map((adicional) => `+ ${adicional.nome_adicional}`).join(' · ')}
                        </p>
                      )}
                      {item.observacoes && (
                        <p className="mt-0.5 text-[13px] text-muted-foreground">Obs.: {item.observacoes}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      R$ {formatarMoeda(item.subtotal)}
                    </span>
                  </li>
                ))}
              </Lista>
            ) : (
              <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                Os itens deste pedido não foram carregados.
              </p>
            )}
          </Secao>

          {pedido.observacoes && (
            <Secao titulo="Observações">
              <p className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-foreground">
                {pedido.observacoes}
              </p>
            </Secao>
          )}

          <dl className="space-y-2 rounded-xl border border-border/70 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-foreground">R$ {formatarMoeda(pedido.subtotal)}</dd>
            </div>
            {pedido.taxa_entrega > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Taxa de entrega</dt>
                <dd className="tabular-nums text-foreground">R$ {formatarMoeda(pedido.taxa_entrega)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border/70 pt-2">
              <dt className="font-medium text-foreground">Total</dt>
              <dd className="text-lg font-semibold tabular-nums text-foreground">R$ {formatarMoeda(pedido.total)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Gaveta>
  )
}
