'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RefreshCw,
  Plus,
  Camera,
  Crop,
  Trash2,
  ImageOff,
  X,
  Tag,
  Filter,
  Package,
  Check,
  ListPlus,
  Search,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalRecorteImagem from '@/components/admin/ModalRecorteImagem'
import { supabase } from '@/lib/supabase'
import { validarArquivoImagem, arquivoParaUrl } from '@/lib/recorteImagem'
import { enviarImagemParaR2 } from '@/lib/servicoUploadImagem'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'

type Adicional = {
  id: string
  nome: string
  preco: number
  imagem_url?: string | null
  disponivel: boolean
  categoria?: string | null
}

type ProdutoSimples = {
  id: string
  nome: string
  categoria: string
}

type CategoriaAdicional = {
  id?: string
  nome: string
}

type EstadoRecorte = {
  aberto: boolean
  imagemUrl: string
  adicionalId: string | null
}

type ConfirmacaoExclusao =
  | { tipo: 'adicional'; id: string; nome: string }
  | { tipo: 'categoria'; nome: string }
  | null

const normalizarCategorias = (categorias: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      categorias
        .map((c) => c?.trim())
        .filter((c): c is string => Boolean(c)),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

const extrairCategoriasDosAdicionais = (lista: Adicional[]) =>
  normalizarCategorias(lista.map((a) => a.categoria))

export default function AdicionaisPage() {
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<string[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [modalCategorias, setModalCategorias] = useState(false)
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')

  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [novoAdicional, setNovoAdicional] = useState({ nome: '', preco: '', categoria: '' })
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [criandoCategoriaNoNovo, setCriandoCategoriaNoNovo] = useState(false)
  const [nomeNovaCategoriaNoNovo, setNomeNovaCategoriaNoNovo] = useState('')
  const [produtosSelecionadosNovo, setProdutosSelecionadosNovo] = useState<string[]>([])
  const [buscaProdutoNovo, setBuscaProdutoNovo] = useState('')

  const [todosProdutos, setTodosProdutos] = useState<ProdutoSimples[]>([])
  const [produtosVinculados, setProdutosVinculados] = useState<Record<string, string[]>>({})
  const [modalProdutosAberto, setModalProdutosAberto] = useState<string | null>(null)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [salvandoProdutos, setSalvandoProdutos] = useState(false)
  const [produtosSelecionadosTemp, setProdutosSelecionadosTemp] = useState<string[]>([])

  const [estadoRecorte, setEstadoRecorte] = useState<EstadoRecorte>({
    aberto: false,
    imagemUrl: '',
    adicionalId: null,
  })
  const [enviandoImagem, setEnviandoImagem] = useState<string | null>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [adicionalSelecionadoParaUpload, setAdicionalSelecionadoParaUpload] = useState<string | null>(null)

  const [confirmacao, setConfirmacao] = useState<ConfirmacaoExclusao>(null)

  const carregarAdicionais = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: listaAdicionais, error: erroAdicionais },
        { data: listaCategorias, error: erroCategorias },
        { data: listaProdutos, error: erroProdutos },
        { data: listaVinculos, error: erroVinculos },
      ] = await Promise.all([
        supabase.from('adicionais').select('*').order('nome', { ascending: true }),
        supabase.from('categorias_adicionais').select('nome').order('nome', { ascending: true }),
        supabase.from('produtos').select('id, nome, categoria').eq('disponivel', true).order('nome', { ascending: true }),
        supabase.from('produto_adicionais').select('produto_id, adicional_id'),
      ])

      if (erroAdicionais) throw erroAdicionais
      if (erroCategorias) throw erroCategorias

      const lista = (listaAdicionais || []) as Adicional[]
      setAdicionais(lista)

      if (!erroProdutos) setTodosProdutos((listaProdutos || []) as ProdutoSimples[])

      if (!erroVinculos && listaVinculos) {
        const mapa: Record<string, string[]> = {}
        for (const v of listaVinculos as Array<{ adicional_id: string; produto_id: string }>) {
          if (!mapa[v.adicional_id]) mapa[v.adicional_id] = []
          mapa[v.adicional_id].push(v.produto_id)
        }
        setProdutosVinculados(mapa)
      }

      const categoriasBanco = normalizarCategorias(
        ((listaCategorias || []) as CategoriaAdicional[]).map((c) => c.nome),
      )
      const categoriasDosAdicionais = extrairCategoriasDosAdicionais(lista)
      setCategorias(normalizarCategorias([...categoriasBanco, ...categoriasDosAdicionais]))
    } catch (erro) {
      console.error('Erro ao carregar adicionais:', erro)
      toast.error('Não foi possível carregar os adicionais.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarAdicionais()

    const channelAdicionais = supabase
      .channel('admin-adicionais-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adicionais' }, () => {
        carregarAdicionais()
      })
      .subscribe()

    const channelCategorias = supabase
      .channel('admin-categorias-adicionais-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias_adicionais' }, () => {
        carregarAdicionais()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelAdicionais)
      supabase.removeChannel(channelCategorias)
    }
  }, [carregarAdicionais])

  const adicionaisPorCategoria =
    filtroCategoria === 'todas'
      ? adicionais
      : filtroCategoria === 'sem-categoria'
        ? adicionais.filter((a) => !a.categoria)
        : adicionais.filter((a) => a.categoria === filtroCategoria)

  const termoBusca = busca.trim().toLowerCase()
  const adicionaisFiltrados = termoBusca
    ? adicionaisPorCategoria.filter((a) => a.nome.toLowerCase().includes(termoBusca))
    : adicionaisPorCategoria

  const resetarFormularioNovoAdicional = () => {
    setNovoAdicional({ nome: '', preco: '', categoria: '' })
    setCriandoCategoriaNoNovo(false)
    setNomeNovaCategoriaNoNovo('')
    setProdutosSelecionadosNovo([])
    setBuscaProdutoNovo('')
  }

  const criarCategoria = async () => {
    const nome = novaCategoria.trim()
    if (!nome) return
    if (categorias.some((c) => c.toLowerCase() === nome.toLowerCase())) {
      toast.warning(`Categoria "${nome}" já existe.`)
      return
    }

    try {
      const { error } = await supabase.from('categorias_adicionais').insert({ nome })
      if (error) throw error

      await carregarAdicionais()
      setNovaCategoria('')
      setCriandoCategoria(false)
      toast.success(`Categoria "${nome}" criada.`)
    } catch (erro) {
      console.error('Erro ao criar categoria:', erro)
      toast.error('Não foi possível criar a categoria.')
    }
  }

  const criarCategoriaNoModalNovoAdicional = async () => {
    const nome = nomeNovaCategoriaNoNovo.trim()
    if (!nome) return

    const existente = categorias.find((c) => c.toLowerCase() === nome.toLowerCase())
    if (existente) {
      setNovoAdicional((s) => ({ ...s, categoria: existente }))
      setCriandoCategoriaNoNovo(false)
      setNomeNovaCategoriaNoNovo('')
      return
    }

    try {
      const { error } = await supabase.from('categorias_adicionais').insert({ nome })
      if (error) throw error

      await carregarAdicionais()
      setNovoAdicional((s) => ({ ...s, categoria: nome }))
      setCriandoCategoriaNoNovo(false)
      setNomeNovaCategoriaNoNovo('')
      toast.success(`Categoria "${nome}" criada.`)
    } catch (erro) {
      console.error('Erro ao criar categoria no modal:', erro)
      toast.error('Não foi possível criar a categoria.')
    }
  }

  const abrirModalProdutos = (adicionalId: string) => {
    setProdutosSelecionadosTemp(produtosVinculados[adicionalId] || [])
    setBuscaProduto('')
    setModalProdutosAberto(adicionalId)
  }

  const salvarVinculosProdutos = async () => {
    if (!modalProdutosAberto) return
    setSalvandoProdutos(true)
    try {
      await supabase.from('produto_adicionais').delete().eq('adicional_id', modalProdutosAberto)

      if (produtosSelecionadosTemp.length > 0) {
        const registros = produtosSelecionadosTemp.map((produtoId) => ({
          produto_id: produtoId,
          adicional_id: modalProdutosAberto,
        }))
        const { error } = await supabase.from('produto_adicionais').insert(registros)
        if (error) throw error
      }

      setProdutosVinculados((prev) => ({
        ...prev,
        [modalProdutosAberto]: [...produtosSelecionadosTemp],
      }))

      setModalProdutosAberto(null)
      toast.success(
        produtosSelecionadosTemp.length === 0
          ? 'Adicional disponível para todos os produtos.'
          : `Adicional vinculado a ${produtosSelecionadosTemp.length} produto(s).`,
      )
    } catch (erro) {
      console.error('Erro ao salvar vínculos:', erro)
      toast.error('Não foi possível salvar os vínculos.')
    } finally {
      setSalvandoProdutos(false)
    }
  }

  const atualizarAdicional = async (id: string, campo: string, valor: unknown) => {
    let valorNormalizado: unknown = valor

    if (campo === 'preco') {
      const precoInformado = typeof valor === 'number' ? valor : Number(valor)
      if (!Number.isFinite(precoInformado) || precoInformado < 0) return
      valorNormalizado = precoInformado
    }

    if (campo === 'categoria') {
      const cat = typeof valor === 'string' ? valor.trim() : ''
      if (cat && !categorias.includes(cat)) {
        toast.error('Categoria inválida. Atualize a tela e tente novamente.')
        return
      }
      valorNormalizado = cat || null
    }

    setSalvando(id)
    try {
      const { error } = await supabase
        .from('adicionais')
        .update({ [campo]: valorNormalizado })
        .eq('id', id)
      if (error) throw error

      setAdicionais((lista) =>
        lista.map((a) => (a.id === id ? { ...a, [campo]: valorNormalizado as never } : a)),
      )
    } catch (erro) {
      console.error('Erro ao atualizar adicional:', erro)
      toast.error('Não foi possível atualizar o adicional.')
    } finally {
      setSalvando(null)
    }
  }

  const iniciarUploadImagem = useCallback((adicionalId: string) => {
    setAdicionalSelecionadoParaUpload(adicionalId)
    inputFileRef.current?.click()
  }, [])

  const aoSelecionarArquivo = useCallback(
    async (evento: React.ChangeEvent<HTMLInputElement>) => {
      const arquivo = evento.target.files?.[0]
      if (!arquivo || !adicionalSelecionadoParaUpload) return

      const validacao = validarArquivoImagem(arquivo)
      if (!validacao.valido) {
        toast.error(validacao.erro || 'Arquivo inválido.')
        evento.target.value = ''
        return
      }

      try {
        const urlImagem = await arquivoParaUrl(arquivo)
        setEstadoRecorte({ aberto: true, imagemUrl: urlImagem, adicionalId: adicionalSelecionadoParaUpload })
      } catch (erro) {
        console.error('Erro ao ler arquivo:', erro)
        toast.error('Não foi possível ler o arquivo.')
      }
      evento.target.value = ''
    },
    [adicionalSelecionadoParaUpload],
  )

  const abrirRecorteImagemExistente = useCallback((adicional: Adicional) => {
    if (!adicional.imagem_url) return
    setEstadoRecorte({ aberto: true, imagemUrl: adicional.imagem_url, adicionalId: adicional.id })
  }, [])

  const enviarImagemRecortada = useCallback(
    async (_base64: string, blob: Blob) => {
      if (!estadoRecorte.adicionalId) return
      const adicionalId = estadoRecorte.adicionalId

      setEnviandoImagem(adicionalId)
      setEstadoRecorte((prev) => ({ ...prev, aberto: false }))

      try {
        const resultado = await enviarImagemParaR2(blob, 'adicionais', adicionalId)
        if (!resultado.sucesso || !resultado.url) {
          throw new Error(resultado.erro || 'Falha no upload')
        }

        const novaUrlImagem = resultado.url
        const { error } = await supabase
          .from('adicionais')
          .update({ imagem_url: novaUrlImagem })
          .eq('id', adicionalId)
        if (error) throw error

        setAdicionais((prev) =>
          prev.map((a) => (a.id === adicionalId ? { ...a, imagem_url: novaUrlImagem } : a)),
        )
        toast.success('Imagem atualizada.')
      } catch (erro) {
        console.error('Erro ao enviar imagem:', erro)
        toast.error(erro instanceof Error ? erro.message : 'Não foi possível enviar a imagem.')
      } finally {
        setEnviandoImagem(null)
      }
    },
    [estadoRecorte.adicionalId],
  )

  const criarAdicional = async () => {
    if (!novoAdicional.nome.trim()) {
      toast.error('Informe o nome do adicional.')
      return
    }
    const preco = parseFloat(novoAdicional.preco)
    if (!Number.isFinite(preco) || preco <= 0) {
      toast.error('Informe um preço válido.')
      return
    }
    if (novoAdicional.categoria && !categorias.includes(novoAdicional.categoria)) {
      toast.error('Categoria inválida.')
      return
    }

    setSalvandoNovo(true)
    try {
      const { data: novoRegistro, error } = await supabase
        .from('adicionais')
        .insert({
          nome: novoAdicional.nome.trim(),
          preco,
          categoria: novoAdicional.categoria || null,
          disponivel: true,
        })
        .select('id')
        .single()
      if (error) throw error

      if (novoRegistro && produtosSelecionadosNovo.length > 0) {
        const registros = produtosSelecionadosNovo.map((produtoId) => ({
          produto_id: produtoId,
          adicional_id: novoRegistro.id,
        }))
        await supabase.from('produto_adicionais').insert(registros)
      }

      setModalNovoAberto(false)
      resetarFormularioNovoAdicional()
      await carregarAdicionais()
      toast.success(`"${novoAdicional.nome.trim()}" foi criado.`)
    } catch (erro: unknown) {
      console.error('Erro ao criar adicional:', erro)
      const code = (erro as { code?: string })?.code
      const msg = (erro as { message?: string })?.message
      const erroFK = code === '23503' && typeof msg === 'string' && msg.includes('adicionais_categoria_fkey')
      toast.error(erroFK ? 'Categoria inválida. Atualize e tente novamente.' : 'Não foi possível criar o adicional.')
    } finally {
      setSalvandoNovo(false)
    }
  }

  const confirmarExclusaoAdicional = async () => {
    if (!confirmacao || confirmacao.tipo !== 'adicional') return
    const { id, nome } = confirmacao
    setConfirmacao(null)
    setSalvando(id)
    try {
      const { error } = await supabase.from('adicionais').delete().eq('id', id)
      if (error) throw error
      setAdicionais((prev) => prev.filter((a) => a.id !== id))
      toast.success(`"${nome}" foi excluído.`)
    } catch (erro) {
      console.error('Erro ao excluir adicional:', erro)
      toast.error('Não foi possível excluir o adicional.')
    } finally {
      setSalvando(null)
    }
  }

  const confirmarExclusaoCategoria = async () => {
    if (!confirmacao || confirmacao.tipo !== 'categoria') return
    const { nome } = confirmacao
    setConfirmacao(null)
    try {
      const { error: erroAdicionais } = await supabase
        .from('adicionais')
        .update({ categoria: null })
        .eq('categoria', nome)
      if (erroAdicionais) throw erroAdicionais

      const { error: erroCategoria } = await supabase
        .from('categorias_adicionais')
        .delete()
        .eq('nome', nome)
      if (erroCategoria) throw erroCategoria

      await carregarAdicionais()
      if (filtroCategoria === nome) setFiltroCategoria('todas')
      toast.success(`Categoria "${nome}" removida.`)
    } catch (erro) {
      console.error('Erro ao excluir categoria:', erro)
      toast.error('Não foi possível excluir a categoria.')
    }
  }

  const removerImagem = useCallback(async (adicionalId: string) => {
    setSalvando(adicionalId)
    try {
      const { error } = await supabase
        .from('adicionais')
        .update({ imagem_url: null })
        .eq('id', adicionalId)
      if (error) throw error

      setAdicionais((prev) =>
        prev.map((a) => (a.id === adicionalId ? { ...a, imagem_url: null } : a)),
      )
      toast.success('Imagem removida.')
    } catch (erro) {
      console.error('Erro ao remover imagem:', erro)
      toast.error('Não foi possível remover a imagem.')
    } finally {
      setSalvando(null)
    }
  }, [])

  const itensAcaoAdicional = (adicional: Adicional): MenuAcaoItem[] => {
    const qtdVinculos = produtosVinculados[adicional.id]?.length || 0
    const itens: MenuAcaoItem[] = [
      {
        key: 'vincular',
        label: qtdVinculos > 0 ? `Vincular produtos (${qtdVinculos})` : 'Vincular produtos (todos)',
        icon: <Package strokeWidth={1.6} className="size-3.5" />,
        onSelect: () => abrirModalProdutos(adicional.id),
      },
    ]

    if (adicional.imagem_url) {
      itens.push(
        {
          key: 'crop',
          label: 'Recortar imagem',
          icon: <Crop strokeWidth={1.6} className="size-3.5" />,
          onSelect: () => abrirRecorteImagemExistente(adicional),
        },
        {
          key: 'remover-img',
          label: 'Remover imagem',
          icon: <ImageOff strokeWidth={1.6} className="size-3.5" />,
          onSelect: () => {
            void removerImagem(adicional.id)
          },
        },
      )
    }

    itens.push({
      key: 'excluir',
      label: 'Excluir',
      icon: <Trash2 strokeWidth={1.6} className="size-3.5" />,
      separatorBefore: true,
      variant: 'destructive',
      onSelect: () => setConfirmacao({ tipo: 'adicional', id: adicional.id, nome: adicional.nome }),
    })

    return itens
  }

  const produtosNovoFiltrados = todosProdutos.filter(
    (p) => !buscaProdutoNovo || p.nome.toLowerCase().includes(buscaProdutoNovo.toLowerCase()),
  )

  const produtosVincularFiltrados = todosProdutos.filter(
    (p) => !buscaProduto || p.nome.toLowerCase().includes(buscaProduto.toLowerCase()),
  )

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                <ListPlus className="size-5 text-primary" strokeWidth={1.6} />
                Adicionais
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Nomes, preços e disponibilidade · {adicionais.length} cadastrado
                {adicionais.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shadow-none"
                onClick={carregarAdicionais}
                disabled={loading}
              >
                <RefreshCw strokeWidth={1.6} className={cn('size-4', loading && 'animate-spin')} />
                Atualizar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 shadow-none"
                onClick={() => {
                  resetarFormularioNovoAdicional()
                  setModalNovoAberto(true)
                }}
              >
                <Plus strokeWidth={1.6} className="size-4" />
                Novo
              </Button>
            </div>
          </div>

          {!loading && (
            <div className="space-y-3">
              <div className="relative min-w-0 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.6} />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome…"
                  className="h-9 border-border/70 bg-background pl-9 shadow-none"
                  aria-label="Buscar adicional por nome"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter strokeWidth={1.6} className="size-4" />
                  Categorias
                </span>
                <FiltroChip
                  ativo={filtroCategoria === 'todas'}
                  onClick={() => setFiltroCategoria('todas')}
                  label={`Todas (${adicionais.length})`}
                />
                {categorias.map((cat) => (
                  <FiltroChip
                    key={cat}
                    ativo={filtroCategoria === cat}
                    onClick={() => setFiltroCategoria(cat)}
                    label={`${cat} (${adicionais.filter((a) => a.categoria === cat).length})`}
                  />
                ))}
                <FiltroChip
                  ativo={filtroCategoria === 'sem-categoria'}
                  onClick={() => setFiltroCategoria('sem-categoria')}
                  label={`Sem categoria (${adicionais.filter((a) => !a.categoria).length})`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalCategorias(true)}
                  className="h-7 rounded-full px-3 text-xs shadow-none"
                >
                  <Tag strokeWidth={1.6} className="size-3" />
                  Gerenciar
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <RefreshCw strokeWidth={1.6} className="size-5 animate-spin text-primary" />
              Carregando adicionais…
            </div>
          ) : adicionaisFiltrados.length === 0 ? (
            <Empty className="border border-dashed border-border/70 bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package strokeWidth={1.6} className="size-5" />
                </EmptyMedia>
                <EmptyTitle>
                  {adicionais.length === 0
                    ? 'Nenhum adicional cadastrado'
                    : termoBusca
                      ? 'Nenhum resultado na busca'
                      : 'Nenhum adicional nessa categoria'}
                </EmptyTitle>
                <EmptyDescription>
                  {adicionais.length === 0
                    ? 'Crie o primeiro adicional para começar.'
                    : termoBusca
                      ? 'Ajuste o nome buscado ou limpe a busca.'
                      : 'Crie um novo adicional ou troque o filtro acima.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-2.5">
              {adicionaisFiltrados.map((adicional) => (
                <div
                  key={adicional.id}
                  className="min-w-0 rounded-xl border border-border/70 bg-card p-3 sm:p-3.5"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex shrink-0 items-start gap-2">
                      <div className="relative">
                        {adicional.imagem_url ? (
                          <div className="relative size-16 overflow-hidden rounded-lg border border-border/70 sm:size-[4.5rem]">
                            <Image
                              src={adicional.imagem_url}
                              alt={adicional.nome}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border/70 bg-muted/30 sm:size-[4.5rem]">
                            <ImageOff strokeWidth={1.6} className="size-4 text-muted-foreground/60" />
                            <span className="text-[10px] text-muted-foreground/60">sem foto</span>
                          </div>
                        )}
                        {enviandoImagem === adicional.id && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/70">
                            <RefreshCw strokeWidth={1.6} className="size-4 animate-spin text-background" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 sm:hidden">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => iniciarUploadImagem(adicional.id)}
                          disabled={enviandoImagem === adicional.id}
                          className="shadow-none"
                        >
                          <Camera strokeWidth={1.6} className="size-3" />
                          {adicional.imagem_url ? 'Trocar' : 'Foto'}
                        </Button>
                        <MenuAcoes
                          ariaLabel={`Ações de ${adicional.nome}`}
                          items={itensAcaoAdicional(adicional)}
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
                          <div className="min-w-0 lg:col-span-4">
                            <Label htmlFor={`nome-${adicional.id}`} className="text-[11px] text-muted-foreground">
                              Nome
                            </Label>
                            <Input
                              id={`nome-${adicional.id}`}
                              value={adicional.nome}
                              onChange={(e) => atualizarAdicional(adicional.id, 'nome', e.target.value)}
                              className="mt-0.5 h-8"
                            />
                          </div>
                          <div className="min-w-0 lg:col-span-3">
                            <Label className="text-[11px] text-muted-foreground">Categoria</Label>
                            <Select
                              value={adicional.categoria || 'sem-categoria'}
                              onValueChange={(v) =>
                                atualizarAdicional(adicional.id, 'categoria', v === 'sem-categoria' ? '' : v)
                              }
                            >
                              <SelectTrigger className="mt-0.5 h-8">
                                <SelectValue placeholder="Sem categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sem-categoria">Sem categoria</SelectItem>
                                {categorias.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="min-w-0 lg:col-span-3">
                            <Label htmlFor={`preco-${adicional.id}`} className="text-[11px] text-muted-foreground">
                              Preço
                            </Label>
                            <div className="relative mt-0.5">
                              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                R$
                              </span>
                              <Input
                                id={`preco-${adicional.id}`}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={adicional.preco}
                                onChange={(e) =>
                                  atualizarAdicional(adicional.id, 'preco', parseFloat(e.target.value))
                                }
                                className="h-8 pl-8 font-mono tabular-nums"
                              />
                            </div>
                          </div>
                          <div className="flex min-w-0 items-end lg:col-span-2">
                            <label className="flex h-8 cursor-pointer items-center gap-2">
                              <Checkbox
                                checked={adicional.disponivel}
                                onCheckedChange={(checked) =>
                                  atualizarAdicional(adicional.id, 'disponivel', checked === true)
                                }
                                aria-label="Disponível"
                              />
                              <span className="text-sm text-foreground">Disponível</span>
                            </label>
                          </div>
                        </div>
                        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                          <MenuAcoes
                            ariaLabel={`Ações de ${adicional.nome}`}
                            items={itensAcaoAdicional(adicional)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => iniciarUploadImagem(adicional.id)}
                            disabled={enviandoImagem === adicional.id}
                            className="shadow-none"
                          >
                            <Camera strokeWidth={1.6} className="size-3" />
                            {adicional.imagem_url ? 'Trocar' : 'Foto'}
                          </Button>
                        </div>
                      </div>

                      {salvando === adicional.id && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RefreshCw strokeWidth={1.6} className="size-3 animate-spin text-primary" />
                          Salvando…
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
          onFechar={() => setEstadoRecorte((prev) => ({ ...prev, aberto: false }))}
          onConfirmar={enviarImagemRecortada}
          proporcaoInicial={1}
          titulo="Ajustar imagem do adicional"
        />

        <Dialog
          open={modalNovoAberto}
          onOpenChange={(open) => {
            setModalNovoAberto(open)
            if (!open) resetarFormularioNovoAdicional()
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo adicional</DialogTitle>
              <DialogDescription>
                Cadastre um adicional novo e, se quiser, já vincule a produtos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="novo-nome">Nome</Label>
                <Input
                  id="novo-nome"
                  value={novoAdicional.nome}
                  onChange={(e) => setNovoAdicional({ ...novoAdicional, nome: e.target.value })}
                  placeholder="Ex.: Bacon extra"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label>Categoria</Label>
                {!criandoCategoriaNoNovo ? (
                  <Select
                    value={novoAdicional.categoria || 'sem-categoria'}
                    onValueChange={(v) => {
                      if (v === '__nova__') {
                        setCriandoCategoriaNoNovo(true)
                        setNomeNovaCategoriaNoNovo('')
                        return
                      }
                      setNovoAdicional({
                        ...novoAdicional,
                        categoria: v === 'sem-categoria' ? '' : v,
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem-categoria">Sem categoria</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      <SelectItem value="__nova__">+ Criar nova categoria</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nomeNovaCategoriaNoNovo}
                      onChange={(e) => setNomeNovaCategoriaNoNovo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          criarCategoriaNoModalNovoAdicional()
                        }
                      }}
                      placeholder="Nome da nova categoria"
                      autoFocus
                    />
                    <Button type="button" size="sm" onClick={criarCategoriaNoModalNovoAdicional}>
                      Criar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCriandoCategoriaNoNovo(false)
                        setNomeNovaCategoriaNoNovo('')
                      }}
                      aria-label="Cancelar criação de categoria"
                    >
                      <X strokeWidth={1.6} className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="novo-preco">Preço</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="novo-preco"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={novoAdicional.preco}
                    onChange={(e) => setNovoAdicional({ ...novoAdicional, preco: e.target.value })}
                    placeholder="0,00"
                    className="pl-9 font-mono tabular-nums"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div>
                  <Label>Produtos que terão este adicional</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Se nenhum for selecionado, fica disponível para todos.
                  </p>
                </div>
                <Input
                  value={buscaProdutoNovo}
                  onChange={(e) => setBuscaProdutoNovo(e.target.value)}
                  placeholder="Buscar produto…"
                />
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border/70 bg-card">
                  {produtosNovoFiltrados.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhum produto encontrado.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {produtosNovoFiltrados.map((produto) => {
                        const selecionado = produtosSelecionadosNovo.includes(produto.id)
                        return (
                          <li key={produto.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setProdutosSelecionadosNovo((prev) =>
                                  selecionado ? prev.filter((id) => id !== produto.id) : [...prev, produto.id],
                                )
                              }
                              className={cn(
                                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                                selecionado ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex size-4 shrink-0 items-center justify-center rounded border',
                                  selecionado ? 'border-primary bg-primary' : 'border-border',
                                )}
                              >
                                {selecionado && <Check strokeWidth={2} className="size-3 text-primary-foreground" />}
                              </span>
                              <span className="truncate">{produto.nome}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {produto.categoria}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                {produtosSelecionadosNovo.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {produtosSelecionadosNovo.length} produto(s) selecionado(s).
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setModalNovoAberto(false)
                  resetarFormularioNovoAdicional()
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={criarAdicional} disabled={salvandoNovo}>
                {salvandoNovo ? (
                  <>
                    <RefreshCw strokeWidth={1.6} className="size-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Plus strokeWidth={1.6} className="size-4" />
                    Criar adicional
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={modalCategorias}
          onOpenChange={(open) => {
            setModalCategorias(open)
            if (!open) {
              setCriandoCategoria(false)
              setNovaCategoria('')
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag strokeWidth={1.6} className="size-4 text-primary" />
                Gerenciar categorias
              </DialogTitle>
              <DialogDescription>
                Crie ou remova categorias usadas pelos adicionais.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto py-2">
              {categorias.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma categoria criada ainda.
                </p>
              ) : (
                categorias.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Tag strokeWidth={1.6} className="size-4 text-muted-foreground" />
                      <span className="truncate text-sm font-medium text-foreground">{cat}</span>
                      <span className="text-xs text-muted-foreground">
                        ({adicionais.filter((a) => a.categoria === cat).length})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmacao({ tipo: 'categoria', nome: cat })}
                      aria-label={`Excluir categoria ${cat}`}
                    >
                      <Trash2 strokeWidth={1.6} className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="sm:justify-start">
              {criandoCategoria ? (
                <div className="flex w-full items-center gap-2">
                  <Input
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        criarCategoria()
                      }
                    }}
                    placeholder="Nome da categoria"
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={criarCategoria}>
                    Criar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCriandoCategoria(false)
                      setNovaCategoria('')
                    }}
                    aria-label="Cancelar"
                  >
                    <X strokeWidth={1.6} className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" className="w-full" onClick={() => setCriandoCategoria(true)}>
                  <Plus strokeWidth={1.6} className="size-4" />
                  Nova categoria
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!modalProdutosAberto}
          onOpenChange={(open) => {
            if (!open) setModalProdutosAberto(null)
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package strokeWidth={1.6} className="size-4 text-primary" />
                Vincular produtos
              </DialogTitle>
              <DialogDescription>
                Escolha em quais produtos esse adicional aparece. Sem seleção, fica disponível para todos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <Input
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                placeholder="Buscar produto…"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {produtosSelecionadosTemp.length} selecionado(s)
                </span>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setProdutosSelecionadosTemp(todosProdutos.map((p) => p.id))}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className="font-medium text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setProdutosSelecionadosTemp([])}
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border/70 bg-card">
                {produtosVincularFiltrados.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhum produto encontrado.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {produtosVincularFiltrados.map((produto) => {
                      const selecionado = produtosSelecionadosTemp.includes(produto.id)
                      return (
                        <li key={produto.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setProdutosSelecionadosTemp((prev) =>
                                selecionado ? prev.filter((id) => id !== produto.id) : [...prev, produto.id],
                              )
                            }
                            className={cn(
                              'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                              selecionado ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded border',
                                selecionado ? 'border-primary bg-primary' : 'border-border',
                              )}
                            >
                              {selecionado && <Check strokeWidth={2} className="size-3 text-primary-foreground" />}
                            </span>
                            <span className="truncate font-medium">{produto.nome}</span>
                            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {produto.categoria}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalProdutosAberto(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={salvarVinculosProdutos} disabled={salvandoProdutos}>
                {salvandoProdutos ? (
                  <>
                    <RefreshCw strokeWidth={1.6} className="size-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Check strokeWidth={1.6} className="size-4" />
                    Salvar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!confirmacao}
          onOpenChange={(open) => {
            if (!open) setConfirmacao(null)
          }}
        >
          <AlertDialogContent>
            {confirmacao?.tipo === 'adicional' && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir adicional</AlertDialogTitle>
                  <AlertDialogDescription>
                    O adicional &quot;{confirmacao.nome}&quot; será removido permanentemente. Essa ação não pode
                    ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmarExclusaoAdicional}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
            {confirmacao?.tipo === 'categoria' && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
                  <AlertDialogDescription>
                    A categoria &quot;{confirmacao.nome}&quot; será removida. Os adicionais que usam essa
                    categoria ficarão sem categoria.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmarExclusaoCategoria}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function FiltroChip({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors',
        ativo
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
