'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import type { Funcionario } from './tipos-caixa'

// Gerenciador de Notificações Robusto
class NotificationManager {
  private static instance: NotificationManager
  private swRegistration: ServiceWorkerRegistration | null = null
  private audioElement: HTMLAudioElement | null = null
  private permissionGranted = false

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  async initialize(): Promise<boolean> {
    if (typeof window === 'undefined') return false

    try {
      // Inicializar áudio
      this.audioElement = new Audio('/notificacao.mp3')
      this.audioElement.volume = 0.8
      this.audioElement.preload = 'auto'

      // Registrar Service Worker
      if ('serviceWorker' in navigator) {
        try {
          this.swRegistration = await navigator.serviceWorker.register('/sw-entregador.js', {
            scope: '/entregador'
          })
          console.log('[NotificationManager] SW registrado:', this.swRegistration.scope)
          
          // Aguardar SW ficar ativo
          if (this.swRegistration.installing) {
            await new Promise<void>((resolve) => {
              this.swRegistration!.installing!.addEventListener('statechange', (e) => {
                if ((e.target as ServiceWorker).state === 'activated') {
                  resolve()
                }
              })
            })
          }
        } catch (swError) {
          console.warn('[NotificationManager] Erro ao registrar SW:', swError)
        }
      }

      // Verificar permissão
      this.permissionGranted = await this.checkPermission()
      
      return this.permissionGranted
    } catch (error) {
      console.error('[NotificationManager] Erro na inicialização:', error)
      return false
    }
  }

  async checkPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('[NotificationManager] Notificações não suportadas')
      return false
    }
    return Notification.permission === 'granted'
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false

    if (Notification.permission === 'granted') {
      this.permissionGranted = true
      return true
    }

    if (Notification.permission === 'denied') {
      console.log('[NotificationManager] Permissão negada anteriormente')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      this.permissionGranted = permission === 'granted'
      return this.permissionGranted
    } catch (error) {
      console.error('[NotificationManager] Erro ao solicitar permissão:', error)
      return false
    }
  }

  isPermissionGranted(): boolean {
    return this.permissionGranted
  }

  async notify(title: string, body: string, tag?: string): Promise<void> {
    console.log('[NotificationManager] Enviando notificação:', title)

    // Sempre tocar som (não depende de permissão)
    this.playSound()

    // Vibrar se suportado
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }

    if (!this.permissionGranted) {
      console.log('[NotificationManager] Sem permissão, apenas som/vibração')
      return
    }

    const notificationOptions: NotificationOptions = {
      body,
      icon: '/logo.webp',
      badge: '/logo.webp',
      tag: tag || `entrega-${Date.now()}`,
      requireInteraction: true,
      silent: false,
      data: { url: '/entregador' }
    }

    try {
      // Tentar via Service Worker (funciona em background)
      if (this.swRegistration?.active) {
        await this.swRegistration.showNotification(title, notificationOptions)
        console.log('[NotificationManager] Notificação enviada via SW')
      } else {
        // Fallback para Notification API direta
        const notification = new Notification(title, notificationOptions)
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
        console.log('[NotificationManager] Notificação enviada via API direta')
      }
    } catch (error) {
      console.error('[NotificationManager] Erro ao enviar notificação:', error)
      // Fallback final - apenas som já foi tocado
    }
  }

  private playSound(): void {
    if (!this.audioElement) return

    try {
      this.audioElement.currentTime = 0
      const playPromise = this.audioElement.play()
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log('[NotificationManager] Som bloqueado (interação necessária):', error)
        })
      }
    } catch (error) {
      console.log('[NotificationManager] Erro ao tocar som:', error)
    }
  }
}

// Instância global
const notificationManager = NotificationManager.getInstance()

// Tipos específicos do painel do entregador
export type EntregaParaEntregador = {
  id: string
  pedido_id: string
  status: 'pendente' | 'em_rota' | 'entregue' | 'cancelada'
  endereco_entrega: string | null
  bairro: string | null
  taxa_entrega: number
  tempo_estimado: number | null
  tempo_real: number | null
  observacoes: string | null
  data_saida: string | null
  data_entrega: string | null
  created_at: string
  pedido: {
    id: string
    nome_cliente: string
    telefone: string | null
    endereco: string | null
    bairro: string | null
    taxa_entrega: number
    total: number
    forma_pagamento: string
    observacoes: string | null
  } | null
}

