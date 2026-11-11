'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowsClockwise as RefreshCw,
  Plus,
  Camera,
  Crop,
  ImageBroken as ImageOff,
  X,
  Tag,
  Package,
  Check,
  MagnifyingGlass as Search,
  Trash as Trash2,
} from '@phosphor-icons/react'
import Image from 'next/image'
import { toast } from 'sonner'

import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalRecorteImagem from '@/components/admin/ModalRecorteImagem'
import { supabase } from '@/lib/supabase'
import { validarArquivoImagem, arquivoParaUrl } from '@/lib/recorteImagem'
import { enviarImagemParaR2 } from '@/lib/servicoUploadImagem'
import { cn, normalizarBusca } from '@/lib/utils'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Chip,
  Entrada,
  EntradaPreco,
  Gaveta,
  Interruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Selecao,
  Selo,
  formatarPreco,
  lerPreco,
  useConfirmar,
} from '@/components/admin/ui'

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
  const confirmar = useConfirmar()
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)

  const [categorias, setCategorias] = useState<string[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [modalCategorias, setModalCategorias] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')

  // null = fechada; { id: null } = criar; { id } = editar
  const [gaveta, setGaveta] = useState<{ id: string | null } | null>(null)

  const [todosProdutos, setTodosProdutos] = useState<ProdutoSimples[]>([])
  const [produtosVinculados, setProdutosVinculados] = useState<Record<string, string[]>>({})

  const [estadoRecorte, setEstadoRecorte] = useState<EstadoRecorte>({
    aberto: false,
    imagemUrl: '',
    adicionalId: null,
  })
  const [enviandoImagem, setEnviandoImagem] = useState<string | null>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [adicionalSelecionadoParaUpload, setAdicionalSelecionadoParaUpload] = useState<string | null>(null)

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

  const termoBusca = normalizarBusca(busca)
  const adicionaisFiltrados = termoBusca
    ? adicionaisPorCategoria.filter((a) => normalizarBusca(a.nome).includes(termoBusca))
    : adicionaisPorCategoria

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
      toast.success(`Categoria "${nome}" criada.`)
    } catch (erro) {
      console.error('Erro ao criar categoria:', erro)
      toast.error('Não foi possível criar a categoria.')
    }
  }

  /** Cria (ou reaproveita) a categoria digitada dentro da gaveta e devolve o nome final. */
  const criarCategoriaNaGaveta = async (nomeDigitado: string): Promise<string | null> => {
    const nome = nomeDigitado.trim()
    if (!nome) return null

    const existente = categorias.find((c) => c.toLowerCase() === nome.toLowerCase())
    if (existente) return existente

    try {
      const { error } = await supabase.from('categorias_adicionais').insert({ nome })
      if (error) throw error

      await carregarAdicionais()
      toast.success(`Categoria "${nome}" criada.`)
      return nome
    } catch (erro) {
      console.error('Erro ao criar categoria no modal:', erro)
      toast.error('Não foi possível criar a categoria.')
      return null
    }
  }

  const salvarVinculosProdutos = async (adicionalId: string, selecionados: string[]) => {
    await supabase.from('produto_adicionais').delete().eq('adicional_id', adicionalId)

    if (selecionados.length > 0) {
      const registros = selecionados.map((produtoId) => ({
        produto_id: produtoId,
        adicional_id: adicionalId,
      }))
      const { error } = await supabase.from('produto_adicionais').insert(registros)
      if (error) throw error
    }

    setProdutosVinculados((prev) => ({ ...prev, [adicionalId]: [...selecionados] }))
  }

  const atualizarDisponivel = async (adicional: Adicional, disponivel: boolean) => {
    setSalvando(adicional.id)
    try {
      const { error } = await supabase.from('adicionais').update({ disponivel }).eq('id', adicional.id)
      if (error) throw error
      setAdicionais((lista) => lista.map((a) => (a.id === adicional.id ? { ...a, disponivel } : a)))
      toast.success(disponivel ? 'Voltou ao cardápio' : 'Pausado no cardápio', { description: adicional.nome })
    } catch (erro) {
      console.error('Erro ao atualizar adicional:', erro)
      toast.error('Não foi possível atualizar o adicional.', { description: adicional.nome })
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

  const excluirCategoria = async (nome: string) => {
    const ok = await confirmar({
      titulo: `Excluir a categoria "${nome}"?`,
      descricao: 'Os adicionais dessa categoria ficam sem categoria. Eles não são apagados.',
      confirmar: 'Excluir categoria',
      perigo: true,
    })
    if (!ok) return
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

  const adicionalEmEdicao = gaveta?.id ? adicionais.find((a) => a.id === gaveta.id) ?? null : null
  const disponiveis = adicionais.filter((a) => a.disponivel).length

  const abrirNovo = () => setGaveta({ id: null })

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina>
          <CabecalhoPagina
            titulo="Adicionais"
            descricao={`${adicionais.length} cadastrado${adicionais.length === 1 ? '' : 's'} · ${disponiveis} no cardápio`}
            acoes={
              <>
                <Botao variante="contorno" onClick={carregarAdicionais} disabled={loading}>
                  <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                  Atualizar
                </Botao>
                <Botao variante="contorno" onClick={() => setModalCategorias(true)}>
                  <Tag className="size-4" />
                  Categorias
                </Botao>
                <Botao onClick={abrirNovo}>
                  <Plus className="size-4" />
                  Novo adicional
                </Botao>
              </>
            }
          />

          {!loading && adicionais.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Entrada
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar adicional"
                  className="pl-9"
                  aria-label="Buscar adicional por nome"
                />
              </div>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:flex-wrap md:px-0">
                <Chip ativo={filtroCategoria === 'todas'} onClick={() => setFiltroCategoria('todas')}>
                  Todas <span className="tabular-nums opacity-70">{adicionais.length}</span>
                </Chip>
                {categorias.map((cat) => (
                  <Chip key={cat} ativo={filtroCategoria === cat} onClick={() => setFiltroCategoria(cat)}>
                    {cat}{' '}
                    <span className="tabular-nums opacity-70">
                      {adicionais.filter((a) => a.categoria === cat).length}
                    </span>
                  </Chip>
                ))}
                <Chip ativo={filtroCategoria === 'sem-categoria'} onClick={() => setFiltroCategoria('sem-categoria')}>
                  Sem categoria{' '}
                  <span className="tabular-nums opacity-70">{adicionais.filter((a) => !a.categoria).length}</span>
                </Chip>
              </div>
            </div>
          )}

          {loading ? (
            <ListaCarregando linhas={5} />
          ) : adicionais.length === 0 ? (
            <ListaVazia
              icone={<Package />}
              titulo="Nenhum adicional cadastrado"
              descricao="Adicionais são extras que o cliente escolhe no produto, como bacon ou queijo."
              acao={
                <Botao onClick={abrirNovo}>
                  <Plus className="size-4" />
                  Novo adicional
                </Botao>
              }
            />
          ) : adicionaisFiltrados.length === 0 ? (
            <ListaVazia
              icone={<Search />}
              titulo={termoBusca ? 'Nenhum adicional encontrado' : 'Nenhum adicional nessa categoria'}
              descricao={termoBusca ? 'Tente outro nome.' : 'Troque o filtro ou crie um adicional novo.'}
              acao={
                <Botao
                  variante="contorno"
                  onClick={() => {
                    setBusca('')
                    setFiltroCategoria('todas')
                  }}
                >
                  Ver todos
                </Botao>
              }
            />
          ) : (
            <Lista>
              {adicionaisFiltrados.map((adicional) => {
                const qtdVinculos = produtosVinculados[adicional.id]?.length || 0
                return (
                  <li key={adicional.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setGaveta({ id: adicional.id })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setGaveta({ id: adicional.id })
                      }}
                      className={cn(
                        'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        !adicional.disponivel && 'opacity-60',
                      )}
                    >
                      <Miniatura adicional={adicional} enviando={enviandoImagem === adicional.id} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{adicional.nome}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-sm tabular-nums text-primary">{formatarPreco(adicional.preco)}</span>
                          {adicional.categoria ? <Selo>{adicional.categoria}</Selo> : null}
                          {qtdVinculos > 0 ? (
                            <Selo tom="primario">
                              {qtdVinculos} produto{qtdVinculos === 1 ? '' : 's'}
                            </Selo>
                          ) : null}
                          {!adicional.disponivel ? <Selo>Pausado</Selo> : null}
                        </div>
                      </div>
                      <Interruptor
                        marcado={adicional.disponivel}
                        desabilitado={salvando === adicional.id}
                        aoMudar={(v) => void atualizarDisponivel(adicional, v)}
                        rotuloAcessivel={`${adicional.disponivel ? 'Pausar' : 'Ativar'} ${adicional.nome} no cardápio`}
                      />
                    </div>
                  </li>
                )
              })}
            </Lista>
          )}

          {!loading && adicionais.length > 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              Toque no adicional para editar. Adicional pausado não aparece no cardápio.
            </p>
          )}
        </Pagina>

        <input
          ref={inputFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={aoSelecionarArquivo}
          className="hidden"
          aria-hidden="true"
        />

        <GavetaAdicional
          aberto={gaveta !== null}
          adicional={adicionalEmEdicao}
          categorias={categorias}
          todosProdutos={todosProdutos}
          vinculosIniciais={gaveta?.id ? produtosVinculados[gaveta.id] || [] : []}
          enviandoImagem={!!gaveta?.id && enviandoImagem === gaveta.id}
          removendoImagem={!!gaveta?.id && salvando === gaveta.id}
          aoFechar={() => setGaveta(null)}
          aoCriarCategoria={criarCategoriaNaGaveta}
          aoSalvarVinculos={salvarVinculosProdutos}
          aoRecarregar={carregarAdicionais}
          aoExcluido={(id) => setAdicionais((prev) => prev.filter((a) => a.id !== id))}
          aoAtualizado={(atualizado) =>
            setAdicionais((lista) => lista.map((a) => (a.id === atualizado.id ? atualizado : a)))
          }
          aoTrocarFoto={iniciarUploadImagem}
          aoRecortarFoto={abrirRecorteImagemExistente}
          aoRemoverFoto={(id) => void removerImagem(id)}
        />

        <ModalRecorteImagem
          aberto={estadoRecorte.aberto}
          imagemUrl={estadoRecorte.imagemUrl}
          onFechar={() => setEstadoRecorte((prev) => ({ ...prev, aberto: false }))}
          onConfirmar={enviarImagemRecortada}
          proporcaoInicial={1}
          titulo="Ajustar imagem do adicional"
        />

        <Gaveta
          aberto={modalCategorias}
          aoFechar={() => {
            setModalCategorias(false)
            setNovaCategoria('')
          }}
          titulo="Categorias"
          descricao="Agrupam os adicionais no cardápio. Excluir uma categoria não apaga os adicionais."
          cabecalho={
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void criarCategoria()
              }}
            >
              <Entrada
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Nova categoria"
                aria-label="Nome da nova categoria"
                className="flex-1"
              />
              <Botao type="submit" disabled={!novaCategoria.trim()} className="h-11 md:h-10">
                <Plus className="size-4" />
                Criar
              </Botao>
            </form>
          }
        >
          {categorias.length === 0 ? (
            <ListaVazia icone={<Tag />} titulo="Nenhuma categoria ainda" descricao="Digite um nome acima para criar." />
          ) : (
            <Lista>
              {categorias.map((cat) => (
                <li key={cat} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{cat}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {adicionais.filter((a) => a.categoria === cat).length} adicionais
                    </p>
                  </div>
                  <Botao
                    variante="fantasma"
                    tamanho="icone"
                    className="size-11 text-muted-foreground hover:text-destructive"
                    onClick={() => void excluirCategoria(cat)}
                    aria-label={`Excluir categoria ${cat}`}
                  >
                    <Trash2 className="size-4" />
                  </Botao>
                </li>
              ))}
            </Lista>
          )}
        </Gaveta>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function Miniatura({ adicional, enviando }: { adicional: Adicional; enviando: boolean }) {
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted/40">
      {adicional.imagem_url ? (
        <Image src={adicional.imagem_url} alt={adicional.nome} fill className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageOff className="size-4 text-muted-foreground/60" />
        </div>
      )}
      {enviando && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/70">
          <RefreshCw className="size-4 animate-spin text-background" />
        </div>
      )}
    </div>
  )
}

