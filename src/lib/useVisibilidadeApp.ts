'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

type ConfiguracaoVisibilidade = {
  // Tempo em ms para considerar que o app ficou muito tempo em background
  tempoMaximoBackground: number
  // Callback executado quando o app volta ao foco após muito tempo
  aoRetornarDoBackground?: () => void
  // Callback executado quando a conexão é restaurada
  aoReconectar?: () => void
  // Nome do canal Realtime para monitorar (opcional)
  nomeCanal?: string
}

const TEMPO_PADRAO_BACKGROUND = 30000 // 30 segundos

/**
 * Hook para gerenciar a visibilidade do app e reconexão automática.
 * Resolve o problema de tela escura quando o usuário sai do app e volta depois de um tempo.
 * 
 * O problema ocorre porque:
 * 1. A conexão Realtime do Supabase é perdida quando o app fica em background
 * 2. O Service Worker pode servir cache expirado
 * 3. O estado do React fica "congelado" e não reflete dados atuais
 * 
 * Este hook detecta quando o app volta ao foco e força uma reconexão/atualização.
 */
export function useVisibilidadeApp(config: ConfiguracaoVisibilidade) {
  const timestampBackground = useRef<number | null>(null)
  const estaOnline = useRef(true)
  const tentativasReconexao = useRef(0)
  const intervaloVerificacao = useRef<NodeJS.Timeout | null>(null)

  const {
    tempoMaximoBackground = TEMPO_PADRAO_BACKGROUND,
    aoRetornarDoBackground,
    aoReconectar,
    nomeCanal
  } = config

  // Verifica se a conexão com o Supabase está funcionando
  const verificarConexao = useCallback(async (): Promise<boolean> => {
    try {
      // Faz uma query simples para testar a conexão
      const { error } = await supabase
        .from('configuracoes')
        .select('id')
        .limit(1)
        .maybeSingle()

      // Se não houver erro, a conexão está ok
      return !error
    } catch {
      return false
    }
  }, [])

  // Força reconexão do Realtime
  const forcarReconexaoRealtime = useCallback(async () => {
    console.log('[Visibilidade] Forçando reconexão do Realtime...')
    
    try {
      // Remove todos os canais existentes e reconecta
      const canais = supabase.getChannels()
      
      for (const canal of canais) {
        await supabase.removeChannel(canal)
      }

      // Aguarda um momento antes de notificar para reconexão
      await new Promise(resolve => setTimeout(resolve, 100))
      
      tentativasReconexao.current = 0
      console.log('[Visibilidade] Canais Realtime removidos, pronto para reconexão')
      
      aoReconectar?.()
    } catch (erro) {
      console.error('[Visibilidade] Erro ao reconectar Realtime:', erro)
    }
  }, [aoReconectar])

  // Tenta reconectar com backoff exponencial
  const tentarReconectar = useCallback(async () => {
    const maxTentativas = 5
    
    if (tentativasReconexao.current >= maxTentativas) {
      console.log('[Visibilidade] Máximo de tentativas atingido, recarregando página...')
      window.location.reload()
      return
    }

    tentativasReconexao.current++
    const delay = Math.min(1000 * Math.pow(2, tentativasReconexao.current - 1), 10000)
    
    console.log(`[Visibilidade] Tentativa ${tentativasReconexao.current}/${maxTentativas} em ${delay}ms`)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    const conectado = await verificarConexao()
    
    if (conectado) {
      console.log('[Visibilidade] Conexão restaurada!')
      estaOnline.current = true
      tentativasReconexao.current = 0
      await forcarReconexaoRealtime()
    } else {
      await tentarReconectar()
    }
  }, [verificarConexao, forcarReconexaoRealtime])

  // Handler para mudança de visibilidade
  const handleVisibilityChange = useCallback(async () => {
    if (document.hidden) {
      // App foi para background
      timestampBackground.current = Date.now()
      console.log('[Visibilidade] App em background')
    } else {
      // App voltou ao foco
      console.log('[Visibilidade] App voltou ao foco')
      
      const tempoEmBackground = timestampBackground.current 
        ? Date.now() - timestampBackground.current 
        : 0

      console.log(`[Visibilidade] Tempo em background: ${tempoEmBackground}ms`)

      // Se ficou muito tempo em background, força atualização
      if (tempoEmBackground > tempoMaximoBackground) {
        console.log('[Visibilidade] Tempo em background excedido, verificando conexão...')
        
        const conectado = await verificarConexao()
        
        if (!conectado) {
          console.log('[Visibilidade] Conexão perdida, tentando reconectar...')
          estaOnline.current = false
          await tentarReconectar()
        } else {
          // Conexão ok, mas precisa atualizar dados
          console.log('[Visibilidade] Conexão ok, atualizando dados...')
          await forcarReconexaoRealtime()
          aoRetornarDoBackground?.()
        }
      } else {
        // Tempo curto em background, apenas verifica se precisa atualizar
        aoRetornarDoBackground?.()
      }

      timestampBackground.current = null
    }
  }, [tempoMaximoBackground, verificarConexao, tentarReconectar, forcarReconexaoRealtime, aoRetornarDoBackground])

  // Handler para mudança de status online/offline
  const handleOnline = useCallback(async () => {
    console.log('[Visibilidade] Dispositivo online')
    estaOnline.current = true
    
    const conectado = await verificarConexao()
    if (conectado) {
      await forcarReconexaoRealtime()
      aoReconectar?.()
    } else {
      await tentarReconectar()
    }
  }, [verificarConexao, forcarReconexaoRealtime, aoReconectar, tentarReconectar])

  const handleOffline = useCallback(() => {
    console.log('[Visibilidade] Dispositivo offline')
    estaOnline.current = false
  }, [])

  // Handler para quando a página é "congelada" (Page Lifecycle API)
  const handleFreeze = useCallback(() => {
    console.log('[Visibilidade] Página congelada pelo sistema')
    timestampBackground.current = Date.now()
  }, [])

  const handleResume = useCallback(async () => {
    console.log('[Visibilidade] Página retomada')
    
    const tempoCongelado = timestampBackground.current 
      ? Date.now() - timestampBackground.current 
      : 0

    if (tempoCongelado > tempoMaximoBackground) {
      console.log('[Visibilidade] Página ficou congelada por muito tempo, recarregando...')
      window.location.reload()
    }
  }, [tempoMaximoBackground])

  // Configura verificação periódica de conexão quando visível
  const iniciarVerificacaoPeriodica = useCallback(() => {
    if (intervaloVerificacao.current) {
      clearInterval(intervaloVerificacao.current)
    }

    // Verifica conexão a cada 60 segundos quando o app está visível
    intervaloVerificacao.current = setInterval(async () => {
      if (!document.hidden && estaOnline.current) {
        const conectado = await verificarConexao()
        
        if (!conectado && estaOnline.current) {
          console.log('[Visibilidade] Conexão perdida durante uso, tentando reconectar...')
          estaOnline.current = false
          await tentarReconectar()
        }
      }
    }, 60000)
  }, [verificarConexao, tentarReconectar])

  useEffect(() => {
    // Registra os event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Page Lifecycle API (se disponível)
    if ('onfreeze' in document) {
      document.addEventListener('freeze', handleFreeze)
      document.addEventListener('resume', handleResume)
    }

    // Inicia verificação periódica
    iniciarVerificacaoPeriodica()

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if ('onfreeze' in document) {
        document.removeEventListener('freeze', handleFreeze)
        document.removeEventListener('resume', handleResume)
      }

      if (intervaloVerificacao.current) {
        clearInterval(intervaloVerificacao.current)
      }
    }
  }, [handleVisibilityChange, handleOnline, handleOffline, handleFreeze, handleResume, iniciarVerificacaoPeriodica])

  return {
    verificarConexao,
    forcarReconexaoRealtime,
    estaOnline: () => estaOnline.current
  }
}
