'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Printer, Trash2, RefreshCw, Clock, CheckCircle, AlertCircle,
  Loader2, ChevronDown, ChevronUp, X, Send, Power, Save,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import Interruptor from '@/components/admin/Interruptor'
import {
  CONFIGURACAO_FILA_IMPRESSAO_PADRAO,
  carregarConfiguracaoFilaImpressao,
  salvarConfiguracaoFilaImpressao,
  type ConfiguracaoFilaImpressao,
} from '@/lib/filaImpressao'

type ItemFila = {
  id: string
  pedido_id: string
  tipo: 'cozinha' | 'cliente'
  status: 'pendente' | 'processando' | 'impresso' | 'erro'
  tentativas: number
  erro_mensagem: string | null
  criado_em: string
  processado_em: string | null
  impresso_em: string | null
  pedidos?: {
    id: string
    nome_cliente: string
    total: number
    status: string
  }
}

type Estatisticas = {
  pendentes: number
  processando: number
  impressos: number
  erros: number
}

type DialogConfirmacao = {
  aberto: boolean
  titulo: string
  descricao: string
  acao: (() => Promise<void>) | null
}

export default function GerenciadorImpressao() {
  const [expandido, setExpandido] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [carregandoConfiguracao, setCarregandoConfiguracao] = useState(true)
  const [salvandoConfiguracao, setSalvandoConfiguracao] = useState(false)
  const [configuracaoFila, setConfiguracaoFila] = useState<ConfiguracaoFilaImpressao>(
    CONFIGURACAO_FILA_IMPRESSAO_PADRAO,
  )
  const [horarioRascunho, setHorarioRascunho] = useState({
    inicio: CONFIGURACAO_FILA_IMPRESSAO_PADRAO.horarioInicio,
    fim: CONFIGURACAO_FILA_IMPRESSAO_PADRAO.horarioFim,
  })
  const [itensFila, setItensFila] = useState<ItemFila[]>([])
  const [itensImpressos, setItensImpressos] = useState<ItemFila[]>([])
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    pendentes: 0, processando: 0, impressos: 0, erros: 0,
  })
  const [abaAtiva, setAbaAtiva] = useState<'fila' | 'impressos' | 'erros'>('fila')
  const [dialog, setDialog] = useState<DialogConfirmacao>({
    aberto: false, titulo: '', descricao: '', acao: null,
  })
  const [executandoDialog, setExecutandoDialog] = useState(false)
  const salvandoConfiguracaoRef = useRef(false)
  const filaAtiva = configuracaoFila.filaAutomaticaAtiva

  const carregarConfiguracao = useCallback(async () => {
    setCarregandoConfiguracao(true)
    try {
      const configuracao = await carregarConfiguracaoFilaImpressao()
      setConfiguracaoFila(configuracao)
      setHorarioRascunho({ inicio: configuracao.horarioInicio, fim: configuracao.horarioFim })
    } catch (erro) {
      console.error('[FilaImpressao] Erro ao carregar configuração:', erro)
      toast.error('Não foi possível carregar a configuração da fila')
    } finally {
      setCarregandoConfiguracao(false)
    }
  }, [])

  const carregarFila = useCallback(async () => {
    setCarregando(true)
    try {
      const { data: pendentes } = await supabase
        .from('fila_impressao')
        .select('*, pedidos(id, nome_cliente, total, status)')
        .in('status', ['pendente', 'processando'])
        .order('criado_em', { ascending: true })

      const ontemISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: impressos } = await supabase
        .from('fila_impressao')
        .select('*, pedidos(id, nome_cliente, total, status)')
        .eq('status', 'impresso')
        .gte('impresso_em', ontemISO)
        .order('impresso_em', { ascending: false })
        .limit(50)

      const { data: erros } = await supabase
        .from('fila_impressao')
        .select('*, pedidos(id, nome_cliente, total, status)')
        .eq('status', 'erro')
        .order('criado_em', { ascending: false })
        .limit(20)

      setItensFila([...(pendentes || []), ...(erros || [])])
      setItensImpressos(impressos || [])
      setEstatisticas({
        pendentes: (pendentes || []).filter((i: ItemFila) => i.status === 'pendente').length,
        processando: (pendentes || []).filter((i: ItemFila) => i.status === 'processando').length,
        impressos: (impressos || []).length,
        erros: (erros || []).length,
      })
    } catch {
      // silencioso — erros de carregamento não precisam de toast
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarFila()
    const channel = supabase
      .channel('fila-impressao-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_impressao' }, carregarFila)
      .subscribe()
    const intervalo = setInterval(carregarFila, 10000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(intervalo)
    }
  }, [carregarFila])

  useEffect(() => {
    void carregarConfiguracao()
    const channel = supabase
      .channel('configuracao-fila-impressao-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_loja' },
        () => void carregarConfiguracao(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [carregarConfiguracao])

  const confirmar = (titulo: string, descricao: string, acao: () => Promise<void>) => {
    setDialog({ aberto: true, titulo, descricao, acao })
  }

  const executarDialog = async () => {
    if (!dialog.acao) return
    setExecutandoDialog(true)
    try {
      await dialog.acao()
    } finally {
      setExecutandoDialog(false)
      setDialog({ aberto: false, titulo: '', descricao: '', acao: null })
    }
  }

  const limparFilaPendente = () =>
    confirmar(
      'Limpar fila pendente',
      'Todos os itens pendentes e com erro serão removidos da fila. Esta ação não pode ser desfeita.',
      async () => {
        const { error } = await supabase
          .from('fila_impressao')
          .delete()
          .in('status', ['pendente', 'erro'])
        if (error) { toast.error('Erro ao limpar fila'); return }
        toast.success('Fila limpa com sucesso')
        carregarFila()
      }
    )

  const removerItem = async (itemId: string) => {
    const { error } = await supabase.from('fila_impressao').delete().eq('id', itemId)
    if (error) { toast.error('Erro ao remover item'); return }
    toast.success('Item removido')
    carregarFila()
  }

  const reenviarItem = async (itemId: string) => {
    const { error } = await supabase
      .from('fila_impressao')
      .update({ status: 'pendente', erro_mensagem: null, tentativas: 0, automatico: false })
      .eq('id', itemId)
    if (error) { toast.error('Erro ao reenviar item'); return }
    toast.success('Item reenviado para fila')
    carregarFila()
  }

  const limparHistorico = () =>
    confirmar(
      'Limpar histórico',
      'O histórico de impressões com mais de 24 horas será removido permanentemente.',
      async () => {
        const ontemISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { error } = await supabase
          .from('fila_impressao')
          .delete()
          .eq('status', 'impresso')
          .lt('impresso_em', ontemISO)
        if (error) { toast.error('Erro ao limpar histórico'); return }
        toast.success('Histórico limpo')
        carregarFila()
      }
    )

  const persistirConfiguracao = async (
    proximaConfiguracao: ConfiguracaoFilaImpressao,
    mensagemSucesso: string,
  ) => {
    if (salvandoConfiguracaoRef.current) return
    salvandoConfiguracaoRef.current = true
    setSalvandoConfiguracao(true)
    try {
      const resultado = await salvarConfiguracaoFilaImpressao(proximaConfiguracao)
      setConfiguracaoFila(proximaConfiguracao)
      setHorarioRascunho({
        inicio: proximaConfiguracao.horarioInicio,
        fim: proximaConfiguracao.horarioFim,
      })
      toast.success(mensagemSucesso, {
        description: resultado.cancelados > 0
          ? `${resultado.cancelados} pendência${resultado.cancelados === 1 ? '' : 's'} automática${resultado.cancelados === 1 ? '' : 's'} cancelada${resultado.cancelados === 1 ? '' : 's'}.`
          : undefined,
      })
      await carregarFila()
    } catch (erro) {
      console.error('[FilaImpressao] Erro ao salvar configuração:', erro)
      toast.error('Não foi possível salvar a configuração da fila')
      await carregarConfiguracao()
    } finally {
      salvandoConfiguracaoRef.current = false
      setSalvandoConfiguracao(false)
    }
  }

  const toggleFila = () => {
    const proxima = { ...configuracaoFila, filaAutomaticaAtiva: !filaAtiva }
    void persistirConfiguracao(
      proxima,
      proxima.filaAutomaticaAtiva ? 'Fila automática ativada' : 'Fila automática pausada',
    )
  }

  const toggleItensEditados = (ativado: boolean) => {
    void persistirConfiguracao(
      { ...configuracaoFila, imprimirItensEditados: ativado },
      ativado
        ? 'Impressão automática de itens editados ativada'
        : 'Impressão automática de itens editados desativada',
    )
  }

  const salvarHorario = () => {
    void persistirConfiguracao(
      {
        ...configuracaoFila,
        horarioInicio: horarioRascunho.inicio,
        horarioFim: horarioRascunho.fim,
      },
      'Horário da fila automática atualizado',
    )
  }

  const formatarData = (data: string | null) => {
    if (!data) return '—'
    return format(new Date(data), 'dd/MM HH:mm', { locale: ptBR })
  }

  const itensFiltrados =
    abaAtiva === 'fila' ? itensFila.filter(i => i.status !== 'erro')
    : abaAtiva === 'erros' ? itensFila.filter(i => i.status === 'erro')
    : itensImpressos

  const abas: { key: typeof abaAtiva; label: string; count: number }[] = [
    { key: 'fila', label: 'Fila', count: estatisticas.pendentes + estatisticas.processando },
    { key: 'impressos', label: 'Impressos', count: estatisticas.impressos },
    { key: 'erros', label: 'Erros', count: estatisticas.erros },
  ]

  const statusDot = (status: ItemFila['status']) => {
    switch (status) {
      case 'pendente':    return 'bg-amber-500'
      case 'processando': return 'bg-sky-500 animate-pulse'
      case 'impresso':    return 'bg-emerald-500'
      case 'erro':        return 'bg-destructive'
    }
  }

  const filaVazia = estatisticas.pendentes === 0 && estatisticas.processando === 0 && estatisticas.erros === 0

  return (
    <>
      <div className="bg-card rounded-lg border border-border/70 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpandido(!expandido)}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/40 flex-shrink-0">
              {filaAtiva ? (
                <Printer className="w-4 h-4 text-foreground" strokeWidth={1.6} />
              ) : (
                <Power className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
              )}
              {!filaVazia && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${estatisticas.erros > 0 ? 'bg-destructive animate-ping' : 'bg-amber-500 animate-ping'}`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ring-2 ring-card ${estatisticas.erros > 0 ? 'bg-destructive' : 'bg-amber-500'}`} />
                </span>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Fila de Impressão</h3>
              <div className="flex items-center gap-2.5 mt-0.5">
                {estatisticas.pendentes > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" strokeWidth={1.6} />
                    {estatisticas.pendentes} pendente{estatisticas.pendentes !== 1 ? 's' : ''}
                  </span>
                )}
                {estatisticas.processando > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {estatisticas.processando} processando
                  </span>
                )}
                {estatisticas.erros > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="w-3 h-3" strokeWidth={1.6} />
                    {estatisticas.erros} erro{estatisticas.erros !== 1 ? 's' : ''}
                  </span>
                )}
                {filaVazia && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CheckCircle className="w-3 h-3" strokeWidth={1.6} />
                    Fila vazia
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); carregarFila() }}
              disabled={carregando}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} strokeWidth={1.8} />
            </button>
            {expandido ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
            )}
          </div>
        </div>

        {/* Expandido */}
        <AnimatePresence>
          {expandido && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/70">
                {/* Barra de ações */}
                <div className="flex items-center justify-between px-4 py-2.5 gap-2">
                  <button
                    onClick={toggleFila}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors ${
                      filaAtiva
                        ? 'border-border/70 bg-card text-foreground hover:bg-muted'
                        : 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {filaAtiva ? <Printer className="w-3.5 h-3.5" strokeWidth={1.6} /> : <Power className="w-3.5 h-3.5" strokeWidth={1.6} />}
                    {filaAtiva ? 'Ativa' : 'Pausada'}
                  </button>

                  {(estatisticas.pendentes > 0 || estatisticas.erros > 0) && (
                    <button
                      onClick={limparFilaPendente}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-destructive border border-destructive/30 bg-destructive/10 hover:bg-destructive/15 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                      Limpar fila
                    </button>
                  )}
                </div>

                <div className="border-t border-border/70 bg-muted/10 px-4 py-3">
                  {carregandoConfiguracao ? (
                    <div className="flex h-20 items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">Itens adicionados na edição</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Envia apenas os itens novos para a cozinha.
                          </p>
                        </div>
                        <Interruptor
                          ativado={configuracaoFila.imprimirItensEditados}
                          aoAlternar={toggleItensEditados}
                          desabilitado={salvandoConfiguracao}
                          aria-label="Alternar impressão automática de itens adicionados na edição"
                        />
                      </div>

                      <div className="border-t border-border/60 pt-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
                            Início
                            <input
                              type="time"
                              value={horarioRascunho.inicio}
                              onChange={(evento) => setHorarioRascunho((atual) => ({
                                ...atual,
                                inicio: evento.target.value,
                              }))}
                              disabled={salvandoConfiguracao}
                              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </label>
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
                            Fim
                            <input
                              type="time"
                              value={horarioRascunho.fim}
                              onChange={(evento) => setHorarioRascunho((atual) => ({
                                ...atual,
                                fim: evento.target.value,
                              }))}
                              disabled={salvandoConfiguracao}
                              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={salvarHorario}
                            disabled={salvandoConfiguracao}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                          >
                            {salvandoConfiguracao
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Save className="h-3.5 w-3.5" />}
                            Salvar horário
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Horários iguais mantêm a fila automática ativa 24h. Impressões manuais continuam disponíveis.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Abas */}
                <div className="flex border-b border-border/70 px-4">
                  {abas.map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setAbaAtiva(key)}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        abaAtiva === key
                          ? 'border-foreground text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                      <span className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] tabular-nums ${
                        abaAtiva === key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                      }`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Lista */}
                <div className="max-h-72 overflow-y-auto">
                  {carregando ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                    </div>
                  ) : itensFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <CheckCircle className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.4} />
                      <p className="text-sm text-muted-foreground">
                        {abaAtiva === 'fila' ? 'Nenhum item na fila' : abaAtiva === 'impressos' ? 'Nenhuma impressão recente' : 'Nenhum erro'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {itensFiltrados.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex-shrink-0 inline-flex h-2 w-2 rounded-full ${statusDot(item.status)}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-medium text-foreground">
                                  #{item.pedido_id.slice(0, 8).toUpperCase()}
                                </span>
                                <span className="inline-flex items-center rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {item.tipo === 'cozinha' ? 'Cozinha' : 'Cliente'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {item.pedidos?.nome_cliente && (
                                  <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                    {item.pedidos.nome_cliente}
                                  </span>
                                )}
                                <span className="text-[11px] text-muted-foreground/50">·</span>
                                <span className="text-[11px] font-mono text-muted-foreground">{formatarData(item.criado_em)}</span>
                                {item.erro_mensagem && (
                                  <>
                                    <span className="text-[11px] text-muted-foreground/50">·</span>
                                    <span className="text-[11px] text-destructive truncate max-w-[150px]">{item.erro_mensagem}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {item.status === 'erro' && (
                              <button
                                onClick={() => reenviarItem(item.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Reenviar"
                              >
                                <Send className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            )}
                            {(item.status === 'pendente' || item.status === 'erro') && (
                              <button
                                onClick={() => removerItem(item.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Remover"
                              >
                                <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {abaAtiva === 'impressos' && itensImpressos.length > 0 && (
                  <div className="px-4 py-3 border-t border-border/70">
                    <button
                      onClick={limparHistorico}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar histórico antigo
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dialog de confirmação */}
      <Dialog open={dialog.aberto} onOpenChange={(open) => !open && setDialog(d => ({ ...d, aberto: false }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog.titulo}</DialogTitle>
            <DialogDescription>{dialog.descricao}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setDialog(d => ({ ...d, aberto: false }))}
              className="inline-flex h-9 items-center justify-center px-4 rounded-md border border-border/70 bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={executarDialog}
              disabled={executandoDialog}
              className="inline-flex h-9 items-center justify-center gap-2 px-4 rounded-md bg-foreground text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {executandoDialog && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
