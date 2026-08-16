'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Edit2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { gerarPDFPedido } from '@/lib/pdf-generator'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'

type Pedido = {
  id: string
  nome_cliente: string
  telefone: string
  endereco?: string
  tipo_entrega: string
  status: string
  subtotal: number
  taxa_entrega: number
  total: number
  created_at: string
}

type ItemPedido = {
  id: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  adicionais?: string
  observacoes?: string
}

export default function DetalhePedidoPage() {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const router = useRouter()
  const params = useParams()
  const pedidoId = params.id as string

  useEffect(() => {
    if (pedidoId) {
      carregarPedido()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId])

  const carregarPedido = async () => {
    try {
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (pedidoError) throw pedidoError

      const { data: itensData, error: itensError } = await supabase
        .from('itens_pedido')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at')

      if (itensError) throw itensError

      setPedido(pedidoData)
      setItens((itensData || []) as ItemPedido[])
    } catch (error) {
      console.error('Erro ao carregar pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGerarPDF = () => {
    if (!pedido) return
    const pedidoCompleto = {
      ...pedido,
      itens: itens.map((item) => ({
        produto: item.nome_item || 'Produto',
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.subtotal,
        adicionais: item.adicionais,
        observacoes: item.observacoes,
      })),
    }
    gerarPDFPedido(pedidoCompleto as any)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendente':
        return 'bg-amber-50 text-amber-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-amber-200 dark:border-yellow-800'
      case 'em preparo':
      case 'preparando':
        return 'bg-zinc-100 text-zinc-800 dark:bg-blue-900/20 dark:text-blue-400 border-zinc-300 dark:border-blue-800'
      case 'pronto':
        return 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800'
      case 'entregue':
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400 border-zinc-300 dark:border-zinc-800'
      case 'cancelado':
        return 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400 border-zinc-300 dark:border-zinc-800'
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex justify-center items-center h-96">
            <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  if (!pedido) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-4">Pedido não encontrado</p>
            <button
              onClick={() => router.push('/admin/pedidos')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              Voltar para Pedidos
            </button>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  const nomeProduto = (item: ItemPedido) => item.nome_item || 'Produto'

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-900 dark:text-white" />
              </button>
              <div>
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                  Pedido #{pedido.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {format(new Date(pedido.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPedidoSelecionado(pedido)
                  setModalEditarAberto(true)
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium 
                         text-amber-700 bg-amber-50 border border-amber-200 
                         hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 
                         dark:text-amber-400 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={handleGerarPDF}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                         bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
              >
                <FileText className="w-4 h-4" />
                Gerar PDF
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Coluna Esquerda */}
            <div className="lg:col-span-2 space-y-6">
              {/* Dados do Cliente */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
              >
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                  Dados do Cliente
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Nome</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">{pedido.nome_cliente}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Telefone</p>
                    <p className="font-semibold text-zinc-900 dark:text-white">{pedido.telefone}</p>
                  </div>
                  {pedido.endereco && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Endereço</p>
                      <p className="font-semibold text-zinc-900 dark:text-white">{pedido.endereco}</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Itens do Pedido */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
              >
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                  Itens do Pedido
                </h3>
                {itens.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">Nenhum item encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                            Produto
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                            Qtd
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                            Preço Un.
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {itens.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-zinc-900 dark:text-white">
                                {nomeProduto(item)}
                              </p>
                              {item.observacoes && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic">
                                  Obs: {item.observacoes}
                                </p>
                              )}
                              {item.adicionais && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                  Adicionais: {item.adicionais}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-zinc-900 dark:text-white">
                              {item.quantidade}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                              R$ {item.preco_unitario.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-white">
                              R$ {item.subtotal.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Coluna Direita */}
            <div className="lg:sticky lg:top-24">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
              >
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                  Informações do Pedido
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Tipo de Pedido</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      pedido.tipo_entrega === 'entrega' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' 
                        : pedido.tipo_entrega === 'retirada'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {pedido.tipo_entrega === 'entrega' ? 'Entrega' : pedido.tipo_entrega === 'retirada' ? 'Retirada' : 'Consumir no Local'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(pedido.status)}`}>
                      {pedido.status}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Total de Itens</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {itens.reduce((acc, item) => acc + item.quantidade, 0)}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Valor Total</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      R$ {pedido.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <ModalEditarPedido
          pedido={pedidoSelecionado}
          aberto={modalEditarAberto}
          onFechar={() => {
            setModalEditarAberto(false)
            setPedidoSelecionado(null)
          }}
          onSucesso={() => {
            carregarPedido()
          }}
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}