type GavetaAdicionalProps = {
  aberto: boolean
  adicional: Adicional | null
  categorias: string[]
  todosProdutos: ProdutoSimples[]
  vinculosIniciais: string[]
  enviandoImagem: boolean
  removendoImagem: boolean
  aoFechar: () => void
  aoCriarCategoria: (nome: string) => Promise<string | null>
  aoSalvarVinculos: (adicionalId: string, selecionados: string[]) => Promise<void>
  aoRecarregar: () => Promise<void>
  aoExcluido: (id: string) => void
  aoAtualizado: (adicional: Adicional) => void
  aoTrocarFoto: (id: string) => void
  aoRecortarFoto: (adicional: Adicional) => void
  aoRemoverFoto: (id: string) => void
}

function GavetaAdicional({
  aberto,
  adicional,
  categorias,
  todosProdutos,
  vinculosIniciais,
  enviandoImagem,
  removendoImagem,
  aoFechar,
  aoCriarCategoria,
  aoSalvarVinculos,
  aoRecarregar,
  aoExcluido,
  aoAtualizado,
  aoTrocarFoto,
  aoRecortarFoto,
  aoRemoverFoto,
}: GavetaAdicionalProps) {
  const confirmar = useConfirmar()
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [categoria, setCategoria] = useState('')
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [erros, setErros] = useState<{ nome?: string; preco?: string; categoria?: string }>({})
  const [salvando, setSalvando] = useState(false)
  // Evita insert duplicado se o vínculo falhar depois de criar e o usuário tentar de novo.
  const idCriado = useRef<string | null>(null)

  const idEdicao = adicional?.id ?? null
  useEffect(() => {
    if (!aberto) return
    setNome(adicional?.nome ?? '')
    setPreco(adicional ? String(adicional.preco).replace('.', ',') : '')
    setCategoria(adicional?.categoria ?? '')
    setCriandoCategoria(false)
    setNomeNovaCategoria('')
    setSelecionados(vinculosIniciais)
    setErros({})
    idCriado.current = null
    // Só reinicia ao abrir ou trocar de adicional; recargas em tempo real não apagam o que foi digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, idEdicao])

  const confirmarNovaCategoria = async () => {
    const criada = await aoCriarCategoria(nomeNovaCategoria)
    if (!criada) return
    setCategoria(criada)
    setCriandoCategoria(false)
    setNomeNovaCategoria('')
  }

  async function salvar() {
    const precoNumero = lerPreco(preco)
    const proximosErros: typeof erros = {}
    if (!nome.trim()) proximosErros.nome = 'Informe o nome do adicional.'
    if (precoNumero === null || (!adicional && precoNumero <= 0)) proximosErros.preco = 'Informe um preço válido.'
    if (categoria && !categorias.includes(categoria)) proximosErros.categoria = 'Categoria inválida. Atualize a tela e tente novamente.'
    setErros(proximosErros)
    if (Object.keys(proximosErros).length > 0 || precoNumero === null) return

    const dados = { nome: nome.trim(), preco: precoNumero, categoria: categoria || null }
    const vinculosMudaram =
      selecionados.length !== vinculosIniciais.length || selecionados.some((id) => !vinculosIniciais.includes(id))

    setSalvando(true)
    try {
      if (adicional) {
        const { error } = await supabase.from('adicionais').update(dados).eq('id', adicional.id)
        if (error) throw error
        aoAtualizado({ ...adicional, ...dados })
        if (vinculosMudaram) await aoSalvarVinculos(adicional.id, selecionados)
        toast.success('Adicional salvo', { description: dados.nome })
      } else {
        if (!idCriado.current) {
          const { data: novoRegistro, error } = await supabase
            .from('adicionais')
            .insert({ ...dados, disponivel: true })
            .select('id')
            .single()
          if (error) throw error
          idCriado.current = novoRegistro?.id ?? null
        }

        if (idCriado.current && selecionados.length > 0) {
          const registros = selecionados.map((produtoId) => ({
            produto_id: produtoId,
            adicional_id: idCriado.current as string,
          }))
          await supabase.from('produto_adicionais').insert(registros)
        }

        await aoRecarregar()
        toast.success('Adicional criado', { description: dados.nome })
      }
      aoFechar()
    } catch (erro: unknown) {
      console.error('Erro ao salvar adicional:', erro)
      const code = (erro as { code?: string })?.code
      const msg = (erro as { message?: string })?.message
      const erroFK = code === '23503' && typeof msg === 'string' && msg.includes('adicionais_categoria_fkey')
      toast.error(
        erroFK
          ? 'Categoria inválida. Atualize e tente novamente.'
          : adicional
            ? 'Não foi possível salvar o adicional.'
            : 'Não foi possível criar o adicional.',
      )
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!adicional) return
    const ok = await confirmar({
      titulo: `Excluir "${adicional.nome}"?`,
      descricao: 'O adicional some do cardápio e dos produtos. Não dá para desfazer.',
      confirmar: 'Excluir adicional',
      perigo: true,
    })
    if (!ok) return
    setSalvando(true)
    try {
      const { error } = await supabase.from('adicionais').delete().eq('id', adicional.id)
      if (error) throw error
      aoExcluido(adicional.id)
      toast.success('Adicional excluído', { description: adicional.nome })
      aoFechar()
    } catch (erro) {
      console.error('Erro ao excluir adicional:', erro)
      toast.error('Não foi possível excluir o adicional.', { description: 'Pause o adicional para tirá-lo do cardápio.' })
    } finally {
      setSalvando(false)
    }
  }

  const idNome = adicional ? `nome-${adicional.id}` : 'novo-nome'
  const idPreco = adicional ? `preco-${adicional.id}` : 'novo-preco'

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={aoFechar}
      bloqueada={salvando}
      largura="lg"
      titulo={adicional ? 'Editar adicional' : 'Novo adicional'}
      descricao="Nome e preço que o cliente vê ao montar o pedido."
      rodape={
        adicional ? (
          <>
            <Botao variante="perigoSuave" className="md:mr-auto" onClick={() => void excluir()} disabled={salvando}>
              Excluir
            </Botao>
            <Botao carregando={salvando} onClick={() => void salvar()}>Salvar</Botao>
          </>
        ) : (
          <>
            <Botao variante="contorno" onClick={aoFechar} disabled={salvando}>Cancelar</Botao>
            <Botao carregando={salvando} onClick={() => void salvar()}>Criar adicional</Botao>
          </>
        )
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
      >
        <Campo rotulo="Nome" htmlFor={idNome} erro={erros.nome}>
          <Entrada
            id={idNome}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Bacon extra"
            autoComplete="off"
          />
        </Campo>

        <Campo rotulo="Preço" htmlFor={idPreco} erro={erros.preco}>
          <EntradaPreco id={idPreco} valor={preco} aoMudar={setPreco} />
        </Campo>

        <Campo rotulo="Categoria" htmlFor="adicional-categoria" erro={erros.categoria} opcional>
          {criandoCategoria ? (
            <div className="flex gap-2">
              <Entrada
                id="adicional-categoria"
                value={nomeNovaCategoria}
                onChange={(e) => setNomeNovaCategoria(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void confirmarNovaCategoria()
                  }
                }}
                placeholder="Nome da nova categoria"
                autoFocus
                className="flex-1"
              />
              <Botao className="h-11 md:h-10" onClick={() => void confirmarNovaCategoria()}>
                Criar
              </Botao>
              <Botao
                variante="fantasma"
                tamanho="icone"
                className="size-11 md:size-10"
                onClick={() => {
                  setCriandoCategoria(false)
                  setNomeNovaCategoria('')
                }}
                aria-label="Cancelar criação de categoria"
              >
                <X className="size-4" />
              </Botao>
            </div>
          ) : (
            <Selecao
              id="adicional-categoria"
              value={categoria}
              onChange={(e) => {
                if (e.target.value === '__nova__') {
                  setCriandoCategoria(true)
                  setNomeNovaCategoria('')
                  return
                }
                setCategoria(e.target.value)
              }}
            >
              <option value="">Sem categoria</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="__nova__">+ Criar nova categoria</option>
            </Selecao>
          )}
        </Campo>

        {adicional && (
          <Campo rotulo="Foto" opcional>
            <div className="flex items-center gap-3">
              <Miniatura adicional={adicional} enviando={enviandoImagem} />
              <div className="flex flex-wrap gap-2">
                <Botao
                  variante="contorno"
                  tamanho="sm"
                  className="h-11 md:h-9"
                  onClick={() => aoTrocarFoto(adicional.id)}
                  disabled={enviandoImagem}
                >
                  <Camera className="size-4" />
                  {adicional.imagem_url ? 'Trocar foto' : 'Adicionar foto'}
                </Botao>
                {adicional.imagem_url && (
                  <>
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      className="h-11 md:h-9"
                      onClick={() => aoRecortarFoto(adicional)}
                      disabled={enviandoImagem}
                    >
                      <Crop className="size-4" />
                      Recortar
                    </Botao>
                    <Botao
                      variante="perigoSuave"
                      tamanho="sm"
                      className="h-11 md:h-9"
                      onClick={() => aoRemoverFoto(adicional.id)}
                      disabled={enviandoImagem || removendoImagem}
                    >
                      Remover
                    </Botao>
                  </>
                )}
              </div>
            </div>
          </Campo>
        )}

        <SeletorProdutos produtos={todosProdutos} selecionados={selecionados} aoMudar={setSelecionados} />

        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}

function SeletorProdutos({
  produtos,
  selecionados,
  aoMudar,
}: {
  produtos: ProdutoSimples[]
  selecionados: string[]
  aoMudar: (ids: string[]) => void
}) {
  const [busca, setBusca] = useState('')
  const filtrados = produtos.filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Em quais produtos aparece</p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            {selecionados.length === 0
              ? 'Nenhum marcado: aparece em todos os produtos.'
              : `${selecionados.length} de ${produtos.length} marcados.`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Botao variante="fantasma" tamanho="xs" onClick={() => aoMudar(produtos.map((p) => p.id))}>
            Marcar todos
          </Botao>
          <Botao variante="fantasma" tamanho="xs" onClick={() => aoMudar([])} disabled={selecionados.length === 0}>
            Limpar
          </Botao>
        </div>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Entrada
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto"
          aria-label="Buscar produto"
          className="pl-9"
        />
      </div>
      {filtrados.length === 0 ? (
        <p className="px-1 py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
      ) : (
        <Lista className="max-h-72 overflow-y-auto">
          {filtrados.map((produto) => {
            const marcado = selecionados.includes(produto.id)
            return (
              <li key={produto.id}>
                <button
                  type="button"
                  aria-pressed={marcado}
                  onClick={() =>
                    aoMudar(marcado ? selecionados.filter((id) => id !== produto.id) : [...selecionados, produto.id])
                  }
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/40',
                    marcado && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border',
                      marcado ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {marcado && <Check weight="bold" className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{produto.nome}</span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">{produto.categoria}</span>
                </button>
              </li>
            )
          })}
        </Lista>
      )}
    </section>
  )
}
