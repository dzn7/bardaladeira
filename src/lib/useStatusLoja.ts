'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

const FUSO_HORARIO = 'America/Sao_Paulo'

type ConfiguracaoLoja = {
  chave: string
  valor: string
}

type HorarioDia = {
  abrir: string // "HH:mm"
  fechar: string // "HH:mm"
  ativo: boolean
}

type HorarioFuncionamento = {
  domingo: HorarioDia
  segunda: HorarioDia
  terca: HorarioDia
  quarta: HorarioDia
  quinta: HorarioDia
  sexta: HorarioDia
  sabado: HorarioDia
}

export type StatusLojaRetorno = {
  lojaFechada: boolean
  numeroWhatsApp: string
  carregando: boolean
  erro: string | null
  alterarStatusLoja: (fechada: boolean) => Promise<boolean>
  // Horário de funcionamento
  horarioAutomatico: boolean
  horarioFuncionamento: HorarioFuncionamento | null
  horarioHoje: HorarioDia | null
  fechamentoEstendidoAte: Date | null
  prestesAFechar: boolean
  minutosParaFechar: number | null
  modoManual: boolean
  // Ações
  alterarHorarioAutomatico: (ativo: boolean) => Promise<boolean>
  salvarHorarioFuncionamento: (horario: HorarioFuncionamento) => Promise<boolean>
  estenderFechamento: (minutos: number) => Promise<boolean>
  cancelarExtensao: () => Promise<boolean>
}

const DIAS_SEMANA: (keyof HorarioFuncionamento)[] = [
  'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
]

function obterAgora(): Date {
  return new Date()
}

function obterHoraLocal(data: Date): { hora: number; minuto: number } {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(data)

  const hora = parseInt(partes.find(p => p.type === 'hour')?.value || '0', 10)
  const minuto = parseInt(partes.find(p => p.type === 'minute')?.value || '0', 10)
  return { hora, minuto }
}

function obterDiaSemanaLocal(data: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_HORARIO,
    weekday: 'short'
  })
  const diaNome = formatter.format(data)
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return mapa[diaNome] ?? 0
}

function parseHorario(horarioStr: string): { hora: number; minuto: number } {
  const [h, m] = horarioStr.split(':').map(Number)
  return { hora: h || 0, minuto: m || 0 }
}

function minutosDesdeInicioDia(hora: number, minuto: number): number {
  return hora * 60 + minuto
}

function calcularMinutosParaFechar(
  horaAtual: { hora: number; minuto: number },
  horarioFechar: string,
  estendidoAte: Date | null
): number | null {
  const agora = minutosDesdeInicioDia(horaAtual.hora, horaAtual.minuto)

  if (estendidoAte) {
    const horaEstendida = obterHoraLocal(estendidoAte)
    const fimEstendido = minutosDesdeInicioDia(horaEstendida.hora, horaEstendida.minuto)
    // Se a extensão é depois da meia-noite, ajustar
    let diff = fimEstendido - agora
    if (diff < -720) diff += 1440 // Cruzou meia-noite
    return diff > 0 ? diff : 0
  }

  const fechar = parseHorario(horarioFechar)
  let fimMinutos = minutosDesdeInicioDia(fechar.hora, fechar.minuto)

  // Se o horário de fechar é após meia-noite (ex: 01:00), ajustar
  let diff = fimMinutos - agora
  if (diff < -720) diff += 1440

  return diff > 0 ? diff : 0
}

