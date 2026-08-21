'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import {
  aplicarLeituraLocal,
  lerRespostaApiNotificacoes,
  selecionarNotificacoesDoModal,
  type NotificacaoAdmin,
} from '@/lib/notificacoes-admin.mjs'

export type ResumoNotificacoesAdmin = {
  urgentes: number
  urgentesNaoLidas: number
  normais: number
  naoLidas: number
  total: number
}

export type PreferenciasNotificacoesAdmin = {
  estoque: boolean
  pedidos: boolean
  pagamentosFuncionarios: boolean
}

const PREFERENCIAS_PADRAO: PreferenciasNotificacoesAdmin = {
  estoque: true,
  pedidos: true,
  pagamentosFuncionarios: true,
}

const RESUMO_VAZIO: ResumoNotificacoesAdmin = {
  urgentes: 0,
  urgentesNaoLidas: 0,
  normais: 0,
  naoLidas: 0,
  total: 0,
}

type ContextoNotificacoes = {
  notificacoes: NotificacaoAdmin[]
  notificacoesModal: NotificacaoAdmin[]
  resumo: ResumoNotificacoesAdmin
  carregando: boolean
  erro: string | null
  modalAtivo: boolean
  preferencias: PreferenciasNotificacoesAdmin
  carregarCentral: (incluirHistorico?: boolean) => Promise<void>
  marcarLida: (id: string) => Promise<void>
  marcarTodasLidas: () => Promise<void>
  dispensar: (id: string) => Promise<void>
  fecharModalEntrada: (naoMostrarNovamente: boolean) => Promise<void>
  definirModalAtivo: (ativo: boolean) => Promise<void>
  definirPreferencias: (preferencias: PreferenciasNotificacoesAdmin) => Promise<void>
  invalidar: () => Promise<void>
}

const NotificacoesAdminContext = createContext<ContextoNotificacoes | null>(null)

const obterUsuarioChave = (usuarioId?: string) => {
  if (usuarioId) return `usuario:${usuarioId}`
  if (typeof window === 'undefined') return 'admin-local'
  const token = window.localStorage.getItem('adminToken') || ''
  if (token.endsWith('bar-da-ladeira')) return 'admin-local:bar-da-ladeira'
  if (token.endsWith('dzndev')) return 'admin-local:dzndev'
  return 'admin-local'
}

type RespostaApi = {
  sucesso?: boolean
  erro?: string
  resumo?: ResumoNotificacoesAdmin
  notificacoes?: NotificacaoAdmin[]
  modalAtivo?: boolean
  preferencias?: PreferenciasNotificacoesAdmin
}

