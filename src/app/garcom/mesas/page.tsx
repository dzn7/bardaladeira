'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Armchair, MapPinned, Package, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import GarcomLayout from '@/components/garcom/GarcomLayout'
import RotaProtegidaGarcom from '@/components/garcom/RotaProtegidaGarcom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PainelSalaoAtual from '@/features/salao/components/PainelSalaoAtual'
import { obterIntervaloDiaOperacionalAtual, estaNoDiaOperacionalAtual } from '@/lib/dia-operacional'
import { supabase } from '@/lib/supabase'
import { useControleAcesso } from '@/contexts/ControleAcessoContext'

type TipoPontoSalao = 'mesa' | 'comanda' | 'local_externo'

type AbaGarcom = 'mesas' | 'comandas' | 'locais'

type PontoSalao = {
  id: string
  numero: number
  tipo: TipoPontoSalao
  status: 'livre' | 'ocupada'
  nome_cliente: string | null
  ocupada_em: string | null
  liberar_em: string | null
  tempo_limite_minutos: number | null
  pedido_id: string | null
  codigo_qr: string
  identificador: string | null
  updated_at: string
}

type ItemPedidoSalao = {
  id: string
  nome_item: string | null
  quantidade: number
  subtotal: number
  observacoes: string | null
  created_at: string | null
  adicionado_por_garcom_id: string | null
  nome_garcom?: string | null
}

type AtividadeGarcomSalao = {
  id: string
  garcom_id: string
  tipo_acao: string
  pedido_id: string | null
  item_pedido_id: string | null
  descricao: string | null
  created_at: string | null
  nome_garcom?: string | null
}

type PedidoSalao = {
  id: string
  numero_pedido: number | null
  nome_cliente: string
  telefone: string | null
  endereco: string | null
  bairro: string | null
  tipo_entrega: string
  status: string
  created_at: string
  observacoes: string | null
  forma_pagamento: string | null
  troco_para: number | null
  subtotal: number
  taxa_entrega: number
  taxa_servico: number
  total: number
  mesa: number | null
  comanda: number | null
  mesa_id: string | null
  garcom_id: string | null
  nome_garcom?: string | null
  itens_pedido: ItemPedidoSalao[]
  atividades_garcom: AtividadeGarcomSalao[]
}

const LIMITE_PEDIDOS = 80

const normalizarNumero = (valor: unknown, fallback = 0) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return fallback
  return numero
}

const statusPedidoEncerrado = (status: string) => {
  const normalizado = String(status || '').trim().toLowerCase()
  return normalizado === 'entregue' || normalizado === 'cancelado'
}

const gerarCodigoQrFallback = (tipo: TipoPontoSalao, numero: number) =>
  `${tipo}-${String(numero).padStart(3, '0')}`

const obterNomeTipo = (tipo: TipoPontoSalao) =>
  tipo === 'comanda' ? 'comanda' : tipo === 'local_externo' ? 'local parceiro' : 'mesa'
const obterNomeTipoCapitalizado = (tipo: TipoPontoSalao) =>
  tipo === 'comanda' ? 'Comanda' : tipo === 'local_externo' ? 'Local parceiro' : 'Mesa'

