'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DrawerContent, DrawerDescription, DrawerNested, DrawerTitle } from '@/components/ui/drawer'

type Mesa = {
  id: string
  numero: number
  tipo: 'mesa' | 'local_externo'
  status: 'livre' | 'ocupada'
  nome_cliente: string | null
  ocupada_em: string | null
  identificador: string | null
}

type ModalSelecionarMesaProps = {
  aberto: boolean
  onFechar: () => void
  onSelecionarMesa: (mesaNumero: number, ponto?: Mesa) => void
  nomeCliente: string
}

const obterRotuloPonto = (ponto: Pick<Mesa, 'numero' | 'tipo' | 'identificador'>) => {
  const nome = ponto.identificador?.trim()
  if (nome) return nome
  return ponto.tipo === 'local_externo' ? `Local ${ponto.numero}` : `Mesa ${ponto.numero}`
}

export default function ModalSelecionarMesa({
  aberto,
  onFechar,
  onSelecionarMesa,
  nomeCliente
}: ModalSelecionarMesaProps) {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [ocupando, setOcupando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mesaSelecionadaSucesso, setMesaSelecionadaSucesso] = useState<number | null>(null)

  const carregarMesas = useCallback(async () => {
    try {
      setErro(null)
      await supabase.rpc('limpar_mesas_expiradas')

      const { data, error } = await supabase
        .from('mesas')
        .select('id, numero, tipo, status, nome_cliente, ocupada_em, identificador')
        .in('tipo', ['mesa', 'local_externo'])
        .order('tipo', { ascending: true })
        .order('numero', { ascending: true })

      if (error) throw error
      setMesas((data || []).map((ponto) => ({
        id: String(ponto.id),
        numero: Number(ponto.numero),
        tipo: ponto.tipo === 'local_externo' ? 'local_externo' : 'mesa',
        status: ponto.status === 'ocupada' ? 'ocupada' : 'livre',
        nome_cliente: ponto.nome_cliente || null,
        ocupada_em: ponto.ocupada_em || null,
        identificador: ponto.identificador || null,
      })))
    } catch (error) {
      console.error('Erro ao carregar mesas:', error)
      setErro('Erro ao carregar mesas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (aberto) {
      setLoading(true)
      setMesaSelecionadaSucesso(null)
      carregarMesas()

      const channel = supabase
        .channel('mesas-cliente-realtime')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'mesas' },
          () => carregarMesas()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [aberto, carregarMesas])

  const selecionarMesa = async (mesa: Mesa) => {
    if (mesa.status === 'ocupada' && mesa.tipo !== 'local_externo') return
    if (!nomeCliente.trim()) {
      setErro('Informe seu nome primeiro!')
      return
    }

    setOcupando(mesa.id)
    setErro(null)

    setMesaSelecionadaSucesso(mesa.numero)

    setTimeout(() => {
      onSelecionarMesa(mesa.numero, mesa)
      onFechar()
      setOcupando(null)
    }, 450)
  }

  const mesasLivres = mesas.filter(m => m.status === 'livre').length
  const mesasInternas = mesas.filter((mesa) => mesa.tipo === 'mesa')
  const locaisParceiros = mesas.filter((mesa) => mesa.tipo === 'local_externo')

  return (
    <DrawerNested open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DrawerContent className="mx-auto w-full max-w-sm overflow-hidden p-0">
            <DrawerDescription className="sr-only">
              Escolha uma mesa livre ou um local parceiro para consumir no estabelecimento.
            </DrawerDescription>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <DrawerTitle className="text-lg font-bold text-foreground">Qual sua mesa?</DrawerTitle>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {mesasLivres} {mesasLivres === 1 ? 'disponível' : 'disponíveis'}
                </p>
              </div>
              <button
                type="button"
                onClick={onFechar}
                className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Fechar seleção de mesa"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* Erro */}
              {erro && (
                <div className="mb-3 rounded-xl bg-rose-50 p-3 text-center text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  {erro}
                </div>
              )}

              {/* Sucesso */}
              <AnimatePresence>
                {mesaSelecionadaSucesso && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      className="rounded-2xl bg-emerald-500 px-8 py-6 text-center text-white shadow-xl"
                    >
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                        <Check className="h-7 w-7" />
                      </div>
                      <div className="text-2xl font-bold">Mesa {mesaSelecionadaSucesso}</div>
                      <div className="mt-1 text-sm text-emerald-100">Selecionada!</div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-bordo-600 dark:border-zinc-700 dark:border-t-bordo-400" />
                    <p className="text-xs text-zinc-400">Carregando mesas...</p>
                  </div>
                </div>
              ) : (
                <>
                  {[
                    { titulo: 'Mesas', pontos: mesasInternas, externo: false },
                    { titulo: 'Locais parceiros', pontos: locaisParceiros, externo: true },
                  ].map((grupo) => (
                    grupo.pontos.length > 0 && (
                      <div key={grupo.titulo} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
                          {grupo.titulo}
                        </p>
                        <div className={grupo.externo ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-4 gap-2'}>
                          {grupo.pontos.map((mesa) => {
                            const ehParceiro = mesa.tipo === 'local_externo'
                            const ocupada = mesa.status === 'ocupada' && !ehParceiro
                            const selecionando = ocupando === mesa.id
                            const rotulo = obterRotuloPonto(mesa)

                            return (
                              <button
                                key={mesa.id}
                                onClick={() => selecionarMesa(mesa)}
                                disabled={ocupada || selecionando || !!mesaSelecionadaSucesso}
                                className={`flex min-h-20 flex-col items-center justify-center rounded-xl px-2 text-center transition-all duration-200 cursor-pointer ${
                                  ocupada
                                    ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed dark:bg-zinc-800/50 dark:text-zinc-600'
                                    : selecionando
                                    ? 'bg-bordo-50 text-bordo-600 ring-2 ring-bordo-500 dark:bg-bordo-900/20 dark:text-bordo-400'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/15'
                                }`}
                              >
                                <span className={grupo.externo ? 'line-clamp-2 text-xs font-bold leading-tight' : 'text-xl font-bold leading-none'}>
                                  {selecionando ? (
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                  ) : grupo.externo ? (
                                    rotulo
                                  ) : (
                                    mesa.numero
                                  )}
                                </span>
                                <span className={`mt-1 text-[9px] font-semibold uppercase tracking-wide ${
                                  ocupada ? 'text-zinc-300 dark:text-zinc-600' : 'text-emerald-500 dark:text-emerald-500'
                                }`}>
                                  {ocupada ? 'Ocupada' : ehParceiro ? 'Disponível' : 'Livre'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  ))}

                  {/* Legenda */}
                  <div className="mt-4 flex items-center justify-center gap-5 text-[10px] text-zinc-400 dark:text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Livre
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" /> Ocupada
                    </span>
                  </div>
                </>
              )}

              {/* Atualizar */}
              <button
                onClick={() => {
                  setLoading(true)
                  carregarMesas()
                }}
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer min-h-[44px]"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
      </DrawerContent>
    </DrawerNested>
  )
}
