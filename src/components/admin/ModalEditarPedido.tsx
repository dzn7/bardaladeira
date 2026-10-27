'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { X, FloppyDisk as Save, CircleNotch as Loader2, Plus, Minus, Trash as Trash2, MagnifyingGlass as Search, Money as Banknote, CreditCard, QrCode, MapPin, ArrowsSplit as Split, ShoppingCart, User, CaretDown as ChevronDown, CaretUp as ChevronUp, Check, Wallet } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { normalizarNomeCategoria } from '@/lib/categoriasCardapio'
import {
  enfileirarImpressao,
  gerarHashEventoImpressao,
  type ItemSnapshotImpressao,
  type PedidoSnapshotImpressao,
} from '@/lib/filaImpressao'
import { limparSnapshotsOrfaosPagamentos } from '@/lib/pagamentoParcial'
import { cn } from '@/lib/utils'
import {
  AreaTexto,
  Botao,
  Campo,
  Cartao,
  Chip,
  Contador,
  Entrada,
  Gaveta,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Secao,
  Segmentos,
  Selecao,
} from '@/components/admin/ui'
import { criarVinculoCatalogoItemPedido } from '@/lib/vinculo-catalogo-item-pedido.mjs'
import { formatarErroEstoque } from '@/lib/estoque-produto.mjs'

type Pedido = {
  id: string
  numero_pedido?: number | string | null
  numero_pedido_diario?: number | null
  nome_cliente: string
  telefone?: string
  endereco?: string
  bairro?: string
  tipo_entrega: string
  status: string
  subtotal: number
  taxa_entrega: number
  taxa_servico?: number
  total: number
  created_at: string
  forma_pagamento?: string
  troco_para?: number | null
  observacoes?: string
  mesa?: number | null
  comanda?: number | null
}

type Bairro = {
  id: string
  nome: string
  taxa_entrega: number
  entrega_gratis: boolean
}

type ItemPedido = {
  id: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  created_at?: string
  observacoes?: string
  adicionais?: { id: string; nome: string; preco: number; quantidade?: number }[]
  produto_id?: string | null
  bebida_id?: string | null
  combo_id?: string | null
}

type Produto = {
  id: string
  nome: string
  preco: number
  categoria: string
  tipo: 'produto' | 'bebida' | 'combo'
}

type Pagamento = {
  id: string
  forma: string
  valor: number
}

type ModalEditarPedidoProps = {
  pedido: Pedido | null
  aberto: boolean
  onFechar: () => void
  onSucesso: () => void
}

const FORMAS_PAGAMENTO = [
  { id: 'PIX', nome: 'PIX', icone: QrCode },
  { id: 'Dinheiro', nome: 'Dinheiro', icone: Banknote },
  { id: 'Cartão', nome: 'Cartão', icone: CreditCard },
  { id: 'Crediário', nome: 'Crediário', icone: Wallet },
]

