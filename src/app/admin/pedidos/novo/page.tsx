'use client'

import { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Save,
  Plus,
  Banknote,
  CreditCard,
  QrCode,
  Split,
  X,
  Loader2,
  Search,
  MapPin,
  Phone,
  UserRound,
  Check,
  ChevronsUpDown,
  Wallet,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { enfileirarImpressao, gerarHashEventoImpressao } from '@/lib/filaImpressao'
import { TEMPO_PADRAO_MESA_MINUTOS, calcularLiberacaoMesa } from '@/lib/mesas-tempo'
import { buscarProximoNumeroPedidoDiario, normalizarNumeroPedido, sincronizarNumeroPedidoDiario } from '@/lib/pedidos/numero-diario'
import PainelCategoriasProduto from '@/components/admin/pedidos/novo/PainelCategoriasProduto'
import PainelTicketPedido from '@/components/admin/pedidos/novo/PainelTicketPedido'
import ModalItemPedidoAdmin, { type ItemPedidoModalDadosAdmin } from '@/components/admin/pedidos/novo/ModalItemPedidoAdmin'
import { CategoriaCatalogoPedido, ItemCatalogoPedido } from '@/components/admin/pedidos/novo/tipos'
import { cn } from '@/lib/utils'
import { normalizarNomeCategoria } from '@/lib/categoriasCardapio'
import { nomeClienteParaPedido, nomeClienteParaPontoSalao } from '@/lib/nome-cliente-local.mjs'

type ProdutoSelecionado = {
  id: string
  nome: string
  preco: number
  quantidade: number
  observacoes: string
  adicionais: Adicional[]
  descontoManualInput: string
}

type Produto = {
  id: string
  nome: string
  preco: number
  categoria: string
}

type ComboType = {
  id: string
  nome: string
  preco: number
  categoria: string
  descricao?: string
}

type Adicional = {
  id: string
  nome: string
  preco: number
}

type Bairro = {
  id: string
  nome: string
  taxa_entrega: number
  ativo: boolean
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
  identificador?: string | null
}

type TipoPontoSalao = 'mesa' | 'comanda' | 'local_externo'
type EtapaNovoPedido = 'salao' | 'dados' | 'produtos' | 'ticket'

type ClienteBusca = {
  id: string
  telefone: string
  nome: string | null
  endereco: string | null
  bairro: string | null
  total_pedidos: number
  ultimo_pedido_em: string | null
}

const formatarTelefoneCliente = (telefone: string): string => {
  const digitos = (telefone || '').replace(/\D/g, '')
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return telefone
}

const FORMAS_PAGAMENTO = [
  { id: 'dinheiro', nome: 'Dinheiro', icone: Banknote, cor: 'text-foreground' },
  { id: 'pix', nome: 'PIX', icone: QrCode, cor: 'text-foreground' },
  { id: 'debito', nome: 'Cartão de Débito', icone: CreditCard, cor: 'text-foreground' },
  { id: 'credito', nome: 'Cartão de Crédito', icone: CreditCard, cor: 'text-foreground' },
  { id: 'crediario', nome: 'Crediário', icone: Wallet, cor: 'text-foreground' },
]

const OPCOES_PAGAMENTO_PEDIDO = [
  { valor: 'PIX', label: 'PIX', icone: QrCode },
  { valor: 'Dinheiro', label: 'Dinheiro', icone: Banknote },
  { valor: 'Cartão de Crédito', label: 'Crédito', icone: CreditCard },
  { valor: 'Cartão de Débito', label: 'Débito', icone: CreditCard },
  { valor: 'Crediário', label: 'Crediário', icone: Wallet },
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

const obterNomeTipoPontoSalao = (tipo: TipoPontoSalao) => {
  if (tipo === 'comanda') return 'comanda'
  if (tipo === 'local_externo') return 'local parceiro'
  return 'mesa'
}

const obterNomeTipoPontoSalaoCapitalizado = (tipo: TipoPontoSalao) => {
  if (tipo === 'comanda') return 'Comanda'
  if (tipo === 'local_externo') return 'Local parceiro'
  return 'Mesa'
}

const obterRotuloPontoSalao = (ponto: Pick<MesaDisponivel, 'numero' | 'tipo' | 'identificador'> | null) => {
  if (!ponto) return 'Local'
  const nome = ponto.identificador?.trim()
  if (nome) return nome
  return `${obterNomeTipoPontoSalaoCapitalizado(ponto.tipo)} ${ponto.numero}`
}

type SeletorBairroComboboxProps = {
  bairros: Bairro[]
  valor: string
  onSelecionar: (id: string) => void
}

function SeletorBairroCombobox({ bairros, valor, onSelecionar }: SeletorBairroComboboxProps) {
  const [aberto, setAberto] = useState(false)
  const bairroAtivo = bairros.find((b) => b.id === valor) || null

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={aberto}
          className="flex h-10 w-full items-center justify-between rounded-md border border-border/70 bg-card px-3 text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/60"
        >
          {bairroAtivo ? (
            <span className="flex min-w-0 items-center gap-2">
              <MapPin strokeWidth={1.6} className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{bairroAtivo.nome}</span>
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {bairroAtivo.taxa_entrega === 0 ? 'Grátis' : `R$ ${bairroAtivo.taxa_entrega.toFixed(2)}`}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione um bairro...</span>
          )}
          <ChevronsUpDown strokeWidth={1.6} className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar bairro..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum bairro encontrado.</CommandEmpty>
            <CommandGroup>
              {bairros.map((bairro) => (
                <CommandItem
                  key={bairro.id}
                  value={bairro.nome}
                  onSelect={() => {
                    onSelecionar(bairro.id === valor ? '' : bairro.id)
                    setAberto(false)
                  }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Check
                      strokeWidth={1.6}
                      className={cn('size-4 shrink-0', valor === bairro.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="truncate">{bairro.nome}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {bairro.taxa_entrega === 0 ? 'Grátis' : `R$ ${bairro.taxa_entrega.toFixed(2)}`}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function NovoPedidoContent() {
  const [nomeCliente, setNomeCliente] = useState('')
  const [endereco, setEndereco] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState('local')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [pagamentoDividido, setPagamentoDividido] = useState(false)
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [novoPagamentoForma, setNovoPagamentoForma] = useState('')
  const [novoPagamentoValor, setNovoPagamentoValor] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [combos, setCombos] = useState<ComboType[]>([])
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProdutos, setLoadingProdutos] = useState(true)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [categoriaExpandida, setCategoriaExpandida] = useState<string | null>(null)
  const [adicionaisDisponiveis, setAdicionaisDisponiveis] = useState<Adicional[]>([])
  const [produtoSelecionadoParaAdicional, setProdutoSelecionadoParaAdicional] = useState<string | null>(null)
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [bairroSelecionado, setBairroSelecionado] = useState<string>('')
  const [loadingBairros, setLoadingBairros] = useState(false)
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [trocoPara, setTrocoPara] = useState('')
  const [enviarParaImpressao, setEnviarParaImpressao] = useState(true)
  const [mesasDisponiveis, setMesasDisponiveis] = useState<MesaDisponivel[]>([])
  const [modoSalao, setModoSalao] = useState<TipoPontoSalao>('mesa')
  const [mesaSelecionada, setMesaSelecionada] = useState<number | null>(null)
  const [comandaSelecionada, setComandaSelecionada] = useState<number | null>(null)
  const [loadingMesas, setLoadingMesas] = useState(false)
  const [taxaServicoAtivaPadrao, setTaxaServicoAtivaPadrao] = useState(false)
  const [aplicarTaxaServico, setAplicarTaxaServico] = useState(false)
  const [percentualTaxaServico, setPercentualTaxaServico] = useState('10')
  const [taxaServicoManual, setTaxaServicoManual] = useState('')
  const [descontoPedidoInput, setDescontoPedidoInput] = useState('')
  const [etapaMobile, setEtapaMobile] = useState<EtapaNovoPedido>('salao')
  const [isDesktop, setIsDesktop] = useState(false)
  const [modalItemAberto, setModalItemAberto] = useState(false)
  const [modalItemDados, setModalItemDados] = useState<ItemPedidoModalDadosAdmin | null>(null)
  const [modalItemModoEdicao, setModalItemModoEdicao] = useState(false)
  const [observacoesPedido, setObservacoesPedido] = useState('')
  const [campoErro, setCampoErro] = useState<'nome' | 'bairro' | 'pagamento' | 'mesa' | 'itens' | null>(null)
  const refNomeCliente = useRef<HTMLInputElement | null>(null)
  const refSecaoPagamento = useRef<HTMLDivElement | null>(null)
  const refSecaoAtendimentoMobile = useRef<HTMLDivElement | null>(null)
  const refSecaoAtendimentoDesktop = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const [telefoneCliente, setTelefoneCliente] = useState('')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesBuscados, setClientesBuscados] = useState<ClienteBusca[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBusca | null>(null)
  const [mostrarDropdownClientes, setMostrarDropdownClientes] = useState(false)
  const refBuscaCliente = useRef<HTMLDivElement>(null)
  const timerBuscaCliente = useRef<ReturnType<typeof setTimeout> | null>(null)
  const referenciaBuscaProduto = useRef<HTMLInputElement | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    carregarProdutosEBebidas()
    carregarCombos()
    carregarAdicionais()
    carregarBairros()
    carregarMesas()
    carregarConfiguracaoTaxaServico()

    const mesaParam = searchParams.get('mesa')
    const comandaParam = searchParams.get('comanda')

    if (mesaParam) {
      const num = parseInt(mesaParam)
      if (!isNaN(num)) {
        setModoSalao('mesa')
        setMesaSelecionada(num)
        setComandaSelecionada(null)
        setTipoEntrega('local')
      }
      return
    }

    if (comandaParam) {
      const num = parseInt(comandaParam)
      if (!isNaN(num)) {
        setModoSalao('comanda')
        setComandaSelecionada(num)
        setMesaSelecionada(null)
        setTipoEntrega('local')
      }
    }
  }, [])

  useEffect(() => {
    if (etapaMobile !== 'salao') return
    void carregarMesas()
  }, [etapaMobile])

  // Fechar dropdown ao clicar fora + cleanup timer busca
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (refBuscaCliente.current && !refBuscaCliente.current.contains(e.target as Node)) {
        setMostrarDropdownClientes(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => {
      document.removeEventListener('mousedown', handleClickFora)
      if (timerBuscaCliente.current) clearTimeout(timerBuscaCliente.current)
    }
  }, [])

  const buscarClientes = useCallback(async (termo: string) => {
    if (termo.trim().length < 2) {
      setClientesBuscados([])
      setMostrarDropdownClientes(false)
      return
    }
    setBuscandoClientes(true)
    try {
      const { data, error } = await supabase.rpc('buscar_clientes', {
        p_termo: termo.trim(),
        p_limite: 8,
      })
      if (error) throw error
      setClientesBuscados((data || []) as ClienteBusca[])
      setMostrarDropdownClientes(true)
    } catch (err) {
      console.error('Erro ao buscar clientes:', err)
    } finally {
      setBuscandoClientes(false)
    }
  }, [])

  const handleBuscaClienteChange = (valor: string) => {
    setBuscaCliente(valor)
    if (timerBuscaCliente.current) clearTimeout(timerBuscaCliente.current)
    timerBuscaCliente.current = setTimeout(() => buscarClientes(valor), 300)
  }

  const selecionarCliente = (cliente: ClienteBusca) => {
    setClienteSelecionado(cliente)
    setNomeCliente(cliente.nome || '')
    setTelefoneCliente(cliente.telefone || '')
    if (cliente.endereco) setEndereco(cliente.endereco)
    if (cliente.bairro) {
      const bairroMatch = bairros.find(
        (b) => b.nome.toLowerCase() === (cliente.bairro || '').toLowerCase()
      )
      if (bairroMatch) setBairroSelecionado(bairroMatch.id)
    }
    setBuscaCliente('')
    setMostrarDropdownClientes(false)
  }

  const limparClienteSelecionado = () => {
    setClienteSelecionado(null)
  }

  const carregarProdutosEBebidas = async () => {
    try {
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('id, nome, preco, categoria')
        .eq('disponivel', true)
        .order('nome')

      console.log('Produtos carregados:', produtosData, produtosError)

      // Tenta carregar bebidas (tabela pode não existir)
      let bebidasData: any[] = []
      try {
        const { data, error } = await supabase
          .from('bebidas')
          .select('id, nome, preco, categoria')
          .eq('disponivel', true)
          .order('nome')
        
        if (!error && data) {
          bebidasData = data
        }
      } catch (e) {
        // Tabela bebidas pode não existir
      }

      const produtosFormatados = (produtosData || []).map((p) => ({
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco),
        categoria: p.categoria,
      }))

      const bebidasFormatadas = (bebidasData || []).map((b) => ({
        id: b.id,
        nome: b.nome,
        preco: Number(b.preco),
        categoria: normalizarNomeCategoria(b.categoria),
      }))

      const todosProdutos = [...produtosFormatados, ...bebidasFormatadas]
      console.log('Todos produtos:', todosProdutos)
      setProdutos(todosProdutos)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setLoadingProdutos(false)
    }
  }

  const carregarCombos = async () => {
    try {
      const [{ data, error }, { data: categoriasData, error: categoriasError }] = await Promise.all([
        supabase
          .from('combos')
          .select('id, nome, preco, descricao')
          .eq('disponivel', true)
          .order('ordem'),
        supabase
          .from('categorias_cardapio')
          .select('nome')
          .eq('tipo', 'combo')
          .eq('ativo', true)
          .order('ordem', { ascending: true })
          .limit(1)
      ])

      if (categoriasError) throw categoriasError
      const categoriaCombo = normalizarNomeCategoria(categoriasData?.[0]?.nome)

      if (!error && data && categoriaCombo) {
        const combosFormatados = data.map((c) => ({
          id: c.id,
          nome: c.nome,
          preco: Number(c.preco),
          categoria: categoriaCombo,
          descricao: c.descricao
        }))
        setCombos(combosFormatados)
      }
    } catch (error) {
      console.error('Erro ao carregar combos:', error)
    }
  }

  const carregarAdicionais = async () => {
    try {
      const { data, error } = await supabase
        .from('adicionais')
        .select('id, nome, preco')
        .eq('disponivel', true)
        .order('nome')

      if (!error && data) {
        setAdicionaisDisponiveis(data.map(a => ({ ...a, preco: Number(a.preco) })))
      }
    } catch (error) {
      console.error('Erro ao carregar adicionais:', error)
    }
  }

  const carregarBairros = async () => {
    setLoadingBairros(true)
    try {
      const { data, error } = await supabase
        .from('bairros')
        .select('id, nome, taxa_entrega, ativo')
        .eq('ativo', true)
        .order('ordem')

      if (!error && data) {
        setBairros(data.map(b => ({ ...b, taxa_entrega: Number(b.taxa_entrega) })))
      }
    } catch (error) {
      console.error('Erro ao carregar bairros:', error)
    } finally {
      setLoadingBairros(false)
    }
  }

  const carregarConfiguracaoTaxaServico = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('chave, valor')
        .in('chave', ['salao_taxa_servico_ativa', 'salao_taxa_servico_percentual'])

      if (error) throw error

      const ativa = data?.find((configuracao) => configuracao.chave === 'salao_taxa_servico_ativa')?.valor
      const percentual = data?.find((configuracao) => configuracao.chave === 'salao_taxa_servico_percentual')?.valor

      const ativaPadrao = String(ativa || 'false').toLowerCase() === 'true'
      const percentualPadrao = String(percentual || '10')

      setTaxaServicoAtivaPadrao(ativaPadrao)
      setAplicarTaxaServico(ativaPadrao)
      setPercentualTaxaServico(percentualPadrao)
    } catch (error) {
      console.error('[Admin] Erro ao carregar configuração da taxa de serviço:', error)
    }
  }

  const carregarMesas = async () => {
    setLoadingMesas(true)
    try {
      await supabase.rpc('limpar_mesas_expiradas')

      const { data, error } = await supabase
        .from('mesas')
        .select('id, numero, tipo, status, nome_cliente, identificador')
        .in('tipo', ['mesa', 'comanda', 'local_externo'])
        .order('tipo', { ascending: true })
        .order('numero', { ascending: true })

      if (error) throw error
      setMesasDisponiveis((data || []).map((mesa) => ({
        id: mesa.id,
        numero: Number(mesa.numero),
        tipo: mesa.tipo === 'comanda' ? 'comanda' : mesa.tipo === 'local_externo' ? 'local_externo' : 'mesa',
        status: mesa.status === 'ocupada' ? 'ocupada' : 'livre',
        nome_cliente: mesa.nome_cliente,
        identificador: mesa.identificador,
      })))
    } catch (error) {
      console.error('[Admin] Erro ao carregar mesas:', error)
    } finally {
      setLoadingMesas(false)
    }
  }

  const selecionarModoSalao = useCallback((modo: TipoPontoSalao) => {
    setModoSalao(modo)
    if (modo !== modoSalao) {
      setMesaSelecionada(null)
      setComandaSelecionada(null)
      return
    }
    if (modo === 'mesa') {
      setComandaSelecionada(null)
      return
    }

    if (modo === 'local_externo') {
      setComandaSelecionada(null)
      return
    }

    setMesaSelecionada(null)
  }, [modoSalao])

  const selecionarPontoSalao = useCallback((ponto: MesaDisponivel) => {
    const ehParceiro = ponto.tipo === 'local_externo'
    const livre = ponto.status === 'livre' || ehParceiro
    const selecionado = ponto.tipo === 'mesa' || ponto.tipo === 'local_externo'
      ? mesaSelecionada === ponto.numero
      : comandaSelecionada === ponto.numero

    if (!livre && !selecionado) return

    setTipoEntrega('local')
    setModoSalao(ponto.tipo)

    if (ponto.tipo === 'mesa' || ponto.tipo === 'local_externo') {
      setMesaSelecionada(selecionado ? null : ponto.numero)
      setComandaSelecionada(null)
      return
    }

    setComandaSelecionada(selecionado ? null : ponto.numero)
    setMesaSelecionada(null)
  }, [comandaSelecionada, mesaSelecionada])

  useEffect(() => {
    if (tipoEntrega !== 'local') {
      setMesaSelecionada(null)
      setComandaSelecionada(null)
    }
  }, [tipoEntrega])

  const adicionarProduto = (produto: Produto | ComboType) => {
    const jaExiste = produtosSelecionados.find((p) => p.id === produto.id)

    if (jaExiste) {
      setProdutosSelecionados(
        produtosSelecionados.map((p) =>
          p.id === produto.id ? { ...p, quantidade: p.quantidade + 1 } : p
        )
      )
    } else {
      setProdutosSelecionados([
        ...produtosSelecionados,
        { ...produto, quantidade: 1, observacoes: '', adicionais: [], descontoManualInput: '' },
      ])
    }
    setBuscaProduto('')
  }

  const removerProduto = (id: string) => {
    setProdutosSelecionados(produtosSelecionados.filter((p) => p.id !== id))
  }

  const atualizarQuantidade = (id: string, quantidade: number) => {
    if (quantidade < 1) return
    setProdutosSelecionados(
      produtosSelecionados.map((p) => (p.id === id ? { ...p, quantidade } : p))
    )
  }

  const atualizarObservacoes = (id: string, observacoes: string) => {
    setProdutosSelecionados(
      produtosSelecionados.map((p) => (p.id === id ? { ...p, observacoes } : p))
    )
  }

  const atualizarDescontoItem = (id: string, valor: string) => {
    const normalizado = normalizarInputMonetario(valor)
    setProdutosSelecionados(
      produtosSelecionados.map((p) => (p.id === id ? { ...p, descontoManualInput: normalizado } : p))
    )
  }

  const alterarDescontoPedido = (valor: string) => {
    setDescontoPedidoInput(normalizarInputMonetario(valor))
  }

  const adicionarAdicional = (produtoId: string, adicional: Adicional) => {
    setProdutosSelecionados(
      produtosSelecionados.map((p) => {
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
    setProdutosSelecionados(
      produtosSelecionados.map((p) => {
        if (p.id === produtoId) {
          return { ...p, adicionais: p.adicionais.filter((a) => a.id !== adicionalId) }
        }
        return p
      })
    )
  }

  const mesasCadastradas = useMemo(
    () => mesasDisponiveis.filter((registro) => registro.tipo === 'mesa'),
    [mesasDisponiveis]
  )

  const comandasCadastradas = useMemo(
    () => mesasDisponiveis.filter((registro) => registro.tipo === 'comanda'),
    [mesasDisponiveis]
  )

  const locaisExternosCadastrados = useMemo(
    () => mesasDisponiveis.filter((registro) => registro.tipo === 'local_externo'),
    [mesasDisponiveis]
  )

  const pontosSalaoAtivos = modoSalao === 'mesa'
    ? mesasCadastradas
    : modoSalao === 'local_externo'
      ? locaisExternosCadastrados
      : comandasCadastradas

  const pontoSalaoSelecionado = useMemo(() => {
    const numero = modoSalao === 'comanda' ? comandaSelecionada : mesaSelecionada
    if (!numero) return null
    return pontosSalaoAtivos.find((registro) => registro.numero === numero) || null
  }, [modoSalao, mesaSelecionada, comandaSelecionada, pontosSalaoAtivos])

  const rotuloPontoSalaoSelecionado = obterRotuloPontoSalao(pontoSalaoSelecionado)

  const obterTaxaEntrega = () => {
    if (tipoEntrega !== 'entrega') return 0
    const bairro = bairros.find((item) => item.id === bairroSelecionado)
    return bairro ? bairro.taxa_entrega : 0
  }

  const calcularSubtotalBrutoProduto = (produto: ProdutoSelecionado) => {
    const precoAdicionais = produto.adicionais.reduce((sum, adicional) => sum + adicional.preco, 0)
    return (produto.preco + precoAdicionais) * produto.quantidade
  }

  const calcularDescontoProduto = (produto: ProdutoSelecionado) =>
    Math.min(
      calcularSubtotalBrutoProduto(produto),
      paraNumeroMonetario(produto.descontoManualInput || '')
    )

  const calcularSubtotalProduto = (produto: ProdutoSelecionado) =>
    Math.max(0, calcularSubtotalBrutoProduto(produto) - calcularDescontoProduto(produto))

  const percentualTaxaServicoNumero = useMemo(() => {
    const numero = Number(percentualTaxaServico.replace(',', '.'))
    if (!Number.isFinite(numero) || numero < 0) return 0
    return numero
  }, [percentualTaxaServico])

  const totalItensPedido = useMemo(
    () => produtosSelecionados.reduce((acc, produto) => acc + produto.quantidade, 0),
    [produtosSelecionados]
  )

  const subtotalBrutoPedido = useMemo(
    () => produtosSelecionados.reduce((acc, produto) => acc + calcularSubtotalBrutoProduto(produto), 0),
    [produtosSelecionados]
  )

  const descontoItensTotal = useMemo(
    () => produtosSelecionados.reduce((acc, produto) => acc + calcularDescontoProduto(produto), 0),
    [produtosSelecionados]
  )

  const subtotalAposDescontosItens = useMemo(
    () => Math.max(0, subtotalBrutoPedido - descontoItensTotal),
    [subtotalBrutoPedido, descontoItensTotal]
  )

  const descontoPedidoAplicado = useMemo(
    () => Math.min(subtotalAposDescontosItens, paraNumeroMonetario(descontoPedidoInput)),
    [subtotalAposDescontosItens, descontoPedidoInput]
  )

  const subtotalPedido = useMemo(
    () => Math.max(0, subtotalAposDescontosItens - descontoPedidoAplicado),
    [subtotalAposDescontosItens, descontoPedidoAplicado]
  )

  const taxaEntregaPedido = useMemo(() => obterTaxaEntrega(), [tipoEntrega, bairroSelecionado, bairros])

  const taxaServicoCalculada = useMemo(() => {
    if (tipoEntrega !== 'local' || !aplicarTaxaServico) return 0
    return subtotalPedido * (percentualTaxaServicoNumero / 100)
  }, [tipoEntrega, aplicarTaxaServico, subtotalPedido, percentualTaxaServicoNumero])

  const taxaServicoPedido = useMemo(() => {
    if (tipoEntrega !== 'local' || !aplicarTaxaServico) return 0
    const manual = Number(taxaServicoManual.replace(',', '.'))
    if (!Number.isFinite(manual) || manual < 0) return taxaServicoCalculada
    return manual
  }, [tipoEntrega, aplicarTaxaServico, taxaServicoManual, taxaServicoCalculada])

  const totalPedido = useMemo(
    () => subtotalPedido + taxaEntregaPedido + taxaServicoPedido,
    [subtotalPedido, taxaEntregaPedido, taxaServicoPedido]
  )

  const calcularTotal = useCallback(() => totalPedido, [totalPedido])

  const adicionarPagamento = () => {
    if (!novoPagamentoForma || !novoPagamentoValor) return
    const valor = parseFloat(novoPagamentoValor)
    if (isNaN(valor) || valor <= 0) return
    
    // Validar se não ultrapassa o total
    const totalAtual = pagamentos.reduce((acc, p) => acc + p.valor, 0)
    const total = calcularTotal()
    
    if (totalAtual + valor > total) {
      toast.warning(`Valor excede o total do pedido. Máximo permitido: R$ ${(total - totalAtual).toFixed(2)}`)
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

  const totalPagamentos = pagamentos.reduce((acc, p) => acc + p.valor, 0)
  const valorRestante = calcularTotal() - totalPagamentos
  const pagamentoValido = pagamentoDividido
    ? pagamentos.length > 0 && Math.abs(valorRestante) <= 0.01
    : !!formaPagamento

  const atendimentoLocalSelecionado =
    tipoEntrega !== 'local' || (modoSalao === 'comanda' ? Boolean(comandaSelecionada) : Boolean(mesaSelecionada))

  const podeSalvarPedido = Boolean(
    !loading &&
    nomeCliente.trim() &&
    produtosSelecionados.length > 0 &&
    atendimentoLocalSelecionado &&
    (tipoEntrega !== 'entrega' || bairroSelecionado) &&
    pagamentoValido
  )

  const pendenciaPrincipalSalvar =
    !nomeCliente.trim()
      ? 'Informe o nome do cliente'
      : produtosSelecionados.length === 0
        ? 'Adicione pelo menos um item'
        : tipoEntrega === 'local' && !atendimentoLocalSelecionado
          ? `Selecione ${obterNomeTipoPontoSalao(modoSalao) === 'local parceiro' ? 'um local parceiro' : `uma ${obterNomeTipoPontoSalao(modoSalao)}`}`
        : tipoEntrega === 'entrega' && !bairroSelecionado
          ? 'Selecione um bairro'
          : !pagamentoValido
            ? 'Revise o pagamento'
          : null

  const podeAvancarEtapaMobile =
    etapaMobile === 'salao'
      ? atendimentoLocalSelecionado
      : etapaMobile === 'produtos'
        ? produtosSelecionados.length > 0
        : etapaMobile === 'dados'
          ? Boolean(nomeCliente.trim()) &&
            atendimentoLocalSelecionado &&
            (tipoEntrega !== 'entrega' || Boolean(bairroSelecionado)) &&
            pagamentoValido
          : podeSalvarPedido

  const textoBotaoEtapaMobile =
    etapaMobile === 'salao'
      ? 'Selecionar itens'
      : etapaMobile === 'produtos'
        ? 'Dados do cliente'
        : etapaMobile === 'dados'
          ? 'Revisar pedido'
          : 'Confirmar pedido'

  const avancarEtapaMobile = () => {
    if (!podeAvancarEtapaMobile) {
      if (etapaMobile === 'salao') {
        destacarCampoErro('mesa')
        toast.warning(`Selecione ${modoSalao === 'local_externo' ? 'um local parceiro' : `uma ${obterNomeTipoPontoSalao(modoSalao)}`}`)
        return
      }
      if (etapaMobile === 'produtos') {
        destacarCampoErro('itens')
        toast.warning('Adicione pelo menos um item')
        return
      }
      if (etapaMobile === 'dados') {
        if (!nomeCliente.trim()) destacarCampoErro('nome')
        else if (tipoEntrega === 'entrega' && !bairroSelecionado) destacarCampoErro('bairro')
        else if (!pagamentoValido) destacarCampoErro('pagamento')
        else if (!atendimentoLocalSelecionado) destacarCampoErro('mesa')
        toast.warning(pendenciaPrincipalSalvar || 'Complete os dados do pedido')
        return
      }
    }

    setCampoErro(null)
    if (etapaMobile === 'salao') setEtapaMobile('produtos')
    else if (etapaMobile === 'produtos') setEtapaMobile('dados')
    else if (etapaMobile === 'dados') setEtapaMobile('ticket')
    else void salvarPedido()
  }

  const salvarPedido = async () => {
    if (!nomeCliente || produtosSelecionados.length === 0) {
      if (!nomeCliente.trim()) destacarCampoErro('nome')
      else destacarCampoErro('itens')
      toast.warning('Preencha o nome do cliente e adicione pelo menos um produto')
      return
    }

    if (tipoEntrega === 'local' && !atendimentoLocalSelecionado) {
      destacarCampoErro('mesa')
      toast.warning(`Selecione ${modoSalao === 'local_externo' ? 'um local parceiro' : `uma ${obterNomeTipoPontoSalao(modoSalao)}`} para pedido no local`)
      return
    }

    if (tipoEntrega === 'entrega' && !bairroSelecionado) {
      destacarCampoErro('bairro')
      toast.warning('Selecione o bairro para entrega')
      return
    }

    if (pagamentoDividido) {
      if (pagamentos.length === 0) {
        destacarCampoErro('pagamento')
        toast.warning('Adicione pelo menos uma forma de pagamento')
        return
      }
      if (Math.abs(valorRestante) > 0.01) {
        destacarCampoErro('pagamento')
        toast.warning('O valor dos pagamentos deve ser igual ao total do pedido')
        return
      }
    } else if (!formaPagamento) {
      destacarCampoErro('pagamento')
      toast.warning('Selecione uma forma de pagamento')
      return
    }

    setCampoErro(null)
    setLoading(true)
    try {
      const subtotal = subtotalPedido
      const subtotalOriginal = subtotalBrutoPedido
      const descontoItens = descontoItensTotal
      const descontoManualPedido = descontoPedidoAplicado
      const taxaEntrega = taxaEntregaPedido
      const taxaServico = taxaServicoPedido
      const totalOriginal = subtotalOriginal + taxaEntrega + taxaServico
      const total = totalPedido
      const numeroSalaoSelecionado = modoSalao === 'comanda' ? comandaSelecionada : mesaSelecionada
      const ehParceiroPedido = (pontoSalaoSelecionado?.tipo || modoSalao) === 'local_externo'
      const nomeClientePedido = nomeClienteParaPedido({
        nomeCliente,
        tipoEntrega,
        localParceiro: ehParceiroPedido,
      })
      const nomeClienteSalao = nomeClienteParaPontoSalao({
        nomeCliente,
        localParceiro: ehParceiroPedido,
      })

      // Bairro selecionado
      const bairroObj = bairros.find(b => b.id === bairroSelecionado)
      const nomeBairro = bairroObj ? bairroObj.nome : null

      // Endereço completo
      const enderecoCompleto = tipoEntrega === 'entrega' && endereco ? endereco : null

      // Determinar forma de pagamento principal
      const formaPagamentoPrincipal = pagamentoDividido 
        ? 'Dividido' 
        : formaPagamento

      // Calcula o valor do troco apenas se for dinheiro e precisar de troco
      const valorTrocoPara = (formaPagamento === 'Dinheiro' && precisaTroco && trocoPara && !pagamentoDividido) 
        ? parseFloat(trocoPara) 
        : null
      const proximoNumeroPedido = await buscarProximoNumeroPedidoDiario(supabase)

      // Cria pedido como 'preparando' primeiro (itens serão inseridos depois)
      // Depois muda para 'pendente' para disparar a impressão com os itens já no banco
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero_pedido: proximoNumeroPedido,
          nome_cliente: nomeClientePedido,
          telefone: telefoneCliente.trim() || null,
          endereco: enderecoCompleto,
          bairro: nomeBairro,
          tipo_entrega: tipoEntrega,
          forma_pagamento: formaPagamentoPrincipal,
          subtotal_original: subtotalOriginal,
          subtotal: subtotal,
          desconto_itens_total: descontoItens,
          desconto_manual: descontoManualPedido,
          taxa_entrega: taxaEntrega,
          taxa_servico: taxaServico,
          total_original: totalOriginal,
          total: total,
          status: 'preparando', // Começa como preparando (não dispara impressão)
          troco_para: valorTrocoPara,
          observacoes: observacoesPedido.trim() || null,
          mesa: tipoEntrega === 'local' && modoSalao !== 'comanda' ? mesaSelecionada : null,
          comanda: tipoEntrega === 'local' && modoSalao === 'comanda' ? comandaSelecionada : null,
          mesa_id: tipoEntrega === 'local' ? pontoSalaoSelecionado?.id || null : null,
          cliente_id: clienteSelecionado?.id || null,
        })
        .select()
        .single()

      if (pedidoError) throw pedidoError
      await sincronizarNumeroPedidoDiario(supabase, pedido).catch((erro) => {
        console.error('[Admin] Falha ao sincronizar número diário do pedido:', erro)
        return normalizarNumeroPedido(pedido.numero_pedido)
      })

      // Ocupar mesa/comanda se for pedido local — locais parceiros nunca bloqueiam
      if (tipoEntrega === 'local' && numeroSalaoSelecionado && !ehParceiroPedido) {
        const agora = new Date()
        const liberarEm = calcularLiberacaoMesa(agora)
        let atualizacaoSalao = supabase
          .from('mesas')
          .update({
            status: 'ocupada',
            nome_cliente: nomeClienteSalao,
            ocupada_em: agora.toISOString(),
            liberar_em: liberarEm.toISOString(),
            tempo_limite_minutos: TEMPO_PADRAO_MESA_MINUTOS,
            pedido_id: pedido.id,
          })
          .eq('status', 'livre')

        if (pontoSalaoSelecionado?.id) {
          atualizacaoSalao = atualizacaoSalao.eq('id', pontoSalaoSelecionado.id)
        } else {
          atualizacaoSalao = atualizacaoSalao
            .eq('numero', numeroSalaoSelecionado)
            .eq('tipo', modoSalao)
        }

        const { data: pontosAtualizados, error: erroAtualizacaoSalao } = await atualizacaoSalao.select('id')

        if (erroAtualizacaoSalao) throw erroAtualizacaoSalao

        if (!pontosAtualizados || pontosAtualizados.length === 0) {
          await supabase.from('pedidos').delete().eq('id', pedido.id)
          throw new Error(`${rotuloPontoSalaoSelecionado} acabou de ser ocupado. Atualize e escolha outro ponto.`)
        }
      }

      // Inserir pagamentos divididos
      if (pagamentoDividido && pagamentos.length > 0) {
        const pagamentosParaInserir = pagamentos.map(p => ({
          pedido_id: pedido.id,
          forma_pagamento: p.forma,
          valor: p.valor
        }))

        const { error: pagamentosError } = await supabase
          .from('pagamentos_pedido')
          .insert(pagamentosParaInserir)

        if (pagamentosError) throw pagamentosError
      } else {
        // Inserir pagamento único
        const formaNormalizada = formaPagamento === 'Dinheiro' ? 'dinheiro' 
          : formaPagamento === 'PIX' ? 'pix'
          : formaPagamento === 'Cartão de Crédito' ? 'credito'
          : formaPagamento === 'Cartão de Débito' ? 'debito'
          : formaPagamento === 'Crediário' ? 'crediario'
          : 'dinheiro'

        const { error: pagError } = await supabase
          .from('pagamentos_pedido')
          .insert({
            pedido_id: pedido.id,
            forma_pagamento: formaNormalizada,
            valor: total
          })
        if (pagError) console.error('[Admin] Falha ao inserir pagamento:', pagError.message)
      }

      // Inserir itens e seus adicionais
      for (const p of produtosSelecionados) {
        const subtotalItemOriginal = calcularSubtotalBrutoProduto(p)
        const descontoItem = calcularDescontoProduto(p)
        const subtotalItem = calcularSubtotalProduto(p)

        const { data: item, error: itemError } = await supabase
          .from('itens_pedido')
          .insert({
            pedido_id: pedido.id,
            nome_item: p.nome,
            quantidade: p.quantidade,
            preco_unitario: p.preco,
            subtotal_original: subtotalItemOriginal,
            desconto_manual: descontoItem,
            subtotal: subtotalItem,
            observacoes: p.observacoes || null,
          })
          .select()
          .single()

        if (itemError) throw itemError

        // Inserir adicionais do item
        if (p.adicionais.length > 0) {
          const adicionaisParaInserir = p.adicionais.map((a) => ({
            item_pedido_id: item.id,
            adicional_id: a.id,
            nome: a.nome,
            preco: a.preco,
          }))

          const { error: adicionaisError } = await supabase
            .from('item_adicionais')
            .insert(adicionaisParaInserir)

          if (adicionaisError) throw adicionaisError
        }
      }

      // Se for entrega, criar registro na tabela de entregas automaticamente
      if (tipoEntrega === 'entrega') {
        try {
          // Usar upsert para evitar duplicatas (constraint unique em pedido_id)
          const { error } = await supabase.from('entregas').upsert({
            pedido_id: pedido.id,
            endereco_entrega: endereco || null,
            taxa_entrega: taxaEntrega,
            status: 'pendente'
          }, { 
            onConflict: 'pedido_id',
            ignoreDuplicates: true 
          })
          
          if (!error) {
            console.log('[Entrega] Entrega criada automaticamente para pedido:', pedido.id)
          }
        } catch (entregaError) {
          console.error('[Entrega] Erro ao criar entrega:', entregaError)
        }
      }

      // Atualiza status para 'confirmado' (pedido pronto)
      const { error: statusError } = await supabase
        .from('pedidos')
        .update({ status: 'confirmado' })
        .eq('id', pedido.id)
      if (statusError) console.error('[Admin] Falha ao atualizar status do pedido:', statusError.message)

      // Envia para fila de impressão se habilitado
      if (enviarParaImpressao) {
        try {
          const hashEvento = gerarHashEventoImpressao(
            pedido.id,
            'cozinha',
            'pedido_completo',
            null,
            'admin_novo_pedido'
          )

          const resultadoFila = await enfileirarImpressao({
            pedidoId: pedido.id,
            tipo: 'cozinha',
            escopo: 'pedido_completo',
            origem: 'admin_novo_pedido',
            hashEvento
          })

          if (resultadoFila.sucesso || resultadoFila.duplicado) {
            console.log('[Impressão] Pedido enviado para fila de impressão')
          } else {
            console.error('[Impressão] Erro ao enviar para fila:', resultadoFila.erro)
          }
        } catch (impressaoError) {
          // Ignora erro de duplicata
          console.error('[Impressão] Erro ao enviar para fila:', impressaoError)
        }
      }

      router.push('/admin/pedidos')
    } catch (error) {
      console.error('Erro ao salvar pedido:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar pedido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const aoPressionarTecla = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement | null
      const tagAlvo = alvo?.tagName || ''
      const digitandoEmCampo = Boolean(
        alvo &&
        (tagAlvo === 'INPUT' ||
          tagAlvo === 'TEXTAREA' ||
          tagAlvo === 'SELECT' ||
          alvo.isContentEditable)
      )

      const enterSimples = evento.key === 'Enter' && !evento.shiftKey && !evento.ctrlKey && !evento.metaKey && !evento.altKey
      if (enterSimples && tagAlvo !== 'TEXTAREA') {
        const botaoConfirmar = document.getElementById('botao-confirmar-pedido') as HTMLButtonElement | null
        if (botaoConfirmar && !botaoConfirmar.disabled) {
          evento.preventDefault()
          botaoConfirmar.click()
          return
        }
      }

      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        referenciaBuscaProduto.current?.focus()
        return
      }

      if (!evento.altKey) return

      const tecla = evento.key.toLowerCase()

      if (tecla === '1') {
        evento.preventDefault()
        setTipoEntrega('entrega')
        return
      }

      if (tecla === '2') {
        evento.preventDefault()
        setTipoEntrega('retirada')
        return
      }

      if (tecla === '3') {
        evento.preventDefault()
        setTipoEntrega('local')
        return
      }

      if (!digitandoEmCampo && tecla === 'm' && tipoEntrega === 'local') {
        evento.preventDefault()
        selecionarModoSalao('mesa')
        return
      }

      if (!digitandoEmCampo && tecla === 'c' && tipoEntrega === 'local') {
        evento.preventDefault()
        selecionarModoSalao('comanda')
        return
      }

      if (!digitandoEmCampo && tecla === 'i') {
        evento.preventDefault()
        setEnviarParaImpressao((estadoAnterior) => !estadoAnterior)
        return
      }

      if (!digitandoEmCampo && tecla === 's') {
        evento.preventDefault()
        const botaoConfirmar = document.getElementById('botao-confirmar-pedido') as HTMLButtonElement | null
        if (botaoConfirmar && !botaoConfirmar.disabled) {
          botaoConfirmar.click()
        }
      }
    }

    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [selecionarModoSalao, tipoEntrega])

  const itensCatalogo = useMemo<ItemCatalogoPedido[]>(
    () => [
      ...produtos.map((produto) => ({
        id: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        categoria: normalizarNomeCategoria(produto.categoria),
        tipo: 'produto' as const,
      })),
      ...combos.map((combo) => ({
        id: combo.id,
        nome: combo.nome,
        preco: combo.preco,
        categoria: normalizarNomeCategoria(combo.categoria),
        tipo: 'combo' as const,
      })),
    ],
    [combos, produtos]
  )

  const categoriasCatalogo = useMemo<CategoriaCatalogoPedido[]>(() => {
    const termoBusca = buscaProduto.trim().toLowerCase()

    const itensFiltrados = itensCatalogo.filter((item) => {
      const nome = item.nome.toLowerCase()
      const categoria = item.categoria.toLowerCase()
      return nome.includes(termoBusca) || categoria.includes(termoBusca)
    })

    const agrupado = itensFiltrados.reduce((acumulador, item) => {
      if (!acumulador[item.categoria]) {
        acumulador[item.categoria] = []
      }
      acumulador[item.categoria].push(item)
      return acumulador
    }, {} as Record<string, ItemCatalogoPedido[]>)

    const ORDEM_CATEGORIAS = ['pastel', 'refri', 'cerveja', 'salgado', 'bombom']
    const ordemCategoria = (nome: string) => {
      const n = nome.toLowerCase()
      const idx = ORDEM_CATEGORIAS.findIndex((k) => n.includes(k))
      return idx >= 0 ? idx : ORDEM_CATEGORIAS.length
    }

    return Object.entries(agrupado)
      .map(([nomeCategoria, itens]) => ({
        id: nomeCategoria,
        nome: nomeCategoria,
        total: itens.length,
        itens: itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      }))
      .sort((a, b) => {
        const diff = ordemCategoria(a.nome) - ordemCategoria(b.nome)
        return diff !== 0 ? diff : a.nome.localeCompare(b.nome, 'pt-BR')
      })
  }, [buscaProduto, itensCatalogo])

  useEffect(() => {
    if (categoriasCatalogo.length === 0) {
      if (categoriaExpandida !== null) setCategoriaExpandida(null)
      return
    }

    if (categoriaExpandida === null) return

    const categoriaAindaExiste = categoriasCatalogo.some((categoria) => categoria.id === categoriaExpandida)
    if (!categoriaAindaExiste) {
      setCategoriaExpandida(categoriasCatalogo[0].id)
    }
  }, [categoriasCatalogo, categoriaExpandida])

  const quantidadesSelecionadasCatalogo = useMemo(
    () =>
      produtosSelecionados.reduce((acumulador, item) => {
        acumulador[item.id] = item.quantidade
        return acumulador
      }, {} as Record<string, number>),
    [produtosSelecionados]
  )

  const destacarCampoErro = useCallback((campo: typeof campoErro) => {
    setCampoErro(campo)
    if (campo === 'nome') {
      refNomeCliente.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      refNomeCliente.current?.focus()
      return
    }
    if (campo === 'pagamento') {
      refSecaoPagamento.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (campo === 'mesa') {
      const alvo = isDesktop ? refSecaoAtendimentoDesktop.current : refSecaoAtendimentoMobile.current
      alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isDesktop])

  const irParaAtendimento = useCallback(() => {
    setEtapaMobile('salao')
    if (isDesktop) {
      requestAnimationFrame(() => {
        refSecaoAtendimentoDesktop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [isDesktop])

  const rotuloResumoAtendimento =
    tipoEntrega === 'entrega'
      ? 'Entrega'
      : tipoEntrega === 'retirada'
        ? 'Retirada'
        : pontoSalaoSelecionado
          ? rotuloPontoSalaoSelecionado
          : obterNomeTipoPontoSalaoCapitalizado(modoSalao)

  const adicionarItemCatalogo = useCallback(
    (item: ItemCatalogoPedido) => {
      setCampoErro(null)
      const jaExiste = produtosSelecionados.find(
        (p) =>
          p.id === item.id &&
          !p.observacoes.trim() &&
          !p.descontoManualInput.trim() &&
          p.adicionais.length === 0,
      )

      if (jaExiste) {
        setProdutosSelecionados(
          produtosSelecionados.map((p) =>
            p.id === jaExiste.id ? { ...p, quantidade: p.quantidade + 1 } : p,
          ),
        )
      } else {
        setProdutosSelecionados([
          ...produtosSelecionados,
          {
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            quantidade: 1,
            observacoes: '',
            adicionais: [],
            descontoManualInput: '',
          },
        ])
      }
      setBuscaProduto('')
    },
    [produtosSelecionados],
  )

  const personalizarItemCatalogo = useCallback(
    (item: ItemCatalogoPedido) => {
      const jaExiste = produtosSelecionados.find((p) => p.id === item.id)
      setModalItemModoEdicao(Boolean(jaExiste))
      setModalItemDados({
        id: item.id,
        nome: item.nome,
        preco: item.preco,
        categoria: item.categoria,
        quantidade: jaExiste?.quantidade ?? 1,
        observacoes: jaExiste?.observacoes ?? '',
        descontoManualInput: jaExiste?.descontoManualInput ?? '',
      })
      setModalItemAberto(true)
    },
    [produtosSelecionados],
  )

  const abrirEditorItem = useCallback(
    (produto: ProdutoSelecionado) => {
      setModalItemModoEdicao(true)
      setModalItemDados({
        id: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        categoria: null,
        quantidade: produto.quantidade,
        observacoes: produto.observacoes,
        descontoManualInput: produto.descontoManualInput,
      })
      setModalItemAberto(true)
    },
    []
  )

  const confirmarModalItem = useCallback(
    (atualizado: { quantidade: number; observacoes: string; descontoManualInput: string }) => {
      if (!modalItemDados) return
      const id = modalItemDados.id
      const jaExiste = produtosSelecionados.find((p) => p.id === id)
      if (jaExiste) {
        setProdutosSelecionados((anteriores) =>
          anteriores.map((p) =>
            p.id === id
              ? {
                  ...p,
                  quantidade: Math.max(1, atualizado.quantidade),
                  observacoes: atualizado.observacoes,
                  descontoManualInput: atualizado.descontoManualInput,
                }
              : p,
          ),
        )
      } else {
        setProdutosSelecionados((anteriores) => [
          ...anteriores,
          {
            id: modalItemDados.id,
            nome: modalItemDados.nome,
            preco: modalItemDados.preco,
            quantidade: Math.max(1, atualizado.quantidade),
            observacoes: atualizado.observacoes,
            adicionais: [],
            descontoManualInput: atualizado.descontoManualInput,
          },
        ])
      }
      setBuscaProduto('')
      setModalItemAberto(false)
    },
    [modalItemDados, produtosSelecionados]
  )

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="flex flex-col gap-4 pb-32 sm:pb-36 xl:h-[calc(100dvh-104px-5.5rem)] xl:overflow-hidden xl:pb-0">
          {/* Stepper mobile */}
          <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3 xl:hidden">
            <div className="grid grid-cols-4 gap-2">
              {([
                {
                  id: 'salao' as const,
                  label:
                    tipoEntrega === 'entrega'
                      ? 'Entrega'
                      : tipoEntrega === 'retirada'
                        ? 'Retirada'
                        : 'Local',
                  ok: atendimentoLocalSelecionado,
                  hint: tipoEntrega === 'local'
                    ? atendimentoLocalSelecionado
                      ? rotuloPontoSalaoSelecionado
                      : 'Escolha'
                    : tipoEntrega === 'entrega'
                      ? 'Com endereço'
                      : 'Balcão',
                },
                {
                  id: 'produtos' as const,
                  label: 'Itens',
                  ok: produtosSelecionados.length > 0,
                  hint:
                    produtosSelecionados.length === 0
                      ? 'Adicione itens'
                      : `${totalItensPedido} ${totalItensPedido === 1 ? 'item' : 'itens'}`,
                },
                {
                  id: 'dados' as const,
                  label: 'Pessoa',
                  ok:
                    Boolean(nomeCliente.trim()) &&
                    atendimentoLocalSelecionado &&
                    (tipoEntrega !== 'entrega' || bairroSelecionado) &&
                    pagamentoValido,
                  hint: !nomeCliente.trim()
                    ? 'Preencha dados'
                    : !pagamentoValido
                      ? 'Falta pagamento'
                      : 'Completo',
                },
                {
                  id: 'ticket' as const,
                  label: 'Resumo',
                  ok: podeSalvarPedido,
                  hint: podeSalvarPedido ? 'Pronto' : 'Revise',
                },
              ]).map((etapa, indice) => {
                const ativo = etapaMobile === etapa.id
                const concluido = etapa.ok && !ativo
                return (
                  <button
                    key={etapa.id}
                    type="button"
                    onClick={() => setEtapaMobile(etapa.id)}
                    aria-current={ativo ? 'step' : undefined}
                    className={cn(
                      'flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center transition-colors',
                      ativo
                        ? 'bg-foreground text-background'
                        : concluido
                          ? 'bg-accent text-foreground hover:bg-accent/80'
                          : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <span className="flex items-center gap-1 text-xs font-medium leading-tight">
                      {concluido ? (
                        <Check strokeWidth={2} className="size-3" />
                      ) : (
                        <span
                          className={cn(
                            'flex size-4 items-center justify-center rounded-full font-mono text-[10px] tabular-nums',
                            ativo
                              ? 'bg-background/15 text-background'
                              : 'bg-muted-foreground/15 text-muted-foreground',
                          )}
                        >
                          {indice + 1}
                        </span>
                      )}
                      {etapa.label}
                    </span>
                    <span className="line-clamp-1 text-[11px] leading-tight opacity-80">
                      {etapa.hint}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Dicas contextuais */}
            {etapaMobile === 'salao' && !atendimentoLocalSelecionado && (
              <p className="rounded-md bg-muted/40 px-3 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                Escolha o tipo de atendimento antes de continuar
              </p>
            )}
            {etapaMobile === 'produtos' && produtosSelecionados.length === 0 && (
              <p className="rounded-md bg-muted/40 px-3 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                Toque nos produtos para adicionar. Use Personalizar para obs. ou desconto.
              </p>
            )}
            {etapaMobile === 'dados' && campoErro && pendenciaPrincipalSalvar && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-center text-[11px] font-medium text-destructive">
                {pendenciaPrincipalSalvar}
              </p>
            )}
            {etapaMobile === 'dados' && !campoErro && !nomeCliente.trim() && (
              <p className="rounded-md bg-muted/40 px-3 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                Preencha o nome do cliente e selecione a forma de pagamento
              </p>
            )}
            {etapaMobile === 'ticket' && !podeSalvarPedido && pendenciaPrincipalSalvar && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-center text-[11px] font-medium text-destructive">
                {pendenciaPrincipalSalvar}
              </p>
            )}
            {etapaMobile === 'ticket' && podeSalvarPedido && (
              <p className="rounded-md bg-muted/40 px-3 py-1.5 text-center text-[11px] font-medium text-foreground">
                Pedido pronto. Toque em &ldquo;Confirmar pedido&rdquo;
              </p>
            )}
          </div>

          <div
            ref={refSecaoAtendimentoMobile}
            className={cn(
              'xl:hidden',
              etapaMobile === 'salao' ? 'block' : 'hidden',
            )}
          >
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-none',
              campoErro === 'mesa' && 'ring-2 ring-destructive/40',
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Tipo de atendimento
              </p>
              {atendimentoLocalSelecionado && tipoEntrega === 'local' && (
                <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-xs font-medium text-foreground">
                  {rotuloPontoSalaoSelecionado}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {([
                { id: 'mesa' as const, label: 'Mesa', hint: 'Consumo no local' },
                { id: 'comanda' as const, label: 'Comanda', hint: 'Atendimento aberto' },
                { id: 'local_externo' as const, label: 'Parceiro', hint: 'Bar próximo' },
              ]).map((opcao) => {
                const ativa = tipoEntrega === 'local' && modoSalao === opcao.id
                return (
                  <button
                    key={opcao.id}
                    type="button"
                    onClick={() => {
                      setTipoEntrega('local')
                      selecionarModoSalao(opcao.id)
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      ativa
                        ? 'border-foreground/20 bg-foreground text-background'
                        : 'border-border/70 bg-background hover:bg-accent',
                    )}
                  >
                    <span className="text-sm font-semibold">{opcao.label}</span>
                    <span className={cn('mt-1 block text-xs', ativa ? 'text-background/75' : 'text-muted-foreground')}>
                      {opcao.hint}
                    </span>
                  </button>
                )
              })}

              {([
                { id: 'entrega', label: 'Entrega', hint: 'Com endereço' },
                { id: 'retirada', label: 'Retirada', hint: 'Balcão' },
              ]).map((opcao) => {
                const ativa = tipoEntrega === opcao.id
                return (
                  <button
                    key={opcao.id}
                    type="button"
                    onClick={() => {
                      setTipoEntrega(opcao.id)
                      setMesaSelecionada(null)
                      setComandaSelecionada(null)
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      ativa
                        ? 'border-foreground/20 bg-foreground text-background'
                        : 'border-border/70 bg-background hover:bg-accent',
                    )}
                  >
                    <span className="text-sm font-semibold">{opcao.label}</span>
                    <span className={cn('mt-1 block text-xs', ativa ? 'text-background/75' : 'text-muted-foreground')}>
                      {opcao.hint}
                    </span>
                  </button>
                )
              })}
            </div>

            {tipoEntrega === 'local' && (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    Escolha {modoSalao === 'local_externo' ? 'o local parceiro' : `a ${obterNomeTipoPontoSalao(modoSalao)}`}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {modoSalao === 'local_externo'
                      ? `${pontosSalaoAtivos.length} disponíveis`
                      : `${pontosSalaoAtivos.filter((ponto) => ponto.status === 'livre').length} livres`}
                  </span>
                </div>

                {loadingMesas ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : pontosSalaoAtivos.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum {obterNomeTipoPontoSalao(modoSalao)} cadastrado
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
                    {pontosSalaoAtivos.map((ponto) => {
                      const ehParceiro = ponto.tipo === 'local_externo'
                      const livre = ponto.status === 'livre'
                      const selecionavel = livre || ehParceiro
                      const selecionada = modoSalao === 'comanda'
                        ? comandaSelecionada === ponto.numero
                        : mesaSelecionada === ponto.numero

                      const rotuloPonto = obterRotuloPontoSalao(ponto)
                      const textoPrincipal = ehParceiro ? rotuloPonto : String(ponto.numero)
                      const textoStatus = selecionada
                        ? 'Selecionado'
                        : ehParceiro
                          ? 'Disponível'
                          : livre ? 'Livre' : 'Ocupado'

                      return (
                        <button
                          key={ponto.id}
                          type="button"
                          onClick={() => selecionarPontoSalao(ponto)}
                          disabled={!selecionavel && !selecionada}
                          className={cn(
                            'flex min-h-[76px] flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            selecionada
                              ? 'border-foreground bg-foreground text-background'
                              : selecionavel
                                ? 'border-border/70 bg-background hover:bg-accent'
                                : 'cursor-not-allowed border-border/60 bg-muted/30 text-muted-foreground opacity-55',
                          )}
                        >
                          {!ehParceiro && (
                            <span className={cn('text-[10px] font-semibold uppercase leading-none tracking-wider', selecionada ? 'text-background/70' : 'text-muted-foreground')}>
                              {modoSalao === 'comanda' ? 'Comanda' : 'Mesa'}
                            </span>
                          )}
                          <span className={cn('mt-1 font-semibold', ehParceiro ? 'line-clamp-2 text-xs' : 'font-mono text-xl tabular-nums leading-none')}>
                            {textoPrincipal}
                          </span>
                          <span className={cn('mt-1 text-[11px]', selecionada ? 'text-background/75' : 'text-muted-foreground')}>
                            {textoStatus}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.section>
          </div>

          <div className="grid w-full min-w-0 overflow-x-hidden gap-4 xl:flex-1 xl:min-h-0 xl:overflow-hidden xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:grid-rows-[1fr]">
            {/* Adicionar Produtos (catálogo) - principal, à esquerda */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`${etapaMobile === 'produtos' ? 'block' : 'hidden'} min-w-0 xl:block xl:col-start-1 xl:row-start-1 xl:h-full xl:overflow-hidden`}
            >
              <PainelCategoriasProduto
                carregando={loadingProdutos}
                referenciaBusca={referenciaBuscaProduto}
                termoBusca={buscaProduto}
                onAlterarBusca={setBuscaProduto}
                onLimparBusca={() => setBuscaProduto('')}
                categorias={categoriasCatalogo}
                categoriaExpandida={categoriaExpandida}
                onExpandirCategoria={setCategoriaExpandida}
                quantidadesSelecionadas={quantidadesSelecionadasCatalogo}
                onAdicionarItem={adicionarItemCatalogo}
                onPersonalizarItem={personalizarItemCatalogo}
              />

              {produtosSelecionados.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-card p-3 xl:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                      No pedido
                    </p>
                    <button
                      type="button"
                      onClick={() => setEtapaMobile('ticket')}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Ver resumo
                    </button>
                  </div>
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                    {produtosSelecionados.map((produto) => (
                      <li
                        key={produto.id}
                        className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{produto.nome}</p>
                          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            R$ {(produto.preco * produto.quantidade).toFixed(2)}
                          </p>
                        </div>
                        <div className="inline-flex items-center rounded-md border border-border/70 bg-card p-0.5">
                          <button
                            type="button"
                            onClick={() => atualizarQuantidade(produto.id, produto.quantidade - 1)}
                            disabled={produto.quantidade <= 1}
                            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-40"
                            aria-label={`Diminuir ${produto.nome}`}
                          >
                            <span className="text-sm leading-none">−</span>
                          </button>
                          <span className="min-w-7 text-center font-mono text-sm tabular-nums">
                            {produto.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => atualizarQuantidade(produto.id, produto.quantidade + 1)}
                            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                            aria-label={`Aumentar ${produto.nome}`}
                          >
                            <span className="text-sm leading-none">+</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removerProduto(produto.id)}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                          aria-label={`Remover ${produto.nome}`}
                        >
                          <X strokeWidth={1.6} className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            {/* Coluna direita: Dados + Ticket scrollam juntos */}
            <div className="contents xl:col-start-2 xl:row-start-1 xl:block xl:h-full xl:min-h-0 xl:overflow-y-auto xl:space-y-4 xl:pb-1">

            {/* Tipo de atendimento — compact, apenas desktop */}
            <div
              ref={refSecaoAtendimentoDesktop}
              id="secao-atendimento-desktop"
              className={cn(
                'hidden xl:block rounded-xl border border-border/70 bg-card p-3',
                campoErro === 'mesa' && 'ring-2 ring-destructive/40',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Tipo de atendimento
                </p>
                {atendimentoLocalSelecionado && tipoEntrega === 'local' && (
                  <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-xs font-medium text-foreground">
                    {rotuloPontoSalaoSelecionado}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {([
                  { id: 'mesa' as const, label: 'Mesa', hint: 'No local' },
                  { id: 'comanda' as const, label: 'Comanda', hint: 'Aberta' },
                  { id: 'local_externo' as const, label: 'Parceiro', hint: 'Bar próximo' },
                ] as const).map((opcao) => {
                  const ativa = tipoEntrega === 'local' && modoSalao === opcao.id
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => { setTipoEntrega('local'); selecionarModoSalao(opcao.id) }}
                      className={cn(
                        'rounded-lg border p-2 text-left transition-colors',
                        ativa
                          ? 'border-foreground/20 bg-foreground text-background'
                          : 'border-border/70 bg-background hover:bg-accent',
                      )}
                    >
                      <span className="block text-xs font-semibold">{opcao.label}</span>
                      <span className={cn('block text-[10px]', ativa ? 'text-background/70' : 'text-muted-foreground')}>
                        {opcao.hint}
                      </span>
                    </button>
                  )
                })}
                {([
                  { id: 'entrega', label: 'Entrega', hint: 'Com endereço' },
                  { id: 'retirada', label: 'Retirada', hint: 'Balcão' },
                ] as const).map((opcao) => {
                  const ativa = tipoEntrega === opcao.id
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => { setTipoEntrega(opcao.id); setMesaSelecionada(null); setComandaSelecionada(null) }}
                      className={cn(
                        'rounded-lg border p-2 text-left transition-colors',
                        ativa
                          ? 'border-foreground/20 bg-foreground text-background'
                          : 'border-border/70 bg-background hover:bg-accent',
                      )}
                    >
                      <span className="block text-xs font-semibold">{opcao.label}</span>
                      <span className={cn('block text-[10px]', ativa ? 'text-background/70' : 'text-muted-foreground')}>
                        {opcao.hint}
                      </span>
                    </button>
                  )
                })}
              </div>

              {tipoEntrega === 'local' && (
                <div className="mt-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-foreground">
                      Escolha {modoSalao === 'local_externo' ? 'o local parceiro' : `a ${obterNomeTipoPontoSalao(modoSalao)}`}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {modoSalao === 'local_externo'
                        ? `${pontosSalaoAtivos.length} disponíveis`
                        : `${pontosSalaoAtivos.filter((p) => p.status === 'livre').length} livres`}
                    </span>
                  </div>
                  {loadingMesas ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : pontosSalaoAtivos.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhum {obterNomeTipoPontoSalao(modoSalao)} cadastrado
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto">
                      <div className={cn('grid gap-1.5', modoSalao === 'local_externo' ? 'grid-cols-2' : 'grid-cols-6')}>
                        {pontosSalaoAtivos.map((ponto) => {
                          const ehParceiro = ponto.tipo === 'local_externo'
                          const livre = ponto.status === 'livre'
                          const selecionavel = livre || ehParceiro
                          const selecionada = modoSalao === 'comanda'
                            ? comandaSelecionada === ponto.numero
                            : mesaSelecionada === ponto.numero
                          const rotuloPonto = obterRotuloPontoSalao(ponto)
                          const textoPrincipal = ehParceiro ? rotuloPonto : String(ponto.numero)
                          return (
                            <button
                              key={ponto.id}
                              type="button"
                              onClick={() => selecionarPontoSalao(ponto)}
                              disabled={!selecionavel && !selecionada}
                              className={cn(
                                'flex flex-col items-center justify-center rounded-lg border px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                selecionada
                                  ? 'border-foreground bg-foreground text-background'
                                  : selecionavel
                                    ? 'border-border/70 bg-background hover:bg-accent'
                                    : 'cursor-not-allowed border-border/60 bg-muted/30 text-muted-foreground opacity-50',
                              )}
                            >
                              <span className={cn('font-semibold', ehParceiro ? 'line-clamp-2 text-[11px]' : 'font-mono text-sm tabular-nums')}>
                                {textoPrincipal}
                              </span>
                              <span className={cn('text-[9px]', selecionada ? 'text-background/70' : 'text-muted-foreground')}>
                                {selecionada ? 'Sel.' : ehParceiro ? 'Disp.' : livre ? 'Livre' : 'Ocup.'}
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

            {/* Cliente + Entrega + Pagamento */}
            <div className={cn('min-w-0 space-y-4', etapaMobile === 'dados' ? 'block' : 'hidden', 'xl:block')}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/70 bg-card p-4 sm:p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">Cliente</h3>
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Obrigatório</span>
                </div>

                <div ref={refBuscaCliente} className="relative mb-4">
                  {clienteSelecionado ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                      <UserRound strokeWidth={1.6} className="size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {clienteSelecionado.nome || 'Cliente'}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{formatarTelefoneCliente(clienteSelecionado.telefone)}</span>
                          {clienteSelecionado.bairro && <span>· {clienteSelecionado.bairro}</span>}
                          <span>· {clienteSelecionado.total_pedidos} pedido{clienteSelecionado.total_pedidos !== 1 ? 's' : ''}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={limparClienteSelecionado}
                        className="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Remover cliente selecionado"
                      >
                        <X strokeWidth={1.6} className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search strokeWidth={1.6} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={buscaCliente}
                          onChange={(e) => handleBuscaClienteChange(e.target.value)}
                          onFocus={() => { if (clientesBuscados.length > 0) setMostrarDropdownClientes(true) }}
                          placeholder="Buscar cliente por nome ou telefone..."
                          className="h-11 w-full rounded-md border border-border/70 bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/60"
                        />
                        {buscandoClientes && (
                          <Loader2 strokeWidth={1.6} className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {mostrarDropdownClientes && clientesBuscados.length > 0 && (
                        <div role="listbox" aria-label="Resultados da busca de clientes" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border/70 bg-card shadow-lg">
                          {clientesBuscados.map((cliente) => (
                            <button
                              key={cliente.id}
                              type="button"
                              role="option"
                              onClick={() => selecionarCliente(cliente)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                            >
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <UserRound strokeWidth={1.6} className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {cliente.nome || 'Cliente'}
                                </p>
                                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Phone strokeWidth={1.6} className="size-3" />
                                    {formatarTelefoneCliente(cliente.telefone)}
                                  </span>
                                  {cliente.bairro && (
                                    <span className="flex items-center gap-1">
                                      <MapPin strokeWidth={1.6} className="size-3" />
                                      {cliente.bairro}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                {cliente.total_pedidos} pedido{cliente.total_pedidos !== 1 ? 's' : ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {mostrarDropdownClientes && buscaCliente.trim().length >= 2 && clientesBuscados.length === 0 && !buscandoClientes && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border/70 bg-card px-4 py-3 text-center text-sm text-muted-foreground shadow-lg">
                          Nenhum cliente encontrado
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="nome-cliente-novo">
                      Nome do cliente *
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="nome-cliente-novo"
                        ref={refNomeCliente}
                        type="text"
                        value={nomeCliente}
                        onChange={(e) => {
                          setNomeCliente(e.target.value)
                          if (campoErro === 'nome') setCampoErro(null)
                        }}
                        placeholder={tipoEntrega === 'local' ? `Ex: ${obterNomeTipoPontoSalaoCapitalizado(modoSalao)} 3` : 'Digite o nome'}
                        aria-invalid={campoErro === 'nome'}
                        className={cn(
                          'h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60',
                          campoErro === 'nome' ? 'border-destructive' : 'border-border/70',
                        )}
                      />
                      {tipoEntrega === 'local' ? (
                        <button
                          type="button"
                          onClick={() => setNomeCliente(pontoSalaoSelecionado ? rotuloPontoSalaoSelecionado : obterNomeTipoPontoSalaoCapitalizado(modoSalao))}
                          className="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          {obterNomeTipoPontoSalaoCapitalizado(modoSalao)}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setNomeCliente('Cliente')}
                          className="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          Cliente
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="telefone-cliente-novo">
                      Telefone
                    </label>
                    <input
                      id="telefone-cliente-novo"
                      type="tel"
                      value={telefoneCliente}
                      onChange={(e) => setTelefoneCliente(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/70 bg-card p-4 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">Atendimento</h3>
                  <button
                    type="button"
                    onClick={irParaAtendimento}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-border/70 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Trocar
                  </button>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5">
                  <p className="text-sm font-semibold text-foreground">{rotuloResumoAtendimento}</p>
                  <p className="text-xs text-muted-foreground">
                    {tipoEntrega === 'local'
                      ? 'Definido na etapa de atendimento'
                      : tipoEntrega === 'entrega'
                        ? 'Entrega com endereço e bairro'
                        : 'Retirada no balcão'}
                  </p>
                </div>

                {tipoEntrega === 'entrega' && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Bairro *
                      </label>
                      {loadingBairros ? (
                        <div className="flex justify-center py-4">
                          <Loader2 strokeWidth={1.6} className="size-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : bairros.length > 0 ? (
                        <div className={cn(campoErro === 'bairro' && 'rounded-md ring-2 ring-destructive/40')}>
                          <SeletorBairroCombobox
                            bairros={bairros}
                            valor={bairroSelecionado}
                            onSelecionar={(id) => {
                              setBairroSelecionado(id)
                              if (campoErro === 'bairro') setCampoErro(null)
                            }}
                          />
                        </div>
                      ) : (
                        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum bairro cadastrado</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="endereco-entrega-novo">
                        Endereço (rua, número, referência)
                      </label>
                      <textarea
                        id="endereco-entrega-novo"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        placeholder="Ex: Rua das Flores, 123, próximo à padaria..."
                        rows={2}
                        className="w-full resize-none rounded-md border border-border/70 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                      />
                    </div>
                  </div>
                )}

                {tipoEntrega === 'local' && (
                  <div className="mt-4 rounded-lg border border-border/70 bg-muted/25 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Taxa de serviço</p>
                        <p className="text-xs text-muted-foreground">
                          Padrão: {taxaServicoAtivaPadrao ? 'ativado' : 'desativado'} · {percentualTaxaServico}%
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={aplicarTaxaServico}
                          onChange={(evento) => setAplicarTaxaServico(evento.target.checked)}
                          className="size-4 rounded border-border text-foreground focus:ring-ring/60"
                        />
                        Aplicar no pedido
                      </label>
                    </div>
                    {aplicarTaxaServico && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Percentual (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={percentualTaxaServico}
                            onChange={(evento) => setPercentualTaxaServico(evento.target.value)}
                            className="h-9 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Valor manual (R$)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={taxaServicoManual}
                            onChange={(evento) => setTaxaServicoManual(evento.target.value)}
                            placeholder={taxaServicoCalculada.toFixed(2)}
                            className="h-9 w-full rounded-md border border-border/70 bg-background px-3 font-mono text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                          />
                        </div>
                        <div className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs">
                          <p className="text-muted-foreground">Taxa calculada</p>
                          <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                            R$ {taxaServicoPedido.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              <motion.div
                ref={refSecaoPagamento}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-xl border border-border/70 bg-card p-4 sm:p-5',
                  campoErro === 'pagamento' && 'ring-2 ring-destructive/40',
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">Pagamento *</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setPagamentoDividido(!pagamentoDividido)
                      if (!pagamentoDividido) {
                        setFormaPagamento('')
                      } else {
                        setPagamentos([])
                      }
                      if (campoErro === 'pagamento') setCampoErro(null)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      pagamentoDividido
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Split strokeWidth={1.6} className="size-3.5" />
                    Dividir
                  </button>
                </div>

                {!pagamentoDividido ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {OPCOES_PAGAMENTO_PEDIDO.map((opcao) => {
                        const Icone = opcao.icone
                        const ativo = formaPagamento === opcao.valor
                        return (
                          <button
                            key={opcao.valor}
                            type="button"
                            onClick={() => {
                              setFormaPagamento(opcao.valor)
                              if (opcao.valor !== 'Dinheiro') {
                                setPrecisaTroco(false)
                                setTrocoPara('')
                              }
                              if (campoErro === 'pagamento') setCampoErro(null)
                            }}
                            className={cn(
                              'flex min-h-[68px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                              ativo
                                ? 'border-foreground bg-foreground text-background'
                                : 'border-border/70 bg-background hover:bg-accent',
                            )}
                          >
                            <span className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-lg',
                              ativo ? 'bg-background/15 text-background' : 'bg-muted text-foreground',
                            )}>
                              <Icone strokeWidth={1.6} className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{opcao.label}</span>
                              <span className={cn('block text-xs', ativo ? 'text-background/70' : 'text-muted-foreground')}>
                                {opcao.valor}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {formaPagamento === 'Dinheiro' && (
                      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="precisaTrocoNovo"
                            checked={precisaTroco}
                            onChange={(e) => {
                              setPrecisaTroco(e.target.checked)
                              if (!e.target.checked) setTrocoPara('')
                            }}
                            className="size-4 cursor-pointer rounded border-input text-foreground focus:ring-ring/60 focus:ring-offset-0"
                          />
                          <label htmlFor="precisaTrocoNovo" className="cursor-pointer text-sm font-medium text-foreground">
                            Cliente precisa de troco
                          </label>
                        </div>
                        {precisaTroco && (
                          <div className="space-y-3">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-foreground">
                                Troco para quanto?
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                                  R$
                                </span>
                                <input
                                  type="number"
                                  value={trocoPara}
                                  onChange={(e) => setTrocoPara(e.target.value)}
                                  placeholder="0,00"
                                  min={calcularTotal()}
                                  step="0.01"
                                  className="h-9 w-full rounded-md border border-input bg-card pl-10 pr-3 font-mono text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {[20, 50, 100, 200].map((valor) => {
                                const ativo = trocoPara === valor.toString()
                                return (
                                  <button
                                    key={valor}
                                    type="button"
                                    onClick={() => setTrocoPara(valor.toString())}
                                    className={cn(
                                      'rounded-md border px-3 py-1.5 font-mono text-sm font-medium tabular-nums transition-colors',
                                      ativo
                                        ? 'border-foreground bg-foreground text-background'
                                        : 'border-border/70 bg-card text-foreground hover:bg-accent',
                                    )}
                                  >
                                    R$ {valor}
                                  </button>
                                )
                              })}
                            </div>
                            {trocoPara && parseFloat(trocoPara) > 0 && (
                              <div className="space-y-1.5 rounded-md border border-border/70 bg-card p-3 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Total do pedido</span>
                                  <span className="font-mono tabular-nums text-foreground">
                                    R$ {calcularTotal().toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Cliente vai pagar</span>
                                  <span className="font-mono tabular-nums text-foreground">
                                    R$ {parseFloat(trocoPara).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between border-t border-border/70 pt-2">
                                  <span className="font-medium text-foreground">Troco a devolver</span>
                                  <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                                    R$ {Math.max(0, parseFloat(trocoPara) - calcularTotal()).toFixed(2)}
                                  </span>
                                </div>
                                {parseFloat(trocoPara) < calcularTotal() && (
                                  <p className="mt-2 text-xs text-destructive">
                                    Valor menor que o total do pedido
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pagamentos.length > 0 && (
                      <div className="space-y-2">
                        {pagamentos.map((pag) => {
                          const forma = FORMAS_PAGAMENTO.find(f => f.id === pag.forma)
                          const Icone = forma?.icone || Banknote
                          return (
                            <div key={pag.id} className="flex items-center justify-between rounded-md border border-border/70 bg-muted/30 p-2.5">
                              <div className="flex items-center gap-2">
                                <Icone strokeWidth={1.6} className="size-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">
                                  {forma?.nome || pag.forma}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                                  R$ {pag.valor.toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removerPagamento(pag.id)}
                                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                                  aria-label="Remover pagamento"
                                >
                                  <X strokeWidth={1.6} className="size-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex flex-1 gap-2">
                        <select
                          value={novoPagamentoForma}
                          onChange={(e) => setNovoPagamentoForma(e.target.value)}
                          className="h-10 min-w-0 flex-1 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                        >
                          <option value="">Forma...</option>
                          {FORMAS_PAGAMENTO.map(f => (
                            <option key={f.id} value={f.id}>{f.nome}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={valorRestante > 0 ? valorRestante : 0}
                          value={novoPagamentoValor}
                          onChange={(e) => setNovoPagamentoValor(e.target.value)}
                          placeholder={valorRestante > 0 ? `${valorRestante.toFixed(0)}` : '0'}
                          disabled={valorRestante <= 0}
                          className="h-10 w-24 rounded-md border border-border/70 bg-background px-2 font-mono text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-50 sm:w-28 sm:px-3"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={adicionarPagamento}
                        disabled={!novoPagamentoForma || !novoPagamentoValor || valorRestante <= 0}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus strokeWidth={1.6} className="size-4" />
                        <span className="sm:hidden">Adicionar</span>
                      </button>
                    </div>
                    <div
                      className={cn(
                        'text-right text-sm font-medium',
                        Math.abs(valorRestante) < 0.01
                          ? 'text-foreground'
                          : valorRestante > 0
                            ? 'text-muted-foreground'
                            : 'text-destructive',
                      )}
                    >
                      {Math.abs(valorRestante) < 0.01
                        ? 'Pagamento completo'
                        : valorRestante > 0
                          ? `Falta R$ ${valorRestante.toFixed(2)}`
                          : `Excesso R$ ${Math.abs(valorRestante).toFixed(2)}`}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Painel lateral */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={`${etapaMobile === 'ticket' ? 'block' : 'hidden'} min-w-0 xl:block`}
            >
              <PainelTicketPedido
                produtosSelecionados={produtosSelecionados}
                totalItensPedido={totalItensPedido}
                subtotalBrutoPedido={subtotalBrutoPedido}
                subtotalPedido={subtotalPedido}
                descontoItensTotal={descontoItensTotal}
                descontoPedidoInput={descontoPedidoInput}
                descontoPedidoAplicado={descontoPedidoAplicado}
                taxaEntregaPedido={taxaEntregaPedido}
                taxaServicoPedido={taxaServicoPedido}
                totalPedido={totalPedido}
                tipoEntrega={tipoEntrega}
                aplicarTaxaServico={aplicarTaxaServico}
                adicionaisDisponiveis={adicionaisDisponiveis}
                produtoSelecionadoParaAdicional={produtoSelecionadoParaAdicional}
                onAlterarProdutoSelecionadoParaAdicional={setProdutoSelecionadoParaAdicional}
                onAtualizarQuantidade={atualizarQuantidade}
                onRemoverProduto={removerProduto}
                onRemoverAdicional={removerAdicional}
                onAdicionarAdicional={adicionarAdicional}
                onAtualizarDescontoItem={atualizarDescontoItem}
                onAlterarDescontoPedido={alterarDescontoPedido}
                onAtualizarObservacoes={atualizarObservacoes}
                onAbrirEditorItem={abrirEditorItem}
                enviarParaImpressao={enviarParaImpressao}
                onAlterarEnviarParaImpressao={setEnviarParaImpressao}
                observacoesPedido={observacoesPedido}
                onAlterarObservacoesPedido={setObservacoesPedido}
                stickyResumo
              />
            </motion.div>
            </div>{/* fecha coluna direita */}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur md:left-[var(--largura-sidebar-admin)]">
            <div
              className="mx-auto w-full max-w-[1500px] px-4 py-3 sm:px-6"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                      {totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono font-medium tabular-nums text-foreground">
                      R$ {totalPedido.toFixed(2)}
                    </span>
                    {tipoEntrega === 'local' && pontoSalaoSelecionado && (
                      <span className="hidden items-center rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground sm:inline-flex">
                        {rotuloPontoSalaoSelecionado}
                      </span>
                    )}
                  </div>
                  <p className={cn('mt-1 text-xs', podeSalvarPedido ? 'text-foreground' : 'text-muted-foreground')}>
                    {podeSalvarPedido
                      ? 'Pedido pronto para confirmar'
                      : loading
                        ? 'Finalizando pedido'
                        : pendenciaPrincipalSalvar || 'Revise os dados do pedido'}
                  </p>
                </div>

                <button
                  id="botao-confirmar-pedido"
                  onClick={isDesktop || etapaMobile === 'ticket' ? salvarPedido : avancarEtapaMobile}
                  disabled={loading || ((isDesktop || etapaMobile === 'ticket') ? !podeSalvarPedido : false)}
                  className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[200px]"
                >
                  {loading ? (
                    <>
                      <Loader2 strokeWidth={1.6} className="size-4 animate-spin" />
                      Salvando
                    </>
                  ) : (
                    <>
                      <Save strokeWidth={1.6} className="size-4" />
                      {isDesktop ? 'Confirmar pedido' : textoBotaoEtapaMobile}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <ModalItemPedidoAdmin
          aberto={modalItemAberto}
          modoEdicao={modalItemModoEdicao}
          dados={modalItemDados}
          descontosAtivos
          onFechar={() => setModalItemAberto(false)}
          onConfirmar={confirmarModalItem}
          onRemover={modalItemModoEdicao && modalItemDados ? () => removerProduto(modalItemDados.id) : undefined}
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}

export default function NovoPedidoPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    }>
      <NovoPedidoContent />
    </Suspense>
  )
}
