'use client'

import { toast } from 'sonner'
import { useState, useEffect, Suspense, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowLeft,
  Save,
  Search,
  Plus,
  Minus,
  RotateCcw,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  X,
  Check,
  Loader2,
  Truck,
  Store,
  Package,
  Wallet,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import GarcomLayout from '@/components/garcom/GarcomLayout'
import RotaProtegidaGarcom from '@/components/garcom/RotaProtegidaGarcom'
import ModalItemPedido from '@/components/garcom/ModalItemPedido'
import { supabase } from '@/lib/supabase'
import { obterSessao } from '@/lib/autenticacao'
import { enfileirarImpressao, gerarHashEventoImpressao } from '@/lib/filaImpressao'
import { TEMPO_PADRAO_MESA_MINUTOS, calcularLiberacaoMesa } from '@/lib/mesas-tempo'
import { buscarProximoNumeroPedidoDiario, normalizarNumeroPedido, sincronizarNumeroPedidoDiario } from '@/lib/pedidos/numero-diario'
import { normalizarNomeCategoria } from '@/lib/categoriasCardapio'
import { nomeClienteParaPedido, nomeClienteParaPontoSalao } from '@/lib/nome-cliente-local.mjs'
import { Pill } from '@/components/kibo-ui/pill'

type TipoItemCatalogo = 'produto' | 'bebida' | 'combo'

type ProdutoSelecionado = {
  id: string
  nome: string
  preco: number
  quantidade: number
  observacoes: string
  adicionais: Adicional[]
  descontoManualInput: string
  tipo_item: TipoItemCatalogo
  produto_id: string | null
  bebida_id: string | null
  combo_id: string | null
}

type Produto = {
  id: string
  nome: string
  preco: number
  categoria: string
  tipo_item: TipoItemCatalogo
}

type Adicional = {
  id: string
  nome: string
  preco: number
}

type Pagamento = {
  id: string
  forma: string
  valor: number
}

type MesaDisponivel = {
  id: string
  numero: number
  tipo: TipoPontoSalao
  status: 'livre' | 'ocupada'
  nome_cliente: string | null
  identificador: string | null
}

type TipoPontoSalao = 'mesa' | 'local_externo'

type ClienteBusca = {
  id: string
  telefone: string
  nome: string | null
  endereco: string | null
  bairro: string | null
  total_pedidos: number
  ultimo_pedido_em: string | null
}

type Bairro = {
  id: string
  nome: string
  taxa_entrega: number
  entrega_gratis: boolean
}

const FORMAS_PAGAMENTO = [
  { id: 'dinheiro', nome: 'Dinheiro', icone: Banknote, cor: 'text-bordo-600' },
  { id: 'pix', nome: 'PIX', icone: Smartphone, cor: 'text-purple-600' },
  { id: 'credito', nome: 'Crédito', icone: CreditCard, cor: 'text-blue-600' },
  { id: 'debito', nome: 'Débito', icone: CreditCard, cor: 'text-amber-600' },
  { id: 'crediario', nome: 'Crediário', icone: Wallet, cor: 'text-zinc-700' },
]

const normalizarInputMonetario = (valor: string) => {
  const valorLimpo = valor.replace(',', '.').replace(/[^\d.]/g, '')
  if (!valorLimpo) return ''

  const partes = valorLimpo.split('.')
  if (partes.length === 1) return partes[0]

  const parteInteira = partes[0]
  const parteDecimal = partes.slice(1).join('').slice(0, 2)
  return parteDecimal.length > 0 ? `${parteInteira}.${parteDecimal}` : `${parteInteira}.`
}

const paraNumeroMonetario = (valor: string) => {
  const normalizado = valor.replace(',', '.').trim()
  if (!normalizado) return 0
  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero < 0) return 0
  return numero
}

const obterRotuloPontoSalao = (ponto: Pick<MesaDisponivel, 'numero' | 'tipo' | 'identificador'> | null) => {
  if (!ponto) return 'Mesa'
  const nome = ponto.identificador?.trim()
  if (nome) return nome
  return ponto.tipo === 'local_externo' ? `Local ${ponto.numero}` : `Mesa ${ponto.numero}`
}

