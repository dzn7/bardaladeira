'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, MagnifyingGlass as Search, ArrowsClockwise as RefreshCw, Trash as Trash2, Check, PushPin as Pin, PushPinSlash as PinOff, Note as StickyNote, Lightbulb, Warning as AlertTriangle, Bell, CheckSquare } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import {
  AreaTexto,
  Botao,
  CabecalhoPagina,
  Campo,
  Chip,
  Entrada,
  Gaveta,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Segmentos,
  Selecao,
  useConfirmar,
} from '@/components/admin/ui'

// Tipos
type CorAnotacao = 'amarelo' | 'verde' | 'azul' | 'rosa' | 'roxo' | 'laranja'
type CategoriaAnotacao = 'geral' | 'urgente' | 'lembrete' | 'tarefa' | 'ideia'
type PrioridadeAnotacao = 'baixa' | 'media' | 'alta' | 'urgente'

interface Anotacao {
  id: string
  titulo: string
  conteudo: string | null
  cor: CorAnotacao
  categoria: CategoriaAnotacao
  prioridade: PrioridadeAnotacao
  concluida: boolean
  fixada: boolean
  ordem: number
  created_at: string
  updated_at: string
}

// Configuração de cores dos post-its
const CORES_POSTIT: Record<CorAnotacao, { fundo: string; borda: string; texto: string; sombra: string }> = {
  amarelo: {
    fundo: 'bg-amber-100 dark:bg-amber-900/40',
    borda: 'border-amber-300 dark:border-amber-700',
    texto: 'text-amber-900 dark:text-amber-100',
    sombra: 'shadow-amber-200/50 dark:shadow-amber-900/30'
  },
  verde: {
    fundo: 'bg-emerald-100 dark:bg-emerald-900/40',
    borda: 'border-emerald-300 dark:border-emerald-700',
    texto: 'text-emerald-900 dark:text-emerald-100',
    sombra: 'shadow-emerald-200/50 dark:shadow-emerald-900/30'
  },
  azul: {
    fundo: 'bg-sky-100 dark:bg-sky-900/40',
    borda: 'border-sky-300 dark:border-sky-700',
    texto: 'text-sky-900 dark:text-sky-100',
    sombra: 'shadow-sky-200/50 dark:shadow-sky-900/30'
  },
  rosa: {
    fundo: 'bg-pink-100 dark:bg-pink-900/40',
    borda: 'border-pink-300 dark:border-pink-700',
    texto: 'text-pink-900 dark:text-pink-100',
    sombra: 'shadow-pink-200/50 dark:shadow-pink-900/30'
  },
  roxo: {
    fundo: 'bg-violet-100 dark:bg-violet-900/40',
    borda: 'border-violet-300 dark:border-violet-700',
    texto: 'text-violet-900 dark:text-violet-100',
    sombra: 'shadow-violet-200/50 dark:shadow-violet-900/30'
  },
  laranja: {
    fundo: 'bg-orange-100 dark:bg-orange-900/40',
    borda: 'border-orange-300 dark:border-orange-700',
    texto: 'text-orange-900 dark:text-orange-100',
    sombra: 'shadow-orange-200/50 dark:shadow-orange-900/30'
  }
}

// Ícones por categoria
const ICONES_CATEGORIA: Record<CategoriaAnotacao, typeof StickyNote> = {
  geral: StickyNote,
  urgente: AlertTriangle,
  lembrete: Bell,
  tarefa: CheckSquare,
  ideia: Lightbulb
}

// Labels das categorias
const LABELS_CATEGORIA: Record<CategoriaAnotacao, string> = {
  geral: 'Geral',
  urgente: 'Urgente',
  lembrete: 'Lembrete',
  tarefa: 'Tarefa',
  ideia: 'Ideia'
}

