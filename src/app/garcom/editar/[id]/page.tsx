'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Check,
  Package,
  User,
  MapPin,
  CreditCard,
  Clock,
} from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import GarcomLayout from '@/components/garcom/GarcomLayout'
import RotaProtegidaGarcom from '@/components/garcom/RotaProtegidaGarcom'
import ModalCatalogoItensPedido, {
  type CategoriaCatalogoGarcom,
  type ItemCatalogoGarcom,
} from '@/components/garcom/ModalCatalogoItensPedido'
import { supabase } from '@/lib/supabase'
import { obterSessao } from '@/lib/autenticacao'
import { normalizarNomeCategoria } from '@/lib/categoriasCardapio'
import { toast } from 'sonner'
import { useControleAcesso } from '@/contexts/ControleAcessoContext'

type ItemPedido = {
  id: string
  nome_item: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  observacoes?: string
}

type Pedido = {
  id: string
  nome_cliente: string
  telefone?: string
  endereco?: string
  tipo_entrega: string
  status: string
  subtotal: number
  taxa_entrega: number
  total: number
  created_at: string
  forma_pagamento?: string
  mesa?: number | null
  observacoes?: string
}

const statusPedidoEncerrado = (status: string) => {
  const normalizado = String(status || '').trim().toLowerCase()
  return normalizado === 'entregue' || normalizado === 'cancelado'
}

