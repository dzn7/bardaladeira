'use client'

import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { ArrowLeft, FloppyDisk as Save, Receipt } from '@phosphor-icons/react'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import {
  AreaTexto,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Entrada,
  Esqueleto,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Selecao,
} from '@/components/admin/ui'

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
          <Pagina className="max-w-2xl">
            <Esqueleto className="h-8 w-56" />
            <ListaCarregando linhas={3} />
          </Pagina>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  if (!pedido) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <Pagina className="max-w-2xl">
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

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina className="max-w-2xl">
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
                titulo={`Editar pedido #${pedido.id.slice(0, 8).toUpperCase()}`}
                descricao="Aqui você muda os dados do cliente e o status. Os itens são editados pela lista de pedidos."
              />
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(evento) => {
              evento.preventDefault()
              void salvarAlteracoes()
            }}
          >
            <Cartao className="space-y-4 p-4 md:p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Campo rotulo="Nome do cliente" htmlFor="editar-nome">
                  <Entrada
                    id="editar-nome"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </Campo>
                <Campo rotulo="Telefone" htmlFor="editar-telefone">
                  <Entrada
                    id="editar-telefone"
                    type="tel"
                    inputMode="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    required
                  />
                </Campo>
              </div>
              <Campo rotulo="Endereço" htmlFor="editar-endereco" opcional>
                <AreaTexto
                  id="editar-endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  rows={2}
                />
              </Campo>
              <div className="grid gap-4 md:grid-cols-2">
                <Campo rotulo="Tipo de pedido" htmlFor="editar-tipo">
                  <Selecao id="editar-tipo" value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)}>
                    <option value="entrega">Entrega</option>
                    <option value="retirada">Retirada</option>
                    <option value="local">Consumir no local</option>
                  </Selecao>
                </Campo>
                <Campo rotulo="Status" htmlFor="editar-status">
                  <Selecao id="editar-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="Pendente">Pendente</option>
                    <option value="Em Preparo">Em preparo</option>
                    <option value="Pronto">Pronto</option>
                    <option value="Entregue">Entregue</option>
                    <option value="Cancelado">Cancelado</option>
                  </Selecao>
                </Campo>
              </div>
            </Cartao>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Botao variante="contorno" onClick={() => router.back()} disabled={salvando}>
                Cancelar
              </Botao>
              <Botao type="submit" carregando={salvando}>
                {!salvando && <Save className="size-4" />}
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </Botao>
            </div>
          </form>
        </Pagina>
      </AdminLayout>
    </ProtectedRoute>
  )
}
