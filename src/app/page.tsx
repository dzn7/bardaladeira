'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, X as XIcon } from 'lucide-react'
import { toast } from 'sonner'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CartaoProduto from '@/components/CartaoProduto'
import CartaoBebida from '@/components/CartaoBebida'
import CartaoCombo from '@/components/CartaoCombo'
import ModalCarrinho from '@/components/ModalCarrinho'
import ModalComplementos from '@/components/ModalComplementos'
import ModalLojaFechada from '@/components/ModalLojaFechada'
import ModalNotificacao from '@/components/ModalNotificacao'
import ModalPedidosCliente from '@/components/ModalPedidosCliente'
import { AjudaPedidoPublica } from '@/components/AjudaPedidoPublica'
import { Produto, Bebida, Combo, supabase } from '@/lib/supabase'
import type { CategoriaCardapio } from '@/lib/supabase'
import { COLUNAS_ESTOQUE_BEBIDAS_PUBLICO, COLUNAS_ESTOQUE_PUBLICO } from '@/lib/estoque'
import {
  avaliarCompraProduto,
  mensagemAvaliacaoCompra,
  somarQuantidadeProdutoNoCarrinho,
} from '@/lib/estoque-produto.mjs'
import { useStatusLoja } from '@/lib/useStatusLoja'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import {
  CATEGORIA_FILTRO_TODOS,
  normalizarNomeCategoria,
  obterCategoriaCombo,
  ordenarNomesPorCategoriasDoBanco
} from '@/lib/categoriasCardapio'
import {
  CHAVE_ORDEM_CATEGORIAS_PRODUTOS,
  CHAVE_ORDENACAO_PRODUTOS_SITE,
  normalizarTipoOrdenacaoProdutos,
  ordenarCategoriasPorPreferencia,
  parsearOrdemCategoriasProdutos,
  TipoOrdenacaoProdutosSite
} from '@/lib/ordenacaoCardapio'

type TipoNotificacao = 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'

type EstadoModalNotificacao = {
  aberto: boolean
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
}

