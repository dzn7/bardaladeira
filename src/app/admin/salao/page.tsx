'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalNotificacao from '@/components/ModalNotificacao'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import { Button } from '@/components/ui/button'
import PainelSalaoAtual from '@/features/salao/components/PainelSalaoAtual'
import DialogNovoPedidoSalao from '@/features/salao/components/DialogNovoPedidoSalao'
import { obterIntervaloDiaOperacionalAtual, estaNoDiaOperacionalAtual } from '@/lib/dia-operacional'
import { supabase } from '@/lib/supabase'
import { enfileirarImpressao, gerarHashEventoImpressao } from '@/lib/filaImpressao'
import { cn } from '@/lib/utils'

const LIMITE_PEDIDOS_SALAO = 80

type TipoPontoSalao = 'mesa' | 'comanda' | 'local_externo'

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
  pagamento_online?: boolean | null
  pagamento_online_status?: string | null
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

type GarcomSalao = {
  id: string
  nome: string
}

type ModalConfirmacao = {
  aberto: boolean
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'
  titulo: string
  mensagem: string
  onConfirmar: () => void
}

type AcaoPedidoSalao = 'pagamento' | 'impressao'
type AcoesPedidoSalao = Partial<Record<AcaoPedidoSalao, boolean>>

const normalizarNumero = (valor: unknown, fallback = 0) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return fallback
  return numero
}

const statusPedidoEncerrado = (status: string) => {
  const normalizado = String(status || '').trim().toLowerCase()
  return normalizado === 'entregue' || normalizado === 'cancelado'
}

const gerarCodigoQrFallback = (numero: number) => `mesa-${String(numero).padStart(3, '0')}`