// Labels das prioridades
const LABELS_PRIORIDADE: Record<PrioridadeAnotacao, { texto: string; cor: string }> = {
  baixa: { texto: 'Baixa', cor: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300' },
  media: { texto: 'Média', cor: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300' },
  alta: { texto: 'Alta', cor: 'bg-orange-200 text-orange-700 dark:bg-orange-800 dark:text-orange-300' },
  urgente: { texto: 'Urgente', cor: 'bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300' }
}

// Formatar tempo relativo
const formatarTempoRelativo = (data: string | undefined) => {
  if (!data) return ''
  try {
    return formatDistanceToNow(new Date(data), { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

// Interface do Card de Anotação
interface CardAnotacaoProps {
  anotacao: Anotacao
  onEditar: (anotacao: Anotacao) => void
  onExcluir: (id: string) => void
  onToggleConcluida: (anotacao: Anotacao) => void
  onToggleFixada: (anotacao: Anotacao) => void
}

function CardAnotacao({ anotacao, onEditar, onExcluir, onToggleConcluida, onToggleFixada }: CardAnotacaoProps) {
  const cores = CORES_POSTIT[anotacao.cor]
  const IconeCategoria = ICONES_CATEGORIA[anotacao.categoria]
  const prioridade = LABELS_PRIORIDADE[anotacao.prioridade]
  const classeAcao =
    'flex size-11 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 md:size-9'

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group relative flex flex-col rounded-xl border p-4',
        cores.fundo,
        cores.borda,
        anotacao.concluida && 'opacity-60'
      )}
    >
      <button
        type="button"
        onClick={() => onEditar(anotacao)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <IconeCategoria className={cn('size-4 shrink-0', cores.texto)} />
            <h3 className={cn('truncate text-sm font-semibold', cores.texto, anotacao.concluida && 'line-through')}>
              {anotacao.titulo}
            </h3>
          </div>
          {anotacao.fixada && <Pin weight="fill" className={cn('size-4 shrink-0', cores.texto)} aria-label="Fixada" />}
        </div>
        {anotacao.conteudo && (
          <p className={cn('mt-2 line-clamp-3 text-sm opacity-80', cores.texto, anotacao.concluida && 'line-through')}>
            {anotacao.conteudo}
          </p>
        )}
        <p className={cn('mt-3 text-xs opacity-70', cores.texto)}>
          {LABELS_CATEGORIA[anotacao.categoria]} · Prioridade {prioridade.texto.toLowerCase()} · {formatarTempoRelativo(anotacao.created_at)}
        </p>
      </button>

      <div className="-mb-2 -mr-2 mt-1 flex justify-end gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onToggleConcluida(anotacao)}
          className={classeAcao}
          aria-label={anotacao.concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
          title={anotacao.concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
        >
          <Check className="size-4" weight={anotacao.concluida ? 'bold' : 'regular'} />
        </button>
        <button
          type="button"
          onClick={() => onToggleFixada(anotacao)}
          className={classeAcao}
          aria-label={anotacao.fixada ? 'Desafixar' : 'Fixar no topo'}
          title={anotacao.fixada ? 'Desafixar' : 'Fixar no topo'}
        >
          {anotacao.fixada ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => onExcluir(anotacao.id)}
          className={cn(classeAcao, 'text-red-600 hover:text-red-700 dark:text-red-400')}
          aria-label="Excluir anotação"
          title="Excluir"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </motion.div>
  )
}

// Gaveta de edição/criação
interface ModalAnotacaoProps {
  anotacao: Anotacao | null
  aberto: boolean
  onFechar: () => void
  onSalvar: (dados: Partial<Anotacao>) => void
  carregando: boolean
}

function ModalAnotacao({ anotacao, aberto, onFechar, onSalvar, carregando }: ModalAnotacaoProps) {
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [cor, setCor] = useState<CorAnotacao>('amarelo')
  const [categoria, setCategoria] = useState<CategoriaAnotacao>('geral')
  const [prioridade, setPrioridade] = useState<PrioridadeAnotacao>('media')

  useEffect(() => {
    if (anotacao) {
      setTitulo(anotacao.titulo)
      setConteudo(anotacao.conteudo || '')
      setCor(anotacao.cor)
      setCategoria(anotacao.categoria)
      setPrioridade(anotacao.prioridade)
    } else {
      setTitulo('')
      setConteudo('')
      setCor('amarelo')
      setCategoria('geral')
      setPrioridade('media')
    }
  }, [anotacao, aberto])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!titulo.trim()) {
      toast.error('Escreva um título')
      return
    }
    onSalvar({
      id: anotacao?.id,
      titulo: titulo.trim(),
      conteudo: conteudo.trim() || null,
      cor,
      categoria,
      prioridade
    })
  }

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      bloqueada={carregando}
      titulo={anotacao ? 'Editar anotação' : 'Nova anotação'}
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar} disabled={carregando}>Cancelar</Botao>
          <Botao onClick={() => handleSubmit()} carregando={carregando} disabled={!titulo.trim()}>
            {anotacao ? 'Salvar' : 'Criar anotação'}
          </Botao>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Campo rotulo="Título" htmlFor="anotacao-titulo">
          <Entrada
            id="anotacao-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Comprar gelo"
            autoComplete="off"
          />
        </Campo>

        <Campo rotulo="Detalhes" htmlFor="anotacao-conteudo" opcional>
          <AreaTexto
            id="anotacao-conteudo"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={4}
          />
        </Campo>

        <Campo rotulo="Tipo">
          <Segmentos
            opcoes={(Object.keys(LABELS_CATEGORIA) as CategoriaAnotacao[]).map((cat) => ({ valor: cat, rotulo: LABELS_CATEGORIA[cat] }))}
            valor={categoria}
            aoMudar={setCategoria}
            rotuloAcessivel="Tipo da anotação"
          />
        </Campo>

        <Campo rotulo="Prioridade">
          <Segmentos
            opcoes={(Object.keys(LABELS_PRIORIDADE) as PrioridadeAnotacao[]).map((prio) => ({ valor: prio, rotulo: LABELS_PRIORIDADE[prio].texto }))}
            valor={prioridade}
            aoMudar={setPrioridade}
            rotuloAcessivel="Prioridade"
          />
        </Campo>

        <Campo rotulo="Cor">
          <div role="radiogroup" aria-label="Cor da anotação" className="flex flex-wrap gap-2">
            {(Object.keys(CORES_POSTIT) as CorAnotacao[]).map((corOpcao) => (
              <button
                key={corOpcao}
                type="button"
                role="radio"
                aria-checked={cor === corOpcao}
                aria-label={corOpcao}
                onClick={() => setCor(corOpcao)}
                className={cn(
                  'size-11 rounded-lg border transition-shadow',
                  CORES_POSTIT[corOpcao].fundo,
                  CORES_POSTIT[corOpcao].borda,
                  cor === corOpcao && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                )}
              />
            ))}
          </div>
        </Campo>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}

// Componente principal
export function PainelAnotacoes() {
  const confirmar = useConfirmar()
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaAnotacao | 'todas'>('todas')
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'concluidas'>('todas')
  const [anotacaoSelecionada, setAnotacaoSelecionada] = useState<Anotacao | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Carrega anotações
  const carregarAnotacoes = useCallback(async () => {
    try {
      setCarregando(true)

      const { data, error } = await supabase
        .from('anotacoes_painel')
        .select('*')
        .order('fixada', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setAnotacoes(data || [])
    } catch (erro) {
      console.error('[PainelAnotacoes] Erro ao carregar:', erro)
      toast.error('Erro ao carregar anotações')
    } finally {
      setCarregando(false)
    }
  }, [])

  // Salvar anotação
  const salvarAnotacao = async (dados: Partial<Anotacao>) => {
    try {
      setSalvando(true)

      if (dados.id) {
        // Atualizar
        const { error } = await supabase
          .from('anotacoes_painel')
          .update({
            titulo: dados.titulo,
            conteudo: dados.conteudo,
            cor: dados.cor,
            categoria: dados.categoria,
            prioridade: dados.prioridade,
            updated_at: new Date().toISOString()
          })
          .eq('id', dados.id)

        if (error) throw error
        toast.success('Anotação atualizada')
      } else {
        // Criar
        const { error } = await supabase
          .from('anotacoes_painel')
          .insert({
            titulo: dados.titulo,
            conteudo: dados.conteudo,
            cor: dados.cor,
            categoria: dados.categoria,
            prioridade: dados.prioridade
          })

        if (error) throw error
        toast.success('Anotação criada')
      }

      setModalAberto(false)
      setAnotacaoSelecionada(null)
    } catch (erro) {
      console.error('[PainelAnotacoes] Erro ao salvar:', erro)
      toast.error('Erro ao salvar anotação')
    } finally {
      setSalvando(false)
    }
  }

  // Excluir anotação
  const excluirAnotacao = async (id: string) => {
    const ok = await confirmar({
      titulo: 'Excluir anotação?',
      descricao: 'Não dá para desfazer.',
      confirmar: 'Excluir',
      perigo: true,
    })
    if (!ok) return
    try {
      const { error } = await supabase
        .from('anotacoes_painel')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Anotação excluída')
    } catch (erro) {
      console.error('[PainelAnotacoes] Erro ao excluir:', erro)
      toast.error('Erro ao excluir anotação')
    }
  }

  // Toggle concluída
  const toggleConcluida = async (anotacao: Anotacao) => {
    try {
      const { error } = await supabase
        .from('anotacoes_painel')
        .update({
          concluida: !anotacao.concluida,
          updated_at: new Date().toISOString()
        })
        .eq('id', anotacao.id)

      if (error) throw error
      toast.success(anotacao.concluida ? 'Marcada como pendente' : 'Marcada como concluída')
    } catch (erro) {
      console.error('[PainelAnotacoes] Erro ao atualizar:', erro)
      toast.error('Erro ao atualizar anotação')
    }
  }

  // Toggle fixada
  const toggleFixada = async (anotacao: Anotacao) => {
    try {
      const { error } = await supabase
        .from('anotacoes_painel')
        .update({
          fixada: !anotacao.fixada,
          updated_at: new Date().toISOString()
        })
        .eq('id', anotacao.id)

      if (error) throw error
      toast.success(anotacao.fixada ? 'Anotação desafixada' : 'Anotação fixada')
    } catch (erro) {
      console.error('[PainelAnotacoes] Erro ao atualizar:', erro)
      toast.error('Erro ao atualizar anotação')
    }
  }

  // Configura realtime
  useEffect(() => {
    carregarAnotacoes()

    channelRef.current = supabase
      .channel(`painel-anotacoes-${Date.now()}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'anotacoes_painel' },
        (payload) => {
          console.log('[PainelAnotacoes] Mudança detectada:', payload.eventType)

          if (payload.eventType === 'INSERT') {
            const novaAnotacao = payload.new as Anotacao
            setAnotacoes(prev => {
              const semDuplicata = prev.filter(a => a.id !== novaAnotacao.id)
              const novaLista = [novaAnotacao, ...semDuplicata]
              return novaLista.sort((a, b) => {
                if (a.fixada !== b.fixada) return a.fixada ? -1 : 1
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              })
            })
          } else if (payload.eventType === 'UPDATE') {
            const anotacaoAtualizada = payload.new as Anotacao
            setAnotacoes(prev => {
              const novaLista = prev.map(a =>
                a.id === anotacaoAtualizada.id ? anotacaoAtualizada : a
              )
              return novaLista.sort((a, b) => {
                if (a.fixada !== b.fixada) return a.fixada ? -1 : 1
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              })
            })
          } else if (payload.eventType === 'DELETE') {
            const anotacaoRemovida = payload.old as Anotacao
            setAnotacoes(prev => prev.filter(a => a.id !== anotacaoRemovida.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('[PainelAnotacoes] Status realtime:', status)
      })

    const aoGanharFoco = () => {
      carregarAnotacoes()
    }

    window.addEventListener('focus', aoGanharFoco)

    return () => {
      window.removeEventListener('focus', aoGanharFoco)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [carregarAnotacoes])

  // Filtra anotações
  const anotacoesFiltradas = useMemo(() => {
    return anotacoes.filter(a => {
      // Filtro de busca
      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase()
        const matchTitulo = a.titulo.toLowerCase().includes(termo)
        const matchConteudo = a.conteudo?.toLowerCase().includes(termo)
        if (!matchTitulo && !matchConteudo) return false
      }

      // Filtro de categoria
      if (filtroCategoria !== 'todas' && a.categoria !== filtroCategoria) {
        return false
      }

      // Filtro de status
      if (filtroStatus === 'pendentes' && a.concluida) return false
      if (filtroStatus === 'concluidas' && !a.concluida) return false

      return true
    })
  }, [anotacoes, termoBusca, filtroCategoria, filtroStatus])

  // Estatísticas
  const estatisticas = useMemo(() => ({
    total: anotacoes.length,
    pendentes: anotacoes.filter(a => !a.concluida).length,
    concluidas: anotacoes.filter(a => a.concluida).length,
    urgentes: anotacoes.filter(a => a.prioridade === 'urgente' && !a.concluida).length
  }), [anotacoes])

  const abrirNovaAnotacao = () => {
    setAnotacaoSelecionada(null)
    setModalAberto(true)
  }

  const abrirEditarAnotacao = (anotacao: Anotacao) => {
    setAnotacaoSelecionada(anotacao)
    setModalAberto(true)
  }

  const filtrosStatus: { valor: typeof filtroStatus; rotulo: string }[] = [
    { valor: 'todas', rotulo: 'Todas' },
    { valor: 'pendentes', rotulo: 'Pendentes' },
    { valor: 'concluidas', rotulo: 'Concluídas' },
  ]

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Anotações"
        descricao={
          <>
            {estatisticas.total} anotações · {estatisticas.pendentes} pendentes
            {estatisticas.urgentes > 0 && <span className="text-destructive"> · {estatisticas.urgentes} urgentes</span>}
          </>
        }
        acoes={
          <>
            <Botao variante="contorno" onClick={() => void carregarAnotacoes()} disabled={carregando}>
              <RefreshCw className={cn(carregando && 'animate-spin')} />
              Atualizar
            </Botao>
            <Botao onClick={abrirNovaAnotacao}>
              <Plus />
              Nova anotação
            </Botao>
          </>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Entrada
              type="search"
              placeholder="Buscar anotação"
              aria-label="Buscar anotação"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="sm:w-52">
            <Selecao
              aria-label="Filtrar por tipo"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value as CategoriaAnotacao | 'todas')}
            >
              <option value="todas">Todos os tipos</option>
              {(Object.keys(LABELS_CATEGORIA) as CategoriaAnotacao[]).map((cat) => (
                <option key={cat} value={cat}>{LABELS_CATEGORIA[cat]}</option>
              ))}
            </Selecao>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {filtrosStatus.map((filtro) => (
            <Chip
              key={filtro.valor}
              ativo={filtroStatus === filtro.valor}
              onClick={() => setFiltroStatus(filtro.valor)}
              className="h-11 md:h-9"
            >
              {filtro.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      {carregando && anotacoes.length === 0 ? (
        <ListaCarregando linhas={4} />
      ) : anotacoesFiltradas.length === 0 ? (
        <ListaVazia
          icone={<StickyNote />}
          titulo={anotacoes.length === 0 ? 'Nenhuma anotação ainda' : 'Nenhuma anotação encontrada'}
          descricao={anotacoes.length === 0 ? 'Anote lembretes e tarefas da equipe.' : 'Tente outra busca ou filtro.'}
          acao={
            anotacoes.length === 0 ? (
              <Botao onClick={abrirNovaAnotacao}>
                <Plus />
                Nova anotação
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {anotacoesFiltradas.map((anotacao) => (
              <CardAnotacao
                key={anotacao.id}
                anotacao={anotacao}
                onEditar={abrirEditarAnotacao}
                onExcluir={(id) => void excluirAnotacao(id)}
                onToggleConcluida={toggleConcluida}
                onToggleFixada={toggleFixada}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ModalAnotacao
        anotacao={anotacaoSelecionada}
        aberto={modalAberto}
        onFechar={() => {
          setModalAberto(false)
          setAnotacaoSelecionada(null)
        }}
        onSalvar={salvarAnotacao}
        carregando={salvando}
      />
    </Pagina>
  )
}