export default function GarcomMesasPage() {
  const { pode, emManutencao } = useControleAcesso()
  const moduloDisponivel = !emManutencao('garcom.mesas')
  const podeCriar = pode('garcom.mesas', 'criar') && moduloDisponivel
  const podeEditar = pode('garcom.mesas', 'editar') && moduloDisponivel
  const [abaAtiva, setAbaAtiva] = useState<AbaGarcom>('mesas')
  const [pontosSalao, setPontosSalao] = useState<PontoSalao[]>([])
  const [pedidosSalao, setPedidosSalao] = useState<PedidoSalao[]>([])
  const [loading, setLoading] = useState(true)
  const [liberandoPonto, setLiberandoPonto] = useState<string | null>(null)
  const router = useRouter()

  const tipoAtual: TipoPontoSalao = abaAtiva === 'comandas' ? 'comanda' : abaAtiva === 'locais' ? 'local_externo' : 'mesa'
  const nomeTipo = obterNomeTipo(tipoAtual)
  const nomeTipoCapitalizado = obterNomeTipoCapitalizado(tipoAtual)

  const carregarPontosSalao = useCallback(async () => {
    await supabase.rpc('limpar_mesas_expiradas')

    const { data, error } = await supabase
      .from('mesas')
      .select(
        'id, numero, tipo, status, nome_cliente, ocupada_em, liberar_em, tempo_limite_minutos, pedido_id, codigo_qr, identificador, updated_at',
      )
      .order('tipo', { ascending: true })
      .order('numero', { ascending: true })

    if (error) throw error

    setPontosSalao(
      (data || []).map((registro) => {
        const numero = normalizarNumero(registro.numero)
        const tipoBruto = String(registro.tipo || 'mesa').toLowerCase()
        const tipo = (tipoBruto === 'comanda' ? 'comanda' : tipoBruto === 'local_externo' ? 'local_externo' : 'mesa') as TipoPontoSalao

        return {
          id: String(registro.id),
          numero,
          tipo,
          status: String(registro.status || 'livre').toLowerCase() === 'ocupada' ? 'ocupada' : 'livre',
          nome_cliente: registro.nome_cliente || null,
          ocupada_em: registro.ocupada_em || null,
          liberar_em: registro.liberar_em || null,
          tempo_limite_minutos:
            registro.tempo_limite_minutos === null || registro.tempo_limite_minutos === undefined
              ? null
              : normalizarNumero(registro.tempo_limite_minutos),
          pedido_id: registro.pedido_id ? String(registro.pedido_id) : null,
          codigo_qr: String(registro.codigo_qr || gerarCodigoQrFallback(tipo, numero)),
          identificador: registro.identificador || null,
          updated_at: String(registro.updated_at || ''),
        }
      }),
    )
  }, [])

  const carregarPedidosSalao = useCallback(async () => {
    const { inicio, fim } = obterIntervaloDiaOperacionalAtual()
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        nome_cliente,
        telefone,
        endereco,
        bairro,
        tipo_entrega,
        status,
        created_at,
        observacoes,
        forma_pagamento,
        troco_para,
        subtotal,
        taxa_entrega,
        taxa_servico,
        total,
        mesa,
        comanda,
        mesa_id,
        garcom_id,
        itens_pedido (
          id,
          nome_item,
          quantidade,
          subtotal,
          observacoes,
          created_at,
          adicionado_por_garcom_id
        )
      `)
      .eq('tipo_entrega', 'local')
      .gte('created_at', inicio.toISOString())
      .lt('created_at', fim.toISOString())
      .order('created_at', { ascending: false })
      .limit(LIMITE_PEDIDOS)

    if (error) throw error

    const registrosPedidos = data || []
    const idsPedidos = registrosPedidos.map((registro) => String(registro.id))
    const idsGarcons = new Set<string>()
    const atividadesPorPedido = new Map<string, AtividadeGarcomSalao[]>()

    registrosPedidos.forEach((registro) => {
      if (registro.garcom_id) idsGarcons.add(String(registro.garcom_id))

      if (Array.isArray(registro.itens_pedido)) {
        registro.itens_pedido.forEach((item) => {
          if (item.adicionado_por_garcom_id) idsGarcons.add(String(item.adicionado_por_garcom_id))
        })
      }
    })

    if (idsPedidos.length > 0) {
      const { data: atividadesData, error: atividadesError } = await supabase
        .from('atividade_garcom')
        .select('id, garcom_id, tipo_acao, pedido_id, item_pedido_id, descricao, created_at')
        .in('pedido_id', idsPedidos)
        .order('created_at', { ascending: false })

      if (atividadesError) {
        console.error('[Garçom Mesas] Erro ao carregar atividades:', atividadesError)
      } else {
        ;(atividadesData || []).forEach((atividade) => {
          const pedidoId = atividade.pedido_id ? String(atividade.pedido_id) : ''
          const garcomId = String(atividade.garcom_id || '')
          if (!pedidoId || !garcomId) return

          idsGarcons.add(garcomId)
          const listaAtual = atividadesPorPedido.get(pedidoId) || []
          listaAtual.push({
            id: String(atividade.id),
            garcom_id: garcomId,
            tipo_acao: String(atividade.tipo_acao || ''),
            pedido_id: pedidoId,
            item_pedido_id: atividade.item_pedido_id ? String(atividade.item_pedido_id) : null,
            descricao: atividade.descricao || null,
            created_at: atividade.created_at ? String(atividade.created_at) : null,
          })
          atividadesPorPedido.set(pedidoId, listaAtual)
        })
      }
    }

    const nomesGarcons = new Map<string, string>()

    if (idsGarcons.size > 0) {
      const { data: garconsData, error: garconsError } = await supabase
        .from('usuarios_sistema')
        .select('id, nome')
        .in('id', Array.from(idsGarcons))

      if (garconsError) {
        console.error('[Garçom Mesas] Erro ao carregar garçons:', garconsError)
      } else {
        ;(garconsData || []).forEach((garcom) => {
          nomesGarcons.set(String(garcom.id), String(garcom.nome || 'Garçom'))
        })
      }
    }

    setPedidosSalao(
      registrosPedidos
        .map((registro) => {
          const pedidoId = String(registro.id)
          const garcomId = registro.garcom_id ? String(registro.garcom_id) : null

          return {
            id: pedidoId,
            numero_pedido:
              registro.numero_pedido === null || registro.numero_pedido === undefined
                ? null
                : normalizarNumero(registro.numero_pedido),
            nome_cliente: String(registro.nome_cliente || 'Cliente'),
            telefone: registro.telefone || null,
            endereco: registro.endereco || null,
            bairro: registro.bairro || null,
            tipo_entrega: String(registro.tipo_entrega || 'local'),
            status: String(registro.status || ''),
            created_at: String(registro.created_at || ''),
            observacoes: registro.observacoes || null,
            forma_pagamento: registro.forma_pagamento || null,
            troco_para:
              registro.troco_para === null || registro.troco_para === undefined
                ? null
                : normalizarNumero(registro.troco_para),
            subtotal: normalizarNumero(registro.subtotal),
            taxa_entrega: normalizarNumero(registro.taxa_entrega),
            taxa_servico: normalizarNumero(registro.taxa_servico),
            total: normalizarNumero(registro.total),
            mesa: registro.mesa === null || registro.mesa === undefined ? null : normalizarNumero(registro.mesa),
            comanda:
              registro.comanda === null || registro.comanda === undefined ? null : normalizarNumero(registro.comanda),
            mesa_id: registro.mesa_id ? String(registro.mesa_id) : null,
            garcom_id: garcomId,
            nome_garcom: garcomId ? nomesGarcons.get(garcomId) || null : null,
            itens_pedido: Array.isArray(registro.itens_pedido)
              ? registro.itens_pedido.map((item) => {
                  const itemGarcomId = item.adicionado_por_garcom_id ? String(item.adicionado_por_garcom_id) : null

                  return {
                    id: String(item.id),
                    nome_item: item.nome_item || null,
                    quantidade: normalizarNumero(item.quantidade, 1),
                    subtotal: normalizarNumero(item.subtotal),
                    observacoes: item.observacoes || null,
                    created_at: item.created_at ? String(item.created_at) : null,
                    adicionado_por_garcom_id: itemGarcomId,
                    nome_garcom: itemGarcomId ? nomesGarcons.get(itemGarcomId) || null : null,
                  }
                })
              : [],
            atividades_garcom: (atividadesPorPedido.get(pedidoId) || []).map((atividade) => ({
              ...atividade,
              nome_garcom: nomesGarcons.get(atividade.garcom_id) || null,
            })),
          }
        })
        .filter((pedido) => !statusPedidoEncerrado(pedido.status) && estaNoDiaOperacionalAtual(pedido.created_at)),
    )
  }, [])

  const carregarTudo = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([carregarPontosSalao(), carregarPedidosSalao()])
    } catch (erro) {
      console.error('[Garçom Mesas] Erro ao carregar salão:', erro)
    } finally {
      setLoading(false)
    }
  }, [carregarPontosSalao, carregarPedidosSalao])

  useEffect(() => {
    void carregarTudo()

    let debouncePontos: ReturnType<typeof setTimeout> | null = null
    let debouncePedidos: ReturnType<typeof setTimeout> | null = null

    const agendarPontos = () => {
      if (debouncePontos) clearTimeout(debouncePontos)
      debouncePontos = setTimeout(() => {
        debouncePontos = null
        void carregarPontosSalao()
      }, 600)
    }

    const agendarPedidos = () => {
      if (debouncePedidos) clearTimeout(debouncePedidos)
      debouncePedidos = setTimeout(() => {
        debouncePedidos = null
        void carregarPedidosSalao()
      }, 600)
    }

    const intervalo = setInterval(() => {
      void Promise.all([carregarPontosSalao(), carregarPedidosSalao()])
    }, 90000)

    const canalSalao = supabase
      .channel(`garcom-salao-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        agendarPontos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        agendarPedidos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => {
        agendarPedidos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividade_garcom' }, () => {
        agendarPedidos()
      })
      .subscribe()

    return () => {
      if (debouncePontos) clearTimeout(debouncePontos)
      if (debouncePedidos) clearTimeout(debouncePedidos)
      clearInterval(intervalo)
      supabase.removeChannel(canalSalao)
    }
  }, [carregarPontosSalao, carregarPedidosSalao, carregarTudo])

  const pontosNormalizados = useMemo(() => {
    return pontosSalao.map((ponto) => {
      const possuiPedidoAtivoVinculado = ponto.pedido_id
        ? pedidosSalao.some((pedido) => pedido.id === ponto.pedido_id)
        : false

      const possuiPedidoAtivoPorMesaId = pedidosSalao.some((pedido) => ponto.id === pedido.mesa_id)
      const possuiPedidoAtivoNoPonto =
        possuiPedidoAtivoPorMesaId ||
        pedidosSalao.some((pedido) =>
          ponto.tipo === 'comanda'
            ? pedido.comanda === ponto.numero
            : ponto.tipo === 'mesa' && pedido.mesa === ponto.numero,
        )

      if (ponto.status !== 'ocupada' || possuiPedidoAtivoVinculado || possuiPedidoAtivoNoPonto) return ponto

      return {
        ...ponto,
        status: 'livre' as const,
        nome_cliente: null,
        ocupada_em: null,
        liberar_em: null,
        pedido_id: null,
      }
    })
  }, [pontosSalao, pedidosSalao])

  const pontosVisiveis = useMemo(
    () => pontosNormalizados.filter((ponto) => ponto.tipo === tipoAtual),
    [pontosNormalizados, tipoAtual],
  )

  const pontosLivres = useMemo(
    () => pontosVisiveis.filter((ponto) => ponto.status === 'livre'),
    [pontosVisiveis],
  )

  const contadores = useMemo(() => {
    const total = pontosVisiveis.length
    const ocupadas = pontosVisiveis.filter((ponto) => ponto.status === 'ocupada').length
    return { total, ocupadas, livres: total - ocupadas }
  }, [pontosVisiveis])

  const abrirNovoPedido = (ponto: PontoSalao) => {
    router.push(`/garcom/novo?${
      ponto.tipo === 'comanda'
        ? `comanda=${ponto.numero}`
        : ponto.tipo === 'local_externo'
          ? `local=${ponto.numero}`
          : `mesa=${ponto.numero}`
    }`)
  }

  const editarPedido = (pedido: PedidoSalao) => {
    router.push(`/garcom/editar/${pedido.id}`)
  }

  const enviarParaCrediario = async (pedido: PedidoSalao) => {
    try {
      const { error } = await supabase.rpc('enviar_pedido_crediario', {
        p_pedido_id: pedido.id,
      })

      if (error) throw error

      toast.success('Pedido enviado para o crediário')
      await carregarPedidosSalao()
    } catch (erro) {
      console.error('[Garçom Mesas] Erro ao enviar para crediário:', erro)
      toast.error('Não foi possível enviar para o crediário')
    }
  }

  const estenderPonto = async (ponto: PontoSalao, minutos: number) => {
    if (ponto.tipo === 'local_externo') return

    setLiberandoPonto(ponto.id)
    try {
      const liberarEmAtual = ponto.liberar_em ? new Date(ponto.liberar_em) : new Date()
      const novoLiberarEm = new Date(liberarEmAtual.getTime() + minutos * 60 * 1000)

      const { error } = await supabase
        .from('mesas')
        .update({ liberar_em: novoLiberarEm.toISOString() })
        .eq('id', ponto.id)

      if (error) throw error
      toast.success(`Tempo estendido em ${minutos} min`)
      await carregarPontosSalao()
    } catch (erro) {
      console.error('[Garçom Mesas] Erro ao estender tempo:', erro)
      toast.error('Não foi possível estender o tempo')
    } finally {
      setLiberandoPonto(null)
    }
  }

  const liberarPonto = async (ponto: PontoSalao) => {
    setLiberandoPonto(ponto.id)
    try {
      const { error } = await supabase
        .from('mesas')
        .update({
          status: 'livre',
          nome_cliente: null,
          ocupada_em: null,
          liberar_em: null,
          pedido_id: null,
        })
        .eq('id', ponto.id)

      if (error) throw error
      await Promise.all([carregarPontosSalao(), carregarPedidosSalao()])
    } catch (erro) {
      console.error('[Garçom Mesas] Erro ao liberar:', erro)
    } finally {
      setLiberandoPonto(null)
    }
  }

  return (
    <RotaProtegidaGarcom>
      <GarcomLayout>
        <div className="space-y-4">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">Salão</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Mesas, comandas e atendimentos abertos.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void carregarTudo()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'mesas' as AbaGarcom, label: 'Mesas', icon: Armchair },
              { id: 'comandas' as AbaGarcom, label: 'Comandas', icon: Package },
              { id: 'locais' as AbaGarcom, label: 'Parceiros', icon: MapPinned },
            ]).map((aba) => {
              const Icone = aba.icon
              const ativa = abaAtiva === aba.id
              return (
                <Button
                  key={aba.id}
                  type="button"
                  variant={ativa ? 'default' : 'outline'}
                  className="h-11 gap-2"
                  onClick={() => setAbaAtiva(aba.id)}
                >
                  <Icone className="h-4 w-4" />
                  {aba.label}
                </Button>
              )
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Card className="border-border/70 p-3 text-center shadow-none">
              <p className="font-mono text-2xl font-semibold tabular-nums">{contadores.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/50 p-3 text-center shadow-none dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{contadores.livres}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Livres</p>
            </Card>
            <Card className="border-amber-200 bg-amber-50/60 p-3 text-center shadow-none dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="font-mono text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">{contadores.ocupadas}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">Ocupadas</p>
            </Card>
          </div>

          <PainelSalaoAtual
            mesas={podeCriar ? pontosNormalizados : pontosNormalizados.filter((ponto) => ponto.status === 'ocupada')}
            pedidos={pedidosSalao}
            tipo={tipoAtual}
            carregando={loading}
            atualizandoPonto={liberandoPonto}
            mostrarAtribuicao={false}
            onAtualizar={carregarTudo}
            onAbrirPedido={abrirNovoPedido}
            permitirEdicaoInterna={podeEditar}
            onEditarPedido={podeEditar ? editarPedido : undefined}
            onLiberarMesa={podeEditar ? liberarPonto : undefined}
            onEstenderMesa={podeEditar ? estenderPonto : undefined}
            onEnviarCrediario={podeEditar ? enviarParaCrediario : undefined}
          />

          {podeCriar ? <Card className="border-border/70 shadow-none">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold">{nomeTipoCapitalizado}s livres</CardTitle>
                <Badge variant="outline" className="rounded-lg border-border/70 bg-muted/30">
                  {pontosLivres.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {loading ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, indice) => (
                    <div key={indice} className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/40" />
                  ))}
                </div>
              ) : pontosLivres.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma {nomeTipo} livre agora.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {pontosLivres.map((ponto) => (
                    <button
                      key={ponto.id}
                      type="button"
                      onClick={() => abrirNovoPedido(ponto)}
                      className="group rounded-xl border border-border/70 bg-card p-3 text-left transition-colors hover:border-border hover:bg-accent/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                          {ponto.numero}
                        </span>
                        <Plus className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      </div>
                      <p className="mt-3 truncate text-sm font-medium text-foreground">
                        {ponto.identificador || `${nomeTipoCapitalizado} ${ponto.numero}`}
                      </p>
                      <p className="text-xs text-muted-foreground">Abrir pedido</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card> : null}
        </div>
      </GarcomLayout>
    </RotaProtegidaGarcom>
  )
}