export function useStatusLoja(): StatusLojaRetorno {
  const [lojaFechada, setLojaFechada] = useState(false)
  const [numeroWhatsApp, setNumeroWhatsApp] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Horários
  const [horarioAutomatico, setHorarioAutomatico] = useState(false)
  const [horarioFuncionamento, setHorarioFuncionamento] = useState<HorarioFuncionamento | null>(null)
  const [fechamentoEstendidoAte, setFechamentoEstendidoAte] = useState<Date | null>(null)
  const [modoManual, setModoManual] = useState(false)
  const [prestesAFechar, setPrestesAFechar] = useState(false)
  const [minutosParaFechar, setMinutosParaFechar] = useState<number | null>(null)
  const [horarioHoje, setHorarioHoje] = useState<HorarioDia | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const configCacheRef = useRef<Map<string, string>>(new Map())
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sincronizandoRef = useRef(false)

  const valorEhVerdadeiro = useCallback((valor?: string | null) => {
    if (!valor) return false
    const valorNormalizado = valor.trim().toLowerCase()
    return valorNormalizado === 'true' || valorNormalizado === '1' || valorNormalizado === 'sim'
  }, [])

  // Calcular status baseado no horário
  const calcularStatusHorario = useCallback(() => {
    if (!horarioAutomatico || !horarioFuncionamento) return

    const agora = obterAgora()
    const diaSemana = obterDiaSemanaLocal(agora)
    const diaNome = DIAS_SEMANA[diaSemana]
    const horarioDia = horarioFuncionamento[diaNome]

    setHorarioHoje(horarioDia)

    if (!horarioDia || !horarioDia.ativo) {
      // Dia não ativo - loja fechada
      setLojaFechada(true)
      setPrestesAFechar(false)
      setMinutosParaFechar(null)
      return
    }

    const horaAtual = obterHoraLocal(agora)
    const abrir = parseHorario(horarioDia.abrir)
    const fechar = parseHorario(horarioDia.fechar)

    const agoraMinutos = minutosDesdeInicioDia(horaAtual.hora, horaAtual.minuto)
    const abrirMinutos = minutosDesdeInicioDia(abrir.hora, abrir.minuto)
    let fecharMinutos = minutosDesdeInicioDia(fechar.hora, fechar.minuto)

    // Se horário de fechar é menor que abrir, é após meia-noite (ex: 18:00-01:00)
    const cruzaMeiaNoite = fecharMinutos <= abrirMinutos

    // Verificar extensão de horário
    let fecharEfetivo = fecharMinutos
    if (fechamentoEstendidoAte) {
      const agoraDate = obterAgora()
      if (agoraDate < fechamentoEstendidoAte) {
        const horaEstendida = obterHoraLocal(fechamentoEstendidoAte)
        fecharEfetivo = minutosDesdeInicioDia(horaEstendida.hora, horaEstendida.minuto)
      } else {
        // Extensão expirou
        setFechamentoEstendidoAte(null)
      }
    }

    let estaAberta: boolean
    if (cruzaMeiaNoite) {
      estaAberta = agoraMinutos >= abrirMinutos || agoraMinutos < fecharEfetivo
    } else {
      estaAberta = agoraMinutos >= abrirMinutos && agoraMinutos < fecharEfetivo
    }

    // Calcular minutos para fechar
    const minRestantes = calcularMinutosParaFechar(horaAtual, horarioDia.fechar, fechamentoEstendidoAte)
    setMinutosParaFechar(minRestantes)
    setPrestesAFechar(estaAberta && minRestantes !== null && minRestantes <= 30 && minRestantes > 0)

    // Se não é modo manual, aplicar status automático
    if (!modoManual) {
      setLojaFechada(!estaAberta)
      // Sincronizar com banco se o status mudou
      const lojaAbertaAtual = configCacheRef.current.get('loja_aberta')
      if (lojaAbertaAtual !== undefined) {
        const estaAbertaNoBanco = valorEhVerdadeiro(lojaAbertaAtual)
        if (estaAbertaNoBanco !== estaAberta) {
          sincronizarStatusBanco(estaAberta)
        }
      }
    }
  }, [horarioAutomatico, horarioFuncionamento, fechamentoEstendidoAte, modoManual, valorEhVerdadeiro])

  const sincronizarStatusBanco = useCallback(async (aberta: boolean) => {
    const valorDesejado = aberta ? 'true' : 'false'
    if (configCacheRef.current.get('loja_aberta') === valorDesejado) return
    if (sincronizandoRef.current) return

    configCacheRef.current.set('loja_aberta', valorDesejado)

    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current)
    syncDebounceRef.current = setTimeout(async () => {
      syncDebounceRef.current = null
      sincronizandoRef.current = true
      try {
        const agora = new Date().toISOString()
        await supabase
          .from('configuracoes_loja')
          .upsert(
            [
              { chave: 'loja_aberta', valor: valorDesejado, tipo: 'boolean', descricao: 'Define se a loja está aberta para pedidos online', updated_at: agora },
              { chave: 'loja_fechada', valor: aberta ? 'false' : 'true', tipo: 'boolean', descricao: 'Compatibilidade com versões antigas do painel', updated_at: agora }
            ],
            { onConflict: 'chave' }
          )
      } catch {
        configCacheRef.current.delete('loja_aberta')
      } finally {
        sincronizandoRef.current = false
      }
    }, 5000)
  }, [])

  const aplicarConfigs = useCallback((data: ConfiguracaoLoja[]) => {
    data.forEach((c) => {
      configCacheRef.current.set(c.chave, c.valor || '')
    })

    const configLojaAberta = data.find((c) => c.chave === 'loja_aberta')
    const configLojaFechada = data.find((c) => c.chave === 'loja_fechada')
    const configWhatsAppNumero = data.find((c) => c.chave === 'whatsapp_numero')
    const configWhatsAppLegado = data.find((c) => c.chave === 'whatsapp')

    if (configLojaAberta) {
      setLojaFechada(!valorEhVerdadeiro(configLojaAberta.valor))
    } else if (configLojaFechada) {
      setLojaFechada(valorEhVerdadeiro(configLojaFechada.valor))
    }

    if (configWhatsAppNumero && configWhatsAppNumero.valor?.trim()) {
      setNumeroWhatsApp(configWhatsAppNumero.valor || '')
    } else if (configWhatsAppLegado) {
      setNumeroWhatsApp(configWhatsAppLegado.valor || '')
    }

    const configAutoAtivo = data.find((c) => c.chave === 'horario_automatico_ativo')
    if (configAutoAtivo) {
      const autoAtivo = valorEhVerdadeiro(configAutoAtivo.valor)
      setHorarioAutomatico(autoAtivo)
    }

    const configHorarioJson = data.find((c) => c.chave === 'horario_funcionamento_json')
    if (configHorarioJson?.valor) {
      try {
        const parsed = JSON.parse(configHorarioJson.valor) as HorarioFuncionamento
        setHorarioFuncionamento(parsed)
      } catch {
        console.warn('[StatusLoja] Erro ao parsear horário de funcionamento')
      }
    }

    const configExtensao = data.find((c) => c.chave === 'loja_fechamento_estendido_ate')
    if (configExtensao) {
      if (configExtensao.valor && configExtensao.valor.trim()) {
        const dataExtensao = new Date(configExtensao.valor)
        if (!isNaN(dataExtensao.getTime()) && dataExtensao > new Date()) {
          setFechamentoEstendidoAte(dataExtensao)
        } else {
          setFechamentoEstendidoAte(null)
        }
      } else {
        setFechamentoEstendidoAte(null)
      }
    }
  }, [valorEhVerdadeiro])

  const carregarConfiguracoes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('chave, valor')
        .in('chave', [
          'loja_aberta', 'loja_fechada', 'whatsapp_numero', 'whatsapp',
          'horario_funcionamento_json', 'horario_automatico_ativo',
          'loja_fechamento_estendido_ate', 'fuso_horario'
        ])

      if (error) {
        throw new Error('Falha ao carregar configurações da loja')
      }

      if (data && data.length > 0) {
        aplicarConfigs(data as ConfiguracaoLoja[])
      }

      setErro(null)
    } catch (err) {
      console.error('Erro ao carregar status da loja:', err)
      setErro(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }, [aplicarConfigs])

  const alterarStatusLoja = useCallback(async (fechada: boolean): Promise<boolean> => {
    try {
      const agora = new Date().toISOString()
      const lojaAberta = !fechada

      // Ao alterar manualmente, entrar em modo manual
      setModoManual(true)

      const { error } = await supabase
        .from('configuracoes_loja')
        .upsert(
          [
            { chave: 'loja_aberta', valor: lojaAberta ? 'true' : 'false', tipo: 'boolean', descricao: 'Define se a loja está aberta para pedidos online', updated_at: agora },
            { chave: 'loja_fechada', valor: fechada ? 'true' : 'false', tipo: 'boolean', descricao: 'Compatibilidade com versões antigas do painel', updated_at: agora }
          ],
          { onConflict: 'chave' }
        )

      if (error) {
        throw new Error('Falha ao atualizar status da loja')
      }

      configCacheRef.current.set('loja_aberta', lojaAberta ? 'true' : 'false')
      setLojaFechada(fechada)
      setErro(null)
      return true
    } catch (err) {
      console.error('Erro ao alterar status da loja:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao atualizar')
      return false
    }
  }, [])

  const alterarHorarioAutomatico = useCallback(async (ativo: boolean): Promise<boolean> => {
    try {
      const agora = new Date().toISOString()
      const { error } = await supabase
        .from('configuracoes_loja')
        .upsert(
          { chave: 'horario_automatico_ativo', valor: ativo ? 'true' : 'false', tipo: 'boolean', descricao: 'Se true, a loja abre/fecha automaticamente pelo horário configurado', updated_at: agora },
          { onConflict: 'chave' }
        )

      if (error) throw new Error('Falha ao atualizar horário automático')

      setHorarioAutomatico(ativo)
      if (ativo) {
        setModoManual(false)
      }
      return true
    } catch (err) {
      console.error('Erro ao alterar horário automático:', err)
      return false
    }
  }, [])

  const salvarHorarioFuncionamento = useCallback(async (horario: HorarioFuncionamento): Promise<boolean> => {
    try {
      const agora = new Date().toISOString()
      const { error } = await supabase
        .from('configuracoes_loja')
        .upsert(
          { chave: 'horario_funcionamento_json', valor: JSON.stringify(horario), tipo: 'json', descricao: 'Horário de funcionamento por dia da semana (America/Sao_Paulo)', updated_at: agora },
          { onConflict: 'chave' }
        )

      if (error) throw new Error('Falha ao salvar horário de funcionamento')

      setHorarioFuncionamento(horario)
      return true
    } catch (err) {
      console.error('Erro ao salvar horário de funcionamento:', err)
      return false
    }
  }, [])

  const estenderFechamento = useCallback(async (minutos: number): Promise<boolean> => {
    try {
      // Calcular novo horário de fechamento estendido
      const agora = obterAgora()
      let baseExtensao: Date

      if (fechamentoEstendidoAte && fechamentoEstendidoAte > agora) {
        // Estender a partir da extensão atual
        baseExtensao = fechamentoEstendidoAte
      } else if (horarioHoje) {
        // Estender a partir do horário de fechamento original
        const fechar = parseHorario(horarioHoje.fechar)
        baseExtensao = new Date(agora)
        // Criar data no fuso correto
        const horaAtual = obterHoraLocal(agora)
        const agoraMin = minutosDesdeInicioDia(horaAtual.hora, horaAtual.minuto)
        const fecharMin = minutosDesdeInicioDia(fechar.hora, fechar.minuto)

        if (agoraMin >= fecharMin) {
          // Já passou do horário - estender a partir de agora
          baseExtensao = agora
        } else {
          // Estender a partir do horário de fechamento
          baseExtensao = new Date(agora)
          baseExtensao.setHours(fechar.hora, fechar.minuto, 0, 0)
        }
      } else {
        // Sem horário configurado, estender a partir de agora
        baseExtensao = agora
      }

      const novoFechamento = new Date(baseExtensao.getTime() + minutos * 60 * 1000)
      const isoStr = novoFechamento.toISOString()
      const agoraISO = new Date().toISOString()

      const { error } = await supabase
        .from('configuracoes_loja')
        .upsert(
          { chave: 'loja_fechamento_estendido_ate', valor: isoStr, tipo: 'string', descricao: 'ISO timestamp até quando o horário está estendido', updated_at: agoraISO },
          { onConflict: 'chave' }
        )

      if (error) throw new Error('Falha ao estender horário')

      setFechamentoEstendidoAte(novoFechamento)

      // Se a loja está fechada, abrir
      if (lojaFechada) {
        await sincronizarStatusBanco(true)
        setLojaFechada(false)
      }

      return true
    } catch (err) {
      console.error('Erro ao estender fechamento:', err)
      return false
    }
  }, [fechamentoEstendidoAte, horarioHoje, lojaFechada, sincronizarStatusBanco])

  const cancelarExtensao = useCallback(async (): Promise<boolean> => {
    try {
      const agoraISO = new Date().toISOString()
      const { error } = await supabase
        .from('configuracoes_loja')
        .upsert(
          { chave: 'loja_fechamento_estendido_ate', valor: '', tipo: 'string', descricao: 'ISO timestamp até quando o horário está estendido', updated_at: agoraISO },
          { onConflict: 'chave' }
        )

      if (error) throw new Error('Falha ao cancelar extensão')

      setFechamentoEstendidoAte(null)
      return true
    } catch (err) {
      console.error('Erro ao cancelar extensão:', err)
      return false
    }
  }, [])

  // Timer para atualizar status a cada 30 segundos
  useEffect(() => {
    if (horarioAutomatico && horarioFuncionamento) {
      calcularStatusHorario()
      timerRef.current = setInterval(calcularStatusHorario, 30000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [horarioAutomatico, horarioFuncionamento, calcularStatusHorario])

  useEffect(() => {
    void carregarConfiguracoes()

    const chavesRelevantes = new Set([
      'loja_aberta', 'loja_fechada', 'whatsapp_numero', 'whatsapp',
      'horario_funcionamento_json', 'horario_automatico_ativo',
      'loja_fechamento_estendido_ate'
    ])

    const canal = supabase
      .channel(`configuracoes-loja-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_loja'
        },
        (payload) => {
          if (!payload.new || typeof payload.new !== 'object') return

          const configAtualizada = payload.new as ConfiguracaoLoja
          if (!chavesRelevantes.has(configAtualizada.chave)) return

          aplicarConfigs([configAtualizada])
        }
      )
      .subscribe()

    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current)
      supabase.removeChannel(canal)
    }
  }, [aplicarConfigs, carregarConfiguracoes])

  return {
    lojaFechada,
    numeroWhatsApp,
    carregando,
    erro,
    alterarStatusLoja,
    horarioAutomatico,
    horarioFuncionamento,
    horarioHoje,
    fechamentoEstendidoAte,
    prestesAFechar,
    minutosParaFechar,
    modoManual,
    alterarHorarioAutomatico,
    salvarHorarioFuncionamento,
    estenderFechamento,
    cancelarExtensao
  }
}
