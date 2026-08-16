'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarClock, Loader2, Phone, Receipt, Search, ShoppingBag, X, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

type PedidoConsulta = {
  id: string
  numero_pedido: number | null
  nome_cliente: string | null
  telefone: string | null
  status: string | null
  tipo_entrega: string | null
  forma_pagamento: string | null
  total: number
  created_at: string
  observacoes: string | null
}

type ModalPedidosClienteProps = {
  aberto: boolean
  onFechar: () => void
}

const CHAVE_TELEFONE_PEDIDOS = 'cliente_telefone_consulta_pedidos'

const mapearStatus = (status: string | null) => {
  const s = (status || '').toLowerCase()
  if (s === 'pendente') return { label: 'Pendente', cor: 'bg-amber-500', classe: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20' }
  if (s === 'confirmado') return { label: 'Confirmado', cor: 'bg-sky-500', classe: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20' }
  if (s === 'preparando') return { label: 'Preparando', cor: 'bg-indigo-500', classe: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20' }
  if (s === 'pronto') return { label: 'Pronto', cor: 'bg-violet-500', classe: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20' }
  if (s === 'entregue') return { label: 'Entregue', cor: 'bg-emerald-500', classe: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20' }
  if (s === 'cancelado') return { label: 'Cancelado', cor: 'bg-rose-500', classe: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20' }
  return { label: status || 'Sem status', cor: 'bg-zinc-400', classe: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-700/30 dark:text-zinc-300 dark:ring-zinc-600' }
}

const formatarTelefone = (telefone: string) => {
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return telefone
}

export default function ModalPedidosCliente({ aberto, onFechar }: ModalPedidosClienteProps) {
  const [telefone, setTelefone] = useState('')
  const [consultado, setConsultado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [pedidos, setPedidos] = useState<PedidoConsulta[]>([])
  const [pedidoExpandido, setPedidoExpandido] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return

    try {
      const salvo = window.localStorage.getItem(CHAVE_TELEFONE_PEDIDOS)
      if (salvo) {
        setTelefone(salvo)
      }
    } catch {
      // Ignora falhas de storage
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) {
      setConsultado(false)
      setErro('')
      setPedidos([])
      setPedidoExpandido(null)
    }
  }, [aberto])

  const resumo = useMemo(() => {
    const totalPedidos = pedidos.length
    const totalGasto = pedidos.reduce((acc, pedido) => acc + Number(pedido.total || 0), 0)
    return { totalPedidos, totalGasto }
  }, [pedidos])

  const consultarPedidos = async () => {
    const telefoneLimpo = telefone.trim()
    if (!telefoneLimpo) {
      setErro('Informe seu telefone para buscar pedidos.')
      return
    }

    setCarregando(true)
    setConsultado(true)
    setErro('')

    try {
      const { data, error } = await supabase.rpc('obter_pedidos_cliente_por_telefone', {
        p_telefone: telefoneLimpo,
        p_limite: 30,
      })

      if (error) throw error

      const lista = ((data || []) as PedidoConsulta[]).map((pedido) => ({
        ...pedido,
        total: Number(pedido.total || 0),
      }))

      setPedidos(lista)

      try {
        window.localStorage.setItem(CHAVE_TELEFONE_PEDIDOS, telefoneLimpo)
      } catch {
        // Ignora falhas de storage
      }
    } catch (error) {
      console.error('Erro ao consultar pedidos por telefone:', error)
      setErro('Não foi possível buscar seus pedidos agora. Tente novamente.')
      setPedidos([])
    } finally {
      setCarregando(false)
    }
  }

  const enviarFormulario = (e: React.FormEvent) => {
    e.preventDefault()
    consultarPedidos()
  }

  return (
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-[110]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onFechar}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <div className="relative flex min-h-full items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full overflow-hidden rounded-t-2xl border-t border-zinc-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl sm:border dark:border-zinc-800 dark:bg-zinc-950"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Meus pedidos</h3>
                  <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
                    Consulte pelo telefone
                  </p>
                </div>
                <button
                  onClick={onFechar}
                  className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Busca */}
              <div className="border-y border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <form onSubmit={enviarFormulario} className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(63) 98105-3014"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 outline-none transition-all focus:border-bordo-500 focus:ring-2 focus:ring-bordo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={carregando}
                    className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-xl bg-bordo-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-bordo-700 active:scale-[0.97] disabled:opacity-60 cursor-pointer"
                  >
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="hidden sm:inline">Buscar</span>
                  </button>
                </form>

                {erro && (
                  <p className="mt-2 text-[13px] text-rose-600 dark:text-rose-400">{erro}</p>
                )}
              </div>

              {/* Conteúdo */}
              <div className="max-h-[55vh] overflow-y-auto p-4">
                {/* Resumo */}
                {consultado && !carregando && pedidos.length > 0 && (
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Pedidos</p>
                      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{resumo.totalPedidos}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total gasto</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">R$ {resumo.totalGasto.toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {carregando ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-bordo-500" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Buscando pedidos...</p>
                  </div>
                ) : consultado && pedidos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
                      <ShoppingBag className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum pedido encontrado para esse telefone.</p>
                  </div>
                ) : !consultado ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
                      <Receipt className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Informe seu telefone para ver seus pedidos.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pedidos.map((pedido) => {
                      const status = mapearStatus(pedido.status)
                      const expandido = pedidoExpandido === pedido.id
                      return (
                        <button
                          key={pedido.id}
                          type="button"
                          onClick={() => setPedidoExpandido(expandido ? null : pedido.id)}
                          className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 text-left transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className={`h-2 w-2 flex-shrink-0 rounded-full ${status.cor}`} />
                              <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  Pedido #{pedido.numero_pedido ?? '--'}
                                </p>
                                <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                                  {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                R$ {pedido.total.toFixed(2)}
                              </span>
                              <ChevronRight className={`h-4 w-4 text-zinc-300 transition-transform dark:text-zinc-600 ${expandido ? 'rotate-90' : ''}`} />
                            </div>
                          </div>

                          <AnimatePresence>
                            {expandido && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.classe}`}>
                                      {status.label}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                                    <span className="rounded-lg bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                      {pedido.tipo_entrega || 'Sem entrega'}
                                    </span>
                                    <span className="rounded-lg bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                      {pedido.forma_pagamento || 'Sem pagamento'}
                                    </span>
                                    {pedido.telefone && (
                                      <span className="rounded-lg bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                        {formatarTelefone(pedido.telefone)}
                                      </span>
                                    )}
                                  </div>

                                  {pedido.observacoes && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                      <span className="font-medium">Obs:</span> {pedido.observacoes}
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
