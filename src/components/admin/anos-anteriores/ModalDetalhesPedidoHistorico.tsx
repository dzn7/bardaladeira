'use client'

import { X, ShoppingCart, MapPin, Phone, CreditCard, Clock, User } from 'lucide-react'
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

const getCorStatus = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'preparando':
    case 'em preparo':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'pronto':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'entregue':
      return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400'
    case 'cancelado':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400'
  }
}

export default function ModalDetalhesPedidoHistorico({
  pedido,
  aberto,
  onFechar
}: ModalDetalhesPedidoHistoricoProps) {
  if (!aberto || !pedido) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onFechar}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Detalhes do Pedido
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                #{pedido.id.slice(0, 8).toUpperCase()} - Histórico 2025
              </p>
            </div>
            <button
              onClick={onFechar}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Informações do cliente */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                Informações do Cliente
              </h3>
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-zinc-400" />
                  <span className="text-zinc-900 dark:text-white font-medium">{pedido.nome_cliente}</span>
                  <span className={`ml-auto px-2 py-1 text-xs font-medium rounded-full ${getCorStatus(pedido.status)}`}>
                    {pedido.status}
                  </span>
                </div>
                {pedido.telefone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-700 dark:text-zinc-300">{pedido.telefone}</span>
                  </div>
                )}
                {pedido.endereco && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-zinc-400 mt-0.5" />
                    <span className="text-zinc-700 dark:text-zinc-300">{pedido.endereco}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">{formatarDataHora(pedido.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">{pedido.forma_pagamento || 'Não informado'}</span>
                </div>
              </div>
            </div>

            {/* Tipo de pedido */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                Tipo de Pedido
              </h3>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  pedido.tipo_entrega === 'entrega'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : pedido.tipo_entrega === 'local'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {pedido.tipo_entrega === 'entrega' ? 'Entrega' :
                   pedido.tipo_entrega === 'local' ? 'No Local' : 'Retirada'}
                </span>
                {pedido.mesa && (
                  <span className="px-3 py-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-sm font-medium">
                    Mesa {pedido.mesa}
                  </span>
                )}
                {pedido.bairro && (
                  <span className="px-3 py-1.5 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 rounded-full text-sm font-medium">
                    {pedido.bairro}
                  </span>
                )}
              </div>
            </div>

            {/* Itens do pedido */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Itens do Pedido
              </h3>
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl overflow-hidden">
                {pedido.itens && pedido.itens.length > 0 ? (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {pedido.itens.map((item, index) => (
                      <div key={item.id || index} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-zinc-900 dark:text-white">
                              {item.quantidade}x {item.nome_item || 'Produto'}
                            </p>
                            {item.observacoes && (
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                Obs: {item.observacoes}
                              </p>
                            )}
                            {item.adicionais && item.adicionais.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.adicionais.map((adicional, idx) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                    + {adicional.nome_adicional}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            R$ {formatarMoeda(item.subtotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
                    Itens não carregados para este pedido
                  </div>
                )}
              </div>
            </div>

            {/* Observações */}
            {pedido.observacoes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                  Observações
                </h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                  <p className="text-zinc-700 dark:text-zinc-300">{pedido.observacoes}</p>
                </div>
              </div>
            )}

            {/* Totais */}
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
                  <span className="text-zinc-900 dark:text-white">R$ {formatarMoeda(pedido.subtotal)}</span>
                </div>
                {pedido.taxa_entrega > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Taxa de Entrega</span>
                    <span className="text-zinc-900 dark:text-white">R$ {formatarMoeda(pedido.taxa_entrega)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <span className="text-lg font-bold text-zinc-900 dark:text-white">Total</span>
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    R$ {formatarMoeda(pedido.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={onFechar}
              className="w-full px-4 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 
                       dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 
                       rounded-xl font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
