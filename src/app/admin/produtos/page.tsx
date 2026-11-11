'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Reorder, useDragControls, type DragControls } from 'framer-motion'
import { ArrowsClockwise as RefreshCw, ArrowsDownUp, PencilSimple as Pencil, Image as ImageIcon, Plus, CaretDown as ChevronDown, CaretUp as ChevronUp, DotsSixVertical as GripVertical, MagnifyingGlass as Search, ClockCounterClockwise as History, ForkKnife, X } from '@phosphor-icons/react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { FiltroProdutosAdmin } from '@/components/admin/produtos/FiltroProdutosAdmin'
import {
  ModalFormularioProduto,
  type DadosSalvarProduto,
} from '@/components/admin/produtos/ModalFormularioProduto'
import { DialogHistoricoProduto } from '@/components/admin/produtos/DialogHistoricoProduto'
import { ajustarEstoqueProduto, ErroEstoque } from '@/lib/estoque'
import {
  camposEstoqueParaCatalogo,
  camposEstoqueParaPersistenciaCatalogo,
  normalizarDinheiro,
} from '@/lib/estoque-produto.mjs'
import { supabase } from '@/lib/supabase'
import type { CategoriaCardapio, TipoCategoriaCardapio } from '@/lib/supabase'
import Image from 'next/image'
import ModalRecorteImagem from '@/components/admin/ModalRecorteImagem'
import { toast } from 'sonner'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Entrada,
  Gaveta,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Segmentos,
  Selo,
  formatarPreco,
  useConfirmar,
} from '@/components/admin/ui'
import { cn, normalizarBusca } from '@/lib/utils'
import { validarArquivoImagem, arquivoParaUrl } from '@/lib/recorteImagem'
import { enviarImagemParaR2 } from '@/lib/servicoUploadImagem'
import {
  categoriasSaoIguais,
  normalizarNomeCategoria,
  obterCategoriaDestinoParaExclusao,
  obterNomesCategoriasPorTipo,
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

type Produto = {
  id: string
  nome: string
  descricao?: string
  preco: number
  preco_original?: number | null
  desconto?: number | null
  categoria: string
  imagem_url?: string
  disponivel: boolean
  ordem?: number | null
  tabela?: 'produtos' | 'bebidas'
  custo_unitario?: number | null
  estoque_quantidade?: number
  estoque_minimo?: number
  bloquear_venda_sem_estoque?: boolean
}

type EstadoRecorte = {
  aberto: boolean
  imagemUrl: string
  produtoId: string | null
  tabela: string
}

type FiltroStatusProduto = 'todos' | 'ativos' | 'ocultos'
type FiltroTipoProduto = 'todos' | 'produtos' | 'bebidas'
type FiltroFotoProduto = 'todos' | 'com-foto' | 'sem-foto'

const LIMITE_INICIAL_PRODUTOS_CATEGORIA = 8
const CHAVE_FILTROS_PRODUTOS_ADMIN = 'admin-produtos-filtros'

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [modalNotificacao, setModalNotificacao] = useState<{
    aberto: boolean
    tipo: 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'
    titulo: string
    mensagem: string
    rotuloConfirmar?: string
    onConfirmar?: () => void
  }>({
    aberto: false,
    tipo: 'info',
    titulo: '',
    mensagem: ''
  })

  const confirmar = useConfirmar()

  useEffect(() => {
    if (!modalNotificacao.aberto) return

    if (modalNotificacao.tipo === 'confirmacao') {
      const { titulo, mensagem, rotuloConfirmar, onConfirmar } = modalNotificacao
      setModalNotificacao((estadoAtual) => ({ ...estadoAtual, aberto: false }))
      void confirmar({ titulo, descricao: mensagem, confirmar: rotuloConfirmar, perigo: true }).then((ok) => {
        if (ok) onConfirmar?.()
      })
      return
    }

    const opcoesToast = { description: modalNotificacao.mensagem }
    if (modalNotificacao.tipo === 'erro') {
      toast.error(modalNotificacao.titulo, opcoesToast)
    } else if (modalNotificacao.tipo === 'aviso') {
      toast.warning(modalNotificacao.titulo, opcoesToast)
    } else if (modalNotificacao.tipo === 'sucesso') {
      toast.success(modalNotificacao.titulo, opcoesToast)
    } else {
      toast.info(modalNotificacao.titulo, opcoesToast)
    }

    setModalNotificacao((estadoAtual) => ({ ...estadoAtual, aberto: false }))
  }, [confirmar, modalNotificacao])

  // Estados para o recorte de imagem
  const [estadoRecorte, setEstadoRecorte] = useState<EstadoRecorte>({
    aberto: false,
    imagemUrl: '',
    produtoId: null,
    tabela: 'produtos'
  })
  const [enviandoImagem, setEnviandoImagem] = useState<string | null>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [produtoSelecionadoParaUpload, setProdutoSelecionadoParaUpload] = useState<{
    id: string
    tabela: string
  } | null>(null)

  const [modalNovoProduto, setModalNovoProduto] = useState(false)
  const [imagemNovoProduto, setImagemNovoProduto] = useState<string | null>(null)
  const [blobNovoProduto, setBlobNovoProduto] = useState<Blob | null>(null)
  const [salvandoNovoProduto, setSalvandoNovoProduto] = useState(false)
  const inputFileNovoProdutoRef = useRef<HTMLInputElement>(null)
  const [recorteNovoProduto, setRecorteNovoProduto] = useState(false)
  const [imagemParaRecorte, setImagemParaRecorte] = useState('')
  const [produtoEmEdicaoId, setProdutoEmEdicaoId] = useState<string | null>(null)
  const [produtoHistoricoId, setProdutoHistoricoId] = useState<string | null>(null)

  const [categoriasCardapio, setCategoriasCardapio] = useState<CategoriaCardapio[]>([])
  const [categoriasReais, setCategoriasReais] = useState<string[]>([])
  const [categoriaBebidasAtual, setCategoriaBebidasAtual] = useState('')
  const [tipoOrdenacaoSite, setTipoOrdenacaoSite] = useState<TipoOrdenacaoProdutosSite>('manual')
  const [ordemCategoriasConfigurada, setOrdemCategoriasConfigurada] = useState<string[]>([])
  const [ordemIdsPorCategoria, setOrdemIdsPorCategoria] = useState<Record<string, string[]>>({})
  const [possuiMudancasNaOrdenacaoManual, setPossuiMudancasNaOrdenacaoManual] = useState(false)
  const [salvandoConfiguracaoOrdenacao, setSalvandoConfiguracaoOrdenacao] = useState(false)
  const [salvandoOrdenacaoManual, setSalvandoOrdenacaoManual] = useState(false)
  const [secaoOrdenacaoAberta, setSecaoOrdenacaoAberta] = useState(false)
  const [salvandoCategoria, setSalvandoCategoria] = useState(false)
  const [categoriaEmProcesso, setCategoriaEmProcesso] = useState<string | null>(null)
  const [buscaProdutos, setBuscaProdutos] = useState('')
  const [filtroStatusProdutos, setFiltroStatusProdutos] = useState<FiltroStatusProduto>('todos')
  const [filtroTipoProdutos, setFiltroTipoProdutos] = useState<FiltroTipoProduto>('todos')
  const [filtroFotoProdutos, setFiltroFotoProdutos] = useState<FiltroFotoProduto>('todos')
  const [categoriaFiltroProdutos, setCategoriaFiltroProdutos] = useState('todas')
  const [categoriasExpandidasProdutos, setCategoriasExpandidasProdutos] = useState<string[]>([])
  const [modalRenomearCategoria, setModalRenomearCategoria] = useState<{
    aberto: boolean
    categoriaAtual: string
    novoNome: string
  }>({
    aberto: false,
    categoriaAtual: '',
    novoNome: ''
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const filtrosSalvos = window.localStorage.getItem(CHAVE_FILTROS_PRODUTOS_ADMIN)
      if (!filtrosSalvos) return

      const filtros = JSON.parse(filtrosSalvos) as Partial<{
        busca: string
        status: FiltroStatusProduto
        tipo: FiltroTipoProduto
        foto: FiltroFotoProduto
        categoria: string
      }>

      if (typeof filtros.busca === 'string') setBuscaProdutos(filtros.busca)
      if (filtros.status === 'todos' || filtros.status === 'ativos' || filtros.status === 'ocultos') {
        setFiltroStatusProdutos(filtros.status)
      }
      if (filtros.tipo === 'todos' || filtros.tipo === 'produtos' || filtros.tipo === 'bebidas') {
        setFiltroTipoProdutos(filtros.tipo)
      }
      if (filtros.foto === 'todos' || filtros.foto === 'com-foto' || filtros.foto === 'sem-foto') {
        setFiltroFotoProdutos(filtros.foto)
      }
      if (typeof filtros.categoria === 'string' && filtros.categoria) {
        setCategoriaFiltroProdutos(filtros.categoria)
      }
    } catch (erro) {
      console.warn('Filtros de produtos inválidos no navegador:', erro)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(
      CHAVE_FILTROS_PRODUTOS_ADMIN,
      JSON.stringify({
        busca: buscaProdutos,
        status: filtroStatusProdutos,
        tipo: filtroTipoProdutos,
        foto: filtroFotoProdutos,
        categoria: categoriaFiltroProdutos,
      })
    )
  }, [buscaProdutos, categoriaFiltroProdutos, filtroFotoProdutos, filtroStatusProdutos, filtroTipoProdutos])

  const ordenarProdutosPorModo = useCallback(
    (listaProdutos: Produto[], modoOrdenacao: TipoOrdenacaoProdutosSite) => {
      const listaOrdenada = [...listaProdutos]

      if (modoOrdenacao === 'preco_crescente') {
        return listaOrdenada.sort((a, b) => a.preco - b.preco || a.nome.localeCompare(b.nome, 'pt-BR'))
      }

      if (modoOrdenacao === 'preco_decrescente') {
        return listaOrdenada.sort((a, b) => b.preco - a.preco || a.nome.localeCompare(b.nome, 'pt-BR'))
      }

      return listaOrdenada.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
    },
    []
  )

  const sincronizarEstadoOrdenacaoManual = useCallback((listaProdutos: Produto[], categoriasOrdenadas: string[]) => {
    const categoriasDisponiveis = categoriasOrdenadas.length > 0
      ? categoriasOrdenadas
      : Array.from(new Set(listaProdutos.map((produtoAtual) => produtoAtual.categoria)))

    setOrdemIdsPorCategoria((estadoAtual) => {
      const proximoEstado: Record<string, string[]> = {}

      for (const categoriaAtual of categoriasDisponiveis) {
        const idsBaseCategoria = listaProdutos
          .filter((produtoAtual) => produtoAtual.categoria === categoriaAtual)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
          .map((produtoAtual) => produtoAtual.id)

        const idsPersistidos = (estadoAtual[categoriaAtual] || []).filter((idAtual) => idsBaseCategoria.includes(idAtual))
        const idsNovos = idsBaseCategoria.filter((idAtual) => !idsPersistidos.includes(idAtual))

        proximoEstado[categoriaAtual] = [...idsPersistidos, ...idsNovos]
      }

      return proximoEstado
    })
  }, [])

  const carregarProdutos = useCallback(async (exibirCarregamento = true) => {
    if (exibirCarregamento) {
      setLoading(true)
    }
    try {
      const [
        { data: produtosData, error: produtosError },
        { data: bebidasData, error: bebidasError },
        { data: categoriasData, error: categoriasError },
        { data: configuracoesOrdenacao, error: erroConfiguracoes }
      ] = await Promise.all([
        supabase
          .from('produtos')
          .select('*')
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('bebidas')
          .select('*')
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('categorias_cardapio')
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('configuracoes_loja')
          .select('chave, valor')
          .in('chave', [CHAVE_ORDENACAO_PRODUTOS_SITE, CHAVE_ORDEM_CATEGORIAS_PRODUTOS])
      ])

      if (produtosError) throw produtosError
      if (bebidasError) throw bebidasError
      if (categoriasError) throw categoriasError
      if (erroConfiguracoes) throw erroConfiguracoes

      const valorOrdenacaoSalvo = configuracoesOrdenacao?.find(
        (configuracaoAtual) => configuracaoAtual.chave === CHAVE_ORDENACAO_PRODUTOS_SITE
      )?.valor
      const valorOrdemCategoriasSalva = configuracoesOrdenacao?.find(
        (configuracaoAtual) => configuracaoAtual.chave === CHAVE_ORDEM_CATEGORIAS_PRODUTOS
      )?.valor

      const modoOrdenacaoAtual = normalizarTipoOrdenacaoProdutos(valorOrdenacaoSalvo)
      const ordemCategoriasSalva = parsearOrdemCategoriasProdutos(valorOrdemCategoriasSalva)

      setTipoOrdenacaoSite(modoOrdenacaoAtual)
      const categoriasAtivas = (categoriasData || []) as CategoriaCardapio[]
      setCategoriasCardapio(categoriasAtivas)

      const categoriasProdutosBanco = obterNomesCategoriasPorTipo(categoriasAtivas, 'produto')
      const categoriasBebidasBanco = obterNomesCategoriasPorTipo(categoriasAtivas, 'bebida')
      const nomeCategoriaBebidas = categoriasBebidasBanco[0] || ''
      setCategoriaBebidasAtual(nomeCategoriaBebidas)

      const bebidasFormatadas = (bebidasData || []).map((bebida) => ({
        id: bebida.id,
        nome: bebida.nome + (bebida.descricao ? ` - ${bebida.descricao}` : ''),
        preco: Number(bebida.preco),
        preco_original: bebida.preco_original ? Number(bebida.preco_original) : null,
        desconto: bebida.desconto,
        categoria: normalizarNomeCategoria(bebida.categoria || nomeCategoriaBebidas),
        imagem_url: bebida.imagem_url,
        disponivel: bebida.disponivel,
        ordem: bebida.ordem,
        custo_unitario: bebida.custo_unitario,
        estoque_quantidade: bebida.estoque_quantidade,
        estoque_minimo: bebida.estoque_minimo,
        bloquear_venda_sem_estoque: bebida.bloquear_venda_sem_estoque,
        tabela: 'bebidas'
      }))

      const produtosFormatados = (produtosData || []).map((produtoAtual) => ({
        ...produtoAtual,
        tabela: 'produtos' as const
      }))

      const todosProdutos = [...produtosFormatados, ...bebidasFormatadas]

      const nomesCategoriasBanco = new Set(categoriasAtivas.map((categoriaAtual) => categoriaAtual.nome))
      const categoriasDisponiveis = Array.from(
        new Set(todosProdutos.map((produtoAtual) => normalizarNomeCategoria(produtoAtual.categoria)).filter(Boolean))
      ).filter((categoriaAtual) => nomesCategoriasBanco.has(categoriaAtual))
      const categoriasOrdenadasBanco = ordenarNomesPorCategoriasDoBanco(categoriasDisponiveis, categoriasAtivas)
      const categoriasOrdenadas = ordenarCategoriasPorPreferencia(categoriasOrdenadasBanco, ordemCategoriasSalva)

      setCategoriasReais(categoriasProdutosBanco)

      setProdutos(ordenarProdutosPorModo(todosProdutos, modoOrdenacaoAtual))
      setOrdemCategoriasConfigurada(categoriasOrdenadas)
      sincronizarEstadoOrdenacaoManual(todosProdutos, categoriasOrdenadas)
      setPossuiMudancasNaOrdenacaoManual(false)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      if (exibirCarregamento) {
        setLoading(false)
      }
    }
  }, [ordenarProdutosPorModo, sincronizarEstadoOrdenacaoManual])

  useEffect(() => {
    carregarProdutos(true)

    const channelProdutos = supabase
      .channel('admin-produtos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, () => {
        carregarProdutos(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bebidas' }, () => {
        carregarProdutos(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_loja' }, () => {
        carregarProdutos(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias_cardapio' }, () => {
        carregarProdutos(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelProdutos)
    }
  }, [carregarProdutos])

  const persistirOrdemCategorias = useCallback(async (categoriasAtualizadas: string[]) => {
    const categoriasNormalizadas = Array.from(
      new Set(categoriasAtualizadas.map((categoriaAtual) => normalizarNomeCategoria(categoriaAtual)).filter(Boolean))
    )

    const { error } = await supabase
      .from('configuracoes_loja')
      .upsert(
        {
          chave: CHAVE_ORDEM_CATEGORIAS_PRODUTOS,
          valor: JSON.stringify(categoriasNormalizadas),
          tipo: 'json',
          descricao: 'Ordem manual das categorias exibidas no cardápio público.'
        },
        { onConflict: 'chave' }
      )

    if (error) throw error
  }, [])

  const salvarCategoriaNoBanco = useCallback(async (
    nomeCategoria: string,
    tipo: TipoCategoriaCardapio = 'produto'
  ) => {
    const nomeNormalizado = normalizarNomeCategoria(nomeCategoria)
    if (!nomeNormalizado) return

    const maiorOrdem = categoriasCardapio.reduce((maior, categoriaAtual) => {
      return Math.max(maior, categoriaAtual.ordem || 0)
    }, 0)

    const { error } = await supabase
      .from('categorias_cardapio')
      .upsert(
        {
          nome: nomeNormalizado,
          tipo,
          ativo: true,
          ordem: maiorOrdem + 1
        },
        { onConflict: 'nome,tipo' }
      )

    if (error) throw error
  }, [categoriasCardapio])

  const abrirModalRenomearCategoria = useCallback((categoria: string) => {
    setModalRenomearCategoria({
      aberto: true,
      categoriaAtual: categoria,
      novoNome: categoria
    })
  }, [])

  const fecharModalRenomearCategoria = useCallback(() => {
    setModalRenomearCategoria({
      aberto: false,
      categoriaAtual: '',
      novoNome: ''
    })
  }, [])

  const salvarRenomeacaoCategoria = useCallback(async () => {
    const categoriaAtual = modalRenomearCategoria.categoriaAtual
    const novoNomeCategoria = normalizarNomeCategoria(modalRenomearCategoria.novoNome)

    if (!categoriaAtual) return

    if (!novoNomeCategoria) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Nome Obrigatório',
        mensagem: 'Informe um nome válido para a categoria.'
      })
      return
    }

    if (categoriasSaoIguais(categoriaAtual, novoNomeCategoria)) {
      fecharModalRenomearCategoria()
      return
    }

    const categoriasExistentes = Array.from(
      new Set(
        [...categoriasCardapio.map((categoriaExistente) => categoriaExistente.nome), ...ordemCategoriasConfigurada]
          .map((categoriaExistente) => normalizarNomeCategoria(categoriaExistente))
          .filter(Boolean)
      )
    )

    const categoriaJaExiste = categoriasExistentes.some(
      (categoriaExistente) =>
        !categoriasSaoIguais(categoriaExistente, categoriaAtual) &&
        categoriasSaoIguais(categoriaExistente, novoNomeCategoria)
    )

    if (categoriaJaExiste) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Categoria Existente',
        mensagem: `Já existe uma categoria chamada "${novoNomeCategoria}".`
      })
      return
    }

    setSalvandoCategoria(true)
    setCategoriaEmProcesso(categoriaAtual)
    try {
      const categoriaTemBebida = produtos.some(
        (produtoAtual) => produtoAtual.tabela === 'bebidas' && categoriasSaoIguais(produtoAtual.categoria, categoriaAtual)
      )

      const [{ error: erroProdutos }, { error: erroBebidas }, { error: erroCategoria }] = await Promise.all([
        supabase
          .from('produtos')
          .update({ categoria: novoNomeCategoria })
          .eq('categoria', categoriaAtual),
        supabase
          .from('bebidas')
          .update({ categoria: novoNomeCategoria })
          .eq('categoria', categoriaAtual),
        supabase
          .from('categorias_cardapio')
          .update({ nome: novoNomeCategoria })
          .eq('nome', categoriaAtual)
      ])

      if (erroProdutos) throw erroProdutos
      if (erroBebidas) throw erroBebidas
      if (erroCategoria) throw erroCategoria

      if (categoriaTemBebida && categoriasSaoIguais(categoriaAtual, categoriaBebidasAtual)) {
        setCategoriaBebidasAtual(novoNomeCategoria)
      }

      const ordemAtualizada = ordemCategoriasConfigurada.map((categoriaConfigurada) =>
        categoriaConfigurada === categoriaAtual ? novoNomeCategoria : categoriaConfigurada
      )
      if (ordemAtualizada.length > 0) {
        await persistirOrdemCategorias(ordemAtualizada)
      }

      fecharModalRenomearCategoria()
      await carregarProdutos(false)

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Categoria Atualizada',
        mensagem: `A categoria "${categoriaAtual}" foi renomeada para "${novoNomeCategoria}".`
      })
    } catch (erro) {
      console.error('Erro ao renomear categoria:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Renomear',
        mensagem: 'Não foi possível renomear a categoria. Tente novamente.'
      })
    } finally {
      setSalvandoCategoria(false)
      setCategoriaEmProcesso(null)
    }
  }, [
    carregarProdutos,
    categoriaBebidasAtual,
    categoriasCardapio,
    fecharModalRenomearCategoria,
    modalRenomearCategoria,
    ordemCategoriasConfigurada,
    produtos,
    persistirOrdemCategorias
  ])

  const excluirCategoriaSemApagarProdutos = useCallback((categoria: string) => {
    const categoriasDisponiveisParaDestino = ordenarNomesPorCategoriasDoBanco(
      Array.from(new Set(produtos.map((produtoAtual) => normalizarNomeCategoria(produtoAtual.categoria)).filter(Boolean))),
      categoriasCardapio
    )
    const categoriaDestino = obterCategoriaDestinoParaExclusao(categoria, categoriasDisponiveisParaDestino)

    if (!categoriaDestino) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Categoria Única',
        mensagem: 'Crie outra categoria antes de remover esta.'
      })
      return
    }

    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: `Excluir a categoria "${categoria}"?`,
      mensagem: `Os produtos vão para "${categoriaDestino}". Nenhum produto é apagado.`,
      rotuloConfirmar: 'Excluir categoria',
      onConfirmar: async () => {
        setSalvandoCategoria(true)
        setCategoriaEmProcesso(categoria)
        try {
          const categoriaTemBebida = produtos.some(
            (produtoAtual) => produtoAtual.tabela === 'bebidas' && categoriasSaoIguais(produtoAtual.categoria, categoria)
          )
          const [{ error: erroProdutos }, { error: erroBebidas }, { error: erroCategoria }] = await Promise.all([
            supabase
              .from('produtos')
              .update({ categoria: categoriaDestino })
              .eq('categoria', categoria),
            supabase
              .from('bebidas')
              .update({ categoria: categoriaDestino })
              .eq('categoria', categoria),
            supabase
              .from('categorias_cardapio')
              .update({ ativo: false })
              .eq('nome', categoria)
          ])

          if (erroProdutos) throw erroProdutos
          if (erroBebidas) throw erroBebidas
          if (erroCategoria) throw erroCategoria

          if (categoriaTemBebida && categoriasSaoIguais(categoria, categoriaBebidasAtual)) {
            setCategoriaBebidasAtual(categoriaDestino)
          }

          const ordemAtualizada = ordemCategoriasConfigurada.filter(
            (categoriaConfigurada) => categoriaConfigurada !== categoria
          )

          if (!ordemAtualizada.includes(categoriaDestino)) {
            ordemAtualizada.push(categoriaDestino)
          }

          if (ordemAtualizada.length > 0) {
            await persistirOrdemCategorias(ordemAtualizada)
          }

          await carregarProdutos(false)
          setModalNotificacao({
            aberto: true,
            tipo: 'sucesso',
            titulo: 'Categoria Excluída',
            mensagem: `A categoria "${categoria}" foi removida e os produtos foram movidos para "${categoriaDestino}".`
          })
        } catch (erro) {
          console.error('Erro ao excluir categoria:', erro)
          setModalNotificacao({
            aberto: true,
            tipo: 'erro',
            titulo: 'Erro ao Excluir',
            mensagem: 'Não foi possível excluir a categoria. Tente novamente.'
          })
        } finally {
          setSalvandoCategoria(false)
          setCategoriaEmProcesso(null)
        }
      }
    })
  }, [carregarProdutos, categoriaBebidasAtual, categoriasCardapio, ordemCategoriasConfigurada, persistirOrdemCategorias, produtos])

  // Função para iniciar o processo de upload de imagem
  const iniciarUploadImagem = useCallback((produtoId: string, tabela: string) => {
    setProdutoSelecionadoParaUpload({ id: produtoId, tabela })
    inputFileRef.current?.click()
  }, [])

  // Função para processar o arquivo selecionado
  const aoSelecionarArquivo = useCallback(async (evento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0]
    if (!arquivo || !produtoSelecionadoParaUpload) return

    // Valida o arquivo
    const validacao = validarArquivoImagem(arquivo)
    if (!validacao.valido) {
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Arquivo Inválido',
        mensagem: validacao.erro || 'O arquivo selecionado não é válido.'
      })
      evento.target.value = ''
      return
    }

    try {
      const urlImagem = await arquivoParaUrl(arquivo)
      setEstadoRecorte({
        aberto: true,
        imagemUrl: urlImagem,
        produtoId: produtoSelecionadoParaUpload.id,
        tabela: produtoSelecionadoParaUpload.tabela
      })
    } catch (erro) {
      console.error('Erro ao ler arquivo:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Ler Arquivo',
        mensagem: 'Não foi possível ler o arquivo selecionado.'
      })
    }

    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    evento.target.value = ''
  }, [produtoSelecionadoParaUpload])

  // Função para abrir o recorte de uma imagem existente
  const abrirRecorteImagemExistente = useCallback((produto: Produto) => {
    if (!produto.imagem_url) return

    setEstadoRecorte({
      aberto: true,
      imagemUrl: produto.imagem_url,
      produtoId: produto.id,
      tabela: produto.tabela || 'produtos'
    })
  }, [])

  // Função para fazer upload da imagem recortada para o Cloudflare R2
  const enviarImagemRecortada = useCallback(async (base64: string, blob: Blob) => {
    if (!estadoRecorte.produtoId) return

    setEnviandoImagem(estadoRecorte.produtoId)
    setEstadoRecorte(prev => ({ ...prev, aberto: false }))

    try {
      // Faz upload para o Cloudflare R2 (já compacta automaticamente)
      const resultado = await enviarImagemParaR2(
        blob,
        estadoRecorte.tabela,
        estadoRecorte.produtoId
      )

      if (!resultado.sucesso || !resultado.url) {
        throw new Error(resultado.erro || 'Falha no upload')
      }

      const novaUrlImagem = resultado.url

      // Atualiza o registro no banco de dados
      const { error: updateError } = await supabase
        .from(estadoRecorte.tabela)
        .update({ imagem_url: novaUrlImagem })
        .eq('id', estadoRecorte.produtoId)

      if (updateError) {
        throw updateError
      }

      // Atualiza o estado local
      setProdutos(prev => prev.map(p =>
        p.id === estadoRecorte.produtoId
          ? { ...p, imagem_url: novaUrlImagem }
          : p
      ))

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Imagem Atualizada',
        mensagem: 'A imagem do produto foi atualizada com sucesso!'
      })
    } catch (erro) {
      console.error('Erro ao enviar imagem:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Enviar Imagem',
        mensagem: erro instanceof Error ? erro.message : 'Não foi possível enviar a imagem. Tente novamente.'
      })
    } finally {
      setEnviandoImagem(null)
    }
  }, [estadoRecorte])

  // Função para remover a imagem de um produto
  const removerImagem = useCallback(async (produtoId: string, tabela: string) => {
    setSalvando(produtoId)
    try {
      const { error } = await supabase
        .from(tabela)
        .update({ imagem_url: null })
        .eq('id', produtoId)

      if (error) throw error

      setProdutos(prev => prev.map(p =>
        p.id === produtoId ? { ...p, imagem_url: undefined } : p
      ))

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Imagem Removida',
        mensagem: 'A imagem foi removida com sucesso.'
      })
    } catch (erro) {
      console.error('Erro ao remover imagem:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Remover',
        mensagem: 'Não foi possível remover a imagem.'
      })
    } finally {
      setSalvando(null)
    }
  }, [])

  // Função para excluir produto/bebida
  const excluirProduto = useCallback(async (produtoId: string, tabela: string, nome: string) => {
    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: `Excluir "${nome}"?`,
      mensagem: 'O item some do cardápio. Não dá para desfazer.',
      rotuloConfirmar: 'Excluir',
      onConfirmar: async () => {
        setSalvando(produtoId)
        try {
          const { error } = await supabase
            .from(tabela)
            .delete()
            .eq('id', produtoId)

          if (error) throw error

          setProdutos((estadoAtual) =>
            ordenarProdutosPorModo(
              estadoAtual.filter((produtoAtual) => produtoAtual.id !== produtoId),
              tipoOrdenacaoSite
            )
          )
          setModalNotificacao({
            aberto: true,
            tipo: 'sucesso',
            titulo: 'Produto Excluído',
            mensagem: `"${nome}" foi excluído com sucesso.`
          })
        } catch (erro) {
          console.error('Erro ao excluir produto:', erro)
          setModalNotificacao({
            aberto: true,
            tipo: 'erro',
            titulo: 'Erro ao Excluir',
            mensagem: 'Não foi possível excluir o produto. Ele pode estar vinculado a pedidos existentes.'
          })
        } finally {
          setSalvando(null)
        }
      }
    })
  }, [ordenarProdutosPorModo, tipoOrdenacaoSite])

  const categoriasOrdenadas = useMemo(() => {
    const categoriasDisponiveis = Array.from(
      new Set(produtos.map((produtoAtual) => normalizarNomeCategoria(produtoAtual.categoria)).filter(Boolean))
    )
    const categoriasOrdenadasBanco = ordenarNomesPorCategoriasDoBanco(categoriasDisponiveis, categoriasCardapio)
    return ordenarCategoriasPorPreferencia(categoriasOrdenadasBanco, ordemCategoriasConfigurada)
  }, [categoriasCardapio, produtos, ordemCategoriasConfigurada])

  const produtosPorId = useMemo(() => {
    return new Map(produtos.map((produtoAtual) => [produtoAtual.id, produtoAtual]))
  }, [produtos])

  const obterIdsOrdenadosDaCategoria = useCallback((categoria: string) => {
    const idsNoEstado = ordemIdsPorCategoria[categoria] || []
    if (idsNoEstado.length > 0) return idsNoEstado

    return produtos
      .filter((produtoAtual) => produtoAtual.categoria === categoria)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((produtoAtual) => produtoAtual.id)
  }, [ordemIdsPorCategoria, produtos])

  const obterProdutosDaCategoria = useCallback((categoria: string) => {
    const itensCategoria = produtos.filter((produtoAtual) => produtoAtual.categoria === categoria)

    if (tipoOrdenacaoSite !== 'manual') {
      return ordenarProdutosPorModo(itensCategoria, tipoOrdenacaoSite)
    }

    const idsOrdenados = obterIdsOrdenadosDaCategoria(categoria)
    const itensMapeados = idsOrdenados
      .map((idAtual) => produtosPorId.get(idAtual))
      .filter((produtoAtual): produtoAtual is Produto => produtoAtual !== undefined)
      .filter((produtoAtual) => produtoAtual.categoria === categoria)

    if (itensMapeados.length === itensCategoria.length) return itensMapeados

    // Garante consistência quando há itens recém-criados ainda não refletidos no estado de ordenação.
    const idsMapeados = new Set(itensMapeados.map((produtoAtual) => produtoAtual.id))
    const itensRestantes = itensCategoria
      .filter((produtoAtual) => !idsMapeados.has(produtoAtual.id))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'))

    return [...itensMapeados, ...itensRestantes]
  }, [obterIdsOrdenadosDaCategoria, ordenarProdutosPorModo, produtos, produtosPorId, tipoOrdenacaoSite])

  const aoReordenarCategorias = (novaOrdemCategorias: string[]) => {
    setOrdemCategoriasConfigurada(novaOrdemCategorias)
    setPossuiMudancasNaOrdenacaoManual(true)
  }

  const aoReordenarProdutosDaCategoria = (categoria: string, novaOrdemIds: string[]) => {
    setOrdemIdsPorCategoria((estadoAtual) => ({
      ...estadoAtual,
      [categoria]: novaOrdemIds
    }))
    setPossuiMudancasNaOrdenacaoManual(true)
  }

  const alterarModoOrdenacaoSite = async (modoSelecionado: TipoOrdenacaoProdutosSite) => {
    setSalvandoConfiguracaoOrdenacao(true)

    try {
      const { error } = await supabase
        .from('configuracoes_loja')
        .upsert(
          {
            chave: CHAVE_ORDENACAO_PRODUTOS_SITE,
            valor: modoSelecionado,
            tipo: 'string',
            descricao: 'Modo de ordenação de produtos no cardápio público: manual, preco_crescente ou preco_decrescente.'
          },
          { onConflict: 'chave' }
        )

      if (error) throw error

      setTipoOrdenacaoSite(modoSelecionado)
      setProdutos((estadoAtual) => ordenarProdutosPorModo(estadoAtual, modoSelecionado))
      if (modoSelecionado !== 'manual') {
        setPossuiMudancasNaOrdenacaoManual(false)
      }
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Ordenação Atualizada',
        mensagem: 'A forma de ordenação no site foi atualizada com sucesso.'
      })
    } catch (erro) {
      console.error('Erro ao alterar modo de ordenação do site:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro na Ordenação',
        mensagem: 'Não foi possível salvar o modo de ordenação. Tente novamente.'
      })
    } finally {
      setSalvandoConfiguracaoOrdenacao(false)
    }
  }

  const salvarOrdenacaoManual = async () => {
    if (tipoOrdenacaoSite !== 'manual') return

    setSalvandoOrdenacaoManual(true)

    try {
      const atualizacoesProdutos: Array<{ tabela: 'produtos' | 'bebidas'; id: string; ordem: number }> = []
      let ordemProdutos = 1
      let ordemBebidas = 1

      for (const categoriaAtual of categoriasOrdenadas) {
        const idsOrdenadosCategoria = obterIdsOrdenadosDaCategoria(categoriaAtual)

        for (const idAtual of idsOrdenadosCategoria) {
          const item = produtosPorId.get(idAtual)
          if (!item || (item.tabela !== 'produtos' && item.tabela !== 'bebidas')) continue

          if (item.tabela === 'bebidas') {
            atualizacoesProdutos.push({
              tabela: 'bebidas',
              id: idAtual,
              ordem: ordemBebidas
            })
            ordemBebidas += 1
            continue
          }

          atualizacoesProdutos.push({
            tabela: 'produtos',
            id: idAtual,
            ordem: ordemProdutos
          })
          ordemProdutos += 1
        }
      }

      const respostasAtualizacao = await Promise.all(
        atualizacoesProdutos.map((atualizacaoAtual) =>
          supabase
            .from(atualizacaoAtual.tabela)
            .update({ ordem: atualizacaoAtual.ordem })
            .eq('id', atualizacaoAtual.id)
        )
      )

      const erroAtualizacao = respostasAtualizacao.find((respostaAtual) => respostaAtual.error)?.error
      if (erroAtualizacao) throw erroAtualizacao

      const { error: erroSalvarCategorias } = await supabase
        .from('configuracoes_loja')
        .upsert(
          {
            chave: CHAVE_ORDEM_CATEGORIAS_PRODUTOS,
            valor: JSON.stringify(categoriasOrdenadas),
            tipo: 'json',
            descricao: 'Ordem manual das categorias exibidas no cardápio público.'
          },
          { onConflict: 'chave' }
        )

      if (erroSalvarCategorias) throw erroSalvarCategorias

      setPossuiMudancasNaOrdenacaoManual(false)
      await carregarProdutos(false)
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Ordem Manual Salva',
        mensagem: 'A nova ordem de categorias e produtos já está ativa no site.'
      })
    } catch (erro) {
      console.error('Erro ao salvar ordenação manual:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Salvar Ordem',
        mensagem: 'Não foi possível salvar a ordem manual. Tente novamente.'
      })
    } finally {
      setSalvandoOrdenacaoManual(false)
    }
  }

  const abrirModalNovoProduto = () => {
    setImagemNovoProduto(null)
    setBlobNovoProduto(null)
    setModalNovoProduto(true)
  }

  const criarCategoriaNoModal = async (nomeCategoria: string): Promise<string | null> => {
    const categoriaNormalizada = normalizarNomeCategoria(nomeCategoria)
    if (!categoriaNormalizada) return null

    try {
      await salvarCategoriaNoBanco(categoriaNormalizada, 'produto')
      setCategoriasReais((estadoAtual) =>
        Array.from(new Set([...estadoAtual, categoriaNormalizada])).sort((a, b) => a.localeCompare(b, 'pt-BR'))
      )
      await carregarProdutos(false)
      return categoriaNormalizada
    } catch (erro) {
      console.error('Erro ao criar categoria:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Criar Categoria',
        mensagem: 'Não foi possível criar a categoria. Tente novamente.'
      })
      return null
    }
  }

  const selecionarImagemNovoProduto = async (evento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return

    const validacao = validarArquivoImagem(arquivo)
    if (!validacao.valido) {
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Arquivo Inválido',
        mensagem: validacao.erro || 'O arquivo selecionado não é válido.'
      })
      evento.target.value = ''
      return
    }

    try {
      const urlImagem = await arquivoParaUrl(arquivo)
      setImagemParaRecorte(urlImagem)
      setRecorteNovoProduto(true)
    } catch (erro) {
      console.error('Erro ao ler arquivo:', erro)
    }
    evento.target.value = ''
  }

  const confirmarRecorteNovoProduto = (base64: string, blob: Blob) => {
    setImagemNovoProduto(base64)
    setBlobNovoProduto(blob)
    setRecorteNovoProduto(false)
  }

  const salvarNovoProduto = async (dados: DadosSalvarProduto) => {
    if (!dados.nome || !dados.preco) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Campos Obrigatórios',
        mensagem: 'Preencha o nome e o preço do produto.'
      })
      return
    }

    if (!dados.categoria) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Categoria Obrigatória',
        mensagem: 'Selecione uma categoria para continuar.'
      })
      return
    }

    setSalvandoNovoProduto(true)
    try {
      const categoriaNormalizadaNovoProduto = normalizarNomeCategoria(dados.categoria)
      const isBebida = categoriasBebidas.some((categoriaBebidaAtual) =>
        categoriasSaoIguais(categoriaNormalizadaNovoProduto, categoriaBebidaAtual)
      ) || categoriasSaoIguais(categoriaNormalizadaNovoProduto, categoriaBebidasAtual)
      const tabela = isBebida ? 'bebidas' : 'produtos'
      const { data: registroMaiorOrdem, error: erroOrdem } = await supabase
        .from(tabela)
        .select('ordem')
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (erroOrdem) throw erroOrdem

      const proximaOrdem = (registroMaiorOrdem?.ordem ?? 0) + 1
      let precoNormalizado = 0
      try {
        precoNormalizado = Number(normalizarDinheiro(dados.preco))
      } catch {
        throw new Error('Informe um preço de venda válido.')
      }
      const tipoCatalogo = isBebida ? 'bebida' : 'produto'
      const camposEstoque = camposEstoqueParaPersistenciaCatalogo(tipoCatalogo, {
            custoUnitario: dados.custoUnitario,
            quantidade: dados.quantidadeEstoque,
            minimo: dados.estoqueMinimo,
            bloquear: dados.bloquearVendaSemEstoque,
          })
      const quantidadeInicial = camposEstoqueParaCatalogo(tipoCatalogo, {
            custoUnitario: dados.custoUnitario,
            quantidade: dados.quantidadeEstoque,
            minimo: dados.estoqueMinimo,
            bloquear: dados.bloquearVendaSemEstoque,
          }).estoque_quantidade

      const dadosInsercao = isBebida
        ? {
          nome: dados.nome,
          descricao: dados.descricao || null,
          preco: precoNormalizado,
          categoria: categoriaNormalizadaNovoProduto || categoriaBebidasAtual,
          ordem: proximaOrdem,
          disponivel: true,
          ...camposEstoque,
        }
        : {
          nome: dados.nome,
          descricao: dados.descricao || null,
          preco: precoNormalizado,
          categoria: categoriaNormalizadaNovoProduto,
          ordem: proximaOrdem,
          disponivel: true,
          ...camposEstoque,
        }

      const { data: produtoCriado, error: erroCriacao } = await supabase
        .from(tabela)
        .insert(dadosInsercao)
        .select()
        .single()

      if (erroCriacao) throw erroCriacao

      if (produtoCriado && typeof quantidadeInicial === 'number') {
        try {
          await ajustarEstoqueProduto({ produtoId: produtoCriado.id, tabela, quantidade: quantidadeInicial })
        } catch (erroEstoque) {
          toast.error(
            erroEstoque instanceof ErroEstoque
              ? erroEstoque.message
              : 'Produto criado, mas o estoque não foi ajustado.',
          )
        }
      }

      if (blobNovoProduto && produtoCriado) {
        const resultadoUpload = await enviarImagemParaR2(
          blobNovoProduto,
          tabela,
          produtoCriado.id
        )

        if (resultadoUpload.sucesso && resultadoUpload.url) {
          await supabase
            .from(tabela)
            .update({ imagem_url: resultadoUpload.url })
            .eq('id', produtoCriado.id)
        }
      }

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: isBebida ? 'Bebida Criada' : 'Produto Criado',
        mensagem: `${isBebida ? 'A bebida' : 'O produto'} foi cadastrado com sucesso!`
      })

      setModalNovoProduto(false)
      setImagemNovoProduto(null)
      setBlobNovoProduto(null)
      carregarProdutos(false)
    } catch (erro: unknown) {
      console.error('Erro ao criar produto:', erro)

      const erroSupabase = erro as { code?: string; message?: string }
      const erroCategoriaNula =
        erroSupabase.code === '23502' &&
        typeof erroSupabase.message === 'string' &&
        erroSupabase.message.includes('categoria')

      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Criar',
        mensagem: erroCategoriaNula
          ? 'Falha ao criar bebida: a categoria é obrigatória no banco.'
          : 'Não foi possível criar o produto. Tente novamente.'
      })
    } finally {
      setSalvandoNovoProduto(false)
    }
  }

  const salvarEdicaoProduto = async (dados: DadosSalvarProduto) => {
    if (!produtoEmEdicaoId) return
    const produto = produtos.find((item) => item.id === produtoEmEdicaoId)
    if (!produto) return

    if (!dados.nome.trim() || !dados.preco) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Campos Obrigatórios',
        mensagem: 'Preencha o nome e o preço do produto.'
      })
      return
    }

    const tabela = produto.tabela || 'produtos'
    let precoNumero = 0
    try {
      precoNumero = Number(normalizarDinheiro(dados.preco))
    } catch {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Preço Inválido',
        mensagem: 'Informe um preço válido.'
      })
      return
    }
    if (Number.isNaN(precoNumero) || precoNumero < 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Preço Inválido',
        mensagem: 'Informe um preço válido.'
      })
      return
    }

    const descontoNumero = Math.min(100, Math.max(0, parseFloat(dados.desconto) || 0))
    const precoFinal = descontoNumero > 0
      ? precoNumero * (1 - descontoNumero / 100)
      : precoNumero
    const categoriaNormalizada = normalizarNomeCategoria(dados.categoria) || produto.categoria
    const tipoCatalogo = tabela === 'bebidas' ? 'bebida' : 'produto'
    const camposEstoque = camposEstoqueParaPersistenciaCatalogo(tipoCatalogo, {
          custoUnitario: dados.custoUnitario,
          quantidade: dados.quantidadeEstoque,
          minimo: dados.estoqueMinimo,
          bloquear: dados.bloquearVendaSemEstoque,
        })
    const quantidadeAlvo = camposEstoqueParaCatalogo(tipoCatalogo, {
          custoUnitario: dados.custoUnitario,
          quantidade: dados.quantidadeEstoque,
          minimo: dados.estoqueMinimo,
          bloquear: dados.bloquearVendaSemEstoque,
        }).estoque_quantidade

    setSalvando(produto.id)
    try {
      const payload =
        tabela === 'bebidas'
          ? {
              nome: dados.nome.trim(),
              descricao: dados.descricao || null,
              preco: precoFinal,
              preco_original: descontoNumero > 0 ? precoNumero : null,
              desconto: descontoNumero > 0 ? descontoNumero : null,
              disponivel: dados.disponivel,
              ...camposEstoque,
            }
          : {
              nome: dados.nome.trim(),
              descricao: dados.descricao || null,
              preco: precoFinal,
              preco_original: descontoNumero > 0 ? precoNumero : null,
              desconto: descontoNumero > 0 ? descontoNumero : null,
              categoria: categoriaNormalizada,
              disponivel: dados.disponivel,
              ...camposEstoque,
            }

      const { error } = await supabase.from(tabela).update(payload).eq('id', produto.id)
      if (error) throw error

      let quantidadeConfirmada = produto.estoque_quantidade ?? 0
      // Saldo inalterado no formulário não sobrescreve vendas feitas enquanto ele estava aberto.
      if (typeof quantidadeAlvo === 'number' && quantidadeAlvo !== produto.estoque_quantidade) {
        quantidadeConfirmada = await ajustarEstoqueProduto({ produtoId: produto.id, tabela, quantidade: quantidadeAlvo })
      }

      if (tabela !== 'bebidas' && categoriaNormalizada !== produto.categoria) {
        await carregarProdutos(false)
      } else {
        setProdutos((estadoAtual) =>
          ordenarProdutosPorModo(
            estadoAtual.map((item): Produto =>
              item.id === produto.id
                ? {
                    ...item,
                    nome: dados.nome.trim(),
                    descricao: dados.descricao || undefined,
                    preco: precoFinal,
                    preco_original: descontoNumero > 0 ? precoNumero : null,
                    desconto: descontoNumero > 0 ? descontoNumero : null,
                    categoria: tabela === 'bebidas' ? item.categoria : categoriaNormalizada,
                    disponivel: dados.disponivel,
                    custo_unitario:
                      dados.custoUnitario.trim() === ''
                        ? null
                        : Number(camposEstoque.custo_unitario),
                    estoque_quantidade: quantidadeConfirmada,
                    estoque_minimo: Number(camposEstoque.estoque_minimo),
                    bloquear_venda_sem_estoque: dados.bloquearVendaSemEstoque,
                  }
                : item
            ),
            tipoOrdenacaoSite
          )
        )
      }

      setProdutoEmEdicaoId(null)
      toast.success('Produto atualizado')
    } catch (erro) {
      console.error('Erro ao salvar edição:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao Salvar',
        mensagem: erro instanceof ErroEstoque
          ? erro.message
          : 'Não foi possível salvar as alterações. Tente novamente.'
      })
    } finally {
      setSalvando(null)
    }
  }

  const categorias = categoriasOrdenadas
  const termoBuscaProdutos = normalizarBusca(buscaProdutos)
  const produtoPassaNosFiltros = useCallback(
    (produto: Produto) => {
      if (categoriaFiltroProdutos !== 'todas' && !categoriasSaoIguais(produto.categoria, categoriaFiltroProdutos)) {
        return false
      }

      if (filtroStatusProdutos === 'ativos' && !produto.disponivel) return false
      if (filtroStatusProdutos === 'ocultos' && produto.disponivel) return false
      if (filtroTipoProdutos === 'produtos' && produto.tabela === 'bebidas') return false
      if (filtroTipoProdutos === 'bebidas' && produto.tabela !== 'bebidas') return false
      if (filtroFotoProdutos === 'com-foto' && !produto.imagem_url) return false
      if (filtroFotoProdutos === 'sem-foto' && produto.imagem_url) return false
      if (!termoBuscaProdutos) return true

      const textoProduto = [
        produto.nome,
        produto.descricao || '',
        produto.categoria,
        produto.tabela === 'bebidas' ? 'bebida' : 'produto',
        produto.disponivel ? 'ativo disponivel' : 'oculto indisponivel',
      ].join(' ')

      return normalizarBusca(textoProduto).includes(termoBuscaProdutos)
    },
    [categoriaFiltroProdutos, filtroFotoProdutos, filtroStatusProdutos, filtroTipoProdutos, termoBuscaProdutos]
  )
  const categoriasBebidas = useMemo(
    () => obterNomesCategoriasPorTipo(categoriasCardapio, 'bebida'),
    [categoriasCardapio]
  )
  const produtoEmEdicao = useMemo(
    () => (produtoEmEdicaoId ? produtos.find((item) => item.id === produtoEmEdicaoId) ?? null : null),
    [produtoEmEdicaoId, produtos]
  )
  const produtoHistorico = useMemo(
    () => (produtoHistoricoId ? produtos.find((item) => item.id === produtoHistoricoId) ?? null : null),
    [produtoHistoricoId, produtos],
  )
  const totalDisponiveis = produtos.filter((produtoAtual) => produtoAtual.disponivel).length
  const totalIndisponiveis = produtos.length - totalDisponiveis
  const totalSemFoto = produtos.filter((produtoAtual) => !produtoAtual.imagem_url).length
  const filtrosAtivosProdutos =
    termoBuscaProdutos ||
    filtroStatusProdutos !== 'todos' ||
    filtroTipoProdutos !== 'todos' ||
    filtroFotoProdutos !== 'todos' ||
    categoriaFiltroProdutos !== 'todas'
  const categoriasVisiveis = categorias.filter((categoria) =>
    obterProdutosDaCategoria(categoria).some(produtoPassaNosFiltros)
  )

  useEffect(() => {
    if (categoriaFiltroProdutos === 'todas') return
    if (categorias.some((categoriaAtual) => categoriasSaoIguais(categoriaAtual, categoriaFiltroProdutos))) return
    setCategoriaFiltroProdutos('todas')
  }, [categoriaFiltroProdutos, categorias])

  const limparFiltrosProdutos = () => {
    setBuscaProdutos('')
    setFiltroStatusProdutos('todos')
    setFiltroTipoProdutos('todos')
    setFiltroFotoProdutos('todos')
    setCategoriaFiltroProdutos('todas')
  }

  const alternarCategoriaExpandida = (categoria: string) => {
    setCategoriasExpandidasProdutos((estadoAtual) =>
      estadoAtual.includes(categoria)
        ? estadoAtual.filter((categoriaAtual) => categoriaAtual !== categoria)
        : [...estadoAtual, categoria]
    )
  }

  const chipsFiltroProdutos: ChipFiltroAtivo[] = []
  if (termoBuscaProdutos) {
    chipsFiltroProdutos.push({ key: 'busca', label: 'Busca', value: buscaProdutos.trim() })
  }
  if (filtroStatusProdutos !== 'todos') {
    chipsFiltroProdutos.push({
      key: 'status',
      label: 'Status',
      value: filtroStatusProdutos === 'ativos' ? 'Ativos' : 'Ocultos',
    })
  }
  if (filtroTipoProdutos !== 'todos') {
    chipsFiltroProdutos.push({
      key: 'tipo',
      label: 'Tipo',
      value: filtroTipoProdutos === 'produtos' ? 'Produtos' : 'Bebidas',
    })
  }
  if (filtroFotoProdutos !== 'todos') {
    chipsFiltroProdutos.push({
      key: 'foto',
      label: 'Foto',
      value: filtroFotoProdutos === 'com-foto' ? 'Com foto' : 'Sem foto',
    })
  }
  if (categoriaFiltroProdutos !== 'todas') {
    chipsFiltroProdutos.push({
      key: 'categoria',
      label: 'Categoria',
      value: categoriaFiltroProdutos,
    })
  }

  const hasFiltroAvancadoProdutos =
    filtroStatusProdutos !== 'todos' ||
    filtroTipoProdutos !== 'todos' ||
    filtroFotoProdutos !== 'todos' ||
    categoriaFiltroProdutos !== 'todas'

  const fecharGavetaOrganizar = () => {
    if (possuiMudancasNaOrdenacaoManual) {
      void confirmar({
        titulo: 'Sair sem salvar a ordem?',
        descricao: 'A nova ordem ainda não foi salva no cardápio.',
        confirmar: 'Sair sem salvar',
        cancelar: 'Continuar organizando',
      }).then((ok) => {
        if (!ok) return
        setSecaoOrdenacaoAberta(false)
        void carregarProdutos(false)
      })
      return
    }
    setSecaoOrdenacaoAberta(false)
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina>
          <CabecalhoPagina
            titulo="Produtos"
            descricao={`${produtos.length} itens · ${totalDisponiveis} no cardápio${totalSemFoto > 0 ? ` · ${totalSemFoto} sem foto` : ''}`}
            acoes={
              <>
                <Botao variante="contorno" onClick={() => setSecaoOrdenacaoAberta(true)} disabled={produtos.length === 0}>
                  <ArrowsDownUp className="size-4" />
                  Organizar
                </Botao>
                <Botao onClick={abrirModalNovoProduto}>
                  <Plus className="size-4" />
                  Novo produto
                </Botao>
              </>
            }
          />

          {produtos.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative w-full min-w-0 sm:flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Entrada
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    value={buscaProdutos}
                    onChange={(evento) => setBuscaProdutos(evento.target.value)}
                    placeholder="Buscar por nome ou categoria"
                    className="h-12 pl-11 pr-12 md:h-10"
                    aria-label="Buscar produtos"
                  />
                  {buscaProdutos ? (
                    <button
                      type="button"
                      onClick={() => setBuscaProdutos('')}
                      className="absolute right-0 top-0 flex h-full w-11 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label="Limpar busca"
                    >
                      <X className="size-5" />
                    </button>
                  ) : null}
                </div>
                <FiltroProdutosAdmin
                  hasFilter={hasFiltroAvancadoProdutos}
                  categorias={categorias}
                  totais={{
                    disponiveis: totalDisponiveis,
                    ocultos: totalIndisponiveis,
                    semFoto: totalSemFoto,
                  }}
                  valor={{
                    status: filtroStatusProdutos,
                    tipo: filtroTipoProdutos,
                    foto: filtroFotoProdutos,
                    categoria: categoriaFiltroProdutos,
                  }}
                  onLimpar={limparFiltrosProdutos}
                  onChange={(proximo) => {
                    if (proximo.status !== undefined) setFiltroStatusProdutos(proximo.status)
                    if (proximo.tipo !== undefined) setFiltroTipoProdutos(proximo.tipo)
                    if (proximo.foto !== undefined) setFiltroFotoProdutos(proximo.foto)
                    if (proximo.categoria !== undefined) setCategoriaFiltroProdutos(proximo.categoria)
                  }}
                />
              </div>
              <FiltrosAtivosChips chips={chipsFiltroProdutos} onLimpar={limparFiltrosProdutos} />
            </div>
          ) : null}

          {loading && produtos.length === 0 ? (
            <ListaCarregando linhas={6} />
          ) : produtos.length === 0 ? (
            <ListaVazia
              icone={<ForkKnife />}
              titulo="Nenhum produto cadastrado"
              descricao="Cadastre o primeiro produto ou bebida do cardápio."
              acao={
                <Botao onClick={abrirModalNovoProduto}>
                  <Plus className="size-4" />
                  Novo produto
                </Botao>
              }
            />
          ) : categoriasVisiveis.length === 0 ? (
            <ListaVazia
              icone={<Search />}
              titulo="Nenhum produto encontrado"
              descricao="Tente buscar por outro nome, categoria ou situação."
              acao={
                filtrosAtivosProdutos ? (
                  <Botao variante="contorno" onClick={limparFiltrosProdutos}>
                    Limpar filtros
                  </Botao>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-6">
              {categoriasVisiveis.map((categoria) => {
                const produtosCategoria = obterProdutosDaCategoria(categoria).filter(produtoPassaNosFiltros)
                const categoriaExpandida = categoriasExpandidasProdutos.includes(categoria)
                const produtosCategoriaExibidos = categoriaExpandida
                  ? produtosCategoria
                  : produtosCategoria.slice(0, LIMITE_INICIAL_PRODUTOS_CATEGORIA)
                const totalOcultosNaCategoria = produtosCategoria.filter((produtoAtual) => !produtoAtual.disponivel).length

                return (
                  <Secao
                    key={categoria}
                    titulo={categoria}
                    descricao={`${produtosCategoria.length} ${produtosCategoria.length === 1 ? 'item' : 'itens'}${totalOcultosNaCategoria > 0 ? ` · ${totalOcultosNaCategoria} fora do cardápio` : ''}`}
                    acao={
                      <Botao
                        variante="fantasma"
                        tamanho="xs"
                        className="h-11 md:h-8"
                        onClick={() => abrirModalRenomearCategoria(categoria)}
                        disabled={salvandoCategoria}
                        carregando={salvandoCategoria && categoriaEmProcesso === categoria}
                        aria-label={`Editar categoria ${categoria}`}
                      >
                        <Pencil />
                        Categoria
                      </Botao>
                    }
                  >
                    <Lista>
                      {produtosCategoriaExibidos.map((produto) => (
                        <li key={produto.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setProdutoEmEdicaoId(produto.id)}
                            onKeyDown={(evento) => {
                              if (evento.key === 'Enter') setProdutoEmEdicaoId(produto.id)
                            }}
                            aria-label={`Editar ${produto.nome}`}
                            className={cn(
                              'flex min-h-16 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-4',
                              !produto.disponivel && 'opacity-60',
                            )}
                          >
                            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                              {produto.imagem_url ? (
                                <Image src={produto.imagem_url} alt="" fill sizes="48px" className="object-cover" />
                              ) : (
                                <div className="flex size-full items-center justify-center">
                                  <ImageIcon className="size-5 text-muted-foreground" />
                                </div>
                              )}
                              {enviandoImagem === produto.id ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                  <RefreshCw className="size-4 animate-spin" />
                                </div>
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{produto.nome}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium tabular-nums text-primary">{formatarPreco(produto.preco)}</span>
                                {produto.desconto && produto.desconto > 0 ? (
                                  <Selo tom="alerta">-{produto.desconto}%</Selo>
                                ) : null}
                                {!produto.disponivel ? <Selo>Fora do cardápio</Selo> : null}
                                {!produto.imagem_url ? <Selo>Sem foto</Selo> : null}
                                {produto.tabela === 'bebidas' ? <Selo>Bebida</Selo> : null}
                              </div>
                            </div>

                            {produto.tabela !== 'bebidas' ? (
                              <Botao
                                variante="fantasma"
                                tamanho="icone"
                                className="size-11 shrink-0 text-muted-foreground"
                                onClick={(evento) => {
                                  evento.stopPropagation()
                                  setProdutoHistoricoId(produto.id)
                                }}
                                onKeyDown={(evento) => evento.stopPropagation()}
                                aria-label={`Histórico de ${produto.nome}`}
                                title="Histórico do produto"
                              >
                                <History />
                              </Botao>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </Lista>

                    {produtosCategoria.length > LIMITE_INICIAL_PRODUTOS_CATEGORIA && (
                      <Botao
                        variante="fantasma"
                        className="h-11 w-full text-muted-foreground"
                        onClick={() => alternarCategoriaExpandida(categoria)}
                      >
                        {categoriaExpandida ? <ChevronUp /> : <ChevronDown />}
                        {categoriaExpandida
                          ? 'Mostrar menos'
                          : `Mostrar mais ${produtosCategoria.length - LIMITE_INICIAL_PRODUTOS_CATEGORIA}`}
                      </Botao>
                    )}
                  </Secao>
                )
              })}
            </div>
          )}
        </Pagina>

        {/* Input oculto para seleção de arquivo */}
        <input
          ref={inputFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={aoSelecionarArquivo}
          className="hidden"
          aria-hidden="true"
        />

        <ModalRecorteImagem
          aberto={estadoRecorte.aberto}
          imagemUrl={estadoRecorte.imagemUrl}
          onFechar={() => setEstadoRecorte(prev => ({ ...prev, aberto: false }))}
          onConfirmar={enviarImagemRecortada}
          proporcaoInicial={1}
          titulo="Ajustar foto do produto"
        />

        <ModalRecorteImagem
          aberto={recorteNovoProduto}
          imagemUrl={imagemParaRecorte}
          onFechar={() => setRecorteNovoProduto(false)}
          onConfirmar={confirmarRecorteNovoProduto}
          proporcaoInicial={1}
          titulo="Ajustar foto do produto"
        />

        <input
          ref={inputFileNovoProdutoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={selecionarImagemNovoProduto}
          className="hidden"
          aria-hidden="true"
        />

        <ModalFormularioProduto
          aberto={modalNovoProduto}
          modo="criar"
          categorias={categoriasReais}
          categoriasBebidas={categoriasBebidas}
          categoriaBebidasFallback={categoriaBebidasAtual}
          salvando={salvandoNovoProduto}
          previewImagemCriacao={imagemNovoProduto}
          onFechar={() => {
            setModalNovoProduto(false)
            setImagemNovoProduto(null)
            setBlobNovoProduto(null)
          }}
          onSalvar={salvarNovoProduto}
          onCriarCategoria={criarCategoriaNoModal}
          onSelecionarFotoCriacao={() => inputFileNovoProdutoRef.current?.click()}
        />

        <ModalFormularioProduto
          aberto={Boolean(produtoEmEdicao)}
          modo="editar"
          produto={produtoEmEdicao}
          categorias={categoriasReais}
          categoriasBebidas={categoriasBebidas}
          categoriaBebidasFallback={categoriaBebidasAtual}
          salvando={Boolean(produtoEmEdicao && salvando === produtoEmEdicao.id)}
          enviandoImagem={Boolean(produtoEmEdicao && enviandoImagem === produtoEmEdicao.id)}
          onFechar={() => setProdutoEmEdicaoId(null)}
          onSalvar={salvarEdicaoProduto}
          onCriarCategoria={criarCategoriaNoModal}
          onSelecionarFoto={() => {
            if (!produtoEmEdicao) return
            iniciarUploadImagem(produtoEmEdicao.id, produtoEmEdicao.tabela || 'produtos')
          }}
          onRecortarFoto={() => {
            if (!produtoEmEdicao) return
            abrirRecorteImagemExistente(produtoEmEdicao)
          }}
          onRemoverFoto={() => {
            if (!produtoEmEdicao) return
            void removerImagem(produtoEmEdicao.id, produtoEmEdicao.tabela || 'produtos')
          }}
          onExcluir={() => {
            if (!produtoEmEdicao) return
            const id = produtoEmEdicao.id
            const tabela = produtoEmEdicao.tabela || 'produtos'
            const nome = produtoEmEdicao.nome
            setProdutoEmEdicaoId(null)
            void excluirProduto(id, tabela, nome)
          }}
        />

        <DialogHistoricoProduto
          aberto={Boolean(produtoHistorico)}
          produto={produtoHistorico}
          onAbertoChange={(aberto) => {
            if (!aberto) setProdutoHistoricoId(null)
          }}
        />

        <Gaveta
          aberto={secaoOrdenacaoAberta}
          aoFechar={fecharGavetaOrganizar}
          largura="lg"
          bloqueada={salvandoOrdenacaoManual}
          titulo="Organizar cardápio"
          descricao="Escolha a ordem em que o cliente vê categorias e produtos."
          cabecalho={
            <div className="flex items-center gap-3">
              <Segmentos<TipoOrdenacaoProdutosSite>
                rotuloAcessivel="Ordem do cardápio"
                valor={tipoOrdenacaoSite}
                aoMudar={(valor) => void alterarModoOrdenacaoSite(valor)}
                opcoes={[
                  { valor: 'manual', rotulo: 'Do meu jeito' },
                  { valor: 'preco_crescente', rotulo: 'Mais barato primeiro' },
                  { valor: 'preco_decrescente', rotulo: 'Mais caro primeiro' },
                ]}
              />
              {salvandoConfiguracaoOrdenacao ? (
                <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Salvando" />
              ) : null}
            </div>
          }
          rodape={
            tipoOrdenacaoSite === 'manual' ? (
              <>
                <Botao variante="contorno" onClick={fecharGavetaOrganizar} disabled={salvandoOrdenacaoManual}>
                  Fechar
                </Botao>
                <Botao
                  onClick={() => void salvarOrdenacaoManual()}
                  disabled={!possuiMudancasNaOrdenacaoManual}
                  carregando={salvandoOrdenacaoManual}
                >
                  Salvar ordem
                </Botao>
              </>
            ) : (
              <Botao variante="contorno" onClick={fecharGavetaOrganizar}>
                Fechar
              </Botao>
            )
          }
        >
          {tipoOrdenacaoSite === 'manual' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Segure a alça <GripVertical className="inline size-4 align-text-bottom" /> e arraste. Nada muda no site até você tocar em Salvar ordem.
              </p>
              <Reorder.Group axis="y" values={categorias} onReorder={aoReordenarCategorias} className="space-y-3">
                {categorias.map((categoria) => (
                  <CategoriaOrdenavel
                    key={categoria}
                    categoria={categoria}
                    idsProdutos={obterIdsOrdenadosDaCategoria(categoria)}
                    produtosPorId={produtosPorId}
                    aoReordenarProdutos={(novaOrdemIds) => aoReordenarProdutosDaCategoria(categoria, novaOrdemIds)}
                  />
                ))}
              </Reorder.Group>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tipoOrdenacaoSite === 'preco_crescente'
                ? 'O cardápio mostra os produtos do mais barato para o mais caro em cada categoria.'
                : 'O cardápio mostra os produtos do mais caro para o mais barato em cada categoria.'}{' '}
              Para arrastar na ordem que quiser, escolha &quot;Do meu jeito&quot;.
            </p>
          )}
        </Gaveta>

        <Gaveta
          aberto={modalRenomearCategoria.aberto}
          aoFechar={fecharModalRenomearCategoria}
          bloqueada={salvandoCategoria}
          titulo="Editar categoria"
          descricao="Os produtos continuam nela com o novo nome."
          rodape={
            <>
              <Botao
                variante="perigoSuave"
                className="md:mr-auto"
                disabled={salvandoCategoria}
                onClick={() => {
                  const categoria = modalRenomearCategoria.categoriaAtual
                  fecharModalRenomearCategoria()
                  excluirCategoriaSemApagarProdutos(categoria)
                }}
              >
                Excluir
              </Botao>
              <Botao carregando={salvandoCategoria} onClick={() => void salvarRenomeacaoCategoria()}>
                Salvar
              </Botao>
            </>
          }
        >
          <form
            onSubmit={(evento) => {
              evento.preventDefault()
              void salvarRenomeacaoCategoria()
            }}
          >
            <Campo rotulo="Nome da categoria" htmlFor="renomear-categoria" ajuda={`Nome atual: ${modalRenomearCategoria.categoriaAtual}`}>
              <Entrada
                id="renomear-categoria"
                value={modalRenomearCategoria.novoNome}
                onChange={(evento) =>
                  setModalRenomearCategoria((estadoAtual) => ({ ...estadoAtual, novoNome: evento.target.value }))
                }
                placeholder="Ex.: Lanches"
                autoComplete="off"
              />
            </Campo>
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </Gaveta>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function AlcaArrasto({ controles, rotulo }: { controles: DragControls; rotulo: string }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onPointerDown={(evento) => controles.start(evento)}
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-accent active:cursor-grabbing"
    >
      <GripVertical className="size-5" />
    </button>
  )
}

function ProdutoOrdenavel({ produto }: { produto: Produto }) {
  const controles = useDragControls()
  return (
    <Reorder.Item
      value={produto.id}
      as="li"
      dragListener={false}
      dragControls={controles}
      className="flex items-center gap-1 bg-card pr-3"
    >
      <AlcaArrasto controles={controles} rotulo={`Arrastar ${produto.nome}`} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{produto.nome}</span>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatarPreco(produto.preco)}</span>
    </Reorder.Item>
  )
}

function CategoriaOrdenavel({
  categoria,
  idsProdutos,
  produtosPorId,
  aoReordenarProdutos,
}: {
  categoria: string
  idsProdutos: string[]
  produtosPorId: Map<string, Produto>
  aoReordenarProdutos: (ids: string[]) => void
}) {
  const controles = useDragControls()
  return (
    <Reorder.Item value={categoria} as="div" dragListener={false} dragControls={controles}>
      <Cartao className="overflow-hidden">
        <div className="flex items-center gap-1 border-b border-border/70 pr-3">
          <AlcaArrasto controles={controles} rotulo={`Arrastar categoria ${categoria}`} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{categoria}</span>
          <Selo>{idsProdutos.length}</Selo>
        </div>
        <Reorder.Group
          axis="y"
          as="ul"
          values={idsProdutos}
          onReorder={aoReordenarProdutos}
          className="divide-y divide-border/70"
        >
          {idsProdutos.map((idProduto) => {
            const produtoAtual = produtosPorId.get(idProduto)
            if (!produtoAtual || produtoAtual.categoria !== categoria) return null
            return <ProdutoOrdenavel key={idProduto} produto={produtoAtual} />
          })}
        </Reorder.Group>
      </Cartao>
    </Reorder.Item>
  )
}