export function NotificacoesAdminProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, usuarioAtual, loading: carregandoAuth } = useAdminAuth()
  const [notificacoes, setNotificacoes] = useState<NotificacaoAdmin[]>([])
  const [notificacoesModal, setNotificacoesModal] = useState<NotificacaoAdmin[]>([])
  const [resumo, setResumo] = useState(RESUMO_VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modalAtivo, setModalAtivo] = useState(true)
  const [preferencias, setPreferencias] = useState(PREFERENCIAS_PADRAO)
  const sessaoAvaliadaRef = useRef(false)
  const ultimoFocoRef = useRef(0)
  const usuarioChave = useMemo(() => obterUsuarioChave(usuarioAtual?.id), [usuarioAtual?.id])

  useEffect(() => {
    sessaoAvaliadaRef.current = false
    setNotificacoes([])
    setNotificacoesModal([])
    setResumo(RESUMO_VAZIO)
    setPreferencias(PREFERENCIAS_PADRAO)
  }, [usuarioChave])

  const requisitar = useCallback(async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const token = window.localStorage.getItem('adminToken')
    if (token) headers.set('x-admin-token', token)
    const resposta = await fetch(url, { ...init, headers })
    return lerRespostaApiNotificacoes<RespostaApi>(resposta)
  }, [])

  const carregarResumo = useCallback(async () => {
    const json = await requisitar(
      '/api/admin/notificacoes',
    )
    setResumo(json.resumo || RESUMO_VAZIO)
  }, [requisitar, usuarioChave])

  const carregarCentral = useCallback(async (incluirHistorico = false) => {
    setCarregando(true)
    setErro(null)
    try {
      const json = await requisitar(
        `/api/admin/notificacoes?modo=completo&incluirHistorico=${incluirHistorico}`,
      )
      const lista = json.notificacoes || []
      setNotificacoes(lista)
      setResumo(json.resumo || RESUMO_VAZIO)
      setModalAtivo(json.modalAtivo !== false)
      setPreferencias(json.preferencias || PREFERENCIAS_PADRAO)
      if (!sessaoAvaliadaRef.current) {
        sessaoAvaliadaRef.current = true
        setNotificacoesModal(json.modalAtivo === false ? [] : selecionarNotificacoesDoModal(lista))
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha ao carregar notificações.')
    } finally {
      setCarregando(false)
    }
  }, [requisitar, usuarioChave])

  const postar = useCallback(async (acao: string, extra: Record<string, unknown> = {}) => {
    const json = await requisitar('/api/admin/notificacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, ...extra }),
    })
    setResumo(json.resumo || RESUMO_VAZIO)
  }, [requisitar, usuarioChave])

  useEffect(() => {
    if (carregandoAuth || !isAuthenticated) return
    void carregarCentral(false)
  }, [carregandoAuth, isAuthenticated, carregarCentral])

  useEffect(() => {
    if (!isAuthenticated) return
    const aoFoco = () => {
      const agora = Date.now()
      if (agora - ultimoFocoRef.current < 60_000) return
      ultimoFocoRef.current = agora
      void carregarResumo().catch(() => undefined)
    }
    window.addEventListener('focus', aoFoco)
    return () => window.removeEventListener('focus', aoFoco)
  }, [isAuthenticated, carregarResumo])

  const marcarLida = useCallback(async (id: string) => {
    const agora = new Date().toISOString()
    setNotificacoes((atual) => atual.map((item) => item.id === id ? aplicarLeituraLocal(item, agora) : item))
    await postar('lida', { ids: [id] })
  }, [postar])

  const marcarTodasLidas = useCallback(async () => {
    const agora = new Date().toISOString()
    setNotificacoes((atual) => atual.map((item) => aplicarLeituraLocal(item, agora)))
    await postar('lidas_todas')
  }, [postar])

  const dispensar = useCallback(async (id: string) => {
    setNotificacoes((atual) => atual.filter((item) => item.id !== id))
    await postar('silenciada', { ids: [id] })
  }, [postar])

  const definirModalAtivo = useCallback(async (ativo: boolean) => {
    setModalAtivo(ativo)
    await postar('preferencia_modal', { ativo })
  }, [postar])

  const fecharModalEntrada = useCallback(async (naoMostrarNovamente: boolean) => {
    const ids = notificacoesModal.map((item) => item.id)
    setNotificacoesModal([])
    await postar('apresentadas', { ids })
    if (naoMostrarNovamente) await definirModalAtivo(false)
  }, [definirModalAtivo, notificacoesModal, postar])

  const definirPreferencias = useCallback(async (novasPreferencias: PreferenciasNotificacoesAdmin) => {
    const anteriores = preferencias
    setPreferencias(novasPreferencias)
    try {
      await postar('preferencias_categorias', { preferencias: novasPreferencias })
      await carregarCentral(false)
    } catch (erro) {
      setPreferencias(anteriores)
      throw erro
    }
  }, [carregarCentral, postar, preferencias])

  const valor = useMemo<ContextoNotificacoes>(() => ({
    notificacoes,
    notificacoesModal,
    resumo,
    carregando,
    erro,
    modalAtivo, preferencias,
    carregarCentral,
    marcarLida,
    marcarTodasLidas,
    dispensar,
    fecharModalEntrada,
    definirModalAtivo, definirPreferencias,
    invalidar: carregarResumo,
  }), [
    notificacoes, notificacoesModal, resumo, carregando, erro, modalAtivo, preferencias,
    carregarCentral, marcarLida, marcarTodasLidas, dispensar,
    fecharModalEntrada, definirModalAtivo, definirPreferencias, carregarResumo,
  ])

  return <NotificacoesAdminContext.Provider value={valor}>{children}</NotificacoesAdminContext.Provider>
}

export function useNotificacoesAdmin() {
  const contexto = useContext(NotificacoesAdminContext)
  if (!contexto) throw new Error('useNotificacoesAdmin deve estar dentro de NotificacoesAdminProvider')
  return contexto
}
