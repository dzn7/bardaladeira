'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, PencilSimple as Edit2, FileText, Receipt } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { gerarPDFPedido } from '@/lib/pdf-generator'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'
import {
  Botao,
  CabecalhoPagina,
  Cartao,
  Esqueleto,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Selo,
} from '@/components/admin/ui'

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
          <Pagina>
            <Esqueleto className="h-8 w-48" />
            <ListaCarregando linhas={4} />
          </Pagina>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  if (!pedido) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <Pagina>
            <ListaVazia
              icone={<Receipt />}
              titulo="Pedido não encontrado"
              descricao="Ele pode ter sido apagado."
              acao={<Botao onClick={() => router.push('/admin/pedidos')}>Voltar para pedidos</Botao>}
            />
          </Pagina>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  const nomeProduto = (item: ItemPedido) => item.nome_item || 'Produto'
  const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0)
  const rotuloTipo =
    pedido.tipo_entrega === 'entrega' ? 'Entrega' : pedido.tipo_entrega === 'retirada' ? 'Retirada' : 'Consumir no local'

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina>
          <div className="flex items-start gap-2">
            <Botao
              variante="fantasma"
              tamanho="icone"
              className="-ml-2 size-11 shrink-0"
              onClick={() => router.back()}
              aria-label="Voltar"
            >
              <ArrowLeft className="size-5" />
            </Botao>
            <div className="min-w-0 flex-1">
              <CabecalhoPagina
                titulo={`Pedido #${pedido.id.slice(0, 8).toUpperCase()}`}
                descricao={format(new Date(pedido.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                acoes={
                  <>
                    <Botao
                      variante="contorno"
                      onClick={() => {
                        setPedidoSelecionado(pedido)
                        setModalEditarAberto(true)
                      }}
                    >
                      <Edit2 className="size-4" />
                      Editar
                    </Botao>
                    <Botao onClick={handleGerarPDF}>
                      <FileText className="size-4" />
                      Gerar PDF
                    </Botao>
                  </>
                }
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <Secao titulo="Cliente">
                <Cartao className="grid gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium text-foreground">{pedido.nome_cliente}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium text-foreground">{pedido.telefone || '—'}</p>
                  </div>
                  {pedido.endereco && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted-foreground">Endereço</p>
                      <p className="font-medium text-foreground">{pedido.endereco}</p>
                    </div>
                  )}
                </Cartao>
              </Secao>

              <Secao titulo="Itens" descricao={`${totalItens} ${totalItens === 1 ? 'unidade' : 'unidades'}`}>
                {itens.length === 0 ? (
                  <ListaVazia icone={<Receipt />} titulo="Nenhum item encontrado" />
                ) : (
                  <Lista>
                    {itens.map((item, index) => (
                      <li key={item.id || index} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            <span className="tabular-nums text-muted-foreground">{item.quantidade}×</span>{' '}
                            {nomeProduto(item)}
                          </p>
                          {item.adicionais && (
                            <p className="mt-0.5 text-sm text-muted-foreground">+ {item.adicionais}</p>
                          )}
                          {item.observacoes && (
                            <p className="mt-0.5 text-sm italic text-muted-foreground">Obs: {item.observacoes}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-medium tabular-nums text-foreground">R$ {item.subtotal.toFixed(2)}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            R$ {item.preco_unitario.toFixed(2)} un.
                          </p>
                        </div>
                      </li>
                    ))}
                  </Lista>
                )}
              </Secao>
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <Secao titulo="Resumo">
                <Cartao className="space-y-4 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Selo>{rotuloTipo}</Selo>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${getStatusColor(pedido.status)}`}>
                      {pedido.status}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-border/70 pt-4">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">R$ {pedido.total.toFixed(2)}</span>
                  </div>
                </Cartao>
              </Secao>
            </div>
          </div>
        </Pagina>

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
