'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, Reorder } from 'framer-motion'
import {
  RefreshCw,
  Pencil,
  Trash2,
  ImageIcon,
  Plus,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Tag,
  GripVertical,
  Search,
  History,
} from 'lucide-react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    onConfirmar?: () => void
  }>({
    aberto: false,
    tipo: 'info',
    titulo: '',
    mensagem: ''
  })

  useEffect(() => {
    if (!modalNotificacao.aberto || modalNotificacao.tipo === 'confirmacao') return

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
  }, [modalNotificacao.aberto, modalNotificacao.mensagem, modalNotificacao.tipo, modalNotificacao.titulo])

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
      titulo: 'Excluir Categoria',
      mensagem: `Excluir "${categoria}"? Os produtos serão movidos para "${categoriaDestino}" (nenhum produto será apagado).`,
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
      titulo: 'Confirmar Exclusão',
      mensagem: `Tem certeza que deseja excluir "${nome}"? Esta ação não pode ser desfeita.`,
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
      if (typeof quantidadeAlvo === 'number') {
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
  const termoBuscaProdutos = buscaProdutos.trim().toLowerCase()
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
        produto.disponivel ? 'ativo disponivel disponível' : 'oculto indisponivel indisponível',
      ].join(' ').toLowerCase()

      return textoProduto.includes(termoBuscaProdutos)
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
  const descricaoTipoOrdenacao =
    tipoOrdenacaoSite === 'manual'
      ? 'Manual'
      : tipoOrdenacaoSite === 'preco_crescente'
        ? 'Preço crescente'
        : 'Preço decrescente'
  const totalDisponiveis = produtos.filter((produtoAtual) => produtoAtual.disponivel).length
  const totalIndisponiveis = produtos.length - totalDisponiveis
  const totalProdutosFiltrados = produtos.filter(produtoPassaNosFiltros).length
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
    chipsFiltroProdutos.push({ key: 'busca', label: 'Busca', value: termoBuscaProdutos })
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

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="max-w-full space-y-5 overflow-x-hidden">
          <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Produtos</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Catálogo do cardápio · {totalProdutosFiltrados} visíveis nesta lista
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-4 md:gap-6">
              <div className="min-w-[70px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Total</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{produtos.length}</p>
              </div>
              <div className="min-w-[70px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ativos</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{totalDisponiveis}</p>
              </div>
              <div className="min-w-[70px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Sem foto</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{totalSemFoto}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shadow-none"
                onClick={() => carregarProdutos(true)}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button type="button" size="sm" className="h-9 shadow-none" onClick={abrirModalNovoProduto}>
                <Plus className="mr-2 h-4 w-4" />
                Novo
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={buscaProdutos}
                  onChange={(evento) => setBuscaProdutos(evento.target.value)}
                  placeholder="Pesquisar produtos..."
                  className="h-9 border-border/70 bg-background pl-9 pr-9 shadow-none"
                  aria-label="Buscar produtos"
                />
                {buscaProdutos ? (
                  <button
                    type="button"
                    onClick={() => setBuscaProdutos('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
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
            <FiltrosAtivosChips
              chips={chipsFiltroProdutos}
              onLimpar={limparFiltrosProdutos}
              className="mb-1"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-medium text-foreground/90">Ordenação do cardápio</p>
                <p className="text-sm text-muted-foreground">Modo atual: {descricaoTipoOrdenacao}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Select
                  value={tipoOrdenacaoSite}
                  onValueChange={(valor) => alterarModoOrdenacaoSite(valor as TipoOrdenacaoProdutosSite)}
                  disabled={salvandoConfiguracaoOrdenacao}
                >
                  <SelectTrigger className="h-9 w-full border-border/70 shadow-none sm:w-[190px]">
                    <SelectValue placeholder="Modo de ordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="preco_crescente">Preço crescente</SelectItem>
                    <SelectItem value="preco_decrescente">Preço decrescente</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSecaoOrdenacaoAberta((estadoAtual) => !estadoAtual)}
                  className="h-9 gap-2 shadow-none"
                >
                  {secaoOrdenacaoAberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {secaoOrdenacaoAberta ? 'Ocultar' : 'Detalhar'}
                </Button>
                {salvandoConfiguracaoOrdenacao ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>

            {secaoOrdenacaoAberta && tipoOrdenacaoSite === 'manual' ? (
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-2 bg-card/95 px-1 py-2 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Arraste categorias e produtos para ajustar a ordem exibida no cliente.
                  </p>
                  <Button
                    size="sm"
                    onClick={salvarOrdenacaoManual}
                    disabled={!possuiMudancasNaOrdenacaoManual || salvandoOrdenacaoManual}
                    className="h-10 w-full gap-2 shadow-none sm:h-9 sm:w-auto"
                  >
                    {salvandoOrdenacaoManual ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar ordem
                  </Button>
                </div>

                <Reorder.Group
                  axis="y"
                  values={categorias}
                  onReorder={aoReordenarCategorias}
                  className="grid max-h-[min(60dvh,520px)] gap-2 overflow-y-auto overscroll-contain pr-0.5 lg:grid-cols-2 lg:max-h-none lg:overflow-visible"
                >
                  {categorias.map((categoria) => (
                    <Reorder.Item
                      key={categoria}
                      value={categoria}
                      as="div"
                      className="touch-none rounded-xl border border-border/70 bg-muted/20 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{categoria}</span>
                        <Badge variant="secondary" className="shrink-0">
                          {obterProdutosDaCategoria(categoria).length}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(evento) => {
                            evento.stopPropagation()
                            abrirModalRenomearCategoria(categoria)
                          }}
                          onPointerDown={(evento) => evento.stopPropagation()}
                          disabled={salvandoCategoria}
                          className="size-8"
                          title="Renomear categoria"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(evento) => {
                            evento.stopPropagation()
                            excluirCategoriaSemApagarProdutos(categoria)
                          }}
                          onPointerDown={(evento) => evento.stopPropagation()}
                          disabled={salvandoCategoria}
                          className="size-8 text-destructive hover:text-destructive"
                          title="Excluir categoria"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Reorder.Group
                        axis="y"
                        values={obterIdsOrdenadosDaCategoria(categoria)}
                        onReorder={(novaOrdemIds) => aoReordenarProdutosDaCategoria(categoria, novaOrdemIds)}
                        className="mt-2 max-h-44 space-y-1 overflow-y-auto overscroll-contain"
                      >
                        {obterIdsOrdenadosDaCategoria(categoria).map((idProduto) => {
                          const produtoAtual = produtosPorId.get(idProduto)
                          if (!produtoAtual || produtoAtual.categoria !== categoria) return null

                          return (
                            <Reorder.Item
                              key={idProduto}
                              value={idProduto}
                              as="div"
                              className="touch-none cursor-grab rounded-md bg-background/80 px-2.5 py-1.5 active:cursor-grabbing"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate text-xs font-medium">{produtoAtual.nome}</span>
                                </div>
                                <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums">
                                  R$ {Number(produtoAtual.preco).toFixed(2)}
                                </span>
                              </div>
                            </Reorder.Item>
                          )
                        })}
                      </Reorder.Group>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            ) : null}
          </div>

          {loading && produtos.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-xl border border-border/70 bg-card">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {categoriasVisiveis.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-card p-6 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">Nenhum produto encontrado</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Tente buscar por outro nome, categoria ou status.
                  </p>
                  {filtrosAtivosProdutos ? (
                    <Button type="button" variant="outline" size="sm" className="shadow-none" onClick={limparFiltrosProdutos}>
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>
              ) : categoriasVisiveis.map((categoria) => {
                const produtosCategoria = obterProdutosDaCategoria(categoria).filter(produtoPassaNosFiltros)
                const categoriaExpandida = categoriasExpandidasProdutos.includes(categoria)
                const produtosCategoriaExibidos = categoriaExpandida
                  ? produtosCategoria
                  : produtosCategoria.slice(0, LIMITE_INICIAL_PRODUTOS_CATEGORIA)
                const totalOcultosNaCategoria = produtosCategoria.filter((produtoAtual) => !produtoAtual.disponivel).length
                const totalSemFotoNaCategoria = produtosCategoria.filter((produtoAtual) => !produtoAtual.imagem_url).length

                return (
                  <Card key={categoria} className="min-w-0 overflow-hidden border-border/70 shadow-none">
                    <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/50 p-3.5 sm:p-4">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-medium">{categoria}</CardTitle>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {produtosCategoria.length} itens
                          {totalOcultosNaCategoria > 0 ? ` · ${totalOcultosNaCategoria} ocultos` : ''}
                          {totalSemFotoNaCategoria > 0 ? ` · ${totalSemFotoNaCategoria} sem foto` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => abrirModalRenomearCategoria(categoria)}
                          disabled={salvandoCategoria}
                          className="size-9 shadow-none"
                          title="Renomear categoria"
                        >
                          {salvandoCategoria && categoriaEmProcesso === categoria ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => excluirCategoriaSemApagarProdutos(categoria)}
                          disabled={salvandoCategoria}
                          className="size-9 text-destructive hover:text-destructive"
                          title="Excluir categoria"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="grid min-w-0 gap-2 p-3 pt-0 sm:gap-3 sm:p-4 sm:pt-0 md:grid-cols-2 xl:grid-cols-3">
                      {produtosCategoriaExibidos.map((produto) => (
                          <motion.div
                            key={produto.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 sm:p-3"
                          >
                            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-16">
                              {produto.imagem_url ? (
                                <Image src={produto.imagem_url} alt={produto.nome} fill className="object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              {enviandoImagem === produto.id ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                </div>
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-semibold leading-snug">{produto.nome}</h3>
                              <p className="font-mono text-base font-semibold tabular-nums">
                                R$ {produto.preco.toFixed(2)}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge
                                  variant={produto.disponivel ? 'success' : 'secondary'}
                                  className={produto.disponivel ? 'shrink-0' : 'shrink-0 text-muted-foreground'}
                                >
                                  {produto.disponivel ? 'Ativo' : 'Oculto'}
                                </Badge>
                                {produto.desconto && produto.desconto > 0 ? (
                                  <Badge variant="warning" className="shrink-0">-{produto.desconto}%</Badge>
                                ) : null}
                                {!produto.imagem_url ? (
                                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                                    sem foto
                                  </Badge>
                                ) : null}
                                <Badge variant="outline" className="gap-1">
                                  <Tag className="h-3 w-3" />
                                  <span className="max-w-[7rem] truncate">
                                    {produto.tabela === 'bebidas' ? 'Bebida' : produto.categoria}
                                  </span>
                                </Badge>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              {produto.tabela !== 'bebidas' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => setProdutoHistoricoId(produto.id)}
                                      className="size-9 shadow-none"
                                      aria-label={`Histórico de ${produto.nome}`}
                                    >
                                      <History className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Histórico do produto</TooltipContent>
                                </Tooltip>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setProdutoEmEdicaoId(produto.id)}
                                className="h-9 gap-1.5 shadow-none"
                                aria-label={`Editar ${produto.nome}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Editar</span>
                              </Button>
                            </div>
                          </motion.div>
                        ))}

                      {produtosCategoria.length > LIMITE_INICIAL_PRODUTOS_CATEGORIA && (
                        <div className="md:col-span-2 xl:col-span-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => alternarCategoriaExpandida(categoria)}
                            className="w-full gap-2"
                          >
                            {categoriaExpandida ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {categoriaExpandida
                              ? 'Mostrar menos'
                              : `Mostrar mais ${produtosCategoria.length - LIMITE_INICIAL_PRODUTOS_CATEGORIA}`}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Input oculto para seleção de arquivo */}
        <input
          ref={inputFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={aoSelecionarArquivo}
          className="hidden"
          aria-hidden="true"
        />

        {/* Modal de recorte de imagem */}
        <ModalRecorteImagem
          aberto={estadoRecorte.aberto}
          imagemUrl={estadoRecorte.imagemUrl}
          onFechar={() => setEstadoRecorte(prev => ({ ...prev, aberto: false }))}
          onConfirmar={enviarImagemRecortada}
          proporcaoInicial={1}
          titulo="Ajustar Imagem do Produto"
        />

        {/* Modal de recorte para novo produto */}
        <ModalRecorteImagem
          aberto={recorteNovoProduto}
          imagemUrl={imagemParaRecorte}
          onFechar={() => setRecorteNovoProduto(false)}
          onConfirmar={confirmarRecorteNovoProduto}
          proporcaoInicial={1}
          titulo="Ajustar Imagem do Novo Produto"
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

        <Dialog open={modalRenomearCategoria.aberto} onOpenChange={(aberto) => {
          if (!aberto) fecharModalRenomearCategoria()
        }}>
          <DialogContent className="flex max-h-[92dvh] max-w-md flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 pr-12 text-left">
              <DialogTitle className="text-[15px] font-semibold tracking-tight">Renomear categoria</DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                Atualize o nome da categoria sem apagar os produtos vinculados.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                Atual: <span className="font-semibold">{modalRenomearCategoria.categoriaAtual}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="renomear-categoria">Novo nome</Label>
                <Input
                  id="renomear-categoria"
                  value={modalRenomearCategoria.novoNome}
                  onChange={(evento) =>
                    setModalRenomearCategoria((estadoAtual) => ({ ...estadoAtual, novoNome: evento.target.value }))
                  }
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') {
                      evento.preventDefault()
                      salvarRenomeacaoCategoria()
                    }
                  }}
                  placeholder="Novo nome da categoria"
                  className="h-11 border-border/70 shadow-none"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
              <Button
                variant="outline"
                className="h-11 w-full shadow-none sm:w-auto"
                onClick={fecharModalRenomearCategoria}
                disabled={salvandoCategoria}
              >
                Cancelar
              </Button>
              <Button
                className="h-11 w-full gap-2 shadow-none sm:w-auto"
                onClick={salvarRenomeacaoCategoria}
                disabled={salvandoCategoria}
              >
                {salvandoCategoria ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={modalNotificacao.aberto && modalNotificacao.tipo === 'confirmacao'}
          onOpenChange={(aberto) => {
            if (!aberto) {
              setModalNotificacao((estadoAtual) => ({ ...estadoAtual, aberto: false }))
            }
          }}
        >
          <AlertDialogContent className="rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{modalNotificacao.titulo}</AlertDialogTitle>
              <AlertDialogDescription>{modalNotificacao.mensagem}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const confirmar = modalNotificacao.onConfirmar
                  setModalNotificacao((estadoAtual) => ({ ...estadoAtual, aberto: false }))
                  confirmar?.()
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}
