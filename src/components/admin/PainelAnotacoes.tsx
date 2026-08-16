'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  X,
  Pin,
  PinOff,
  GripVertical,
  StickyNote,
  Lightbulb,
  AlertTriangle,
  Bell,
  CheckSquare,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02, rotate: anotacao.fixada ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'relative rounded-lg border-2 p-4 shadow-lg transition-all duration-200 cursor-pointer group',
        cores.fundo,
        cores.borda,
        cores.sombra,
        anotacao.concluida && 'opacity-60'
      )}
      onClick={() => onEditar(anotacao)}
    >
      {/* Indicador de fixado */}
      {anotacao.fixada && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
          <Pin className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <IconeCategoria className={cn('w-4 h-4 flex-shrink-0', cores.texto)} />
          <h3 className={cn(
            'font-semibold text-sm truncate',
            cores.texto,
            anotacao.concluida && 'line-through'
          )}>
            {anotacao.titulo}
          </h3>
        </div>
        <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', prioridade.cor)}>
          {prioridade.texto}
        </span>
      </div>

      {/* Conteúdo */}
      {anotacao.conteudo && (
        <p className={cn(
          'text-xs mb-3 line-clamp-3',
          cores.texto,
          'opacity-80',
          anotacao.concluida && 'line-through'
        )}>
          {anotacao.conteudo}
        </p>
      )}

      {/* Rodapé */}
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px]', cores.texto, 'opacity-60')}>
          {formatarTempoRelativo(anotacao.created_at)}
        </span>
        <span className={cn(
          'px-1.5 py-0.5 text-[10px] font-medium rounded',
          cores.texto,
          'bg-black/10 dark:bg-white/10'
        )}>
          {LABELS_CATEGORIA[anotacao.categoria]}
        </span>
      </div>

      {/* Ações (visíveis no hover) */}
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleConcluida(anotacao)
          }}
          className={cn(
            'p-1.5 rounded-full transition-colors',
            anotacao.concluida
              ? 'bg-emerald-500 text-white'
              : 'bg-white/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
          )}
          title={anotacao.concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFixada(anotacao)
          }}
          className={cn(
            'p-1.5 rounded-full transition-colors',
            'bg-white/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
          )}
          title={anotacao.fixada ? 'Desafixar' : 'Fixar'}
        >
          {anotacao.fixada ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onExcluir(anotacao.id)
          }}
          className="p-1.5 rounded-full bg-white/80 dark:bg-zinc-800/80 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          title="Excluir"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  )
}

// Modal de Edição/Criação
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) {
      toast.error('O título é obrigatório')
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

  if (!aberto) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
        onClick={onFechar}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 
                   sm:w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl z-50 
                   flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {anotacao ? 'Editar Anotação' : 'Nova Anotação'}
          </h2>
          <button
            onClick={onFechar}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Digite o título da anotação..."
              className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 
                       border border-zinc-200 dark:border-zinc-700 rounded-lg
                       text-zinc-900 dark:text-white placeholder-zinc-500
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Conteúdo */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Conteúdo
            </label>
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Descreva os detalhes..."
              rows={4}
              className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 
                       border border-zinc-200 dark:border-zinc-700 rounded-lg
                       text-zinc-900 dark:text-white placeholder-zinc-500
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                       resize-none"
            />
          </div>

          {/* Cor */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Cor do Post-it
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(CORES_POSTIT) as CorAnotacao[]).map((corOpcao) => (
                <button
                  key={corOpcao}
                  type="button"
                  onClick={() => setCor(corOpcao)}
                  className={cn(
                    'w-8 h-8 rounded-lg border-2 transition-all',
                    CORES_POSTIT[corOpcao].fundo,
                    cor === corOpcao
                      ? 'ring-2 ring-offset-2 ring-amber-500 scale-110'
                      : 'hover:scale-105'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Categoria
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(LABELS_CATEGORIA) as CategoriaAnotacao[]).map((cat) => {
                const Icone = ICONES_CATEGORIA[cat]
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoria(cat)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                      categoria === cat
                        ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-300'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    )}
                  >
                    <Icone className="w-3.5 h-3.5" />
                    {LABELS_CATEGORIA[cat]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Prioridade
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(LABELS_PRIORIDADE) as PrioridadeAnotacao[]).map((prio) => (
                <button
                  key={prio}
                  type="button"
                  onClick={() => setPrioridade(prio)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    prioridade === prio
                      ? cn(LABELS_PRIORIDADE[prio].cor, 'ring-2 ring-offset-1 ring-amber-500')
                      : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  )}
                >
                  {LABELS_PRIORIDADE[prio].texto}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 
                     hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={carregando || !titulo.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 
                     hover:bg-amber-700 rounded-lg transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
          >
            {carregando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {anotacao ? 'Salvar' : 'Criar'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// Componente principal
export function PainelAnotacoes() {
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

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Painel de Anotações
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {estatisticas.total} anotações • {estatisticas.pendentes} pendentes
            {estatisticas.urgentes > 0 && (
              <span className="text-red-500 font-medium"> • {estatisticas.urgentes} urgentes</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={carregarAnotacoes}
            disabled={carregando}
            className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors
                     border border-zinc-200 dark:border-zinc-700"
            title="Atualizar"
          >
            <RefreshCw className={cn('w-4 h-4 text-zinc-600 dark:text-zinc-400', carregando && 'animate-spin')} />
          </button>
          <button
            onClick={abrirNovaAnotacao}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                     bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Anotação</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar anotações..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 
                       border border-zinc-200 dark:border-zinc-700 rounded-lg
                       text-zinc-900 dark:text-white placeholder-zinc-500
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            {termoBusca && (
              <button
                onClick={() => setTermoBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro de categoria */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value as CategoriaAnotacao | 'todas')}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 
                       border border-zinc-200 dark:border-zinc-700 rounded-lg
                       text-zinc-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                       appearance-none cursor-pointer"
            >
              <option value="todas">Todas as Categorias</option>
              {(Object.keys(LABELS_CATEGORIA) as CategoriaAnotacao[]).map((cat) => (
                <option key={cat} value={cat}>{LABELS_CATEGORIA[cat]}</option>
              ))}
            </select>
          </div>

          {/* Filtro de status */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'todas' | 'pendentes' | 'concluidas')}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 
                       border border-zinc-200 dark:border-zinc-700 rounded-lg
                       text-zinc-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                       appearance-none cursor-pointer"
            >
              <option value="todas">Todos os Status</option>
              <option value="pendentes">Pendentes</option>
              <option value="concluidas">Concluídas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Anotações */}
      {carregando && anotacoes.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      ) : anotacoesFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <StickyNote className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            {anotacoes.length === 0 ? 'Nenhuma anotação ainda' : 'Nenhuma anotação encontrada'}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
            {anotacoes.length === 0
              ? 'Crie sua primeira anotação para começar!'
              : 'Tente ajustar os filtros de busca'}
          </p>
          {anotacoes.length === 0 && (
            <button
              onClick={abrirNovaAnotacao}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
                       bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar Anotação
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {anotacoesFiltradas.map((anotacao) => (
              <CardAnotacao
                key={anotacao.id}
                anotacao={anotacao}
                onEditar={abrirEditarAnotacao}
                onExcluir={excluirAnotacao}
                onToggleConcluida={toggleConcluida}
                onToggleFixada={toggleFixada}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalAberto && (
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
        )}
      </AnimatePresence>
    </div>
  )
}