export default function EditarPedidoGarcomPage() {
  const { pode, emManutencao } = useControleAcesso()
  const podeExcluir = pode('garcom.pedidos', 'excluir') && !emManutencao('garcom.pedidos')
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [status, setStatus] = useState('')
  const [observacoes, setObservacoes] = useState('')
  
  // Estado para adicionar novos itens
  const [mostrarProdutos, setMostrarProdutos] = useState(false)
  const [itensCatalogo, setItensCatalogo] = useState<ItemCatalogoGarcom[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(false)
  const [adicionandoItemCatalogo, setAdicionandoItemCatalogo] = useState(false)
  const [erroCatalogo, setErroCatalogo] = useState<string | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [categoriaAtivaCatalogo, setCategoriaAtivaCatalogo] = useState('')
  const [itemSelecionadoCatalogo, setItemSelecionadoCatalogo] = useState<ItemCatalogoGarcom | null>(null)
  const [quantidadeSelecionadaCatalogo, setQuantidadeSelecionadaCatalogo] = useState(1)
  const [observacaoSelecionadaCatalogo, setObservacaoSelecionadaCatalogo] = useState('')
  const [acaoRapidaAplicada, setAcaoRapidaAplicada] = useState(false)

  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const pedidoId = params.id as string

  const carregarPedido = useCallback(async () => {
    if (!pedidoId) return

    try {
      setLoading(true)

      const [pedidoResult, itensResult] = await Promise.all([
        supabase.from('pedidos').select('*').eq('id', pedidoId).single(),
        supabase.from('itens_pedido').select('*').eq('pedido_id', pedidoId).order('created_at'),
      ])

      if (pedidoResult.error) throw pedidoResult.error

      setPedido(pedidoResult.data)
      setItens(itensResult.data || [])
      setStatus(pedidoResult.data.status || '')
      setObservacoes(pedidoResult.data.observacoes || '')
    } catch (error) {
      console.error('[Garçom] Erro ao carregar pedido:', error)
      toast.error('Erro ao carregar pedido')
    } finally {
      setLoading(false)
    }
  }, [pedidoId])

  useEffect(() => {
    carregarPedido()
  }, [carregarPedido])

  const carregarProdutos = useCallback(async (forcar: boolean = false) => {
    if (!forcar && itensCatalogo.length > 0) return

    setLoadingProdutos(true)
    setErroCatalogo(null)
    try {
      const [resultadoProdutos, resultadoBebidas, resultadoCombos, resultadoCategoriaCombo] = await Promise.all([
        supabase
          .from('produtos')
          .select('id, nome, preco, categoria')
          .eq('disponivel', true)
          .order('categoria')
          .order('nome'),
        supabase
          .from('bebidas')
          .select('id, nome, preco, categoria, descricao')
          .eq('disponivel', true)
          .order('categoria')
          .order('nome'),
        supabase
          .from('combos')
          .select('id, nome, preco')
          .eq('disponivel', true)
          .order('nome'),
        supabase
          .from('categorias_cardapio')
          .select('nome')
          .eq('tipo', 'combo')
          .eq('ativo', true)
          .order('ordem', { ascending: true })
          .limit(1),
      ])

      if (resultadoProdutos.error) throw resultadoProdutos.error
      if (resultadoBebidas.error) throw resultadoBebidas.error
      if (resultadoCombos.error) throw resultadoCombos.error
      if (resultadoCategoriaCombo.error) throw resultadoCategoriaCombo.error

      const categoriaCombo = normalizarNomeCategoria(resultadoCategoriaCombo.data?.[0]?.nome)

      const itensProdutos: ItemCatalogoGarcom[] = (resultadoProdutos.data || []).map((produto) => ({
        id: produto.id,
        nome: produto.nome,
        preco: Number(produto.preco),
        categoria: normalizarNomeCategoria(produto.categoria),
        tipo_item: 'produto',
      }))

      const itensBebidas: ItemCatalogoGarcom[] = (resultadoBebidas.data || []).map((bebida) => {
        const descricaoCurta = bebida.descricao ? ` - ${bebida.descricao}` : ''
        return {
          id: bebida.id,
          nome: `${bebida.nome}${descricaoCurta}`,
          preco: Number(bebida.preco),
          categoria: normalizarNomeCategoria(bebida.categoria),
          tipo_item: 'bebida',
        }
      })

      const itensCombos: ItemCatalogoGarcom[] = categoriaCombo
        ? (resultadoCombos.data || []).map((combo) => ({
          id: combo.id,
          nome: combo.nome,
          preco: Number(combo.preco),
          categoria: categoriaCombo,
          tipo_item: 'combo' as const,
        }))
        : []

      const catalogoOrdenado = [...itensProdutos, ...itensBebidas, ...itensCombos].sort((a, b) => {
        const comparacaoCategoria = a.categoria.localeCompare(b.categoria, 'pt-BR')
        if (comparacaoCategoria !== 0) return comparacaoCategoria
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

      setItensCatalogo(catalogoOrdenado)
    } catch (error) {
      console.error('[Garçom] Erro ao carregar produtos:', error)
      setErroCatalogo('Não foi possível carregar os itens agora. Tente novamente.')
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoadingProdutos(false)
    }
  }, [itensCatalogo.length])

  const categoriasCatalogo = useMemo<CategoriaCatalogoGarcom[]>(() => {
    const totaisPorCategoria = itensCatalogo.reduce((acumulador, item) => {
      const categoria = normalizarNomeCategoria(item.categoria)
      if (!categoria) return acumulador
      acumulador[categoria] = (acumulador[categoria] || 0) + 1
      return acumulador
    }, {} as Record<string, number>)

    return Object.entries(totaisPorCategoria)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [itensCatalogo])

  useEffect(() => {
    if (categoriasCatalogo.length === 0) {
      setCategoriaAtivaCatalogo('')
      return
    }

    const categoriaExiste = categoriasCatalogo.some((categoria) => categoria.nome === categoriaAtivaCatalogo)
    if (!categoriaExiste) {
      setCategoriaAtivaCatalogo(categoriasCatalogo[0].nome)
    }
  }, [categoriasCatalogo, categoriaAtivaCatalogo])

  const itensCatalogoFiltrados = useMemo(() => {
    const termoBusca = buscaProduto.trim().toLowerCase()
    if (termoBusca) {
      return itensCatalogo.filter(
        (item) =>
          item.nome.toLowerCase().includes(termoBusca) ||
          item.categoria.toLowerCase().includes(termoBusca)
      )
    }

    if (!categoriaAtivaCatalogo) return itensCatalogo
    return itensCatalogo.filter((item) => item.categoria === categoriaAtivaCatalogo)
  }, [itensCatalogo, buscaProduto, categoriaAtivaCatalogo])

  const adicionarNovoItem = async (
    itemCatalogo: ItemCatalogoGarcom,
    quantidade: number,
    observacao: string
  ) => {
    if (!pedido) return

    try {
      setAdicionandoItemCatalogo(true)
      const sessaoGarcom = obterSessao()

      const novoItem = {
        pedido_id: pedido.id,
        produto_id: itemCatalogo.tipo_item === 'produto' ? itemCatalogo.id : null,
        bebida_id: itemCatalogo.tipo_item === 'bebida' ? itemCatalogo.id : null,
        combo_id: itemCatalogo.tipo_item === 'combo' ? itemCatalogo.id : null,
        nome_item: itemCatalogo.nome,
        quantidade,
        preco_unitario: itemCatalogo.preco,
        subtotal: itemCatalogo.preco * quantidade,
        observacoes: observacao.trim() || null,
        adicionado_por_garcom_id: sessaoGarcom?.id || null,
      }

      const { data, error } = await supabase
        .from('itens_pedido')
        .insert(novoItem)
        .select()
        .single()

      if (error) throw error

      setItens((prev) => [...prev, data])
      await recalcularTotalPedido()
      setMostrarProdutos(false)
      setItemSelecionadoCatalogo(null)
      setQuantidadeSelecionadaCatalogo(1)
      setObservacaoSelecionadaCatalogo('')
      setBuscaProduto('')
      toast.success(`${itemCatalogo.nome} adicionado`)

      if (sessaoGarcom?.id) {
        try {
          await supabase.from('atividade_garcom').insert({
            garcom_id: sessaoGarcom.id,
            tipo_acao: 'item_adicionado',
            pedido_id: pedido.id,
            descricao: `Item adicionado: ${quantidade}x ${itemCatalogo.nome}`,
          })
        } catch {
          // atividade nao-critica
        }
      }
    } catch (error) {
      console.error('[Garçom] Erro ao adicionar item:', error)
      toast.error('Erro ao adicionar item')
    } finally {
      setAdicionandoItemCatalogo(false)
    }
  }

  const abrirModalProdutos = useCallback(() => {
    setMostrarProdutos(true)
    setItemSelecionadoCatalogo(null)
    setQuantidadeSelecionadaCatalogo(1)
    setObservacaoSelecionadaCatalogo('')
    setBuscaProduto('')
    void carregarProdutos()
  }, [carregarProdutos])

  const fecharModalProdutos = useCallback(() => {
    if (adicionandoItemCatalogo) return
    setMostrarProdutos(false)
    setItemSelecionadoCatalogo(null)
    setQuantidadeSelecionadaCatalogo(1)
    setObservacaoSelecionadaCatalogo('')
    setBuscaProduto('')
  }, [adicionandoItemCatalogo])

  const confirmarAdicaoItemCatalogo = useCallback(() => {
    if (!itemSelecionadoCatalogo) {
      toast.error('Selecione um item para continuar')
      return
    }

    void adicionarNovoItem(
      itemSelecionadoCatalogo,
      Math.max(1, quantidadeSelecionadaCatalogo),
      observacaoSelecionadaCatalogo
    )
  }, [itemSelecionadoCatalogo, quantidadeSelecionadaCatalogo, observacaoSelecionadaCatalogo, adicionarNovoItem])

  useEffect(() => {
    const acao = searchParams.get('acao')
    if (acao !== 'adicionar-item' || acaoRapidaAplicada || !pedido) return

    setAcaoRapidaAplicada(true)
    abrirModalProdutos()
    router.replace(`/garcom/editar/${pedidoId}`, { scroll: false })
  }, [searchParams, acaoRapidaAplicada, pedido, abrirModalProdutos, router, pedidoId])

  const atualizarQuantidadeItem = async (itemId: string, novaQuantidade: number) => {
    if (novaQuantidade < 1) return

    const item = itens.find((i) => i.id === itemId)
    if (!item) return

    const novoSubtotal = item.preco_unitario * novaQuantidade

    try {
      const { error } = await supabase
        .from('itens_pedido')
        .update({ quantidade: novaQuantidade, subtotal: novoSubtotal })
        .eq('id', itemId)

      if (error) throw error

      setItens((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, quantidade: novaQuantidade, subtotal: novoSubtotal } : i
        )
      )

      await recalcularTotalPedido()
    } catch (error) {
      console.error('[Garçom] Erro ao atualizar item:', error)
      toast.error('Erro ao atualizar item')
    }
  }

  const removerItem = async (itemId: string) => {
    if (itens.length <= 1) {
      toast.error('O pedido deve ter pelo menos um item')
      return
    }

    try {
      const { error } = await supabase.from('itens_pedido').delete().eq('id', itemId)

      if (error) throw error

      setItens((prev) => prev.filter((i) => i.id !== itemId))
      await recalcularTotalPedido()
      toast.success('Item removido')
    } catch (error) {
      console.error('[Garçom] Erro ao remover item:', error)
      toast.error('Erro ao remover item')
    }
  }

  const recalcularTotalPedido = async () => {
    if (!pedido) return

    const { data: itensAtualizados, error: erroItens } = await supabase
      .from('itens_pedido')
      .select('subtotal')
      .eq('pedido_id', pedido.id)

    if (erroItens) {
      console.error('[Garçom] Falha ao buscar itens para recálculo:', erroItens.message)
      return
    }

    const novoSubtotal = (itensAtualizados || []).reduce(
      (acc, item) => acc + Number(item.subtotal || 0),
      0
    )
    const novoTotal = novoSubtotal + Number(pedido.taxa_entrega || 0)

    const { error: erroUpdate } = await supabase
      .from('pedidos')
      .update({ subtotal: novoSubtotal, total: novoTotal })
      .eq('id', pedido.id)
    if (erroUpdate) console.error('[Garçom] Falha ao atualizar total do pedido:', erroUpdate.message)

    setPedido((prev) => (prev ? { ...prev, subtotal: novoSubtotal, total: novoTotal } : prev))
  }

  const salvarAlteracoes = async () => {
    if (!pedido) return

    try {
      setSalvando(true)

      const { error } = await supabase
        .from('pedidos')
        .update({
          status,
          observacoes: observacoes || null,
        })
        .eq('id', pedido.id)

      if (error) throw error

      if (pedido.tipo_entrega === 'local' && statusPedidoEncerrado(status)) {
        const { error: liberarMesaError } = await supabase
          .from('mesas')
          .update({
            status: 'livre',
            nome_cliente: null,
            ocupada_em: null,
            liberar_em: null,
            pedido_id: null,
          })
          .eq('pedido_id', pedido.id)

        if (liberarMesaError) {
          console.error('[Garçom] Erro ao liberar mesa/comanda do pedido encerrado:', liberarMesaError)
        }
      }

      setPedido((pedidoAtual) =>
        pedidoAtual
          ? {
              ...pedidoAtual,
              status,
              observacoes: observacoes || undefined,
            }
          : pedidoAtual
      )

      const sessaoGarcom = obterSessao()
      if (sessaoGarcom?.id) {
        try {
          await supabase.from('atividade_garcom').insert({
            garcom_id: sessaoGarcom.id,
            tipo_acao: 'pedido_modificado',
            pedido_id: pedido.id,
            descricao: `Pedido editado: status alterado para ${status}`,
          })
        } catch { /* atividade nao-critica */ }
      }

      setSucesso(true)
      toast.success('Pedido atualizado')
    } catch (error) {
      console.error('[Garçom] Erro ao salvar:', error)
      toast.error('Erro ao salvar alterações')
    } finally {
      setSalvando(false)
    }
  }

  const getStatusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case 'pendente':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
      case 'confirmado':
      case 'preparando':
      case 'em preparo':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'pronto':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'entregue':
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
      case 'cancelado':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
    }
  }

  if (loading) {
    return (
      <RotaProtegidaGarcom>
        <GarcomLayout>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-bordo-600 animate-spin" />
          </div>
        </GarcomLayout>
      </RotaProtegidaGarcom>
    )
  }

  if (!pedido) {
    return (
      <RotaProtegidaGarcom>
        <GarcomLayout>
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">Pedido não encontrado</p>
            <button
              onClick={() => router.push('/garcom')}
              className="px-4 py-2 bg-bordo-600 hover:bg-bordo-700 text-white rounded-lg transition-colors"
            >
              Voltar
            </button>
          </div>
        </GarcomLayout>
      </RotaProtegidaGarcom>
    )
  }

  if (sucesso) {
    return (
      <RotaProtegidaGarcom>
        <GarcomLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
            >
              <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
            </motion.div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Pedido Atualizado!</h2>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/garcom')}
                className="px-5 py-3 text-sm font-semibold text-white bg-bordo-600 hover:bg-bordo-700 rounded-xl transition-colors"
              >
                Ver Pedidos
              </button>
            </div>
          </div>
        </GarcomLayout>
      </RotaProtegidaGarcom>
    )
  }

  return (
    <RotaProtegidaGarcom>
      <GarcomLayout>
        <div className="space-y-4 pb-28">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                Editar Pedido
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                #{pedido.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Info do pedido */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="font-semibold">{pedido.nome_cliente}</span>
            </div>
            {pedido.endereco && (
              <div className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{pedido.endereco}</span>
              </div>
            )}
            {pedido.forma_pagamento && (
              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
                <CreditCard className="w-4 h-4" />
                <span>{pedido.forma_pagamento}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Status do Pedido
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'cancelado'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                    status === s
                      ? `${getStatusColor(s)} ring-2 ring-offset-1 ring-bordo-500`
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Itens */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-bordo-600 dark:text-bordo-400" />
                <h3 className="font-semibold text-zinc-900 dark:text-white">Itens do Pedido</h3>
              </div>
              <button
                type="button"
                onClick={abrirModalProdutos}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-bordo-600 hover:bg-bordo-700 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Item
              </button>
            </div>

            <div className="space-y-3">
              {itens.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">
                      {item.nome_item || 'Produto'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      R$ {Number(item.preco_unitario).toFixed(2)} un.
                    </p>
                    {item.observacoes && (
                      <p className="text-xs text-zinc-400 italic mt-1">{item.observacoes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => atualizarQuantidadeItem(item.id, item.quantidade - 1)}
                      disabled={item.quantidade <= 1}
                      className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold text-zinc-900 dark:text-white">
                      {item.quantidade}
                    </span>
                    <button
                      onClick={() => atualizarQuantidadeItem(item.id, item.quantidade + 1)}
                      className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-bordo-600 dark:text-bordo-400">
                      R$ {Number(item.subtotal).toFixed(2)}
                    </p>
                  </div>

                  {podeExcluir ? (
                    <button
                      onClick={() => removerItem(item.id)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label={`Remover ${item.nome_item || 'item'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Subtotal</span>
                <span>R$ {Number(pedido.subtotal).toFixed(2)}</span>
              </div>
              {Number(pedido.taxa_entrega) > 0 && (
                <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <span>Taxa de entrega</span>
                  <span>R$ {Number(pedido.taxa_entrega).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-zinc-900 dark:text-white pt-2">
                <span>Total</span>
                <span className="text-bordo-600 dark:text-bordo-400">
                  R$ {Number(pedido.total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações do pedido..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bordo-500 resize-none"
            />
          </div>

          {/* Botão salvar fixo */}
          <div className="fixed bottom-20 md:bottom-4 left-0 right-0 px-4 z-40">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={salvarAlteracoes}
                disabled={salvando}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-bordo-600 hover:bg-bordo-700 rounded-xl transition-colors shadow-lg disabled:opacity-50"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <ModalCatalogoItensPedido
          aberto={mostrarProdutos}
          carregando={loadingProdutos}
          carregandoAdicao={adicionandoItemCatalogo}
          erro={erroCatalogo}
          termoBusca={buscaProduto}
          onAlterarBusca={setBuscaProduto}
          onLimparBusca={() => setBuscaProduto('')}
          categorias={categoriasCatalogo}
          categoriaAtiva={categoriaAtivaCatalogo}
          onSelecionarCategoria={setCategoriaAtivaCatalogo}
          itensVisiveis={itensCatalogoFiltrados}
          itemSelecionado={itemSelecionadoCatalogo}
          onSelecionarItem={(item) => {
            setItemSelecionadoCatalogo(item)
            setQuantidadeSelecionadaCatalogo(1)
            setObservacaoSelecionadaCatalogo('')
          }}
          quantidadeSelecionada={quantidadeSelecionadaCatalogo}
          onAlterarQuantidade={(quantidade) => setQuantidadeSelecionadaCatalogo(Math.max(1, quantidade))}
          observacaoSelecionada={observacaoSelecionadaCatalogo}
          onAlterarObservacao={setObservacaoSelecionadaCatalogo}
          onFechar={fecharModalProdutos}
          onTentarNovamente={() => {
            void carregarProdutos(true)
          }}
          onConfirmarAdicao={confirmarAdicaoItemCatalogo}
        />
      </GarcomLayout>
    </RotaProtegidaGarcom>
  )
}