export type EstatisticasEntregador = {
  pendentes: number
  emRota: number
  concluidas: number
  totalHoje: number
  ganhoHoje: number
}

type NotificacaoEntregador = {
  id: string
  tipo: 'nova_entrega' | 'cancelamento' | 'info'
  titulo: string
  mensagem: string
  timestamp: Date
  lida: boolean
}

const HORA_INICIO_DIA_OPERACIONAL = 3

const criarDataLocal = (data?: string | null) => {
  if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [ano, mes, dia] = data.split('-').map(Number)
    return new Date(ano, mes - 1, dia)
  }

  return new Date()
}

const criarIntervaloDiaOperacional = (data?: string | null) => {
  const agora = new Date()
  const inicio = criarDataLocal(data)
  inicio.setHours(HORA_INICIO_DIA_OPERACIONAL, 0, 0, 0)

  if (!data && agora < inicio) {
    inicio.setDate(inicio.getDate() - 1)
  }

  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)

  return { inicio, fim }
}

export function useEntregador(entregadorId: string | null, dataFiltro?: string | null) {
  const [entregas, setEntregas] = useState<EntregaParaEntregador[]>([])
  const [entregador, setEntregador] = useState<Funcionario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [estatisticas, setEstatisticas] = useState<EstatisticasEntregador>({
    pendentes: 0,
    emRota: 0,
    concluidas: 0,
    totalHoje: 0,
    ganhoHoje: 0
  })
  const [notificacoes, setNotificacoes] = useState<NotificacaoEntregador[]>([])
  const [notificacoesPermitidas, setNotificacoesPermitidas] = useState(false)

  const entregasRef = useRef<EntregaParaEntregador[]>([])
  const inicializadoRef = useRef(false)

  // Manter ref atualizada
  useEffect(() => {
    entregasRef.current = entregas
  }, [entregas])

  // Inicializar sistema de notificações
  useEffect(() => {
    if (inicializadoRef.current) return
    inicializadoRef.current = true

    const init = async () => {
      const permitido = await notificationManager.initialize()
      setNotificacoesPermitidas(permitido)
      console.log('[Entregador] Notificações inicializadas:', permitido)
    }

    init()
  }, [])

  // Solicitar permissão de notificações
  const verificarPermissaoNotificacao = useCallback(async () => {
    const permitido = await notificationManager.requestPermission()
    setNotificacoesPermitidas(permitido)
    return permitido
  }, [])

  // Enviar notificação
  const enviarNotificacaoPush = useCallback(async (titulo: string, corpo: string, tag?: string) => {
    await notificationManager.notify(titulo, corpo, tag)
  }, [])

  // Adicionar notificação interna
  const adicionarNotificacao = useCallback((
    tipo: NotificacaoEntregador['tipo'],
    titulo: string,
    mensagem: string
  ) => {
    const novaNotificacao: NotificacaoEntregador = {
      id: Date.now().toString(),
      tipo,
      titulo,
      mensagem,
      timestamp: new Date(),
      lida: false
    }
    setNotificacoes(prev => [novaNotificacao, ...prev].slice(0, 50))
  }, [])

  // Marcar notificação como lida
  const marcarNotificacaoLida = useCallback((id: string) => {
    setNotificacoes(prev => 
      prev.map(n => n.id === id ? { ...n, lida: true } : n)
    )
  }, [])

  // Limpar notificações lidas
  const limparNotificacoesLidas = useCallback(() => {
    setNotificacoes(prev => prev.filter(n => !n.lida))
  }, [])

  // Carregar dados do entregador
  const carregarEntregador = useCallback(async () => {
    if (!entregadorId) return

    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('*')
        .eq('id', entregadorId)
        .single()

      if (error) throw error
      setEntregador(data)
    } catch (erro) {
      console.error('[Entregador] Erro ao carregar dados:', erro)
    }
  }, [entregadorId])

  const obterIntervaloDiaOperacional = useCallback(() => {
    return criarIntervaloDiaOperacional(dataFiltro)
  }, [dataFiltro])

  // Calcular estatísticas do período selecionado
  const calcularEstatisticas = useCallback((listaEntregas: EntregaParaEntregador[]) => {
    const stats: EstatisticasEntregador = {
      pendentes: listaEntregas.filter(e => e.status === 'pendente').length,
      emRota: listaEntregas.filter(e => e.status === 'em_rota').length,
      concluidas: listaEntregas.filter(e => e.status === 'entregue').length,
      totalHoje: listaEntregas.length,
      ganhoHoje: listaEntregas
        .filter(e => e.status === 'entregue')
        .reduce((acc, e) => acc + (e.taxa_entrega || 0), 0)
    }

    setEstatisticas(stats)
  }, [])

  // Carregar entregas
  const carregarEntregas = useCallback(async () => {
    try {
      const { inicio, fim } = obterIntervaloDiaOperacional()

      const { data, error } = await supabase
        .from('entregas')
        .select(`
          *,
          pedido:pedidos(id, nome_cliente, telefone, endereco, bairro, taxa_entrega, total, forma_pagamento, observacoes)
        `)
        .gte('created_at', inicio.toISOString())
        .lt('created_at', fim.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error

      setEntregas(data || [])
      calcularEstatisticas(data || [])
    } catch (erro) {
      console.error('[Entregador] Erro ao carregar entregas:', erro)
    }
  }, [calcularEstatisticas, obterIntervaloDiaOperacional])

  // Iniciar entrega (mudar para em_rota)
  const iniciarEntrega = useCallback(async (entregaId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('entregas')
        .update({
          status: 'em_rota',
          data_saida: new Date().toISOString()
        })
        .eq('id', entregaId)

      if (error) throw error

      await carregarEntregas()
      return true
    } catch (erro) {
      console.error('[Entregador] Erro ao iniciar entrega:', erro)
      return false
    }
  }, [carregarEntregas])

  // Concluir entrega
  const concluirEntrega = useCallback(async (entregaId: string): Promise<boolean> => {
    try {
      const entrega = entregas.find(e => e.id === entregaId)
      if (!entrega) return false

      // Calcular tempo real se tiver data de saída
      let tempoReal = null
      if (entrega.data_saida) {
        const saida = new Date(entrega.data_saida)
        const agora = new Date()
        tempoReal = Math.round((agora.getTime() - saida.getTime()) / 60000) // em minutos
      }

      const { error } = await supabase
        .from('entregas')
        .update({
          status: 'entregue',
          data_entrega: new Date().toISOString(),
          tempo_real: tempoReal
        })
        .eq('id', entregaId)

      if (error) throw error

      // Atualizar status do pedido também
      if (entrega.pedido_id) {
        const { error: erroPedido } = await supabase
          .from('pedidos')
          .update({ status: 'entregue', updated_at: new Date().toISOString() })
          .eq('id', entrega.pedido_id)
        if (erroPedido) {
          console.error('[Entregador] Falha ao atualizar status do pedido:', erroPedido.message)
        }
      }

      await carregarEntregas()
      return true
    } catch (erro) {
      console.error('[Entregador] Erro ao concluir entrega:', erro)
      return false
    }
  }, [entregas, carregarEntregas])

  // Sincronizar pedidos de entrega faltantes na tabela entregas
  const sincronizarPedidosFaltantes = useCallback(async () => {
    try {
      const { inicio, fim } = obterIntervaloDiaOperacional()
      const { inicio: inicioAtual } = criarIntervaloDiaOperacional(null)

      if (inicio.getTime() !== inicioAtual.getTime()) return
      
      // Buscar pedidos de entrega que não têm registro na tabela entregas
      const { data: pedidosFaltantes } = await supabase
        .from('pedidos')
        .select('id, endereco, bairro, taxa_entrega, status, created_at, updated_at')
        .eq('tipo_entrega', 'entrega')
        .gte('created_at', inicio.toISOString())
        .lt('created_at', fim.toISOString())
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')

      if (!pedidosFaltantes || pedidosFaltantes.length === 0) return

      // Buscar entregas existentes
      const { data: entregasExistentes } = await supabase
        .from('entregas')
        .select('pedido_id')
        .in('pedido_id', pedidosFaltantes.map((pedido) => pedido.id))

      const pedidosComEntrega = new Set(entregasExistentes?.map(e => e.pedido_id) || [])

      // Inserir entregas faltantes
      const faltantes = pedidosFaltantes.filter(p => !pedidosComEntrega.has(p.id))
      
      if (faltantes.length > 0) {
        console.log(`[Entregador] Sincronizando ${faltantes.length} pedido(s) faltante(s)`)
        
        for (const pedido of faltantes) {
          // Usar upsert para evitar duplicatas (constraint unique em pedido_id)
          const { error } = await supabase.from('entregas').upsert({
            pedido_id: pedido.id,
            endereco_entrega: pedido.endereco || null,
            bairro: pedido.bairro || null,
            taxa_entrega: pedido.taxa_entrega || 0,
            status: pedido.status === 'entregue' ? 'entregue' : 'pendente',
            data_entrega: pedido.status === 'entregue' ? pedido.updated_at : null
          }, { 
            onConflict: 'pedido_id',
            ignoreDuplicates: true 
          })
          
          // Ignora erro de duplicata silenciosamente
          if (error && error.code !== '23505') {
            console.error('[Entregador] Erro ao criar entrega:', error)
          }
        }
      }
    } catch (erro) {
      console.error('[Entregador] Erro ao sincronizar pedidos faltantes:', erro)
    }
  }, [obterIntervaloDiaOperacional])

  // Carregar dados iniciais
  const carregarDados = useCallback(async () => {
    setCarregando(true)
    await sincronizarPedidosFaltantes()
    await Promise.all([
      carregarEntregador(),
      carregarEntregas(),
      verificarPermissaoNotificacao()
    ])
    setCarregando(false)
  }, [carregarEntregador, carregarEntregas, verificarPermissaoNotificacao, sincronizarPedidosFaltantes])

  // Referência para o canal Realtime
  const canalRealtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Configura o canal Realtime
  const configurarRealtime = useCallback(() => {
    // Remove canal anterior se existir
    if (canalRealtimeRef.current) {
      supabase.removeChannel(canalRealtimeRef.current)
    }

    const channel = supabase
      .channel('entregador-realtime-' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'entregas' },
        async (payload) => {
          console.log('[Entregador] Nova entrega:', payload)
          
          // Buscar dados completos da entrega
          const { data: novaEntrega } = await supabase
            .from('entregas')
            .select(`
              *,
              pedido:pedidos(id, nome_cliente, telefone, endereco, bairro, taxa_entrega, total, forma_pagamento, observacoes)
            `)
            .eq('id', payload.new.id)
            .single()

          if (novaEntrega) {
            // Notificar
            const nomeCliente = novaEntrega.pedido?.nome_cliente || 'Cliente'
            const endereco = novaEntrega.endereco_entrega || novaEntrega.pedido?.endereco || 'Endereco nao informado'
            const total = novaEntrega.pedido?.total?.toFixed(2) || '0.00'
            
            adicionarNotificacao(
              'nova_entrega',
              'NOVA ENTREGA!',
              `${nomeCliente} - ${endereco}`
            )

            enviarNotificacaoPush(
              'NOVA ENTREGA - R$ ' + total,
              `${nomeCliente}\n${endereco}`,
              `entrega-${novaEntrega.id}`
            )
          }

          await carregarEntregas()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'entregas' },
        async (payload) => {
          console.log('[Entregador] Entrega atualizada:', payload)
          await carregarEntregas()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'entregas' },
        async (payload) => {
          console.log('[Entregador] Entrega removida:', payload)
          setEntregas(prev => prev.filter(e => e.id !== payload.old.id))
          calcularEstatisticas(entregasRef.current.filter(e => e.id !== payload.old.id))
        }
      )
      .subscribe((status) => {
        console.log('[Entregador] Realtime status:', status)
      })

    canalRealtimeRef.current = channel
  }, [carregarEntregas, calcularEstatisticas, adicionarNotificacao, enviarNotificacaoPush])

  // Handler para evento de reconexão do PWA
  const handleReconexao = useCallback(() => {
    console.log('[Entregador] Evento de reconexão recebido, atualizando dados...')
    carregarDados()
    configurarRealtime()
  }, [carregarDados, configurarRealtime])

  // Configurar Realtime e escutar eventos de reconexão
  useEffect(() => {
    carregarDados()
    configurarRealtime()

    // Escuta evento de reconexão do PWAManager
    window.addEventListener('pwa-entregador-reconectar', handleReconexao)

    return () => {
      if (canalRealtimeRef.current) {
        supabase.removeChannel(canalRealtimeRef.current)
      }
      window.removeEventListener('pwa-entregador-reconectar', handleReconexao)
    }
  }, [carregarDados, configurarRealtime, handleReconexao])

  return {
    entregas,
    entregador,
    estatisticas,
    notificacoes,
    notificacoesPermitidas,
    carregando,
    carregarDados,
    iniciarEntrega,
    concluirEntrega,
    verificarPermissaoNotificacao,
    marcarNotificacaoLida,
    limparNotificacoesLidas
  }
}
