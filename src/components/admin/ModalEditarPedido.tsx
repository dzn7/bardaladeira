'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  X,
  Save,
  Loader2,
  Plus,
  Minus,
  Trash2,
  Search,
  Banknote,
  CreditCard,
  QrCode,
  MapPin,
  Split,
  ShoppingCart,
  User,
  ChevronDown,
  ChevronUp,
  Check,
  Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { normalizarNomeCategoria } from '@/lib/categoriasCardapio'
import {
  enfileirarImpressao,
  gerarHashEventoImpressao,
  type ItemSnapshotImpressao,
  type PedidoSnapshotImpressao,
} from '@/lib/filaImpressao'
import { limparSnapshotsOrfaosPagamentos } from '@/lib/pagamentoParcial'
import { ModalSheet } from '@/components/ui/modal-sheet'

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
}

type Produto = {
  id: string
  nome: string
  preco: number
  categoria: string
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
  const [secaoExpandida, setSecaoExpandida] = useState<'dados' | 'itens' | 'pagamento' | null>('itens')

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
      setSecaoExpandida('itens')
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

      const produtosFormatados = (produtosData || []).map((p) => ({
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco),
        categoria: p.categoria,
      }))

      const bebidasFormatadas = (bebidasData || []).map((b) => ({
        id: b.id,
        nome: `${b.nome}${b.descricao ? ` - ${b.descricao}` : ''}`,
        preco: Number(b.preco),
        categoria: normalizarNomeCategoria(b.categoria),
      }))

      setProdutos([...produtosFormatados, ...bebidasFormatadas])
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
    } finally {
      setSalvando(false)
      setConfirmacaoCrediarioAberta(false)
    }
  }

  const toggleSecao = (secao: 'dados' | 'itens' | 'pagamento') => {
    setSecaoExpandida((prev) => (prev === secao ? null : secao))
  }

  return (
    <>
      <ModalSheet
        open={Boolean(aberto && pedido)}
        onOpenChange={(open) => {
          if (!open) onFechar()
        }}
        title="Editar Pedido"
        showCloseButton={false}
        className="max-h-[100dvh] overflow-hidden sm:max-h-[92dvh] sm:max-w-2xl"
      >
        {pedido ? (
          <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bordo-100 dark:bg-bordo-950/40">
                  <ShoppingCart className="h-5 w-5 text-bordo-600 dark:text-bordo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Editar Pedido</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    #{pedido.id.slice(0, 8).toUpperCase()}
                    {pedido.mesa ? ` · Mesa ${pedido.mesa}` : ''}
                    {pedido.comanda ? ` · Comanda ${pedido.comanda}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusAtual.cor}`}>
                  {statusAtual.label}
                </span>
                <button
                  onClick={onFechar}
                  className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Seção: Dados do Cliente */}
              <div className="border-b border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => toggleSecao('dados')}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-bordo-500 dark:text-bordo-400" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">Dados do Cliente</span>
                  </div>
                  {secaoExpandida === 'dados' ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {secaoExpandida === 'dados' && (
                  <div className="px-5 pb-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                        Nome do Cliente
                      </label>
                      <input
                        type="text"
                        value={nomeCliente}
                        onChange={(e) => setNomeCliente(e.target.value)}
                        placeholder="Nome do cliente"
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                        Endereço
                      </label>
                      <textarea
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        rows={2}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                          Tipo
                        </label>
                        <select
                          value={tipoEntrega}
                          onChange={(e) => setTipoEntrega(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500 cursor-pointer"
                        >
                          <option value="entrega">Entrega</option>
                          <option value="retirada">Retirada</option>
                          <option value="local">Local</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                          Status
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className={`w-full px-3.5 py-2.5 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bordo-500 cursor-pointer ${statusAtual.cor}`}
                        >
                          {OPCOES_STATUS.map((opcao) => (
                            <option key={opcao.valor} value={opcao.valor}>
                              {opcao.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {tipoEntrega === 'entrega' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                            Bairro
                          </label>
                          <select
                            value={bairro}
                            onChange={(e) => setBairro(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500 cursor-pointer"
                          >
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
                          </select>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2 bg-bordo-50 dark:bg-bordo-950/20 border border-bordo-200 dark:border-bordo-800 rounded-lg">
                          <MapPin className="w-4 h-4 text-bordo-500" />
                          <span className="text-sm text-bordo-700 dark:text-bordo-300">
                            Taxa de entrega: R$ {taxaEntrega.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Seção: Itens do Pedido */}
              <div className="border-b border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => toggleSecao('itens')}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4 text-bordo-500 dark:text-bordo-400" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">Itens do Pedido</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-bordo-100 dark:bg-bordo-950/40 px-2.5 py-0.5 text-[11px] font-bold text-bordo-700 dark:text-bordo-300">
                      {totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'}
                    </span>
                    {secaoExpandida === 'itens' ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {secaoExpandida === 'itens' && (
                  <div className="px-5 pb-4">
                    {/* Buscar Produtos */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={buscaProduto}
                        onChange={(e) => {
                          setBuscaProduto(e.target.value)
                          setMostrarProdutos(e.target.value.length > 0)
                        }}
                        onFocus={() => setMostrarProdutos(buscaProduto.length > 0)}
                        placeholder="Buscar produto para adicionar..."
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bordo-500 focus:border-transparent"
                      />

                      {mostrarProdutos && produtosFiltrados.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                          {produtosFiltrados.map((produto) => (
                            <button
                              key={produto.id}
                              onClick={() => adicionarItem(produto)}
                              className="w-full px-4 py-2.5 text-left hover:bg-bordo-50 dark:hover:bg-bordo-950/20 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{produto.nome}</p>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{produto.categoria}</p>
                                </div>
                                <span className="text-sm font-bold text-bordo-600 dark:text-bordo-400">
                                  R$ {produto.preco.toFixed(2)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Lista de Itens */}
                    {carregandoItens ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-bordo-600" />
                      </div>
                    ) : itens.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
                        <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-zinc-400" />
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Nenhum item no pedido</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Busque produtos acima para adicionar.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {itens.map((item) => {
                          const adicionaisUnitarios = (item.adicionais || []).reduce((t, a) => t + Number(a.preco), 0)

                          return (
                            <article
                              key={item.id}
                              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/70"
                            >
                              {/* Header do item */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                                    {item.nome_item || 'Produto'}
                                  </p>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    R$ {item.preco_unitario.toFixed(2)}
                                    {adicionaisUnitarios > 0 ? ` + R$ ${adicionaisUnitarios.toFixed(2)} adicionais/un.` : ''}
                                  </p>
                                </div>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex-shrink-0">
                                  R$ {item.subtotal.toFixed(2)}
                                </p>
                              </div>

                              {/* Adicionais do item */}
                              {item.adicionais && item.adicionais.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {item.adicionais.map((adicional) => (
                                    <span
                                      key={adicional.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-bordo-50 dark:bg-bordo-950/30 text-bordo-700 dark:text-bordo-300 border border-bordo-200 dark:border-bordo-800"
                                    >
                                      {adicional.nome}
                                      <button
                                        onClick={() => removerAdicionalDoItem(item.id, adicional.id)}
                                        className="ml-0.5 hover:text-red-600 transition-colors cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Controles de quantidade */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
                                  <button
                                    onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                                    disabled={item.quantidade <= 1}
                                    className="h-8 w-8 rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 text-base font-medium cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center text-sm font-bold text-zinc-900 dark:text-white">
                                    {item.quantidade}
                                  </span>
                                  <button
                                    onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                                    className="h-8 w-8 rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 text-base font-medium cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="flex items-center gap-1">
                                  {adicionaisDisponiveis.length > 0 && (
                                    <button
                                      onClick={() =>
                                        setItemSelecionadoParaAdicional(
                                          itemSelecionadoParaAdicional === item.id ? null : item.id
                                        )
                                      }
                                      className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                                        itemSelecionadoParaAdicional === item.id
                                          ? 'bg-bordo-50 dark:bg-bordo-950/30 text-bordo-700 dark:text-bordo-300 border-bordo-300 dark:border-bordo-700'
                                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-bordo-300'
                                      }`}
                                    >
                                      {itemSelecionadoParaAdicional === item.id ? 'Ocultar' : '+ Adicionais'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removerItem(item.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Painel de adicionais */}
                              {itemSelecionadoParaAdicional === item.id && (
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                  {adicionaisDisponiveis.map((adicional) => {
                                    const jaAdicionado = item.adicionais?.some((a) => a.id === adicional.id)
                                    return (
                                      <button
                                        key={adicional.id}
                                        onClick={() => adicionarAdicionalAoItem(item.id, adicional)}
                                        disabled={jaAdicionado}
                                        className={`px-2.5 py-2 text-left text-xs rounded-lg border transition-colors cursor-pointer ${
                                          jaAdicionado
                                            ? 'bg-bordo-50 dark:bg-bordo-950/20 border-bordo-300 dark:border-bordo-700 opacity-60'
                                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-bordo-400 hover:bg-bordo-50 dark:hover:bg-bordo-950/20'
                                        }`}
                                      >
                                        <p className="font-medium text-zinc-900 dark:text-white truncate">{adicional.nome}</p>
                                        <p className="text-bordo-600 dark:text-bordo-400">+ R$ {adicional.preco.toFixed(2)}</p>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Observações */}
                              <input
                                type="text"
                                value={item.observacoes || ''}
                                onChange={(e) => atualizarObservacoes(item.id, e.target.value)}
                                placeholder="Observações..."
                                className="mt-2 w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-bordo-500"
                              />
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seção: Pagamento */}
              <div className="border-b border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => toggleSecao('pagamento')}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-bordo-500 dark:text-bordo-400" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">Pagamento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formaPagamento && !pagamentoDividido && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{formaPagamento}</span>
                    )}
                    {pagamentoDividido && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Dividido</span>
                    )}
                    {secaoExpandida === 'pagamento' ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {secaoExpandida === 'pagamento' && (
                  <div className="px-5 pb-4 space-y-3">
                    {/* Toggle dividir */}
                    <div className="flex justify-end">
                      <button
                        type="button"
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          pagamentoDividido
                            ? 'bg-bordo-100 dark:bg-bordo-950/30 text-bordo-700 dark:text-bordo-400 border border-bordo-300 dark:border-bordo-700'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <Split className="w-3.5 h-3.5" />
                        Dividir pagamento
                      </button>
                    </div>

                    {!pagamentoDividido ? (
                      <>
                        {/* Botões de forma de pagamento */}
                        <div className="grid grid-cols-3 gap-2">
                          {FORMAS_PAGAMENTO.map(({ id, nome, icone: Icone }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setFormaPagamento(id)
                                if (id !== 'Dinheiro') {
                                  setPrecisaTroco(false)
                                  setTrocoPara('')
                                }
                              }}
                              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                formaPagamento === id
                                  ? 'border-bordo-500 bg-bordo-50 dark:bg-bordo-950/30 text-bordo-700 dark:text-bordo-400'
                                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              <Icone className={`w-5 h-5 ${formaPagamento === id ? 'text-bordo-600 dark:text-bordo-400' : ''}`} />
                              <span className="text-xs font-medium">{nome}</span>
                            </button>
                          ))}
                        </div>

                        {/* Troco */}
                        {formaPagamento === 'Dinheiro' && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-3">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={precisaTroco}
                                onChange={(e) => {
                                  setPrecisaTroco(e.target.checked)
                                  if (!e.target.checked) setTrocoPara('')
                                }}
                                className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                Precisa de troco
                              </span>
                            </label>

                            {precisaTroco && (
                              <div className="space-y-2">
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm font-medium">
                                    R$
                                  </span>
                                  <input
                                    type="number"
                                    value={trocoPara}
                                    onChange={(e) => setTrocoPara(e.target.value)}
                                    placeholder="0,00"
                                    step="0.01"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                </div>
                                <div className="flex gap-1.5">
                                  {[20, 50, 100, 200].map((valor) => (
                                    <button
                                      key={valor}
                                      type="button"
                                      onClick={() => setTrocoPara(valor.toString())}
                                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                                        trocoPara === valor.toString()
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                                      }`}
                                    >
                                      R$ {valor}
                                    </button>
                                  ))}
                                </div>
                                {trocoPara && parseFloat(trocoPara) > 0 && (
                                  <div className="flex justify-between items-center px-3 py-2 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Troco:</span>
                                    <span className="text-sm font-bold text-emerald-600">
                                      R$ {Math.max(0, parseFloat(trocoPara) - totalFinal).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      /* Pagamento dividido */
                      <div className="bg-bordo-50 dark:bg-bordo-950/20 border border-bordo-200 dark:border-bordo-800 rounded-xl p-3 space-y-3">
                        {pagamentos.length > 0 && (
                          <div className="space-y-1.5">
                            {pagamentos.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border border-bordo-200 dark:border-bordo-800"
                              >
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">{p.forma}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-bordo-600 dark:text-bordo-400">
                                    R$ {p.valor.toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => removerPagamento(p.id)}
                                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <select
                            value={novoPagamentoForma}
                            onChange={(e) => setNovoPagamentoForma(e.target.value)}
                            className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-zinc-900 border border-bordo-200 dark:border-bordo-700 rounded-lg text-sm cursor-pointer"
                          >
                            <option value="">Forma...</option>
                            <option value="PIX">PIX</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="Cartão de Crédito">Crédito</option>
                            <option value="Cartão de Débito">Débito</option>
                          </select>
                          <input
                            type="number"
                            value={novoPagamentoValor}
                            onChange={(e) => setNovoPagamentoValor(e.target.value)}
                            placeholder={valorRestante > 0 ? valorRestante.toFixed(2) : '0'}
                            step="0.01"
                            className="w-24 px-3 py-2 bg-white dark:bg-zinc-900 border border-bordo-200 dark:border-bordo-700 rounded-lg text-sm text-center"
                          />
                          <button
                            type="button"
                            onClick={adicionarPagamento}
                            disabled={!novoPagamentoForma || valorRestante <= 0}
                            className="px-3 py-2 bg-bordo-600 text-white rounded-lg hover:bg-bordo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className={`text-center text-sm font-bold ${Math.abs(valorRestante) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {Math.abs(valorRestante) < 0.01
                            ? 'Pagamento completo'
                            : valorRestante > 0
                              ? `Falta: R$ ${valorRestante.toFixed(2)}`
                              : `Excesso: R$ ${Math.abs(valorRestante).toFixed(2)}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Ticket resumo + Salvar */}
            <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 px-5 py-4 space-y-3">
              {/* Resumo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal ({totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'})</span>
                  <span>R$ {subtotalItens.toFixed(2)}</span>
                </div>
                {taxaEntrega > 0 && (
                  <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>Taxa de entrega</span>
                    <span>R$ {taxaEntrega.toFixed(2)}</span>
                  </div>
                )}
                {taxaServico > 0 && (
                  <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>Taxa de serviço</span>
                    <span>R$ {taxaServico.toFixed(2)}</span>
                  </div>
                )}
                {descontos.manual > 0 && (
                  <div className="flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Desconto do pedido</span>
                    <span>− R$ {descontos.manual.toFixed(2)}</span>
                  </div>
                )}
                {descontos.cupom > 0 && (
                  <div className="flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Cupom</span>
                    <span>− R$ {descontos.cupom.toFixed(2)}</span>
                  </div>
                )}
                {descontoFreteEfetivo > 0 && (
                  <div className="flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Desconto no frete</span>
                    <span>− R$ {descontoFreteEfetivo.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-base font-bold text-zinc-900 dark:text-white">Total</span>
                  <span className="text-xl font-extrabold text-bordo-600 dark:text-bordo-400">
                    R$ {totalFinal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={onFechar}
                  disabled={salvando}
                  className="flex-1 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarAlteracoes}
                  disabled={salvando || !nomeCliente || itens.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-bordo-600/20"
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
        ) : null}
      </ModalSheet>

      <ModalSheet
        open={confirmacaoCrediarioAberta}
        onOpenChange={(open) => {
          if (!open && !salvando) setConfirmacaoCrediarioAberta(false)
        }}
        title="Aplicar mudanças no crediário?"
        showCloseButton={false}
        className="sm:max-w-md"
      >
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="size-5 text-amber-600 dark:text-amber-400" />
            <h4 className="text-base font-semibold text-zinc-900 dark:text-white">
              Aplicar mudanças no crediário?
            </h4>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Este pedido já está vinculado a um crediário aberto. As alterações feitas (itens, total)
            podem ser sincronizadas no crediário do cliente ou mantidas apenas no pedido.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void executarSalvar(true)}
              className="w-full rounded-xl bg-bordo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bordo-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Sim, refletir no crediário'}
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => void executarSalvar(false)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Não, manter crediário como está
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => setConfirmacaoCrediarioAberta(false)}
              className="w-full rounded-xl px-4 py-2 text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      </ModalSheet>
    </>
  )
}