function GarcomNovoPedidoContent() {
  const [nomeCliente, setNomeCliente] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBusca | null>(null)
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteBusca[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [endereco, setEndereco] = useState('')
  const [bairro, setBairro] = useState('')
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [tipoEntrega, setTipoEntrega] = useState('local')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [pagamentoDividido, setPagamentoDividido] = useState(false)
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [novoPagamentoForma, setNovoPagamentoForma] = useState('')
  const [novoPagamentoValor, setNovoPagamentoValor] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([])
  const [descontosAtivos, setDescontosAtivos] = useState(false)
  const [descontoPedidoInput, setDescontoPedidoInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProdutos, setLoadingProdutos] = useState(true)
  const [erroCatalogoProdutos, setErroCatalogoProdutos] = useState<string | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [adicionaisDisponiveis, setAdicionaisDisponiveis] = useState<Adicional[]>([])
  const [produtoSelecionadoParaAdicional, setProdutoSelecionadoParaAdicional] = useState<string | null>(null)
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [trocoPara, setTrocoPara] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [mesasDisponiveis, setMesasDisponiveis] = useState<MesaDisponivel[]>([])
  const [modoSalao, setModoSalao] = useState<TipoPontoSalao>('mesa')
  const [mesaSelecionada, setMesaSelecionada] = useState<number | null>(null)
  const [loadingMesas, setLoadingMesas] = useState(false)
  const [carregandoPedidoBase, setCarregandoPedidoBase] = useState(false)
  const [pedidoBaseRepeticao, setPedidoBaseRepeticao] = useState<string | null>(null)
  const [etapaMobile, setEtapaMobile] = useState<'dados' | 'produtos' | 'resumo'>('dados')
  const [categoriaAtiva, setCategoriaAtiva] = useState('')
  const [itemModal, setItemModal] = useState<{
    chave: string
    nome: string
    preco: number
    quantidade: number
    observacoes: string
    descontoManualInput: string
    produtoBase: Produto | null
    modoEdicao: boolean
  } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const navegarEtapaMobile = (etapa: 'dados' | 'produtos' | 'resumo') => {
    setEtapaMobile(etapa)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const obterChaveProduto = (produto: Pick<Produto, 'id' | 'tipo_item'>) =>
    `${produto.tipo_item}:${produto.id}`

  const obterEtiquetaTipoItem = (tipoItem: TipoItemCatalogo) => {
    if (tipoItem === 'produto') return 'Produto'
    if (tipoItem === 'bebida') return 'Bebida'
    return 'Combo'
  }

  useEffect(() => {
    carregarProdutosEBebidas()
    carregarAdicionais()
    carregarMesas()
    carregarBairros()
    carregarConfiguracaoDescontoGarcom()

    // Ler parâmetros da URL
    const mesaParam = searchParams.get('mesa')
    const localParam = searchParams.get('local')
    const comandaParam = searchParams.get('comanda')
    const repetirParam = searchParams.get('repetir')

    if (mesaParam) {
      const num = parseInt(mesaParam)
      if (!isNaN(num)) {
        setMesaSelecionada(num)
        setModoSalao('mesa')
        setTipoEntrega('local')
      }
    } else if (localParam) {
      const num = parseInt(localParam)
      if (!isNaN(num)) {
        setMesaSelecionada(num)
        setModoSalao('local_externo')
        setTipoEntrega('local')
      }
    } else if (comandaParam) {
      const num = parseInt(comandaParam)
      if (!isNaN(num)) {
        setTipoEntrega('local')
      }
    }

    if (repetirParam) {
      setPedidoBaseRepeticao(repetirParam)
    }
  }, [])

  useEffect(() => {
    if (tipoEntrega !== 'local' || !mesaSelecionada) return
    if (clienteSelecionado) return
    const ponto = mesasDisponiveis.find((registro) => registro.tipo === modoSalao && registro.numero === mesaSelecionada) || null
    if (ponto?.nome_cliente) setNomeCliente(ponto.nome_cliente)
  }, [tipoEntrega, modoSalao, mesaSelecionada, mesasDisponiveis, clienteSelecionado])

  useEffect(() => {
    if (clienteSelecionado && clienteSelecionado.nome === nomeCliente) return
    const termo = nomeCliente.trim()
    if (termo.length < 2) {
      setClientesEncontrados([])
      return
    }
    // Não buscar quando o nome ainda é o rótulo automático da mesa/local (Mesa 1, Local 2 etc.)
    if (tipoEntrega === 'local' && /^(mesa|local|comanda)\s*\d+$/i.test(termo)) {
      setClientesEncontrados([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoClientes(true)
      try {
        const { data, error } = await supabase.rpc('buscar_clientes', {
          p_termo: nomeCliente.trim(),
          p_limite: 5,
        })

        if (error) throw error
        setClientesEncontrados((data || []) as ClienteBusca[])
      } catch (erro) {
        console.error('[Garçom] Erro ao buscar clientes:', erro)
      } finally {
        setBuscandoClientes(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [clienteSelecionado, nomeCliente, tipoEntrega])

  const carregarProdutosEBebidas = async () => {
    setLoadingProdutos(true)
    setErroCatalogoProdutos(null)
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

      const produtosFormatados: Produto[] = (resultadoProdutos.data || []).map((p) => ({
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco),
        categoria: normalizarNomeCategoria(p.categoria),
        tipo_item: 'produto',
      }))

      const bebidasFormatadas: Produto[] = (resultadoBebidas.data || []).map((b) => ({
        id: b.id,
        nome: `${b.nome}${b.descricao ? ` - ${b.descricao}` : ''}`,
        preco: Number(b.preco),
        categoria: normalizarNomeCategoria(b.categoria),
        tipo_item: 'bebida',
      }))

      const combosFormatados: Produto[] = categoriaCombo
        ? (resultadoCombos.data || []).map((combo) => ({
          id: combo.id,
          nome: combo.nome,
          preco: Number(combo.preco),
          categoria: categoriaCombo,
          tipo_item: 'combo' as const,
        }))
        : []

      const catalogoOrdenado = [...produtosFormatados, ...bebidasFormatadas, ...combosFormatados].sort((a, b) => {
        const comparacaoCategoria = a.categoria.localeCompare(b.categoria, 'pt-BR')
        if (comparacaoCategoria !== 0) return comparacaoCategoria
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

      setProdutos(catalogoOrdenado)
    } catch (error) {
      console.error('[Garçom] Erro ao carregar produtos:', error)
      setErroCatalogoProdutos('Não foi possível carregar o catálogo de produtos no momento.')
    } finally {
      setLoadingProdutos(false)
    }
  }

  const carregarAdicionais = async () => {
    // Adicionais desabilitados - negócio não trabalha com adicionais atualmente
    setAdicionaisDisponiveis([])
  }

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
    } catch (error) {
      console.error('Erro ao carregar bairros:', error)
      setBairros([])
    }
  }

  const carregarMesas = async () => {
    setLoadingMesas(true)
    try {
      await supabase.rpc('limpar_mesas_expiradas')

      const { data, error } = await supabase
        .from('mesas')
        .select('id, numero, tipo, status, nome_cliente, identificador')
        .in('tipo', ['mesa', 'local_externo'])
        .order('tipo', { ascending: true })
        .order('numero', { ascending: true })

      if (error) throw error
      setMesasDisponiveis((data || []).map((ponto) => ({
        id: String(ponto.id),
        numero: Number(ponto.numero),
        tipo: ponto.tipo === 'local_externo' ? 'local_externo' : 'mesa',
        status: ponto.status === 'ocupada' ? 'ocupada' : 'livre',
        nome_cliente: ponto.nome_cliente || null,
        identificador: ponto.identificador || null,
      })))
    } catch (error) {
      console.error('[Garçom] Erro ao carregar mesas:', error)
    } finally {
      setLoadingMesas(false)
    }
  }

  const carregarConfiguracaoDescontoGarcom = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('valor')
        .eq('chave', 'garcom_habilitar_descontos_novo_pedido')
        .maybeSingle()

      if (error) throw error

      const ativadoPadrao = String(data?.valor || 'false').toLowerCase() === 'true'
      setDescontosAtivos(ativadoPadrao)
    } catch (error) {
      console.error('[Garçom] Erro ao carregar configuração de desconto:', error)
      setDescontosAtivos(false)
    }
  }

  const carregarPedidoBaseRepeticao = async (pedidoId: string) => {
    setCarregandoPedidoBase(true)
    try {
      const { data: pedidoBase, error: erroPedidoBase } = await supabase
        .from('pedidos')
        .select('id, nome_cliente, tipo_entrega, endereco, bairro, forma_pagamento, mesa')
        .eq('id', pedidoId)
        .single()

      if (erroPedidoBase || !pedidoBase) return

      const { data: itensBase, error: erroItensBase } = await supabase
        .from('itens_pedido')
        .select('id, nome_item, quantidade, preco_unitario, observacoes')
        .eq('pedido_id', pedidoId)

      if (erroItensBase || !itensBase) return

      const tipoBase = String(pedidoBase.tipo_entrega || 'local')
      const formaBaseNormalizada = String(pedidoBase.forma_pagamento || '').toLowerCase()
      const formaPagamentoBase =
        formaBaseNormalizada === 'dinheiro' ? 'Dinheiro'
          : formaBaseNormalizada === 'pix' ? 'PIX'
            : formaBaseNormalizada === 'credito' || formaBaseNormalizada === 'cartão de crédito' ? 'Cartão de Crédito'
              : formaBaseNormalizada === 'debito' || formaBaseNormalizada === 'cartão de débito' ? 'Cartão de Débito'
                : formaBaseNormalizada === 'crediario' || formaBaseNormalizada === 'crediário' ? 'Crediário'
                : String(pedidoBase.forma_pagamento || '')
      setTipoEntrega(tipoBase)
      setNomeCliente(String(pedidoBase.nome_cliente || 'Cliente'))
      setEndereco(String(pedidoBase.endereco || ''))
      setBairro(tipoBase === 'entrega' ? String(pedidoBase.bairro || '') : '')
      setFormaPagamento(formaPagamentoBase)
      setMesaSelecionada(tipoBase === 'local' ? (pedidoBase.mesa || null) : null)
      setPagamentoDividido(false)
      setPagamentos([])
      setPrecisaTroco(false)
      setTrocoPara('')

      const itensConvertidos: ProdutoSelecionado[] = itensBase.map((item, indice) => {
        const produtoEncontrado = produtos.find((produto) =>
          produto.nome.toLowerCase() === String(item.nome_item || '').toLowerCase()
        )
        const tipoItem = produtoEncontrado?.tipo_item || 'produto'
        const identificadorProduto = produtoEncontrado ? obterChaveProduto(produtoEncontrado) : `repetido-${item.id}-${indice}`

        return {
          id: identificadorProduto,
          nome: String(item.nome_item || 'Produto'),
          preco: Number(item.preco_unitario || 0),
          quantidade: Number(item.quantidade || 1),
          observacoes: String(item.observacoes || ''),
          adicionais: [],
          descontoManualInput: '',
          tipo_item: tipoItem,
          produto_id: tipoItem === 'produto' && produtoEncontrado ? produtoEncontrado.id : null,
          bebida_id: tipoItem === 'bebida' && produtoEncontrado ? produtoEncontrado.id : null,
          combo_id: tipoItem === 'combo' && produtoEncontrado ? produtoEncontrado.id : null,
        }
      })

      setProdutosSelecionados(itensConvertidos)
    } catch (error) {
      console.error('[Garçom] Erro ao carregar pedido base:', error)
    } finally {
      setCarregandoPedidoBase(false)
      setPedidoBaseRepeticao(null)
    }
  }

  useEffect(() => {
    if (!pedidoBaseRepeticao || produtos.length === 0) return
    carregarPedidoBaseRepeticao(pedidoBaseRepeticao)
  }, [pedidoBaseRepeticao, produtos.length])

  const abrirModalParaProduto = (produto: Produto) => {
    const chave = obterChaveProduto(produto)
    const existente = produtosSelecionados.find((item) => item.id === chave)
    setItemModal({
      chave,
      nome: produto.nome,
      preco: produto.preco,
      quantidade: existente?.quantidade ?? 1,
      observacoes: existente?.observacoes ?? '',
      descontoManualInput: existente?.descontoManualInput ?? '',
      produtoBase: produto,
      modoEdicao: Boolean(existente),
    })
  }

  const abrirModalParaItemSelecionado = (item: ProdutoSelecionado) => {
    setItemModal({
      chave: item.id,
      nome: item.nome,
      preco: item.preco,
      quantidade: item.quantidade,
      observacoes: item.observacoes,
      descontoManualInput: item.descontoManualInput,
      produtoBase: null,
      modoEdicao: true,
    })
  }

  const confirmarItemModal = (atualizado: { quantidade: number; observacoes: string; descontoManualInput: string }) => {
    if (!itemModal) return
    const { chave, produtoBase } = itemModal
    setProdutosSelecionados((atual) => {
      const existente = atual.find((item) => item.id === chave)
      if (existente) {
        return atual.map((item) =>
          item.id === chave
            ? {
                ...item,
                quantidade: Math.max(1, atualizado.quantidade),
                observacoes: atualizado.observacoes,
                descontoManualInput: atualizado.descontoManualInput,
              }
            : item,
        )
      }
      if (!produtoBase) return atual
      return [
        ...atual,
        {
          id: chave,
          nome: produtoBase.nome,
          preco: produtoBase.preco,
          quantidade: Math.max(1, atualizado.quantidade),
          observacoes: atualizado.observacoes,
          adicionais: [],
          descontoManualInput: atualizado.descontoManualInput,
          tipo_item: produtoBase.tipo_item,
          produto_id: produtoBase.tipo_item === 'produto' ? produtoBase.id : null,
          bebida_id: produtoBase.tipo_item === 'bebida' ? produtoBase.id : null,
          combo_id: produtoBase.tipo_item === 'combo' ? produtoBase.id : null,
        },
      ]
    })
    setBuscaProduto('')
    setItemModal(null)
  }

  const removerItemModal = () => {
    if (!itemModal) return
    setProdutosSelecionados((atual) => atual.filter((item) => item.id !== itemModal.chave))
  }

  const removerProduto = (id: string) => {
    setProdutosSelecionados((atual) => atual.filter((item) => item.id !== id))
  }

  const atualizarQuantidade = (id: string, quantidade: number) => {
    if (quantidade < 1) return
    setProdutosSelecionados((atual) =>
      atual.map((item) => (item.id === id ? { ...item, quantidade } : item))
    )
  }

  const atualizarObservacoes = (id: string, observacoes: string) => {
    setProdutosSelecionados((atual) =>
      atual.map((item) => (item.id === id ? { ...item, observacoes } : item))
    )
  }

  const atualizarDescontoItem = (id: string, valor: string) => {
    const normalizado = normalizarInputMonetario(valor)
    setProdutosSelecionados((atual) =>
      atual.map((item) => (item.id === id ? { ...item, descontoManualInput: normalizado } : item))
    )
  }

  const alterarDescontoPedido = (valor: string) => {
    setDescontoPedidoInput(normalizarInputMonetario(valor))
  }

  const adicionarAdicional = (produtoId: string, adicional: Adicional) => {
    setProdutosSelecionados((atual) =>
      atual.map((p) => {
        if (p.id === produtoId) {
          const jaTemAdicional = p.adicionais.find((a) => a.id === adicional.id)
          if (jaTemAdicional) return p
          return { ...p, adicionais: [...p.adicionais, adicional] }
        }
        return p
      })
    )
  }

  const removerAdicional = (produtoId: string, adicionalId: string) => {
    setProdutosSelecionados((atual) =>
      atual.map((p) => {
        if (p.id === produtoId) {
          return { ...p, adicionais: p.adicionais.filter((a) => a.id !== adicionalId) }
        }
        return p
      })
    )
  }

  const calcularSubtotalBrutoProduto = (produto: ProdutoSelecionado) => {
    const precoAdicionais = produto.adicionais.reduce((sum, adicional) => sum + adicional.preco, 0)
    return (produto.preco + precoAdicionais) * produto.quantidade
  }

  const calcularDescontoProduto = (produto: ProdutoSelecionado) => {
    if (!descontosAtivos) return 0
    return Math.min(
      calcularSubtotalBrutoProduto(produto),
      paraNumeroMonetario(produto.descontoManualInput || '')
    )
  }

  const calcularSubtotalProduto = (produto: ProdutoSelecionado) =>
    Math.max(0, calcularSubtotalBrutoProduto(produto) - calcularDescontoProduto(produto))

  const subtotalBrutoPedido = useMemo(
    () => produtosSelecionados.reduce((acc, produto) => acc + calcularSubtotalBrutoProduto(produto), 0),
    [produtosSelecionados]
  )

  const descontoItensTotal = useMemo(
    () => produtosSelecionados.reduce((acc, produto) => acc + calcularDescontoProduto(produto), 0),
    [produtosSelecionados, descontosAtivos]
  )

  const subtotalAposDescontosItens = useMemo(
    () => Math.max(0, subtotalBrutoPedido - descontoItensTotal),
    [subtotalBrutoPedido, descontoItensTotal]
  )

  const descontoPedidoAplicado = useMemo(() => {
    if (!descontosAtivos) return 0
    return Math.min(subtotalAposDescontosItens, paraNumeroMonetario(descontoPedidoInput))
  }, [descontosAtivos, subtotalAposDescontosItens, descontoPedidoInput])

  useEffect(() => {
    if (!descontosAtivos) {
      setDescontoPedidoInput('')
      setProdutosSelecionados((atual) =>
        atual.map((item) => ({ ...item, descontoManualInput: '' }))
      )
    }
  }, [descontosAtivos])

  const subtotalPedido = useMemo(
    () => Math.max(0, subtotalAposDescontosItens - descontoPedidoAplicado),
    [subtotalAposDescontosItens, descontoPedidoAplicado]
  )

  // Taxa derivada do bairro, como no PDV. O fixo antigo (R$ 2) era o mais barato do
  // cadastro e rebaixava entregas de R$ 3 e R$ 5.
  const bairroSelecionado = bairros.find((item) => item.nome === bairro) || null
  const taxaEntregaPedido =
    tipoEntrega !== 'entrega' || !bairroSelecionado
      ? 0
      : bairroSelecionado.entrega_gratis
        ? 0
        : bairroSelecionado.taxa_entrega
  const totalPedido = subtotalPedido + taxaEntregaPedido
  const totalItensPedido = useMemo(
    () => produtosSelecionados.reduce((acc, produto) => acc + produto.quantidade, 0),
    [produtosSelecionados]
  )

  const calcularTotal = () => totalPedido

  const adicionarPagamento = () => {
    if (!novoPagamentoForma || !novoPagamentoValor) return
    const valor = parseFloat(novoPagamentoValor)
    if (isNaN(valor) || valor <= 0) return
    
    const totalAtual = pagamentos.reduce((acc, p) => acc + p.valor, 0)
    const total = calcularTotal()
    
    if (totalAtual + valor > total) {
      toast.warning(`Valor excede o total do pedido. Máximo: R$ ${(total - totalAtual).toFixed(2)}`)
      return
    }
    
    setPagamentos([...pagamentos, {
      id: Date.now().toString(),
      forma: novoPagamentoForma,
      valor
    }])
    setNovoPagamentoForma('')
    setNovoPagamentoValor('')
  }

  const removerPagamento = (id: string) => {
    setPagamentos(pagamentos.filter(p => p.id !== id))
  }

  const limparPedidoAtual = () => {
    setProdutosSelecionados([])
    setPagamentoDividido(false)
    setPagamentos([])
    setFormaPagamento('')
    setNovoPagamentoForma('')
    setNovoPagamentoValor('')
    setPrecisaTroco(false)
    setTrocoPara('')
    setProdutoSelecionadoParaAdicional(null)
    setDescontoPedidoInput('')
    setBuscaProduto('')
    setCategoriaAtiva('')
    setEtapaMobile('dados')
  }

  const dadosClienteValidos =
    Boolean(nomeCliente.trim()) &&
    (tipoEntrega !== 'local' || mesaSelecionada) &&
    // Exige um bairro DO CADASTRO, não só um texto: bairro pré-preenchido de cliente
    // salvo ou de "repetir pedido" pode ter sido desativado e salvaria com taxa 0.
    (tipoEntrega !== 'entrega' || Boolean(bairroSelecionado))
  const itensSelecionados = produtosSelecionados.length > 0
  const totalPagamentos = pagamentos.reduce((acc, p) => acc + p.valor, 0)
  const valorRestante = totalPedido - totalPagamentos
  const pagamentoValido = pagamentoDividido
    ? pagamentos.length > 0 && Math.abs(valorRestante) <= 0.01
    : !!formaPagamento
  const podeSalvarPedido = Boolean(
    !loading &&
    dadosClienteValidos &&
    itensSelecionados &&
    pagamentoValido
  )
  const pendenciaEtapaDados =
    !nomeCliente.trim()
      ? 'Informe o nome do cliente'
      : tipoEntrega === 'local' && !mesaSelecionada
        ? 'Selecione uma mesa'
        : tipoEntrega === 'entrega' && !bairroSelecionado
          ? 'Selecione o bairro'
          : null
  const pendenciaEtapaProdutos = itensSelecionados ? null : 'Adicione pelo menos um item'
  const pendenciaPrincipalSalvar =
    !nomeCliente.trim()
      ? 'Informe o nome do cliente'
      : produtosSelecionados.length === 0
        ? 'Adicione pelo menos um item'
        : tipoEntrega === 'local' && !mesaSelecionada
          ? 'Selecione uma mesa'
          : tipoEntrega === 'entrega' && !bairroSelecionado
            ? 'Selecione o bairro'
            : !pagamentoValido
              ? 'Revise o pagamento'
              : null

  const pontosSalaoAtivos = useMemo(
    () => mesasDisponiveis.filter((ponto) => ponto.tipo === modoSalao),
    [mesasDisponiveis, modoSalao],
  )

  const pontoSalaoSelecionado = useMemo(
    () => pontosSalaoAtivos.find((ponto) => ponto.numero === mesaSelecionada) || null,
    [mesaSelecionada, pontosSalaoAtivos],
  )

  const primeiroPontoLivre = useMemo(
    () => pontosSalaoAtivos.find((ponto) => ponto.status === 'livre') || null,
    [pontosSalaoAtivos]
  )

  const salvarPedido = async () => {
    if (!nomeCliente.trim() || produtosSelecionados.length === 0) {
      toast.warning('Preencha o nome do cliente e adicione pelo menos um produto')
      return
    }

    if (tipoEntrega === 'local' && !mesaSelecionada) {
      toast.warning('Selecione uma mesa para pedido no local')
      return
    }

    if (tipoEntrega === 'entrega' && !bairroSelecionado) {
      toast.warning('Selecione o bairro da entrega')
      return
    }

    if (pagamentoDividido) {
      if (pagamentos.length === 0) {
        toast.warning('Adicione pelo menos uma forma de pagamento')
        return
      }
      if (Math.abs(valorRestante) > 0.01) {
        toast.warning('O valor dos pagamentos deve ser igual ao total do pedido')
        return
      }
    } else if (!formaPagamento) {
      toast.warning('Selecione uma forma de pagamento')
      return
    }

    setLoading(true)
    try {
      const subtotal = subtotalPedido
      const subtotalOriginal = subtotalBrutoPedido
      const descontoItens = descontoItensTotal
      const descontoManualPedido = descontoPedidoAplicado
      const taxaEntrega = taxaEntregaPedido
      const totalOriginal = subtotalOriginal + taxaEntrega
      const total = totalPedido

      const enderecoCompleto = tipoEntrega === 'entrega' && endereco ? endereco : null

      const formaPagamentoPrincipal = pagamentoDividido ? 'Dividido' : formaPagamento

      const valorTrocoPara = (formaPagamento === 'Dinheiro' && precisaTroco && trocoPara && !pagamentoDividido) 
        ? parseFloat(trocoPara) 
        : null

      const sessaoGarcom = obterSessao()
      const garcomId = sessaoGarcom?.id || null
      const proximoNumeroPedido = await buscarProximoNumeroPedidoDiario(supabase)
      const ehParceiroPedido = pontoSalaoSelecionado?.tipo === 'local_externo'
      const nomeClientePedido = nomeClienteParaPedido({
        nomeCliente,
        tipoEntrega,
        localParceiro: ehParceiroPedido,
      })
      const nomeClienteSalao = nomeClienteParaPontoSalao({
        nomeCliente,
        localParceiro: ehParceiroPedido,
      })

      // Cria pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero_pedido: proximoNumeroPedido,
          nome_cliente: nomeClientePedido,
          telefone: clienteSelecionado?.telefone || null,
          endereco: enderecoCompleto,
          bairro: tipoEntrega === 'entrega' ? (bairroSelecionado?.nome || null) : null,
          tipo_entrega: tipoEntrega,
          forma_pagamento: formaPagamentoPrincipal,
          subtotal_original: subtotalOriginal,
          subtotal: subtotal,
          desconto_itens_total: descontoItens,
          desconto_manual: descontoManualPedido,
          taxa_entrega: taxaEntrega,
          total_original: totalOriginal,
          total: total,
          status: 'preparando',
          troco_para: valorTrocoPara,
          mesa: tipoEntrega === 'local' ? mesaSelecionada : null,
          mesa_id: tipoEntrega === 'local' ? pontoSalaoSelecionado?.id || null : null,
          garcom_id: garcomId,
          cliente_id: clienteSelecionado?.id || null,
        })
        .select()
        .single()

      if (pedidoError) throw pedidoError
      await sincronizarNumeroPedidoDiario(supabase, pedido).catch((erro) => {
        console.error('[Garçom] Falha ao sincronizar número diário do pedido:', erro)
        return normalizarNumeroPedido(pedido.numero_pedido)
      })

      // Ocupar mesa se for pedido local — locais parceiros nunca bloqueiam
      if (tipoEntrega === 'local' && mesaSelecionada && pontoSalaoSelecionado?.tipo === 'mesa') {
        const agora = new Date()
        const liberarEm = calcularLiberacaoMesa(agora)
        const { data: mesasAtualizadas, error: mesaError } = await supabase
          .from('mesas')
          .update({
            status: 'ocupada',
            nome_cliente: nomeClienteSalao,
            ocupada_em: agora.toISOString(),
            liberar_em: liberarEm.toISOString(),
            tempo_limite_minutos: TEMPO_PADRAO_MESA_MINUTOS,
            pedido_id: pedido.id
          })
          .eq('id', pontoSalaoSelecionado.id)
          .eq('status', 'livre')
          .select('id')

        if (mesaError) throw mesaError

        if (!mesasAtualizadas || mesasAtualizadas.length === 0) {
          await supabase.from('pedidos').delete().eq('id', pedido.id)
          throw new Error(`${obterRotuloPontoSalao(pontoSalaoSelecionado)} acabou de ser ocupada. Atualize e escolha outra mesa.`)
        }
      }

      // Inserir pagamentos
      if (pagamentoDividido && pagamentos.length > 0) {
        const pagamentosParaInserir = pagamentos.map(p => ({
          pedido_id: pedido.id,
          forma_pagamento: p.forma,
          valor: p.valor
        }))

        const { error: pagDivError } = await supabase.from('pagamentos_pedido').insert(pagamentosParaInserir)
        if (pagDivError) console.error('[Garçom] Falha ao inserir pagamentos divididos:', pagDivError.message)
      } else {
        const formaNormalizada = formaPagamento === 'Dinheiro' ? 'dinheiro' 
          : formaPagamento === 'PIX' ? 'pix'
          : formaPagamento === 'Cartão de Crédito' ? 'credito'
          : formaPagamento === 'Cartão de Débito' ? 'debito'
          : formaPagamento === 'Crediário' ? 'crediario'
          : 'dinheiro'

        const { error: pagError } = await supabase.from('pagamentos_pedido').insert({
          pedido_id: pedido.id,
          forma_pagamento: formaNormalizada,
          valor: total
        })
        if (pagError) console.error('[Garçom] Falha ao inserir pagamento:', pagError.message)
      }

      // Inserir itens
      for (const p of produtosSelecionados) {
        const subtotalItemOriginal = calcularSubtotalBrutoProduto(p)
        const descontoItem = calcularDescontoProduto(p)
        const subtotalItem = calcularSubtotalProduto(p)

        const { data: item, error: itemError } = await supabase
          .from('itens_pedido')
          .insert({
            pedido_id: pedido.id,
            produto_id: p.produto_id,
            bebida_id: p.bebida_id,
            combo_id: p.combo_id,
            nome_item: p.nome,
            quantidade: p.quantidade,
            preco_unitario: p.preco,
            subtotal_original: subtotalItemOriginal,
            desconto_manual: descontoItem,
            subtotal: subtotalItem,
            observacoes: p.observacoes || null,
            adicionado_por_garcom_id: garcomId,
          })
          .select()
          .single()

        if (itemError) throw itemError

        if (p.adicionais.length > 0) {
          const adicionaisParaInserir = p.adicionais.map((a) => ({
            item_pedido_id: item.id,
            adicional_id: a.id,
            nome: a.nome,
            preco: a.preco,
          }))

          const { error: adicError } = await supabase.from('item_adicionais').insert(adicionaisParaInserir)
          if (adicError) throw adicError
        }
      }

      // Criar entrega se necessário
      if (tipoEntrega === 'entrega') {
        // Usar upsert para evitar duplicatas (constraint unique em pedido_id)
        const { error: entregaError } = await supabase.from('entregas').upsert({
          pedido_id: pedido.id,
          endereco_entrega: endereco || null,
          taxa_entrega: taxaEntrega,
          status: 'pendente'
        }, { 
          onConflict: 'pedido_id',
          ignoreDuplicates: true 
        })
        if (entregaError) console.error('[Garçom] Falha ao criar entrega:', entregaError.message)
      }

      // Atualizar status para confirmado (produção)
      const { error: statusError } = await supabase
        .from('pedidos')
        .update({ status: 'confirmado' })
        .eq('id', pedido.id)
      if (statusError) console.error('[Garçom] Falha ao atualizar status do pedido:', statusError.message)

      const hashEventoImpressao = gerarHashEventoImpressao(
        pedido.id,
        'cozinha',
        'pedido_completo',
        null,
        'garcom_novo_pedido'
      )

      enfileirarImpressao({
        pedidoId: pedido.id,
        tipo: 'cozinha',
        escopo: 'pedido_completo',
        origem: 'garcom_novo_pedido',
        hashEvento: hashEventoImpressao
      }).then((resultado) => {
        if (resultado.sucesso || resultado.duplicado) {
          console.log('[Garçom][Impressão] Pedido enviado para fila')
          return
        }

        console.error('[Garçom][Impressão] Falha ao enviar para fila:', resultado.erro)
      })

      // Registrar atividade do garçom
      if (garcomId) {
        try {
          await supabase.from('atividade_garcom').insert({
            garcom_id: garcomId,
            tipo_acao: 'pedido_criado',
            pedido_id: pedido.id,
            descricao: `Pedido criado para ${nomeCliente}`,
            dados_extra: { total, tipo_entrega: tipoEntrega, mesa: mesaSelecionada },
          })
        } catch { /* atividade nao-critica */ }
      }

      setSucesso(true)
    } catch (error) {
      console.error('[Garçom] Erro ao salvar pedido:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar pedido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const termoBuscaProduto = buscaProduto.trim().toLowerCase()

  const produtosFiltrados = useMemo(() => {
    if (!termoBuscaProduto) return produtos

    return produtos.filter(
      (produto) =>
        produto.nome.toLowerCase().includes(termoBuscaProduto) ||
        produto.categoria.toLowerCase().includes(termoBuscaProduto)
    )
  }, [produtos, termoBuscaProduto])

  const produtosPorCategoria = useMemo(
    () =>
      produtosFiltrados.reduce((acumulador, produto) => {
        const categoria = normalizarNomeCategoria(produto.categoria)
        if (!categoria) return acumulador
        if (!acumulador[categoria]) {
          acumulador[categoria] = []
        }
        acumulador[categoria].push(produto)
        return acumulador
      }, {} as Record<string, Produto[]>),
    [produtosFiltrados]
  )

  const categoriasDisponiveis = useMemo(
    () =>
      Object.entries(
        produtos.reduce((acumulador, produto) => {
          const categoria = normalizarNomeCategoria(produto.categoria)
          if (!categoria) return acumulador
          acumulador[categoria] = (acumulador[categoria] || 0) + 1
          return acumulador
        }, {} as Record<string, number>)
      )
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [produtos]
  )

  useEffect(() => {
    if (categoriasDisponiveis.length === 0) {
      if (categoriaAtiva) setCategoriaAtiva('')
      return
    }

    const categoriaExiste = categoriasDisponiveis.some((categoria) => categoria.nome === categoriaAtiva)
    if (!categoriaAtiva || !categoriaExiste) {
      setCategoriaAtiva(categoriasDisponiveis[0].nome)
    }
  }, [categoriasDisponiveis, categoriaAtiva])

  const produtosVisiveis = useMemo(() => {
    if (termoBuscaProduto) return produtosFiltrados
    if (!categoriaAtiva) return produtosFiltrados
    return produtosPorCategoria[categoriaAtiva] || []
  }, [termoBuscaProduto, produtosFiltrados, categoriaAtiva, produtosPorCategoria])

  const resetarFormulario = () => {
    setNomeCliente('')
    setEndereco('')
    setTipoEntrega('local')
    setFormaPagamento('')
    setPagamentoDividido(false)
    setPagamentos([])
    setProdutosSelecionados([])
    setDescontoPedidoInput('')
    setPrecisaTroco(false)
    setTrocoPara('')
    setMesaSelecionada(null)
    setEtapaMobile('dados')
    setBuscaProduto('')
    setSucesso(false)
  }

  if (sucesso) {
    return (
      <RotaProtegidaGarcom>
      <GarcomLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center ring-8 ring-green-100 dark:ring-green-900/20"
          >
            <Check className="w-12 h-12 text-green-600 dark:text-green-400" strokeWidth={2.5} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-center"
          >
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Pedido Criado!</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">O pedido foi enviado para a cozinha.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-col sm:flex-row gap-3 w-full max-w-xs"
          >
            <button
              onClick={resetarFormulario}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-white bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800 rounded-xl transition-colors cursor-pointer shadow-lg shadow-bordo-900/20 min-h-[52px]"
            >
              <Plus className="w-4 h-4" />
              Novo Pedido
            </button>
            <button
              onClick={() => router.push('/garcom')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors cursor-pointer min-h-[52px]"
            >
              Ver Pedidos
            </button>
          </motion.div>
        </div>
      </GarcomLayout>
      </RotaProtegidaGarcom>
    )
  }

  return (
    <RotaProtegidaGarcom>
    <GarcomLayout>
      <div className="space-y-4 pb-44 md:pb-32">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              aria-label="Voltar"
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-900 dark:text-white" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Novo pedido</h2>
              {carregandoPedidoBase && (
                <p className="text-zinc-500 text-xs">Carregando repetição…</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={limparPedidoAtual}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Limpar
          </button>
        </div>

        <div className="lg:hidden">
          {(() => {
            const passos = [
              { id: 'dados' as const, titulo: 'Cliente', valido: dadosClienteValidos },
              { id: 'produtos' as const, titulo: 'Cardápio', valido: itensSelecionados },
              { id: 'resumo' as const, titulo: 'Pedido', valido: podeSalvarPedido },
            ]
            const indiceAtivo = passos.findIndex((p) => p.id === etapaMobile)
            const progresso = ((indiceAtivo + 1) / passos.length) * 100
            return (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  {passos.map((passo, indice) => {
                    const ativo = etapaMobile === passo.id
                    const concluido = indice < indiceAtivo || (passo.valido && !ativo)
                    return (
                      <button
                        key={passo.id}
                        type="button"
                        onClick={() => navegarEtapaMobile(passo.id)}
                        className="flex flex-col items-center gap-1.5 px-1 py-0.5 cursor-pointer"
                        aria-current={ativo ? 'step' : undefined}
                      >
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors ${
                            ativo
                              ? 'bg-bordo-600 text-white ring-4 ring-bordo-100 dark:ring-bordo-950'
                              : concluido
                                ? 'bg-green-600 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {concluido && !ativo ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : indice + 1}
                        </span>
                        <span
                          className={`text-[11px] font-medium ${
                            ativo ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {passo.titulo}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-bordo-600 transition-all duration-300"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>
            )
          })()}
        </div>

        <div className="grid gap-4 lg:grid-cols-3 min-w-0">
          {/* Dados do Cliente e Produtos */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            {/* Dados do Cliente */}
            <div className={`${etapaMobile === 'dados' ? 'block' : 'hidden'} lg:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4`}>
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white mb-3">Cliente</h3>
              
              {/* Tipo de Entrega */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { id: 'local', label: 'No Local', icon: Store },
                  { id: 'retirada', label: 'Retirada', icon: Package },
                  { id: 'entrega', label: 'Entrega', icon: Truck },
                ].map((tipo) => {
                  const Icon = tipo.icon
                  return (
                    <button
                      key={tipo.id}
                      type="button"
                      onClick={() => setTipoEntrega(tipo.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer min-h-[64px] justify-center ${
                        tipoEntrega === tipo.id
                          ? 'border-bordo-500 bg-bordo-50 dark:bg-bordo-950/30 text-bordo-600 dark:text-bordo-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-bordo-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-semibold">{tipo.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Nome */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Nome do Cliente *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nomeCliente}
                    onChange={(e) => {
                      setNomeCliente(e.target.value)
                      setClienteSelecionado(null)
                    }}
                    placeholder={tipoEntrega === 'local' ? "Ex: Mesa 1" : "Nome do cliente"}
                    className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                             dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white
                             placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bordo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setNomeCliente('Cliente')}
                    className="px-4 py-2.5 bg-bordo-600 hover:bg-bordo-700 text-white text-sm font-medium 
                             rounded-lg transition-colors whitespace-nowrap"
                  >
                    Cliente
                  </button>
                </div>
                {(buscandoClientes || clientesEncontrados.length > 0 || clienteSelecionado) && (
                  <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
                    {clienteSelecionado ? (
                      <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{clienteSelecionado.nome || 'Cliente'}</p>
                          <p className="truncate text-xs text-zinc-500">{clienteSelecionado.telefone}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setClienteSelecionado(null)}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        >
                          Trocar
                        </button>
                      </div>
                    ) : buscandoClientes ? (
                      <p className="px-3 py-2 text-xs text-zinc-500">Buscando clientes...</p>
                    ) : (
                      <div className="grid gap-1">
                        {clientesEncontrados.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => {
                              setClienteSelecionado(cliente)
                              setNomeCliente(cliente.nome || 'Cliente')
                              if (tipoEntrega !== 'local' && cliente.endereco) setEndereco(cliente.endereco)
                              if (tipoEntrega === 'entrega' && cliente.bairro) setBairro(cliente.bairro)
                              setClientesEncontrados([])
                            }}
                            className="rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            <span className="font-medium">{cliente.nome || 'Cliente'}</span>
                            <span className="ml-2 text-xs text-zinc-500">{cliente.telefone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seleção de Mesa (apenas para local) */}
              {tipoEntrega === 'local' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Local *
                    </label>
                    <button
                      type="button"
                      disabled={!primeiroPontoLivre}
                      onClick={() => {
                        if (!primeiroPontoLivre) return
                        setMesaSelecionada(primeiroPontoLivre.numero)
                      }}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Usar primeiro livre
                    </button>
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {([
                      { id: 'mesa' as const, label: 'Mesas' },
                      { id: 'local_externo' as const, label: 'Locais parceiros' },
                    ]).map((opcao) => (
                      <button
                        key={opcao.id}
                        type="button"
                        onClick={() => {
                          setModoSalao(opcao.id)
                          setMesaSelecionada(null)
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          modoSalao === opcao.id
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {opcao.label}
                      </button>
                    ))}
                  </div>
                  {loadingMesas ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-bordo-600" />
                    </div>
                  ) : (
                    <div className={modoSalao === 'local_externo' ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-4 sm:grid-cols-6 gap-2'}>
                      {pontosSalaoAtivos.map((mesa) => {
                        const ehParceiro = mesa.tipo === 'local_externo'
                        const livre = mesa.status === 'livre'
                        const sempreDisponivel = ehParceiro // parceiros aceitam pedidos paralelos
                        const selecionavel = livre || sempreDisponivel
                        const selecionada = mesaSelecionada === mesa.numero
                        const rotulo = obterRotuloPontoSalao(mesa)
                        return (
                          <button
                            key={mesa.id}
                            type="button"
                            onClick={() => {
                              if (selecionavel || selecionada) {
                                setMesaSelecionada(selecionada ? null : mesa.numero)
                              }
                            }}
                            disabled={!selecionavel && !selecionada}
                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all min-h-[72px] justify-center cursor-pointer ${
                              selecionada
                                ? 'border-bordo-500 bg-bordo-50 dark:bg-bordo-950/30 text-bordo-600 ring-2 ring-bordo-500/20'
                                : selecionavel
                                  ? 'border-zinc-200 dark:border-zinc-700 hover:border-bordo-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                                  : 'border-zinc-200 dark:border-zinc-700 opacity-35 cursor-not-allowed text-zinc-400'
                            }`}
                          >
                            <span className={ehParceiro ? 'line-clamp-2 text-xs font-bold leading-tight' : 'text-lg font-black leading-none'}>
                              {ehParceiro ? rotulo : mesa.numero}
                            </span>
                            <span className={`text-[10px] font-semibold ${
                              selecionada ? 'text-bordo-600 dark:text-bordo-400' : selecionavel ? 'text-green-600 dark:text-green-400' : 'text-red-400'
                            }`}>
                              {selecionada ? 'Selecionada' : ehParceiro ? 'Disponível' : livre ? 'Livre' : 'Ocupada'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {pontosSalaoAtivos.length === 0 && !loadingMesas && (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      Nenhum {modoSalao === 'local_externo' ? 'local parceiro' : 'mesa'} cadastrado
                    </p>
                  )}
                </div>
              )}

              {/* Bairro e endereço (apenas para entrega) */}
              {tipoEntrega === 'entrega' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Bairro
                  </label>
                  <select
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200
                             dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-bordo-500 cursor-pointer"
                  >
                    <option value="">Selecione o bairro</option>
                    {bairros.map((b) => (
                      <option key={b.id} value={b.nome}>
                        {b.nome} — {b.entrega_gratis ? 'grátis' : `R$ ${b.taxa_entrega.toFixed(2)}`}
                      </option>
                    ))}
                  </select>

                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-4 mb-2">
                    Endereço
                  </label>
                  <textarea
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, número, referência..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200
                             dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white
                             placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bordo-500 resize-none"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {bairroSelecionado
                      ? `Taxa de entrega: R$ ${taxaEntregaPedido.toFixed(2)}`
                      : 'Selecione o bairro para calcular a taxa'}
                  </p>
                </div>
              )}
            </div>

            {/* Produtos */}
            <div className={`${etapaMobile === 'produtos' ? 'block' : 'hidden'} lg:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 min-w-0 overflow-hidden`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">Cardápio</h3>
                {totalItensPedido > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bordo-50 dark:bg-bordo-950/30 text-bordo-700 dark:text-bordo-400 text-[11px] font-semibold">
                    <ShoppingCart className="w-3 h-3" />
                    {totalItensPedido}
                  </span>
                )}
              </div>
              
              {/* Busca */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  placeholder="Buscar por nome ou categoria..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                           dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white
                           placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bordo-500"
                />
                {buscaProduto && (
                  <button
                    type="button"
                    onClick={() => setBuscaProduto('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    aria-label="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Lista de Produtos */}
              {loadingProdutos ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-bordo-600" />
                </div>
              ) : erroCatalogoProdutos ? (
                <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-center">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">{erroCatalogoProdutos}</p>
                  <button
                    type="button"
                    onClick={carregarProdutosEBebidas}
                    className="mt-3 px-4 py-2 rounded-lg bg-bordo-600 hover:bg-bordo-700 text-white text-sm font-semibold transition-colors"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {!termoBuscaProduto && categoriasDisponiveis.length > 0 && (
                    <div className="-mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto scrollbar-hide">
                      <div className="flex items-center gap-2 flex-nowrap pb-1 w-max">
                        {categoriasDisponiveis.map((categoria) => {
                          const ativo = categoriaAtiva === categoria.nome
                          return (
                            <Pill
                              key={categoria.nome}
                              asChild
                              className={`shrink-0 cursor-pointer text-xs font-semibold transition-colors active:scale-[0.98] ${
                                ativo
                                  ? 'bg-bordo-600 text-white hover:bg-bordo-600 shadow-sm'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setCategoriaAtiva(categoria.nome)}
                                aria-pressed={ativo}
                              >
                                <span>{categoria.nome}</span>
                                <span
                                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] tabular-nums ${
                                    ativo ? 'bg-white/20 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                                  }`}
                                >
                                  {categoria.total}
                                </span>
                              </button>
                            </Pill>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {produtosVisiveis.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-8">
                      {termoBuscaProduto
                        ? 'Nenhum item encontrado para essa busca.'
                        : 'Nenhum item disponível nessa categoria.'}
                    </p>
                  ) : (
                    <div className="overflow-y-auto overflow-x-hidden pr-0.5" style={{ maxHeight: 'clamp(320px, 50vh, 600px)' }}>
                      {!termoBuscaProduto && categoriaAtiva && (
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{categoriaAtiva}</h4>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 min-w-0">
                        {produtosVisiveis.map((produto) => {
                          const qtdNoCarrinho = produtosSelecionados.find(p => p.id === obterChaveProduto(produto))?.quantidade
                          return (
                            <button
                              key={obterChaveProduto(produto)}
                              type="button"
                              onClick={() => abrirModalParaProduto(produto)}
                              className={`group relative flex w-full max-w-full min-w-0 overflow-hidden flex-col items-start gap-1.5 rounded-xl border px-2.5 py-2.5 text-left transition-all cursor-pointer active:scale-[0.99] min-h-[84px] ${
                                qtdNoCarrinho
                                  ? 'border-bordo-500 bg-bordo-50 dark:bg-bordo-950/30'
                                  : 'border-zinc-200 dark:border-zinc-700 hover:border-bordo-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              {qtdNoCarrinho ? (
                                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-bordo-600 text-white text-[10px] font-bold rounded-full px-1 leading-none">
                                  {qtdNoCarrinho}
                                </span>
                              ) : null}
                              <span
                                className={`w-full text-[13px] font-medium line-clamp-2 leading-snug break-words pr-5 ${
                                  qtdNoCarrinho ? 'text-bordo-800 dark:text-bordo-200' : 'text-zinc-900 dark:text-white'
                                }`}
                              >
                                {produto.nome}
                              </span>
                              <span className="mt-auto text-sm font-semibold text-bordo-700 dark:text-bordo-400 whitespace-nowrap tabular-nums">
                                R$ {produto.preco.toFixed(2)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resumo do Pedido */}
          <div className={`${etapaMobile === 'resumo' ? 'block' : 'hidden'} lg:block lg:col-span-1 min-w-0`}>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-bordo-600" />
                  Resumo
                </h3>
                {produtosSelecionados.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-bordo-600 text-white text-xs font-bold">
                    {totalItensPedido}
                  </span>
                )}
              </div>

              {/* Itens Selecionados */}
              {produtosSelecionados.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhum produto adicionado</p>
              ) : (
                <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-0.5">
                  {produtosSelecionados.map((produto) => {
                    const subtotalBrutoItem = calcularSubtotalBrutoProduto(produto)
                    const descontoItem = calcularDescontoProduto(produto)
                    const subtotalItem = calcularSubtotalProduto(produto)

                    return (
                      <div key={produto.id} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => abrirModalParaItemSelecionado(produto)}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                            aria-label={`Editar ${produto.nome}`}
                          >
                            <p className="font-medium text-sm text-zinc-900 dark:text-white truncate underline-offset-2 hover:underline">
                              {produto.nome}
                            </p>
                            <p className="text-xs text-bordo-600">R$ {produto.preco.toFixed(2)}</p>
                            {produto.observacoes && (
                              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 italic line-clamp-1">“{produto.observacoes}”</p>
                            )}
                            {produto.adicionais.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {produto.adicionais.map((a) => (
                                  <span key={a.id} className="text-xs bg-bordo-100 dark:bg-bordo-900/30 text-bordo-700 dark:text-dourado-400 px-1.5 py-0.5 rounded">
                                    +{a.nome}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => atualizarQuantidade(produto.id, produto.quantidade - 1)}
                              className="min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-7 text-center text-sm font-bold">{produto.quantidade}</span>
                            <button
                              onClick={() => atualizarQuantidade(produto.id, produto.quantidade + 1)}
                              className="min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removerProduto(produto.id)}
                              className="min-w-[32px] min-h-[32px] flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer ml-0.5"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 px-2.5 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                          <div className="flex items-center justify-between">
                            <span>Subtotal bruto</span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">R$ {subtotalBrutoItem.toFixed(2)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <span>Subtotal final</span>
                            <span className="font-semibold text-bordo-700 dark:text-dourado-400">R$ {subtotalItem.toFixed(2)}</span>
                          </div>
                        </div>

                        {descontosAtivos && (
                          <div className="mt-2">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                              Desconto do item (R$)
                            </label>
                            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={produto.descontoManualInput}
                                onChange={(evento) => atualizarDescontoItem(produto.id, evento.target.value)}
                                placeholder="0,00"
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500"
                              />
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                                - R$ {descontoItem.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Observação do item */}
                        <div className="mt-2">
                          <textarea
                            value={produto.observacoes}
                            onChange={(e) => atualizarObservacoes(produto.id, e.target.value)}
                            placeholder="Observações (opcional)..."
                            rows={1}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-bordo-400 resize-none"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Descontos manuais</p>
                  <button
                    type="button"
                    onClick={() => setDescontosAtivos((estadoAnterior) => !estadoAnterior)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      descontosAtivos ? 'bg-bordo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                    aria-pressed={descontosAtivos}
                    aria-label="Ativar descontos no pedido"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        descontosAtivos ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {descontosAtivos && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                      Desconto geral do pedido (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={descontoPedidoInput}
                      onChange={(evento) => alterarDescontoPedido(evento.target.value)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500"
                    />
                  </div>
                )}
              </div>

              {/* Forma de Pagamento */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Pagamento
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPagamentoDividido(!pagamentoDividido)
                      if (!pagamentoDividido) setFormaPagamento('')
                      else setPagamentos([])
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[32px] ${
                      pagamentoDividido
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    {pagamentoDividido ? 'Dividido' : 'Dividir'}
                  </button>
                </div>
                
                {!pagamentoDividido ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Dinheiro', label: 'Dinheiro', icone: Banknote },
                      { id: 'PIX', label: 'PIX', icone: Smartphone },
                      { id: 'Cartão de Crédito', label: 'Crédito', icone: CreditCard },
                      { id: 'Cartão de Débito', label: 'Débito', icone: CreditCard },
                      { id: 'Crediário', label: 'Crediário', icone: Wallet },
                    ].map((fp) => {
                      const Icone = fp.icone
                      return (
                        <button
                          key={fp.id}
                          type="button"
                          onClick={() => setFormaPagamento(fp.id)}
                          className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 transition-all cursor-pointer min-h-[52px] ${
                            formaPagamento === fp.id
                              ? 'border-bordo-500 bg-bordo-50 dark:bg-bordo-950/30 text-bordo-700 dark:text-bordo-300'
                              : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-bordo-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Icone className="w-4 h-4 shrink-0" />
                          <span className="text-sm font-medium">{fp.label}</span>
                          {formaPagamento === fp.id && (
                            <Check className="w-3.5 h-3.5 ml-auto shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pagamentos.map((pag) => (
                      <div key={pag.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 rounded-xl text-sm">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{pag.forma}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-bordo-600">R$ {pag.valor.toFixed(2)}</span>
                          <button onClick={() => removerPagamento(pag.id)} className="text-red-400 hover:text-red-600 min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <select
                        value={novoPagamentoForma}
                        onChange={(e) => setNovoPagamentoForma(e.target.value)}
                        className="flex-1 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500"
                      >
                        <option value="">Forma...</option>
                        {FORMAS_PAGAMENTO.map((f) => (
                          <option key={f.id} value={f.nome}>{f.nome}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="Valor"
                        value={novoPagamentoValor}
                        onChange={(e) => setNovoPagamentoValor(e.target.value)}
                        className="w-24 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500"
                      />
                      <button
                        onClick={adicionarPagamento}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-bordo-600 hover:bg-bordo-700 text-white rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    {valorRestante > 0.01 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/30">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Restam a pagar</span>
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-400">R$ {valorRestante.toFixed(2)}</span>
                      </div>
                    )}
                    {Math.abs(valorRestante) <= 0.01 && pagamentos.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900/30">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">Pagamento completo</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Troco para dinheiro */}
                {formaPagamento === 'Dinheiro' && !pagamentoDividido && (
                  <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <label className="flex items-center gap-3 cursor-pointer min-h-[36px]">
                      <input
                        type="checkbox"
                        checked={precisaTroco}
                        onChange={(e) => setPrecisaTroco(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 text-bordo-600 focus:ring-bordo-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cliente precisa de troco</span>
                    </label>
                    {precisaTroco && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Troco para quanto?</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="Ex: 50,00"
                          value={trocoPara}
                          onChange={(e) => setTrocoPara(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-bordo-500"
                        />
                        {trocoPara && parseFloat(trocoPara) >= calcularTotal() && (
                          <div className="mt-2 flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900/30">
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">Troco</span>
                            <span className="text-sm font-bold text-green-700 dark:text-green-400">
                              R$ {(parseFloat(trocoPara) - calcularTotal()).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Totais */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span>R$ {subtotalBrutoPedido.toFixed(2)}</span>
                </div>
                {descontosAtivos && descontoItensTotal > 0 && (
                  <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                    <span>Desconto itens</span>
                    <span>- R$ {descontoItensTotal.toFixed(2)}</span>
                  </div>
                )}
                {descontosAtivos && descontoPedidoAplicado > 0 && (
                  <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                    <span>Desconto geral</span>
                    <span>- R$ {descontoPedidoAplicado.toFixed(2)}</span>
                  </div>
                )}
                {tipoEntrega === 'entrega' && (
                  <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                    <span>Taxa de entrega</span>
                    <span>+ R$ {taxaEntregaPedido.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-base font-bold text-zinc-900 dark:text-white">Total</span>
                  <span className="text-xl font-black text-bordo-600 dark:text-bordo-400">R$ {totalPedido.toFixed(2)}</span>
                </div>
              </div>

              {/* Botão Salvar (visível no desktop via sidebar) */}
              <button
                onClick={salvarPedido}
                disabled={!podeSalvarPedido}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold text-white bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800 rounded-xl transition-colors shadow-md shadow-bordo-900/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[52px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Confirmar Pedido
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="fixed inset-x-0 z-40 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/97 dark:bg-zinc-950/97 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.10)] bottom-[calc(env(safe-area-inset-bottom,0px)+68px)] md:bottom-0">
          <div
            className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-2 sm:py-2.5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
          >
            <div className="lg:hidden">
              {etapaMobile === 'dados' && (
                <button
                  type="button"
                  onClick={() => navegarEtapaMobile('produtos')}
                  disabled={!dadosClienteValidos}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800 text-white font-semibold text-sm transition-colors shadow-md shadow-bordo-900/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[48px]"
                >
                  <span>{dadosClienteValidos ? 'Avançar para o cardápio' : pendenciaEtapaDados}</span>
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}

              {etapaMobile === 'produtos' && (
                <button
                  type="button"
                  onClick={() => navegarEtapaMobile('resumo')}
                  disabled={!itensSelecionados}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800 text-white font-semibold text-sm transition-colors shadow-md shadow-bordo-900/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[48px]"
                >
                  <span>
                    {itensSelecionados
                      ? `Revisar pedido · ${totalItensPedido} ${totalItensPedido === 1 ? 'item' : 'itens'}`
                      : pendenciaEtapaProdutos}
                  </span>
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}

              {etapaMobile === 'resumo' && (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                    {totalItensPedido > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'}
                      </span>
                    )}
                    {tipoEntrega === 'local' && mesaSelecionada && (
                      <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold">
                        Mesa {mesaSelecionada}
                      </span>
                    )}
                    {!podeSalvarPedido && pendenciaPrincipalSalvar && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 truncate">
                        {pendenciaPrincipalSalvar}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {totalPedido > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-zinc-500 leading-none">Total</p>
                        <p className="text-base font-black text-bordo-600 dark:text-bordo-400 leading-tight">R$ {totalPedido.toFixed(2)}</p>
                      </div>
                    )}
                    <button
                      onClick={salvarPedido}
                      disabled={!podeSalvarPedido}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-bordo-900/20 min-h-[48px] cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="hidden sm:inline">Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Confirmar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                {totalItensPedido > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'}
                  </span>
                )}
                {tipoEntrega === 'local' && mesaSelecionada && (
                  <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold">
                    Mesa {mesaSelecionada}
                  </span>
                )}
                {!podeSalvarPedido && pendenciaPrincipalSalvar && (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 truncate">
                    {pendenciaPrincipalSalvar}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {totalPedido > 0 && (
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-zinc-500 leading-none">Total</p>
                    <p className="text-base font-black text-bordo-600 dark:text-bordo-400 leading-tight">R$ {totalPedido.toFixed(2)}</p>
                  </div>
                )}
                <button
                  onClick={salvarPedido}
                  disabled={!podeSalvarPedido}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-bordo-600 hover:bg-bordo-700 active:bg-bordo-800 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-bordo-900/20 min-h-[48px] cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Confirmar</span>
                      {totalPedido > 0 && (
                        <span className="hidden sm:inline font-black">· R$ {totalPedido.toFixed(2)}</span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalItemPedido
        aberto={Boolean(itemModal)}
        modoEdicao={itemModal?.modoEdicao ?? false}
        descontosAtivos={descontosAtivos}
        dados={
          itemModal
            ? {
                id: itemModal.chave,
                nome: itemModal.nome,
                preco: itemModal.preco,
                quantidade: itemModal.quantidade,
                observacoes: itemModal.observacoes,
                descontoManualInput: itemModal.descontoManualInput,
              }
            : null
        }
        onFechar={() => setItemModal(null)}
        onConfirmar={confirmarItemModal}
        onRemover={itemModal?.modoEdicao ? removerItemModal : undefined}
      />
    </GarcomLayout>
    </RotaProtegidaGarcom>
  )
}

export default function GarcomNovoPedidoPage() {
  return (
    <Suspense fallback={
      <GarcomLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-bordo-600" />
        </div>
      </GarcomLayout>
    }>
      <GarcomNovoPedidoContent />
    </Suspense>
  )
}