export default function Home() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [bebidas, setBebidas] = useState<Bebida[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [categoriasCardapio, setCategoriasCardapio] = useState<CategoriaCardapio[]>([])
  const [modalCarrinhoAberto, setModalCarrinhoAberto] = useState(false)
  const [modalPedidosClienteAberto, setModalPedidosClienteAberto] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [modalComplementosAberto, setModalComplementosAberto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [temAdicionaisDisponiveis, setTemAdicionaisDisponiveis] = useState(false)
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>(CATEGORIA_FILTRO_TODOS)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [tipoOrdenacaoProdutos, setTipoOrdenacaoProdutos] = useState<TipoOrdenacaoProdutosSite>('manual')
  const [ordemCategoriasProdutos, setOrdemCategoriasProdutos] = useState<string[]>([])
  const [modalNotificacao, setModalNotificacao] = useState<EstadoModalNotificacao>({
    aberto: false,
    tipo: 'sucesso',
    titulo: '',
    mensagem: ''
  })

  const { lojaFechada, numeroWhatsApp } = useStatusLoja()
  const { adicionarItem, itens } = useCarrinho()

  useEffect(() => {
    const raiz = document.documentElement
    const caminho = window.location.pathname
    if (caminho !== '/' && !caminho.startsWith('/preview-mobile-frame')) return

    raiz.classList.add('tema-publico')
    const meta = document.querySelector('meta[name="theme-color"]')
    const corAnterior = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', raiz.classList.contains('dark') ? '#1A1410' : '#F3E6D4')

    return () => {
      raiz.classList.remove('tema-publico')
      if (!meta) return
      if (corAnterior) meta.setAttribute('content', corAnterior)
      else meta.removeAttribute('content')
    }
  }, [])

  const obterCategoriaDaBebida = useCallback((bebida: Pick<Bebida, 'categoria'>) => {
    return normalizarNomeCategoria(bebida.categoria)
  }, [])

  const carregarCategoriasCardapio = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_cardapio')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      setCategoriasCardapio((data || []) as CategoriaCardapio[])
    } catch (error) {
      console.error('Erro ao carregar categorias do cardápio:', error)
      setCategoriasCardapio([])
    }
  }, [])

  const carregarConfiguracaoOrdenacao = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('chave, valor')
        .in('chave', [CHAVE_ORDENACAO_PRODUTOS_SITE, CHAVE_ORDEM_CATEGORIAS_PRODUTOS])

      if (error) throw error

      const valorOrdenacao = data?.find((configAtual) => configAtual.chave === CHAVE_ORDENACAO_PRODUTOS_SITE)?.valor
      const valorOrdemCategorias = data?.find((configAtual) => configAtual.chave === CHAVE_ORDEM_CATEGORIAS_PRODUTOS)?.valor

      const tipoOrdenacao = normalizarTipoOrdenacaoProdutos(valorOrdenacao)
      const ordemCategorias = parsearOrdemCategoriasProdutos(valorOrdemCategorias)

      setTipoOrdenacaoProdutos(tipoOrdenacao)
      setOrdemCategoriasProdutos(ordemCategorias)

      return { tipoOrdenacao, ordemCategorias }
    } catch (error) {
      console.error('Erro ao carregar configuração de ordenação do cardápio:', error)
      return { tipoOrdenacao: 'manual' as TipoOrdenacaoProdutosSite, ordemCategorias: [] as string[] }
    }
  }, [])

  const carregarProdutos = useCallback(async (modoOrdenacao: TipoOrdenacaoProdutosSite = tipoOrdenacaoProdutos) => {
    setCarregando(true)
    try {
      let consulta = supabase
        .from('produtos')
        .select(COLUNAS_ESTOQUE_PUBLICO)
        .eq('disponivel', true)

      if (modoOrdenacao === 'manual') {
        consulta = consulta
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true })
      } else if (modoOrdenacao === 'preco_crescente') {
        consulta = consulta
          .order('preco', { ascending: true })
          .order('nome', { ascending: true })
      } else {
        consulta = consulta
          .order('preco', { ascending: false })
          .order('nome', { ascending: true })
      }

      let { data, error } = await consulta
      if (error && /estoque_quantidade|bloquear_venda_sem_estoque|column|schema cache/i.test(error.message || '')) {
        let consultaLegado = supabase
          .from('produtos')
          .select('id, nome, descricao, preco, preco_original, desconto, categoria, imagem_url, disponivel, ordem, destaque, created_at, updated_at')
          .eq('disponivel', true)
        if (modoOrdenacao === 'manual') {
          consultaLegado = consultaLegado.order('ordem', { ascending: true }).order('nome', { ascending: true })
        } else if (modoOrdenacao === 'preco_crescente') {
          consultaLegado = consultaLegado.order('preco', { ascending: true }).order('nome', { ascending: true })
        } else {
          consultaLegado = consultaLegado.order('preco', { ascending: false }).order('nome', { ascending: true })
        }
        const retry = await consultaLegado
        data = retry.data as typeof data
        error = retry.error
      }
      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setCarregando(false)
    }
  }, [tipoOrdenacaoProdutos])

  const carregarBebidas = useCallback(async (modoOrdenacao: TipoOrdenacaoProdutosSite = tipoOrdenacaoProdutos) => {
    try {
      let consulta = supabase
        .from('bebidas')
        .select(COLUNAS_ESTOQUE_BEBIDAS_PUBLICO)
        .eq('disponivel', true)

      if (modoOrdenacao === 'manual') {
        consulta = consulta
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true })
      } else if (modoOrdenacao === 'preco_crescente') {
        consulta = consulta
          .order('preco', { ascending: true })
          .order('nome', { ascending: true })
      } else {
        consulta = consulta
          .order('preco', { ascending: false })
          .order('nome', { ascending: true })
      }

      const { data, error } = await consulta

      if (error) throw error
      setBebidas(data || [])
    } catch (error) {
      console.error('Erro ao carregar bebidas:', error)
    }
  }, [tipoOrdenacaoProdutos])

  const carregarCombos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('combos')
        .select('*')
        .eq('disponivel', true)
        .order('preco', { ascending: false })

      if (error) throw error
      setCombos(data || [])
    } catch (error) {
      console.error('Erro ao carregar combos:', error)
    }
  }, [])

  const carregarDisponibilidadeAdicionais = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('adicionais')
        .select('id', { head: true, count: 'exact' })
        .eq('disponivel', true)

      if (error) throw error
      setTemAdicionaisDisponiveis((count || 0) > 0)
    } catch (error) {
      console.error('Erro ao verificar adicionais:', error)
      setTemAdicionaisDisponiveis(false)
    }
  }, [])

  const sincronizarCardapio = useCallback(async () => {
    const { tipoOrdenacao } = await carregarConfiguracaoOrdenacao()
    await Promise.all([
      carregarCategoriasCardapio(),
      carregarProdutos(tipoOrdenacao),
      carregarBebidas(tipoOrdenacao),
      carregarCombos(),
      carregarDisponibilidadeAdicionais()
    ])
  }, [carregarBebidas, carregarCategoriasCardapio, carregarCombos, carregarConfiguracaoOrdenacao, carregarDisponibilidadeAdicionais, carregarProdutos])

  useEffect(() => {
    sincronizarCardapio()

    const channelProdutos = supabase
      .channel('produtos-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'produtos' },
        () => {
          carregarProdutos()
        }
      )
      .subscribe()

    const channelBebidas = supabase
      .channel('bebidas-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bebidas' },
        () => {
          carregarBebidas()
        }
      )
      .subscribe()

    const channelCombos = supabase
      .channel('combos-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'combos' },
        () => {
          carregarCombos()
        }
      )
      .subscribe()

    const channelAdicionais = supabase
      .channel('adicionais-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adicionais' },
        () => {
          carregarDisponibilidadeAdicionais()
        }
      )
      .subscribe()

    const channelCategorias = supabase
      .channel('categorias-cardapio-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categorias_cardapio' },
        () => {
          carregarCategoriasCardapio()
        }
      )
      .subscribe()

    const channelConfiguracoes = supabase
      .channel('configuracoes-cardapio-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_loja' },
        (payload) => {
          const registro = payload.new
          if (!registro || typeof registro !== 'object') return

          const chave = (registro as { chave?: string }).chave
          if (chave === CHAVE_ORDENACAO_PRODUTOS_SITE || chave === CHAVE_ORDEM_CATEGORIAS_PRODUTOS) {
            sincronizarCardapio()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelProdutos)
      supabase.removeChannel(channelBebidas)
      supabase.removeChannel(channelCombos)
      supabase.removeChannel(channelAdicionais)
      supabase.removeChannel(channelCategorias)
      supabase.removeChannel(channelConfiguracoes)
    }
  }, [carregarBebidas, carregarCategoriasCardapio, carregarCombos, carregarDisponibilidadeAdicionais, carregarProdutos, sincronizarCardapio])

  const mostrarAvisoLojaFechada = () => {
    setModalNotificacao({
      aberto: true,
      tipo: 'aviso',
      titulo: 'Loja fechada',
      mensagem: 'Estamos fechados no momento. Você pode navegar no cardápio, mas não é possível fazer pedidos agora.'
    })
  }

  const mostrarItemAdicionado = (nomeItem: string) => {
    toast.success(`${nomeItem} adicionado`, {
      description: 'Continue escolhendo ou revise o pedido quando quiser.',
      action: {
        label: 'Ver carrinho',
        onClick: () => setModalCarrinhoAberto(true),
      },
    })
  }

  const adicionarProdutoAoCarrinho = (produto: Produto) => {
    if (lojaFechada) {
      mostrarAvisoLojaFechada()
      return
    }

    const jaNoCarrinho = somarQuantidadeProdutoNoCarrinho(itens, produto.id)
    const avaliacao = avaliarCompraProduto(produto, jaNoCarrinho, 1)
    if (!avaliacao.permitido) {
      toast.error(mensagemAvaliacaoCompra(produto, avaliacao) || 'Não foi possível adicionar este produto.')
      return
    }

    if (!temAdicionaisDisponiveis) {
      const adicionado = adicionarItem(produto, 1, [], undefined)
      if (!adicionado) {
        toast.error(mensagemAvaliacaoCompra(produto, avaliacao) || 'Não foi possível adicionar este produto.')
        return
      }
      mostrarItemAdicionado(produto.nome)
      return
    }

    // Abre o modal de complementos apenas quando há adicionais disponíveis
    setProdutoSelecionado(produto)
    setModalComplementosAberto(true)
  }

  const adicionarComboAoCarrinho = (combo: Combo) => {
    if (lojaFechada) {
      mostrarAvisoLojaFechada()
      return
    }

    const categoriaCombo = obterCategoriaCombo(categoriasCardapio)
    if (!categoriaCombo) return

    const comboProduto: Produto = {
      id: combo.id,
      nome: combo.nome,
      descricao: combo.descricao || '',
      preco: combo.preco,
      categoria: categoriaCombo,
      imagem_url: combo.imagem_url || '',
      disponivel: combo.disponivel,
      ordem: combo.ordem,
      destaque: combo.destaque,
      created_at: combo.created_at,
      updated_at: combo.updated_at
    }
    adicionarItem(comboProduto, 1, [], undefined)
    mostrarItemAdicionado(combo.nome)
  }

  const adicionarBebidaAoCarrinho = (bebida: Bebida) => {
    if (lojaFechada) {
      mostrarAvisoLojaFechada()
      return
    }

    const produtoBebida = {
      id: bebida.id,
      nome: bebida.nome,
      descricao: bebida.descricao || '',
      preco: bebida.preco,
      categoria: obterCategoriaDaBebida(bebida),
      imagem_url: bebida.imagem_url || '',
      disponivel: true,
      ordem: bebida.ordem,
      destaque: false,
      created_at: bebida.created_at,
      updated_at: bebida.updated_at,
    }

    adicionarItem(produtoBebida, 1, [], undefined)
    mostrarItemAdicionado(bebida.nome)
  }

  const abrirCarrinho = () => {
    if (lojaFechada) {
      mostrarAvisoLojaFechada()
      return
    }

    setModalCarrinhoAberto(true)
  }

  const categoriasProdutosDisponiveis = Array.from(
    new Set(produtos.map((produtoAtual) => normalizarNomeCategoria(produtoAtual.categoria)).filter(Boolean))
  )
  const categoriasBebidasDisponiveis = Array.from(
    new Set(bebidas.map((bebidaAtual) => obterCategoriaDaBebida(bebidaAtual)).filter(Boolean))
  )
  const nomesCategoriasBanco = new Set(
    categoriasCardapio
      .filter((categoria) => categoria.ativo)
      .map((categoria) => categoria.nome)
  )
  const categoriasParaOrdenar = [...categoriasProdutosDisponiveis, ...categoriasBebidasDisponiveis]
    .filter((categoria) => nomesCategoriasBanco.has(categoria))
  const categoriasOrdenadasPorBanco = ordenarNomesPorCategoriasDoBanco(categoriasParaOrdenar, categoriasCardapio)
  const categoriasOrdenadas = ordenarCategoriasPorPreferencia(categoriasOrdenadasPorBanco, ordemCategoriasProdutos)
  const categoriaCombo = obterCategoriaCombo(categoriasCardapio)
  const categorias = [
    CATEGORIA_FILTRO_TODOS,
    ...(combos.length > 0 && categoriaCombo ? [categoriaCombo] : []),
    ...categoriasOrdenadas
  ]
  const categoriaAtivaEhCategoriaBebidas = categoriasBebidasDisponiveis.includes(categoriaAtiva)
  const categoriaAtivaEhCombo = Boolean(categoriaCombo) && categoriaAtiva === categoriaCombo

  useEffect(() => {
    if (categoriaAtiva !== CATEGORIA_FILTRO_TODOS && !categorias.includes(categoriaAtiva)) {
      setCategoriaAtiva(CATEGORIA_FILTRO_TODOS)
    }
  }, [categoriaAtiva, categorias])

  const buscaLower = busca.toLowerCase()

  const combosFiltrados = useMemo(() =>
    categoriaAtivaEhCombo || categoriaAtiva === CATEGORIA_FILTRO_TODOS
      ? combos.filter((c) => !busca || c.nome.toLowerCase().includes(buscaLower))
      : [],
    [categoriaAtiva, categoriaAtivaEhCombo, combos, busca, buscaLower]
  )

  const produtosFiltrados = useMemo(() =>
    categoriaAtiva === CATEGORIA_FILTRO_TODOS
      ? produtos.filter((p) => !busca || p.nome.toLowerCase().includes(buscaLower))
      : categoriaAtivaEhCategoriaBebidas
        ? []
        : produtos.filter(
          (p) =>
            p.categoria === categoriaAtiva &&
            (!busca || p.nome.toLowerCase().includes(buscaLower))
        ),
    [busca, buscaLower, categoriaAtiva, categoriaAtivaEhCategoriaBebidas, produtos]
  )

  const bebidasFiltradas = useMemo(() =>
    categoriaAtiva === CATEGORIA_FILTRO_TODOS
      ? bebidas.filter((b) => !busca || b.nome.toLowerCase().includes(buscaLower))
      : categoriaAtivaEhCategoriaBebidas
        ? bebidas.filter(
          (b) =>
            obterCategoriaDaBebida(b) === categoriaAtiva &&
            (!busca || b.nome.toLowerCase().includes(buscaLower))
        )
        : [],
    [bebidas, busca, buscaLower, categoriaAtiva, categoriaAtivaEhCategoriaBebidas, obterCategoriaDaBebida]
  )

  const gruposCategorias = categoriasOrdenadas
    .map((categoria) => ({
      categoria,
      produtos: produtosFiltrados.filter((produto) => produto.categoria === categoria),
      bebidas: bebidasFiltradas.filter((bebida) => obterCategoriaDaBebida(bebida) === categoria)
    }))
    .filter((grupo) => grupo.produtos.length > 0 || grupo.bebidas.length > 0)

  const totalResultados = combosFiltrados.length + produtosFiltrados.length + bebidasFiltradas.length
  const navegacaoInferiorVisivel = !(
    modalCarrinhoAberto ||
    modalPedidosClienteAberto ||
    ajudaAberta ||
    modalComplementosAberto ||
    modalNotificacao.aberto
  )

  return (
    <div className="tema-publico min-h-screen bg-background text-foreground">
      <Header onAbrirAjuda={() => setAjudaAberta(true)} />

      <main className="pb-24 pt-24">
        <section id="cardapio" className="pb-6 pt-2">
          <div className="container mx-auto px-4">
            {/* Busca */}
            <div className="mb-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-10 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {busca && (
                  <button
                    onClick={() => setBusca('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              {busca && !carregando && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {totalResultados} {totalResultados === 1 ? 'resultado' : 'resultados'} para &quot;{busca}&quot;
                </p>
              )}
            </div>

            {/* Categorias */}
            <div className="mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="inline-flex min-w-max gap-1.5">
                {categorias.map((categoria) => {
                  const ativo = categoriaAtiva === categoria
                  return (
                    <button
                      key={categoria}
                      onClick={() => setCategoriaAtiva(categoria)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${ativo
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                    >
                      {categoria}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Conteúdo */}
            {carregando ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
                  <p className="text-sm text-muted-foreground">Carregando cardápio...</p>
                </div>
              </div>
            ) : categoriaAtivaEhCombo ? (
              combosFiltrados.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-muted-foreground">Nenhum combo encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                  {combosFiltrados.map((combo) => (
                    <CartaoCombo key={combo.id} combo={combo} onAdicionar={adicionarComboAoCarrinho} />
                  ))}
                </div>
              )
            ) : categoriaAtivaEhCategoriaBebidas ? (
              bebidasFiltradas.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-muted-foreground">Nenhum item encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                  {bebidasFiltradas.map((bebida) => (
                    <CartaoBebida key={bebida.id} bebida={bebida} onAdicionar={adicionarBebidaAoCarrinho} />
                  ))}
                </div>
              )
            ) : categoriaAtiva === CATEGORIA_FILTRO_TODOS ? (
              totalResultados === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-muted-foreground">Nenhum produto encontrado</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {combosFiltrados.length > 0 && (
                    <section>
                      <div className="mb-4 flex items-center gap-3">
                        <h3 className="text-lg font-bold text-foreground">{categoriaCombo}</h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {combosFiltrados.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                        {combosFiltrados.map((combo) => (
                          <CartaoCombo key={combo.id} combo={combo} onAdicionar={adicionarComboAoCarrinho} />
                        ))}
                      </div>
                    </section>
                  )}
                  {gruposCategorias.map((grupo) => (
                    <section key={grupo.categoria}>
                      <div className="mb-4 flex items-center gap-3">
                        <h3 className="text-lg font-bold text-foreground">{grupo.categoria}</h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {grupo.produtos.length + grupo.bebidas.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                        {grupo.produtos.map((produto) => (
                          <CartaoProduto key={produto.id} produto={produto} onAdicionar={adicionarProdutoAoCarrinho} />
                        ))}
                        {grupo.bebidas.map((bebida) => (
                          <CartaoBebida key={bebida.id} bebida={bebida} onAdicionar={adicionarBebidaAoCarrinho} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : produtosFiltrados.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {produtosFiltrados.map((produto) => (
                  <CartaoProduto key={produto.id} produto={produto} onAdicionar={adicionarProdutoAoCarrinho} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {navegacaoInferiorVisivel && (
        <Footer
          onAbrirCarrinho={abrirCarrinho}
          onAbrirPedidos={() => setModalPedidosClienteAberto(true)}
        />
      )}

      <AjudaPedidoPublica aberto={ajudaAberta} numeroWhatsApp={numeroWhatsApp} onFechar={() => setAjudaAberta(false)} />

      <ModalCarrinho
        aberto={modalCarrinhoAberto}
        onFechar={() => setModalCarrinhoAberto(false)}
        lojaFechada={lojaFechada}
      />

      <ModalPedidosCliente
        aberto={modalPedidosClienteAberto}
        onFechar={() => setModalPedidosClienteAberto(false)}
      />

      <ModalNotificacao
        aberto={modalNotificacao.aberto}
        tipo={modalNotificacao.tipo}
        titulo={modalNotificacao.titulo}
        mensagem={modalNotificacao.mensagem}
        onFechar={() => setModalNotificacao((prev) => ({ ...prev, aberto: false }))}
      />

      <ModalComplementos
        produto={produtoSelecionado}
        aberto={modalComplementosAberto}
        onFechar={() => {
          setModalComplementosAberto(false)
          setProdutoSelecionado(null)
        }}
        onItemAdicionado={mostrarItemAdicionado}
      />

      <ModalLojaFechada
        aberto={lojaFechada}
        numeroWhatsApp={numeroWhatsApp}
      />
    </div>
  )
}