const OPCOES_STATUS = [
  { valor: 'pendente', label: 'Pendente', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  { valor: 'confirmado', label: 'Confirmado', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { valor: 'preparando', label: 'Preparando', cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  { valor: 'pronto', label: 'Pronto', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { valor: 'entregue', label: 'Entregue', cor: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300' },
  { valor: 'cancelado', label: 'Cancelado', cor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
]

const normalizarFormaPagamentoBanco = (forma: string): string => {
  const mapa: Record<string, string> = {
    'PIX': 'pix',
    'Dinheiro': 'dinheiro',
    'Cartão de Crédito': 'credito',
    'Cartão de Débito': 'debito',
    'Cartão': 'cartao',
    'Crediário': 'crediario',
    'Vale Refeição': 'vale_refeicao',
  }
  return mapa[forma] || forma.toLowerCase()
}

const ehItemTemporario = (id: string) => id.startsWith('temp-')

export default function ModalEditarPedido({ pedido, aberto, onFechar, onSucesso }: ModalEditarPedidoProps) {
  const [nomeCliente, setNomeCliente] = useState('')
  const [endereco, setEndereco] = useState('')
  const [bairro, setBairro] = useState('')
  const [bairros, setBairros] = useState<Bairro[]>([])
  // Buscados aqui, e não recebidos por prop: os 7 call sites deste modal montam o
  // objeto `pedido` com selects diferentes e nem todos trazem estas colunas.
  const [descontos, setDescontos] = useState({ cupom: 0, frete: 0, manual: 0 })
  const [tipoEntrega, setTipoEntrega] = useState('')
  const [status, setStatus] = useState('')
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [buscaProduto, setBuscaProduto] = useState('')
  const [mostrarProdutos, setMostrarProdutos] = useState(false)
  const [carregandoItens, setCarregandoItens] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [adicionaisDisponiveis, setAdicionaisDisponiveis] = useState<{ id: string; nome: string; preco: number }[]>([])
  const [itemSelecionadoParaAdicional, setItemSelecionadoParaAdicional] = useState<string | null>(null)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [trocoPara, setTrocoPara] = useState<string>('')
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [pagamentoDividido, setPagamentoDividido] = useState(false)
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [novoPagamentoForma, setNovoPagamentoForma] = useState('')
  const [novoPagamentoValor, setNovoPagamentoValor] = useState('')

  type SnapshotCrediario = { id: string; valor: number; itens: unknown }
  const [snapshotCrediario, setSnapshotCrediario] = useState<SnapshotCrediario | null>(null)
  const [confirmacaoCrediarioAberta, setConfirmacaoCrediarioAberta] = useState(false)

  useEffect(() => {
    if (pedido) {
      setNomeCliente(pedido.nome_cliente || 'Cliente')
      setEndereco(pedido.endereco || '')
      setBairro(pedido.bairro || '')
      setTipoEntrega(pedido.tipo_entrega || 'retirada')
      setStatus(pedido.status || 'confirmado')
      setFormaPagamento(pedido.forma_pagamento || '')

      if (pedido.troco_para && pedido.troco_para > 0) {
        setPrecisaTroco(true)
        setTrocoPara(pedido.troco_para.toString())
      } else {
        setPrecisaTroco(false)
        setTrocoPara('')
      }

      if (pedido.forma_pagamento === 'Dividido') {
        setPagamentoDividido(true)
        carregarPagamentosDivididos()
      } else {
        setPagamentoDividido(false)
        setPagamentos([])
      }

      carregarItensPedido()
      carregarBairros()
      carregarDescontosPedido()
      carregarProdutos()
      carregarAdicionais()
      carregarSnapshotCrediario()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido])

  const carregarBairros = async () => {
    try {
      const { data, error } = await supabase
        .from('bairros')
        .select('id, nome, taxa_entrega, entrega_gratis')
        .eq('ativo', true)
        .order('ordem')

      if (error) throw error
      setBairros(
        (data || []).map((b) => ({
          id: String(b.id),
          nome: String(b.nome),
          taxa_entrega: Number(b.taxa_entrega || 0),
          entrega_gratis: Boolean(b.entrega_gratis),
        }))
      )
    } catch (e) {
      console.error('Erro ao carregar bairros:', e)
      setBairros([])
    }
  }

  const carregarDescontosPedido = async () => {
    if (!pedido) return
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('desconto_cupom, desconto_frete, desconto_manual')
        .eq('id', pedido.id)
        .single()

      if (error) throw error
      setDescontos({
        cupom: Number(data?.desconto_cupom || 0),
        frete: Number(data?.desconto_frete || 0),
        manual: Number(data?.desconto_manual || 0),
      })
    } catch (e) {
      console.error('Erro ao carregar descontos do pedido:', e)
      setDescontos({ cupom: 0, frete: 0, manual: 0 })
    }
  }

  const carregarSnapshotCrediario = async () => {
    if (!pedido) return
    if (!String(pedido.forma_pagamento || '').toLowerCase().includes('credi')) {
      setSnapshotCrediario(null)
      return
    }
    try {
      const { data, error } = await supabase
        .from('crediario_movimentos')
        .select('id, valor, itens')
        .eq('pedido_id', pedido.id)
        .eq('origem', 'pedido')
        .eq('tipo', 'consumo')
        .eq('status', 'ativo')
        .maybeSingle()
      if (error) throw error
      if (data) {
        setSnapshotCrediario({
          id: String(data.id),
          valor: Number(data.valor || 0),
          itens: data.itens,
        })
      } else {
        setSnapshotCrediario(null)
      }
    } catch (e) {
      console.error('Erro ao carregar snapshot crediário:', e)
      setSnapshotCrediario(null)
    }
  }

  const carregarPagamentosDivididos = async () => {
    if (!pedido) return
    try {
      const { data, error } = await supabase
        .from('pagamentos_pedido')
        .select('*')
        .eq('pedido_id', pedido.id)

      if (!error && data) {
        setPagamentos(
          data.map((p) => ({
            id: p.id,
            forma: p.forma_pagamento,
            valor: p.valor,
          }))
        )
      }
    } catch (e) {
      console.error('Erro ao carregar pagamentos:', e)
    }
  }

  const carregarItensPedido = async () => {
    if (!pedido) return
    setCarregandoItens(true)
    try {
      const { data: itensData, error } = await supabase
        .from('itens_pedido')
        .select('*')
        .eq('pedido_id', pedido.id)
        .order('created_at')

      if (error) throw error

      const itensComAdicionais = await Promise.all(
        (itensData || []).map(async (item) => {
          const { data: adicionais } = await supabase
            .from('item_adicionais')
            .select('id, nome, preco, quantidade')
            .eq('item_pedido_id', item.id)

          return { ...item, adicionais: adicionais || [] }
        })
      )

      setItens(itensComAdicionais)
    } catch (error) {
      console.error('Erro ao carregar itens:', error)
    } finally {
      setCarregandoItens(false)
    }
  }

  const carregarProdutos = async () => {
    try {
      const { data: produtosData } = await supabase
        .from('produtos')
        .select('id, nome, preco, categoria')
        .eq('disponivel', true)
        .order('nome')

      const { data: bebidasData } = await supabase
        .from('bebidas')
        .select('id, nome, preco, descricao, categoria')
        .eq('disponivel', true)
        .order('nome')

      const { data: combosData } = await supabase
        .from('combos')
        .select('id, nome, preco')
        .eq('disponivel', true)
        .order('nome')

      const produtosFormatados = (produtosData || []).map((p) => ({
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco),
        categoria: p.categoria,
        tipo: 'produto' as const,
      }))

      const bebidasFormatadas = (bebidasData || []).map((b) => ({
        id: b.id,
        nome: `${b.nome}${b.descricao ? ` - ${b.descricao}` : ''}`,
        preco: Number(b.preco),
        categoria: normalizarNomeCategoria(b.categoria),
        tipo: 'bebida' as const,
      }))

      const combosFormatados = (combosData || []).map((combo) => ({
        id: combo.id,
        nome: combo.nome,
        preco: Number(combo.preco),
        categoria: 'Combos',
        tipo: 'combo' as const,
      }))

      setProdutos([...produtosFormatados, ...bebidasFormatadas, ...combosFormatados])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    }
  }

  const carregarAdicionais = async () => {
    try {
      const { data, error } = await supabase
        .from('adicionais')
        .select('id, nome, preco')
        .eq('disponivel', true)
        .order('nome')

      if (error) throw error
      setAdicionaisDisponiveis(data || [])
    } catch (error) {
      console.error('Erro ao carregar adicionais:', error)
    }
  }

  const adicionarAdicionalAoItem = useCallback(
    (itemId: string, adicional: { id: string; nome: string; preco: number }) => {
      setItens((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item
          if (item.adicionais?.find((a) => a.id === adicional.id)) return item

          const novosAdicionais = [...(item.adicionais || []), adicional]
          const precoAdicionais = novosAdicionais.reduce((sum, a) => sum + Number(a.preco), 0)
          return {
            ...item,
            adicionais: novosAdicionais,
            subtotal: (item.preco_unitario + precoAdicionais) * item.quantidade,
          }
        })
      )
    },
    []
  )

  const removerAdicionalDoItem = useCallback((itemId: string, adicionalId: string) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const novosAdicionais = (item.adicionais || []).filter((a) => a.id !== adicionalId)
        const precoAdicionais = novosAdicionais.reduce((sum, a) => sum + Number(a.preco), 0)
        return {
          ...item,
          adicionais: novosAdicionais,
          subtotal: (item.preco_unitario + precoAdicionais) * item.quantidade,
        }
      })
    )
  }, [])

  const adicionarItem = useCallback((produto: Produto) => {
    const novoItem: ItemPedido = {
      id: `temp-${Date.now()}`,
      nome_item: produto.nome,
      quantidade: 1,
      preco_unitario: produto.preco,
      subtotal: produto.preco,
      created_at: new Date().toISOString(),
      observacoes: '',
      ...criarVinculoCatalogoItemPedido(produto.tipo, produto.id),
    }
    setItens((prev) => [...prev, novoItem])
    setBuscaProduto('')
    setMostrarProdutos(false)
  }, [])

  const removerItem = useCallback((itemId: string) => {
    setItens((prev) => prev.filter((item) => item.id !== itemId))
  }, [])

  const atualizarQuantidade = useCallback((itemId: string, quantidade: number) => {
    if (quantidade < 1) return
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const precoAdicionais = (item.adicionais || []).reduce((soma, adicional) => {
          return soma + Number(adicional.preco) * Number(adicional.quantidade || 1)
        }, 0)
        return { ...item, quantidade, subtotal: (item.preco_unitario + precoAdicionais) * quantidade }
      })
    )
  }, [])

  const atualizarObservacoes = useCallback((itemId: string, observacoes: string) => {
    setItens((prev) => prev.map((item) => (item.id === itemId ? { ...item, observacoes } : item)))
  }, [])

  const subtotalItens = useMemo(() => itens.reduce((acc, item) => acc + item.subtotal, 0), [itens])
  // A taxa vem do bairro (2, 3 ou 5 conforme cadastro), como no PDV. Bairro histórico
  // que saiu do cadastro ou pedido antigo sem bairro preserva a taxa já gravada —
  // nunca cai para um valor fixo, que rebaixava silenciosamente entregas de R$ 5.
  const bairroSelecionado = bairros.find((item) => item.nome === bairro) || null
  const taxaEntrega =
    tipoEntrega !== 'entrega'
      ? 0
      : bairroSelecionado
        ? (bairroSelecionado.entrega_gratis ? 0 : bairroSelecionado.taxa_entrega)
        : Number(pedido?.taxa_entrega || 0)
  const taxaServico = tipoEntrega === 'local' ? Number(pedido?.taxa_servico || 0) : 0

  // Semântica das colunas, conferida em /admin/pedidos/novo e ModalCarrinho:
  // `desconto_itens_total` já está embutido no subtotal de cada item (não subtrair de novo),
  // `desconto_manual` é do pedido e fica FORA da soma dos itens,
  // `desconto_cupom`/`desconto_frete` ficam fora do subtotal gravado.
  // O frete grátis não pode passar da taxa vigente — trocar para um bairro mais barato
  // deixaria o desconto maior que a própria taxa.
  const descontoFreteEfetivo = Math.min(descontos.frete, taxaEntrega)
  const subtotalLiquido = Math.max(0, subtotalItens - descontos.manual)
  const totalFinal = Math.max(
    0,
    subtotalLiquido + taxaEntrega + taxaServico - descontos.cupom - descontoFreteEfetivo
  )
  const totalItensPedido = useMemo(() => itens.reduce((acc, item) => acc + item.quantidade, 0), [itens])

  const adicionarPagamento = useCallback(() => {
    if (!novoPagamentoForma) return

    const totalAtual = pagamentos.reduce((acc, p) => acc + p.valor, 0)
    const restante = totalFinal - totalAtual

    let valor = novoPagamentoValor ? parseFloat(novoPagamentoValor) : restante
    if (isNaN(valor) || valor <= 0) valor = restante
    if (valor > restante + 0.01) valor = restante

    if (valor <= 0) return

    setPagamentos((prev) => [
      ...prev,
      { id: Date.now().toString(), forma: novoPagamentoForma, valor },
    ])
    setNovoPagamentoForma('')
    setNovoPagamentoValor('')
  }, [novoPagamentoForma, novoPagamentoValor, pagamentos, totalFinal])

  const removerPagamento = useCallback((id: string) => {
    setPagamentos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const totalPagamentos = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos])
  const valorRestante = totalFinal - totalPagamentos

  const produtosFiltrados = useMemo(
    () => produtos.filter((p) => p.nome.toLowerCase().includes(buscaProduto.toLowerCase())),
    [produtos, buscaProduto]
  )

  const statusAtual = useMemo(
    () => OPCOES_STATUS.find((s) => s.valor === status) || OPCOES_STATUS[0],
    [status]
  )

  const salvarAlteracoes = async () => {
    if (!pedido || !nomeCliente) return

    if (pagamentoDividido && pagamentos.length === 0) {
      toast.warning('Adicione pelo menos um pagamento')
      return
    }

    if (pagamentoDividido && Math.abs(valorRestante) > 0.01) {
      toast.warning('O valor dos pagamentos deve ser igual ao total do pedido')
      return
    }

    // Pedido já está em crediário e ainda continua: perguntar se mudanças refletem
    if (
      snapshotCrediario &&
      String(formaPagamento || '').toLowerCase().includes('credi')
    ) {
      setConfirmacaoCrediarioAberta(true)
      return
    }

    await executarSalvar(true)
  }

  const executarSalvar = async (refletirNoCrediario: boolean) => {
    if (!pedido) return
    setSalvando(true)

    // Captura snapshot dos itens novos (IDs temporários) ANTES de salvar — após o
    // insert os IDs viram permanentes e perderíamos o sinal de "recém-adicionado".
    const itensNovosSnapshot: ItemSnapshotImpressao[] = itens
      .filter((item) => ehItemTemporario(item.id))
      .map((item) => ({
        nome_item: item.nome_item || 'Produto',
        quantidade: Number(item.quantidade || 1),
        preco_unitario: Number(item.preco_unitario || 0),
        subtotal: Number(item.subtotal || 0),
        observacoes: item.observacoes || null,
        item_adicionais: (item.adicionais || []).map((adicional) => ({
          nome: adicional.nome,
          preco: Number(adicional.preco || 0),
          quantidade: Number(adicional.quantidade || 1),
        })),
      }))

    try {
      const formaPagamentoPrincipal = pagamentoDividido ? 'Dividido' : formaPagamento
      const valorTrocoPara =
        formaPagamento === 'Dinheiro' && precisaTroco && trocoPara && !pagamentoDividido
          ? parseFloat(trocoPara)
          : null

      const { error: pedidoError } = await supabase
        .from('pedidos')
        .update({
          nome_cliente: nomeCliente || 'Cliente',
          endereco: endereco || null,
          bairro: tipoEntrega === 'entrega' ? (bairro || null) : null,
          tipo_entrega: tipoEntrega || 'retirada',
          status: status,
          subtotal: subtotalLiquido,
          taxa_entrega: taxaEntrega,
          desconto_frete: descontoFreteEfetivo,
          taxa_servico: taxaServico,
          total: totalFinal,
          forma_pagamento: formaPagamentoPrincipal || null,
          troco_para: valorTrocoPara,
        })
        .eq('id', pedido.id)

      if (pedidoError) throw pedidoError

      // Preserva pagamentos parciais (itens_pagos não-vazio) — criados pelo modal de detalhes.
      // Apaga apenas pagamentos do pedido completo (sem itens_pagos), que o form deste modal gerencia.
      const { error: deletePagError } = await supabase
        .from('pagamentos_pedido')
        .delete()
        .eq('pedido_id', pedido.id)
        .or('itens_pagos.is.null,itens_pagos.eq.[]')
      if (deletePagError) throw deletePagError

      // Soma o que já foi pago parcial (itens_pagos preservados acima) — não duplicar.
      const { data: pagamentosParciaisExistentes } = await supabase
        .from('pagamentos_pedido')
        .select('valor, itens_pagos')
        .eq('pedido_id', pedido.id)
      const valorJaPagoParcial = (pagamentosParciaisExistentes || [])
        .filter((p) => Array.isArray(p.itens_pagos) && p.itens_pagos.length > 0)
        .reduce((sum, p) => sum + Number(p.valor || 0), 0)
      const temPagamentoParcial = valorJaPagoParcial > 0.009
      const valorPagamentoGlobal = Math.max(0, Number((totalFinal - valorJaPagoParcial).toFixed(2)))

      if (!temPagamentoParcial) {
        if (pagamentoDividido && pagamentos.length > 0) {
          const pagamentosParaInserir = pagamentos.map((p) => ({
            pedido_id: pedido.id,
            forma_pagamento: normalizarFormaPagamentoBanco(p.forma),
            valor: p.valor,
          }))

          const { error: pagamentosError } = await supabase
            .from('pagamentos_pedido')
            .insert(pagamentosParaInserir)
          if (pagamentosError) throw pagamentosError
        } else if (formaPagamento && valorPagamentoGlobal > 0) {
          const { error: pagUnicoError } = await supabase
            .from('pagamentos_pedido')
            .insert({
              pedido_id: pedido.id,
              forma_pagamento: normalizarFormaPagamentoBanco(formaPagamento),
              valor: valorPagamentoGlobal,
            })
          if (pagUnicoError) throw pagUnicoError
        }
      }

      const { data: itensExistentes, error: itensExistentesError } = await supabase
        .from('itens_pedido')
        .select('id')
        .eq('pedido_id', pedido.id)
      if (itensExistentesError) throw itensExistentesError

      const idsItensMantidos = new Set(
        itens.filter((item) => !ehItemTemporario(item.id)).map((item) => item.id)
      )
      const idsItensParaRemover = (itensExistentes || [])
        .map((item) => item.id as string)
        .filter((id) => !idsItensMantidos.has(id))

      if (idsItensParaRemover.length > 0) {
        const { error: deleteAdicionaisRemovidosError } = await supabase
          .from('item_adicionais')
          .delete()
          .in('item_pedido_id', idsItensParaRemover)
        if (deleteAdicionaisRemovidosError) throw deleteAdicionaisRemovidosError

        const { error: deleteItensRemovidosError } = await supabase
          .from('itens_pedido')
          .delete()
          .in('id', idsItensParaRemover)
        if (deleteItensRemovidosError) throw deleteItensRemovidosError

        // Limpa snapshots órfãos em pagamentos_pedido.itens_pagos.
        // crediario_movimentos.itens é re-snapshotado pelo trigger trg_atualizar_snapshot_itens.
        await limparSnapshotsOrfaosPagamentos(pedido.id, new Set(idsItensParaRemover))
      }

      const idsItensAtuais = new Map<string, string>()
      for (const item of itens) {
        const dadosItem = {
          pedido_id: pedido.id,
          nome_item: item.nome_item || 'Produto',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
          observacoes: item.observacoes || null,
        }

        if (ehItemTemporario(item.id)) {
          const { data: itemInserido, error: insertItemError } = await supabase
            .from('itens_pedido')
            .insert({
              ...dadosItem,
              produto_id: item.produto_id || null,
              bebida_id: item.bebida_id || null,
              combo_id: item.combo_id || null,
              created_at: item.created_at || new Date().toISOString(),
            })
            .select('id')
            .single()

          if (insertItemError) throw insertItemError
          if (itemInserido?.id) idsItensAtuais.set(item.id, itemInserido.id)
        } else {
          const { error: updateItemError } = await supabase
            .from('itens_pedido')
            .update(dadosItem)
            .eq('id', item.id)
            .eq('pedido_id', pedido.id)

          if (updateItemError) throw updateItemError
          idsItensAtuais.set(item.id, item.id)
        }
      }

      const idsItensParaAtualizarAdicionais = Array.from(idsItensAtuais.values())
      if (idsItensParaAtualizarAdicionais.length > 0) {
        const { error: deleteAdicionaisError } = await supabase
          .from('item_adicionais')
          .delete()
          .in('item_pedido_id', idsItensParaAtualizarAdicionais)
        if (deleteAdicionaisError) throw deleteAdicionaisError
      }

      const adicionaisParaInserir: {
        item_pedido_id: string
        adicional_id: string
        nome: string
        preco: number
        quantidade: number
      }[] = []

      itens.forEach((item) => {
        const itemPedidoId = idsItensAtuais.get(item.id)
        if (!itemPedidoId || !item.adicionais?.length) return
        item.adicionais.forEach((adicional) => {
          adicionaisParaInserir.push({
            item_pedido_id: itemPedidoId,
            adicional_id: adicional.id,
            nome: adicional.nome,
            preco: Number(adicional.preco),
            quantidade: Number(adicional.quantidade || 1),
          })
        })
      })

      if (adicionaisParaInserir.length > 0) {
        const { error: insertAdicionaisError } = await supabase
          .from('item_adicionais')
          .insert(adicionaisParaInserir)
        if (insertAdicionaisError) throw insertAdicionaisError
      }

      // Caso "não refletir": restaurar snapshot original do movimento de crediário.
      // Os triggers do banco regeneraram itens/valor com base nas alterações; aqui
      // congelamos o crediário no estado anterior.
      if (
        !refletirNoCrediario &&
        snapshotCrediario &&
        String(formaPagamento || '').toLowerCase().includes('credi')
      ) {
        const { error: restoreError } = await supabase
          .from('crediario_movimentos')
          .update({
            valor: snapshotCrediario.valor,
            itens: snapshotCrediario.itens,
          })
          .eq('id', snapshotCrediario.id)
        if (restoreError) {
          console.error('Erro ao restaurar snapshot crediário:', restoreError)
          toast.error('Pedido salvo, mas não foi possível congelar o crediário')
        } else {
          toast.success('Pedido salvo · crediário mantido')
        }
      }

      if (itensNovosSnapshot.length > 0) {
        const semente = `${Date.now()}`
        const pedidoSnapshot: PedidoSnapshotImpressao = {
          id: pedido.id,
          numero_pedido: pedido.numero_pedido_diario ?? pedido.numero_pedido ?? null,
          nome_cliente: nomeCliente || 'Cliente',
          telefone: pedido.telefone || null,
          tipo_entrega: tipoEntrega || 'retirada',
          mesa: pedido.mesa ?? null,
          comanda: pedido.comanda ?? null,
          endereco: endereco || pedido.endereco || null,
          bairro: tipoEntrega === 'entrega' ? (bairro || pedido.bairro || null) : null,
          observacoes: pedido.observacoes || null,
          subtotal: subtotalLiquido,
          taxa_entrega: taxaEntrega,
          taxa_servico: taxaServico,
          total: totalFinal,
          forma_pagamento: formaPagamentoPrincipal || null,
          pagamentos_divididos: pagamentoDividido
            ? pagamentos.map((pagamento) => ({
                forma_pagamento: normalizarFormaPagamentoBanco(pagamento.forma),
                valor: pagamento.valor,
              }))
            : null,
          troco_para: valorTrocoPara,
          created_at: pedido.created_at,
        }

        // Itens novos imprimem APENAS o ticket de cozinha. O ticket do cliente
        // é gerado uma vez no fechamento; emitir um cliente a cada item gera
        // papel duplicado com o mesmo conteúdo (cozinha + cliente do "NOVOS ITENS").
        await enfileirarImpressao({
          pedidoId: pedido.id,
          tipo: 'cozinha',
          escopo: 'itens_novos',
          itensSnapshot: itensNovosSnapshot,
          pedidoSnapshot,
          origem: 'admin_editar_pedido',
          hashEvento: gerarHashEventoImpressao(
            pedido.id,
            'cozinha',
            'itens_novos',
            itensNovosSnapshot,
            `admin_editar_pedido:${semente}`
          ),
        })
      }

      onSucesso()
      onFechar()
    } catch (error) {
      console.error('Erro ao salvar alterações:', error)
      toast.error(formatarErroEstoque(error))
    } finally {
      setSalvando(false)
      setConfirmacaoCrediarioAberta(false)
    }
  }

  return (
    <>
      <Gaveta
        aberto={Boolean(aberto && pedido)}
        aoFechar={onFechar}
        bloqueada={salvando}
        largura="lg"
        titulo="Editar pedido"
        descricao={
          pedido ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono tabular-nums">#{pedido.id.slice(0, 8).toUpperCase()}</span>
              {pedido.mesa ? <span>· Mesa {pedido.mesa}</span> : null}
              {pedido.comanda ? <span>· Comanda {pedido.comanda}</span> : null}
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', statusAtual.cor)}>
                {statusAtual.label}
              </span>
            </span>
          ) : undefined
        }
        rodape={
          pedido ? (
            <>
              <Botao variante="contorno" onClick={onFechar} disabled={salvando}>
                Cancelar
              </Botao>
              <Botao
                onClick={salvarAlteracoes}
                carregando={salvando}
                disabled={!nomeCliente || itens.length === 0}
              >
                {!salvando && <Save className="size-4" />}
                {salvando ? 'Salvando...' : `Salvar · R$ ${totalFinal.toFixed(2)}`}
              </Botao>
            </>
          ) : undefined
        }
      >
        {pedido ? (
          <div className="space-y-6">
            <Secao titulo="Cliente">
              <div className="space-y-4">
                <Campo rotulo="Nome do cliente" htmlFor="editar-pedido-nome">
                  <Entrada
                    id="editar-pedido-nome"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    placeholder="Nome do cliente"
                    autoComplete="off"
                  />
                </Campo>

                <Campo rotulo="Como o pedido sai">
                  <Segmentos
                    rotuloAcessivel="Tipo do pedido"
                    valor={tipoEntrega}
                    aoMudar={setTipoEntrega}
                    opcoes={[
                      { valor: 'entrega', rotulo: 'Entrega' },
                      { valor: 'retirada', rotulo: 'Retirada' },
                      { valor: 'local', rotulo: 'No local' },
                    ]}
                  />
                </Campo>

                <Campo rotulo="Status" htmlFor="editar-pedido-status">
                  <Selecao id="editar-pedido-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {OPCOES_STATUS.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.label}
                      </option>
                    ))}
                  </Selecao>
                </Campo>

                {(tipoEntrega === 'entrega' || pedido.endereco) && (
                  <Campo rotulo="Endereço" htmlFor="editar-pedido-endereco" opcional>
                    <AreaTexto
                      id="editar-pedido-endereco"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      rows={2}
                    />
                  </Campo>
                )}

                {tipoEntrega === 'entrega' && (
                  <>
                    <Campo
                      rotulo="Bairro"
                      htmlFor="editar-pedido-bairro"
                      ajuda={`Taxa de entrega: R$ ${taxaEntrega.toFixed(2).replace('.', ',')}`}
                    >
                      <Selecao id="editar-pedido-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)}>
                        <option value="">Não informado (mantém a taxa atual)</option>
                        {/* Bairro do pedido que saiu do cadastro continua selecionável,
                            senão salvar o pedido o apagaria sem o operador perceber. */}
                        {bairro && !bairroSelecionado && (
                          <option value={bairro}>{bairro} (fora do cadastro)</option>
                        )}
                        {bairros.map((b) => (
                          <option key={b.id} value={b.nome}>
                            {b.nome} — {b.entrega_gratis ? 'grátis' : `R$ ${b.taxa_entrega.toFixed(2).replace('.', ',')}`}
                          </option>
                        ))}
                      </Selecao>
                    </Campo>
                  </>
                )}
              </div>
            </Secao>

            <Secao
              titulo="Itens"
              descricao={`${totalItensPedido} ${totalItensPedido === 1 ? 'item' : 'itens'} · R$ ${subtotalItens.toFixed(2)}`}
            >
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Entrada
                    type="search"
                    value={buscaProduto}
                    onChange={(e) => {
                      setBuscaProduto(e.target.value)
                      setMostrarProdutos(e.target.value.length > 0)
                    }}
                    onFocus={() => setMostrarProdutos(buscaProduto.length > 0)}
                    placeholder="Buscar produto para adicionar"
                    aria-label="Buscar produto para adicionar"
                    className="pl-9"
                  />
                </div>

                {mostrarProdutos && produtosFiltrados.length > 0 && (
                  <Lista className="max-h-64 overflow-y-auto">
                    {produtosFiltrados.map((produto) => (
                      <li key={produto.id}>
                        <button
                          type="button"
                          onClick={() => adicionarItem(produto)}
                          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/40"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{produto.nome}</span>
                            <span className="block truncate text-xs text-muted-foreground">{produto.categoria}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-foreground">
                            R$ {produto.preco.toFixed(2)}
                            <Plus className="size-4 text-primary" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </Lista>
                )}
                {mostrarProdutos && produtosFiltrados.length === 0 && (
                  <p className="px-1 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                )}

                {carregandoItens ? (
                  <ListaCarregando linhas={3} />
                ) : itens.length === 0 ? (
                  <ListaVazia
                    icone={<ShoppingCart />}
                    titulo="Nenhum item no pedido"
                    descricao="Busque um produto acima para adicionar."
                  />
                ) : (
                  <Lista>
                    {itens.map((item) => {
                      const adicionaisUnitarios = (item.adicionais || []).reduce((t, a) => t + Number(a.preco), 0)
                      const painelAberto = itemSelecionadoParaAdicional === item.id

                      return (
                        <li key={item.id} className="space-y-3 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {item.nome_item || 'Produto'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                R$ {item.preco_unitario.toFixed(2)}
                                {adicionaisUnitarios > 0 ? ` + R$ ${adicionaisUnitarios.toFixed(2)} adicionais/un.` : ''}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                              R$ {item.subtotal.toFixed(2)}
                            </p>
                          </div>

                          {item.adicionais && item.adicionais.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {item.adicionais.map((adicional) => (
                                <span
                                  key={adicional.id}
                                  className="inline-flex h-8 items-center gap-1 rounded-full bg-muted pl-3 pr-1 text-xs font-medium text-foreground"
                                >
                                  {adicional.nome}
                                  <button
                                    type="button"
                                    onClick={() => removerAdicionalDoItem(item.id, adicional.id)}
                                    aria-label={`Remover ${adicional.nome}`}
                                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <Contador
                              valor={item.quantidade}
                              aoMudar={(quantidade) => atualizarQuantidade(item.id, quantidade)}
                              minimo={1}
                              maximo={999}
                              rotuloAcessivel={`quantidade de ${item.nome_item || 'produto'}`}
                            />
                            <div className="flex items-center gap-1">
                              {adicionaisDisponiveis.length > 0 && (
                                <Botao
                                  variante={painelAberto ? 'fantasma' : 'contorno'}
                                  tamanho="sm"
                                  className="h-11"
                                  aria-expanded={painelAberto}
                                  onClick={() => setItemSelecionadoParaAdicional(painelAberto ? null : item.id)}
                                >
                                  {painelAberto ? 'Ocultar' : 'Adicionais'}
                                </Botao>
                              )}
                              <Botao
                                variante="perigoSuave"
                                tamanho="icone"
                                className="size-11"
                                aria-label={`Remover ${item.nome_item || 'item'}`}
                                onClick={() => removerItem(item.id)}
                              >
                                <Trash2 className="size-4" />
                              </Botao>
                            </div>
                          </div>

                          {painelAberto && (
                            <div className="flex flex-wrap gap-2">
                              {adicionaisDisponiveis.map((adicional) => {
                                const jaAdicionado = Boolean(item.adicionais?.some((a) => a.id === adicional.id))
                                return (
                                  <Chip
                                    key={adicional.id}
                                    ativo={jaAdicionado}
                                    disabled={jaAdicionado}
                                    onClick={() => adicionarAdicionalAoItem(item.id, adicional)}
                                    className="h-11 normal-case"
                                  >
                                    {jaAdicionado && <Check className="size-3.5" />}
                                    {adicional.nome}
                                    <span className="tabular-nums text-muted-foreground">+R$ {adicional.preco.toFixed(2)}</span>
                                  </Chip>
                                )
                              })}
                            </div>
                          )}

                          <Entrada
                            value={item.observacoes || ''}
                            onChange={(e) => atualizarObservacoes(item.id, e.target.value)}
                            placeholder="Observação do item (opcional)"
                            aria-label={`Observação de ${item.nome_item || 'item'}`}
                          />
                        </li>
                      )
                    })}
                  </Lista>
                )}
              </div>
            </Secao>

            <Secao
              titulo="Pagamento"
              acao={
                <Botao
                  variante={pagamentoDividido ? 'fantasma' : 'contorno'}
                  tamanho="sm"
                  aria-pressed={pagamentoDividido}
                  onClick={() => {
                    setPagamentoDividido(!pagamentoDividido)
                    if (!pagamentoDividido) {
                      setFormaPagamento('')
                      setPrecisaTroco(false)
                      setTrocoPara('')
                    } else {
                      setPagamentos([])
                    }
                  }}
                >
                  <Split className="size-4" />
                  {pagamentoDividido ? 'Pagamento único' : 'Dividir'}
                </Botao>
              }
            >
              {!pagamentoDividido ? (
                <div className="space-y-3">
                  <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {FORMAS_PAGAMENTO.map(({ id, nome, icone: Icone }) => {
                      const ativo = formaPagamento === id
                      return (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={ativo}
                          onClick={() => {
                            setFormaPagamento(id)
                            if (id !== 'Dinheiro') {
                              setPrecisaTroco(false)
                              setTrocoPara('')
                            }
                          }}
                          className={cn(
                            'flex min-h-14 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors',
                            ativo
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/70 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Icone className="size-5" />
                          {nome}
                        </button>
                      )
                    })}
                  </div>

                  {formaPagamento === 'Dinheiro' && (
                    <div className="space-y-3">
                      <LinhaInterruptor
                        titulo="Precisa de troco"
                        marcado={precisaTroco}
                        aoMudar={(marcado) => {
                          setPrecisaTroco(marcado)
                          if (!marcado) setTrocoPara('')
                        }}
                      />
                      {precisaTroco && (
                        <Campo
                          rotulo="Troco para"
                          htmlFor="editar-pedido-troco"
                          ajuda={
                            trocoPara && parseFloat(trocoPara) > 0
                              ? `Troco: R$ ${Math.max(0, parseFloat(trocoPara) - totalFinal).toFixed(2)}`
                              : undefined
                          }
                        >
                          <div className="space-y-2">
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                R$
                              </span>
                              <Entrada
                                id="editar-pedido-troco"
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={trocoPara}
                                onChange={(e) => setTrocoPara(e.target.value)}
                                placeholder="0,00"
                                className="pl-10 font-mono tabular-nums"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[20, 50, 100, 200].map((valor) => (
                                <Chip
                                  key={valor}
                                  ativo={trocoPara === valor.toString()}
                                  onClick={() => setTrocoPara(valor.toString())}
                                  className="h-11 px-4"
                                >
                                  R$ {valor}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        </Campo>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {pagamentos.length > 0 && (
                    <Lista>
                      {pagamentos.map((p) => (
                        <li key={p.id} className="flex min-h-12 items-center justify-between gap-2 py-1 pl-4 pr-1">
                          <span className="text-sm font-medium text-foreground">{p.forma}</span>
                          <span className="flex items-center gap-1">
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              R$ {p.valor.toFixed(2)}
                            </span>
                            <Botao
                              variante="perigoSuave"
                              tamanho="icone"
                              className="size-11"
                              aria-label={`Remover pagamento ${p.forma}`}
                              onClick={() => removerPagamento(p.id)}
                            >
                              <Trash2 className="size-4" />
                            </Botao>
                          </span>
                        </li>
                      ))}
                    </Lista>
                  )}

                  <div className="flex gap-2">
                    <Selecao
                      value={novoPagamentoForma}
                      onChange={(e) => setNovoPagamentoForma(e.target.value)}
                      aria-label="Forma do pagamento"
                      className="min-w-0 flex-1"
                    >
                      <option value="">Forma...</option>
                      <option value="PIX">PIX</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão de Crédito">Crédito</option>
                      <option value="Cartão de Débito">Débito</option>
                    </Selecao>
                    <Entrada
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={novoPagamentoValor}
                      onChange={(e) => setNovoPagamentoValor(e.target.value)}
                      placeholder={valorRestante > 0 ? valorRestante.toFixed(2) : '0'}
                      aria-label="Valor do pagamento"
                      className="w-28 text-center tabular-nums"
                    />
                    <Botao
                      tamanho="icone"
                      className="size-11 shrink-0"
                      aria-label="Adicionar pagamento"
                      onClick={adicionarPagamento}
                      disabled={!novoPagamentoForma || valorRestante <= 0}
                    >
                      <Plus className="size-4" />
                    </Botao>
                  </div>

                  <p
                    className={cn(
                      'text-sm font-medium',
                      Math.abs(valorRestante) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                    )}
                  >
                    {Math.abs(valorRestante) < 0.01
                      ? 'Pagamento completo'
                      : valorRestante > 0
                        ? `Falta: R$ ${valorRestante.toFixed(2)}`
                        : `Excesso: R$ ${Math.abs(valorRestante).toFixed(2)}`}
                  </p>
                </div>
              )}
            </Secao>

            <Secao titulo="Resumo">
              <Cartao className="space-y-1.5 p-4 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal ({totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'})</span>
                  <span className="tabular-nums">R$ {subtotalItens.toFixed(2)}</span>
                </div>
                {taxaEntrega > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Taxa de entrega</span>
                    <span className="tabular-nums">R$ {taxaEntrega.toFixed(2)}</span>
                  </div>
                )}
                {taxaServico > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Taxa de serviço</span>
                    <span className="tabular-nums">R$ {taxaServico.toFixed(2)}</span>
                  </div>
                )}
                {descontos.manual > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Desconto do pedido</span>
                    <span className="tabular-nums">− R$ {descontos.manual.toFixed(2)}</span>
                  </div>
                )}
                {descontos.cupom > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Cupom</span>
                    <span className="tabular-nums">− R$ {descontos.cupom.toFixed(2)}</span>
                  </div>
                )}
                {descontoFreteEfetivo > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Desconto no frete</span>
                    <span className="tabular-nums">− R$ {descontoFreteEfetivo.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/70 pt-2">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">R$ {totalFinal.toFixed(2)}</span>
                </div>
              </Cartao>
            </Secao>
          </div>
        ) : null}
      </Gaveta>

      <Gaveta
        aberto={confirmacaoCrediarioAberta}
        aoFechar={() => {
          if (!salvando) setConfirmacaoCrediarioAberta(false)
        }}
        bloqueada={salvando}
        titulo="Aplicar mudanças no crediário?"
        descricao="Este pedido já está num crediário aberto. As mudanças de itens e total podem ir para o crediário do cliente ou ficar só no pedido."
      >
        <div className="flex flex-col gap-2">
          <Botao tamanho="lg" carregando={salvando} onClick={() => void executarSalvar(true)}>
            <Wallet className="size-4" />
            Sim, refletir no crediário
          </Botao>
          <Botao variante="contorno" tamanho="lg" disabled={salvando} onClick={() => void executarSalvar(false)}>
            Não, manter crediário como está
          </Botao>
          <Botao variante="fantasma" disabled={salvando} onClick={() => setConfirmacaoCrediarioAberta(false)}>
            Cancelar
          </Botao>
        </div>
      </Gaveta>
    </>
  )
}