export default function SalaoPage() {
  const [mesas, setMesas] = useState<PontoSalao[]>([])
  const [pedidos, setPedidos] = useState<PedidoSalao[]>([])
  const [garcons, setGarcons] = useState<GarcomSalao[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizandoMesa, setAtualizandoMesa] = useState<string | null>(null)
  const [atribuindoPedidoId, setAtribuindoPedidoId] = useState<string | null>(null)
  const [acoesPedido, setAcoesPedido] = useState<Record<string, AcoesPedidoSalao>>({})
  const [pontosEmFechamento, setPontosEmFechamento] = useState<Record<string, boolean>>({})
  const [modalNotificacao, setModalNotificacao] = useState<ModalConfirmacao>({
    aberto: false,
    tipo: 'info',
    titulo: '',
    mensagem: '',
    onConfirmar: () => {},
  })
  const router = useRouter()

  const carregarMesas = useCallback(async () => {
    await supabase.rpc('limpar_mesas_expiradas')

    const { data, error } = await supabase
      .from('mesas')
      .select('id, numero, tipo, status, nome_cliente, ocupada_em, liberar_em, tempo_limite_minutos, pedido_id, codigo_qr, identificador, updated_at')
      .in('tipo', ['mesa', 'local_externo'])
      .order('tipo', { ascending: true })
      .order('numero', { ascending: true })

    if (error) throw error

    setMesas(
      (data || []).map((registro) => {
        const numero = normalizarNumero(registro.numero)
        return {
          id: String(registro.id),
          numero,
          tipo: registro.tipo === 'local_externo' ? 'local_externo' : 'mesa',
          status: String(registro.status || 'livre').toLowerCase() === 'ocupada' ? 'ocupada' : 'livre',
          nome_cliente: registro.nome_cliente || null,
          ocupada_em: registro.ocupada_em || null,
          liberar_em: registro.liberar_em || null,
          tempo_limite_minutos:
            registro.tempo_limite_minutos === null || registro.tempo_limite_minutos === undefined
              ? null
              : normalizarNumero(registro.tempo_limite_minutos),
          pedido_id: registro.pedido_id ? String(registro.pedido_id) : null,
          codigo_qr: String(registro.codigo_qr || gerarCodigoQrFallback(numero)),
          identificador: registro.identificador || null,
          updated_at: String(registro.updated_at || ''),
        }
      }),
    )
  }, [])

  const carregarPedidos = useCallback(async () => {
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
        pagamento_online,
        pagamento_online_status,
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
      .limit(LIMITE_PEDIDOS_SALAO)

    if (error) throw error

    const registrosPedidos = data || []
    const idsPedidos = registrosPedidos.map((registro) => String(registro.id))
    const idsGarcons = new Set<string>()
    const atividadesPorPedido = new Map<string, AtividadeGarcomSalao[]>()

    registrosPedidos.forEach((registro) => {
      if (registro.garcom_id) idsGarcons.add(String(registro.garcom_id))

      if (Array.isArray(registro.itens_pedido)) {
        registro.itens_pedido.forEach((item) => {
          if (item.adicionado_por_garcom_id) {
            idsGarcons.add(String(item.adicionado_por_garcom_id))
          }
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
        console.error('[Salão] Erro ao carregar atividades:', atividadesError)
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
        console.error('[Salão] Erro ao carregar garçons:', garconsError)
      } else {
        ;(garconsData || []).forEach((garcom) => {
          nomesGarcons.set(String(garcom.id), String(garcom.nome || 'Garçom'))
        })
      }
    }

    setPedidos(
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
            pagamento_online: Boolean(registro.pagamento_online),
            pagamento_online_status: registro.pagamento_online_status ? String(registro.pagamento_online_status) : null,
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

  const carregarGarcons = useCallback(async () => {
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('id, nome')
      .eq('papel', 'garcom')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) throw error

    setGarcons(
      (data || []).map((garcom) => ({
        id: String(garcom.id),
        nome: String(garcom.nome || 'Garçom'),
      })),
    )
  }, [])

  const carregarTudo = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([carregarMesas(), carregarPedidos(), carregarGarcons()])
    } catch (erro) {
      console.error('[Salão] Erro ao carregar dados:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Falha ao carregar salão',
        mensagem: 'Não foi possível carregar as mesas ocupadas agora.',
        onConfirmar: () => {},
      })
    } finally {
      setLoading(false)
    }
  }, [carregarGarcons, carregarMesas, carregarPedidos])

  useEffect(() => {
    void carregarTudo()

    const intervalo = setInterval(() => {
      void Promise.all([carregarMesas(), carregarPedidos()])
    }, 30000)

    const canalSalao = supabase
      .channel(`admin-salao-atual-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        void carregarMesas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        void carregarPedidos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => {
        void carregarPedidos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividade_garcom' }, () => {
        void carregarPedidos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios_sistema' }, () => {
        void carregarGarcons()
      })
      .subscribe()

    return () => {
      clearInterval(intervalo)
      supabase.removeChannel(canalSalao)
    }
  }, [carregarGarcons, carregarMesas, carregarPedidos, carregarTudo])

  const abrirPedidoMesa = (mesa: PontoSalao) => {
    router.push(`/admin/pedidos/novo?mesa=${mesa.numero}`)
  }

  const atribuirGarcom = async (pedido: PedidoSalao, garcomId: string | null) => {
    setAtribuindoPedidoId(pedido.id)
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ garcom_id: garcomId })
        .eq('id', pedido.id)

      if (error) throw error

      const garcom = garcons.find((item) => item.id === garcomId)
      if (garcomId && garcom) {
        const { error: atividadeError } = await supabase.from('atividade_garcom').insert({
          garcom_id: garcomId,
          tipo_acao: 'mesa_atribuida',
          pedido_id: pedido.id,
          descricao: `Mesa ${pedido.mesa || '-'} atribuída para ${garcom.nome}`,
        })

        if (atividadeError) {
          console.error('[Salão] Erro ao registrar atribuição:', atividadeError)
        }
      }

      await carregarPedidos()
    } catch (erro) {
      console.error('[Salão] Erro ao atribuir garçom:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao atribuir garçom',
        mensagem: 'Não foi possível vincular o garçom a esta mesa.',
        onConfirmar: () => {},
      })
    } finally {
      setAtribuindoPedidoId(null)
    }
  }

  const enviarParaCrediario = async (pedido: PedidoSalao) => {
    try {
      const { error } = await supabase.rpc('enviar_pedido_crediario', {
        p_pedido_id: pedido.id,
      })

      if (error) throw error

      toast.success('Pedido enviado para o crediário')
      await carregarPedidos()
    } catch (erro) {
      console.error('[Salão] Erro ao enviar para crediário:', erro)
      toast.error('Não foi possível enviar para o crediário')
    }
  }

  const confirmarPagamento = async (pedido: PedidoSalao) => {
    if (pedido.pagamento_online_status === 'pago') return

    setAcoesPedido((atual) => ({
      ...atual,
      [pedido.id]: { ...atual[pedido.id], pagamento: true },
    }))

    try {
      const agoraIso = new Date().toISOString()
      const { error } = await supabase
        .from('pedidos')
        .update({
          pagamento_online_status: 'pago',
          pagamento_online_pago_em: agoraIso,
          updated_at: agoraIso,
        })
        .eq('id', pedido.id)

      if (error) throw error

      toast.success('Pagamento confirmado')
      await carregarPedidos()
    } catch (erro) {
      console.error('[Salão] Erro ao confirmar pagamento:', erro)
      toast.error('Não foi possível confirmar o pagamento')
    } finally {
      setAcoesPedido((atual) => ({
        ...atual,
        [pedido.id]: { ...atual[pedido.id], pagamento: false },
      }))
    }
  }

  const imprimirPedido = async (pedido: PedidoSalao) => {
    setAcoesPedido((atual) => ({
      ...atual,
      [pedido.id]: { ...atual[pedido.id], impressao: true },
    }))

    try {
      const hashEvento = gerarHashEventoImpressao(
        pedido.id,
        'cozinha',
        'pedido_completo',
        null,
        'admin_salao_card',
      )
      const resultado = await enfileirarImpressao({
        pedidoId: pedido.id,
        tipo: 'cozinha',
        escopo: 'pedido_completo',
        origem: 'admin_salao_card',
        hashEvento,
        automatico: false,
      })

      if (resultado.duplicado) {
        toast.info('Pedido já está na fila de impressão')
        return
      }

      if (!resultado.sucesso) throw new Error(resultado.erro || 'Falha ao enfileirar impressão.')

      toast.success('Enviado para impressora da cozinha')
    } catch (erro) {
      console.error('[Salão] Erro ao imprimir pedido:', erro)
      toast.error('Não foi possível enviar para impressão')
    } finally {
      setAcoesPedido((atual) => ({
        ...atual,
        [pedido.id]: { ...atual[pedido.id], impressao: false },
      }))
    }
  }

  const estenderMesa = async (mesa: PontoSalao, minutos = 30) => {
    setAtualizandoMesa(mesa.id)
    try {
      const liberarEmAtual = mesa.liberar_em ? new Date(mesa.liberar_em) : new Date()
      const novoLiberarEm = new Date(liberarEmAtual.getTime() + minutos * 60 * 1000)

      const { error } = await supabase
        .from('mesas')
        .update({ liberar_em: novoLiberarEm.toISOString() })
        .eq('id', mesa.id)

      if (error) throw error
      toast.success(`Tempo estendido em ${minutos} min`)
      await carregarMesas()
    } catch (erro) {
      console.error('[Salão] Erro ao estender mesa:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao estender',
        mensagem: 'Não foi possível ajustar o tempo desta mesa.',
        onConfirmar: () => {},
      })
    } finally {
      setAtualizandoMesa(null)
    }
  }

  const liberarMesa = (mesa: PontoSalao) => {
    const pedidoVinculado =
      (mesa.pedido_id ? pedidos.find((pedido) => pedido.id === mesa.pedido_id) : null) ||
      pedidos.find((pedido) => pedido.mesa_id === mesa.id) ||
      pedidos.find((pedido) => (
        mesa.tipo === 'local_externo'
          ? false
          : pedido.mesa === mesa.numero
      )) ||
      null

    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: `Fechar ${mesa.identificador || `Mesa ${mesa.numero}`}`,
      mensagem: pedidoVinculado
        ? 'Deseja marcar o pedido como entregue e liberar este ponto do salão?'
        : 'Deseja liberar este ponto do salão?',
      onConfirmar: async () => {
        setAtualizandoMesa(mesa.id)
        setPontosEmFechamento((atual) => ({ ...atual, [mesa.id]: true }))
        try {
          const agoraIso = new Date().toISOString()
          if (pedidoVinculado && !statusPedidoEncerrado(pedidoVinculado.status)) {
            const { error: erroPedido } = await supabase
              .from('pedidos')
              .update({
                status: 'entregue',
                updated_at: agoraIso,
              })
              .eq('id', pedidoVinculado.id)

            if (erroPedido) throw erroPedido
          }

          const { error } = await supabase
            .from('mesas')
            .update({
              status: 'livre',
              nome_cliente: null,
              ocupada_em: null,
              liberar_em: null,
              pedido_id: null,
              observacoes: null,
              updated_at: agoraIso,
            })
            .eq('id', mesa.id)

          if (error) throw error
          toast.success('Ponto fechado com sucesso')
          await Promise.all([carregarMesas(), carregarPedidos()])
        } catch (erro) {
          console.error('[Salão] Erro ao liberar mesa:', erro)
          setModalNotificacao({
            aberto: true,
            tipo: 'erro',
            titulo: 'Erro ao fechar',
            mensagem: 'Não foi possível fechar o ponto selecionado.',
            onConfirmar: () => {},
          })
        } finally {
          setAtualizandoMesa(null)
          setPontosEmFechamento((atual) => ({ ...atual, [mesa.id]: false }))
        }
      },
    })
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Salão</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Mesas ocupadas, garçons e fechamento do pedido — tudo em um lugar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shadow-none"
                onClick={() => void carregarTudo()}
                disabled={loading}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
                Atualizar
              </Button>
              <DialogNovoPedidoSalao pontos={mesas} carregando={loading} />
            </div>
          </div>

          <PainelSalaoAtual
            mesas={mesas}
            pedidos={pedidos}
            tipo="mesa"
            garcons={garcons}
            carregando={loading}
            atualizandoPonto={atualizandoMesa}
            atribuindoPedidoId={atribuindoPedidoId}
            onAtualizar={carregarTudo}
            onAbrirPedido={abrirPedidoMesa}
            onLiberarMesa={liberarMesa}
            onEstenderMesa={estenderMesa}
            onAtribuirGarcom={atribuirGarcom}
            onEnviarCrediario={enviarParaCrediario}
            onImprimirPedido={imprimirPedido}
            onConfirmarPagamento={confirmarPagamento}
            acoesPedido={acoesPedido}
            pontosEmFechamento={pontosEmFechamento}
          />

          <PainelSalaoAtual
            mesas={mesas}
            pedidos={pedidos}
            tipo="local_externo"
            garcons={garcons}
            carregando={loading}
            atualizandoPonto={atualizandoMesa}
            atribuindoPedidoId={atribuindoPedidoId}
            onAtualizar={carregarTudo}
            onAbrirPedido={abrirPedidoMesa}
            onLiberarMesa={liberarMesa}
            onEstenderMesa={estenderMesa}
            onAtribuirGarcom={atribuirGarcom}
            onEnviarCrediario={enviarParaCrediario}
            onImprimirPedido={imprimirPedido}
            onConfirmarPagamento={confirmarPagamento}
            acoesPedido={acoesPedido}
            pontosEmFechamento={pontosEmFechamento}
          />
        </div>

        <ModalNotificacao
          aberto={modalNotificacao.aberto}
          tipo={modalNotificacao.tipo}
          titulo={modalNotificacao.titulo}
          mensagem={modalNotificacao.mensagem}
          onFechar={() => setModalNotificacao((atual) => ({ ...atual, aberto: false }))}
          onConfirmar={modalNotificacao.onConfirmar}
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}
