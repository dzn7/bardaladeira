'use client'

import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'

type Pedido = {
  id: string
  nome_cliente: string
  telefone: string
  endereco?: string
  tipo_entrega: string
  status: string
  total: number
}

export default function EditarPedidoPage() {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
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
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (error) throw error

      setPedido(data)
      setNomeCliente(data.nome_cliente)
      setTelefone(data.telefone)
      setEndereco(data.endereco || '')
      setTipoEntrega(data.tipo_entrega)
      setStatus(data.status)
    } catch (error) {
      console.error('Erro ao carregar pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  const salvarAlteracoes = async () => {
    if (!nomeCliente || !telefone) {
      toast.warning('Preencha todos os campos obrigatórios')
      return
    }

    setSalvando(true)
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          nome_cliente: nomeCliente,
          telefone,
          endereco: endereco || null,
          tipo_entrega: tipoEntrega,
          status,
        })
        .eq('id', pedidoId)

      if (error) throw error

      router.push(`/admin/pedidos/${pedidoId}`)
    } catch (error) {
      console.error('Erro ao salvar alterações:', error)
      toast.error('Erro ao salvar alterações. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex justify-center items-center h-96">
            <Loader2 className="w-8 h-8 text-bordo-600 animate-spin" />
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
            <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-4">
              Pedido não encontrado
            </h2>
            <button
              onClick={() => router.push('/admin/pedidos')}
              className="px-6 py-2.5 bg-bordo-700 hover:bg-bordo-800 text-white rounded-lg font-medium transition-colors"
            >
              Voltar para Pedidos
            </button>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div>
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-900 dark:text-white" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
              Editar Pedido #{pedido.id.slice(0, 8).toUpperCase()}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">
                  Dados do Cliente
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Nome do Cliente *
                    </label>
                    <input
                      type="text"
                      value={nomeCliente}
                      onChange={(e) => setNomeCliente(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-bordo-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Telefone *
                    </label>
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-bordo-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Endereço
                    </label>
                    <textarea
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-bordo-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Tipo de Pedido
                    </label>
                    <select
                      value={tipoEntrega}
                      onChange={(e) => setTipoEntrega(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-bordo-500 focus:border-transparent transition-all"
                    >
                      <option value="entrega">Entrega</option>
                      <option value="retirada">Retirada</option>
                      <option value="local">Consumir no Local</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-bordo-500 focus:border-transparent transition-all"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em Preparo">Em Preparo</option>
                      <option value="Pronto">Pronto</option>
                      <option value="Entregue">Entregue</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6 sticky top-4">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                  Ações
                </h2>
                <div className="space-y-3">
                  <button
                    onClick={salvarAlteracoes}
                    disabled={salvando}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-bordo-700 hover:bg-bordo-800 disabled:bg-bordo-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Salvar Alterações
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => router.back()}
                    disabled={salvando}
                    className="w-full px-6 py-3 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    <strong>Nota:</strong> Esta página permite editar apenas os dados do
                    cliente e o status do pedido. Os itens do pedido não podem ser
                    alterados após a criação.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

