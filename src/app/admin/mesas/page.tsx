'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowsClockwise, Check, DownloadSimple, Eye, Package, Plus, Printer, QrCode, ShoppingCart, Timer } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { QRCodeCanvas } from 'qrcode.react'
import { format, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Chip,
  Contador,
  Entrada,
  EntradaPreco,
  Gaveta,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Segmentos,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { obterIntervaloDiaOperacionalAtual, estaNoDiaOperacionalAtual } from '@/lib/dia-operacional'
import { TEMPO_PADRAO_MESA_MINUTOS } from '@/lib/mesas-tempo'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useImpressoraOpcional } from '@/contexts/ImpressoraContext'
import {
  converterConferenciaParaEscpos,
  DadosConferenciaPedido,
  montarModeloConferencia,
  OpcaoTaxaConferencia,
} from '@/lib/impressora/conferencia'
import {
  enfileirarImpressao,
  gerarHashEventoImpressao,
  ItemSnapshotImpressao,
  PedidoSnapshotImpressao,
} from '@/lib/filaImpressao'

const TEMPO_PADRAO_MINUTOS = TEMPO_PADRAO_MESA_MINUTOS
const LIMITE_PEDIDOS_SALAO = 50

type TipoPontoSalao = 'mesa' | 'comanda'
type AbaSalao = 'mesas' | 'comandas' | 'taxa_servico'

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
  item_adicionais: Array<{
    nome: string
    preco: number
    quantidade: number
  }>
}

type PedidoSalao = {
  id: string
  numero_pedido: number | null
  nome_cliente: string
  telefone: string | null
  endereco: string | null
  bairro: string | null
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
  pagamentos_divididos: Array<{
    forma_pagamento: string
    valor: number
  }>
  itens_pedido: ItemPedidoSalao[]
}

type ModalCriarLote = {
  aberto: boolean
  tipo: TipoPontoSalao
}

type ModalEditarPonto = {
  aberto: boolean
  ponto: PontoSalao | null
  numero: string
  identificador: string
}

const ABAS_SALAO: Array<{ id: AbaSalao; titulo: string }> = [
  { id: 'mesas', titulo: 'Mesas' },
  { id: 'comandas', titulo: 'Comandas' },
  { id: 'taxa_servico', titulo: 'Taxa de serviço' },
]

const formatarMoeda = (valor: number) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

const normalizarNumero = (valor: unknown, fallback = 0) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return fallback
  return numero
}

const obterTipoAba = (abaAtiva: AbaSalao): TipoPontoSalao => (abaAtiva === 'comandas' ? 'comanda' : 'mesa')

const obterTituloPonto = (tipo: TipoPontoSalao) => (tipo === 'comanda' ? 'Comanda' : 'Mesa')

const gerarCodigoQrLocal = (tipo: TipoPontoSalao, numero: number) =>
  `${tipo}-${numero}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const obterUrlBaseQr = (tipo: TipoPontoSalao) => {
  if (tipo === 'mesa') {
    const configuradaMesa = process.env.NEXT_PUBLIC_URL_QR_MESA_BASE?.trim()
    if (configuradaMesa) return configuradaMesa
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }

  const configuradaComanda = process.env.NEXT_PUBLIC_URL_QR_SALAO_BASE?.trim()
  if (configuradaComanda) return configuradaComanda
  if (typeof window !== 'undefined') return `${window.location.origin}/admin/pedidos/novo`
  return '/admin/pedidos/novo'
}

const montarUrlQrPonto = (ponto: PontoSalao) => {
  const base = obterUrlBaseQr(ponto.tipo)
  const separador = base.includes('?') ? '&' : '?'
  const parametros =
    ponto.tipo === 'comanda'
      ? `comanda=${ponto.numero}&token=${encodeURIComponent(ponto.codigo_qr)}`
      : `mesa=${ponto.numero}&origem=qr_mesa&abrirCarrinho=1&token=${encodeURIComponent(ponto.codigo_qr)}`

  return `${base}${separador}${parametros}`
}

const statusPedidoEncerrado = (status: string) => {
  const normalizado = String(status || '').trim().toLowerCase()
  return normalizado === 'entregue' || normalizado === 'cancelado'
}

export default function MesasPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaSalao>('mesas')
  const [pontosSalao, setPontosSalao] = useState<PontoSalao[]>([])
  const [pedidosSalao, setPedidosSalao] = useState<PedidoSalao[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizandoPonto, setAtualizandoPonto] = useState<string | null>(null)
  const [salvandoTaxaServico, setSalvandoTaxaServico] = useState(false)
  const [salvandoTaxaPedido, setSalvandoTaxaPedido] = useState<string | null>(null)
  const [idsSelecionados, setIdsSelecionados] = useState<string[]>([])

  const [taxaServicoAtiva, setTaxaServicoAtiva] = useState(false)
  const [taxaServicoPercentual, setTaxaServicoPercentual] = useState('10')
  const [taxaServicoPorPedido, setTaxaServicoPorPedido] = useState<Record<string, string>>({})
  const [pedidoTicketSelecionadoId, setPedidoTicketSelecionadoId] = useState<string | null>(null)
  const [opcaoTaxaConferencia, setOpcaoTaxaConferencia] = useState<OpcaoTaxaConferencia>('com_taxa')
  const [imprimindoConferencia, setImprimindoConferencia] = useState(false)

  const [modalCriarLote, setModalCriarLote] = useState<ModalCriarLote>({ aberto: false, tipo: 'mesa' })
  const [numeroInicialLote, setNumeroInicialLote] = useState('1')
  const [quantidadeLote, setQuantidadeLote] = useState('1')
  const [criandoLote, setCriandoLote] = useState(false)

  const [modalEditarPonto, setModalEditarPonto] = useState<ModalEditarPonto>({
    aberto: false,
    ponto: null,
    numero: '',
    identificador: '',
  })
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const confirmar = useConfirmar()
  const avisar = (tipo: 'sucesso' | 'erro' | 'aviso' | 'info', titulo: string, mensagem: string) => {
    if (tipo === 'sucesso') toast.success(titulo, { description: mensagem })
    else if (tipo === 'erro') toast.error(titulo, { description: mensagem })
    else if (tipo === 'aviso') toast.warning(titulo, { description: mensagem })
    else toast(titulo, { description: mensagem })
  }

  const router = useRouter()
  const impressora = useImpressoraOpcional()

  const carregarPontosSalao = useCallback(async () => {
    try {
      await supabase.rpc('limpar_mesas_expiradas')

      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .order('tipo', { ascending: true })
        .order('numero', { ascending: true })

      if (error) throw error

      const pontos = (data || []).map((registro) => ({
        id: String(registro.id),
        numero: normalizarNumero(registro.numero),
        tipo: (String(registro.tipo || 'mesa').toLowerCase() === 'comanda' ? 'comanda' : 'mesa') as TipoPontoSalao,
        status: (String(registro.status || 'livre').toLowerCase() === 'ocupada' ? 'ocupada' : 'livre') as 'livre' | 'ocupada',
        nome_cliente: registro.nome_cliente,
        ocupada_em: registro.ocupada_em,
        liberar_em: registro.liberar_em,
        tempo_limite_minutos: registro.tempo_limite_minutos,
        pedido_id: registro.pedido_id,
        codigo_qr: String(registro.codigo_qr || gerarCodigoQrLocal('mesa', normalizarNumero(registro.numero))),
        identificador: registro.identificador,
        updated_at: String(registro.updated_at || ''),
      }))

      setPontosSalao(pontos)
    } catch (erro) {
      console.error('Erro ao carregar pontos do salão:', erro)
      avisar('erro', 'Falha ao carregar salão', 'Não foi possível carregar mesas e comandas.')
    }
  }, [])

  const carregarPedidosSalao = useCallback(async () => {
    try {
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
          itens_pedido (
            id,
            nome_item,
            quantidade,
            subtotal,
            observacoes,
            item_adicionais (
              nome,
              preco,
              quantidade
            )
          )
        `)
        .eq('tipo_entrega', 'local')
        .gte('created_at', inicio.toISOString())
        .lt('created_at', fim.toISOString())
        .order('created_at', { ascending: false })
        .limit(LIMITE_PEDIDOS_SALAO)

      if (error) throw error

      const idsPedidos = (data || []).map((registro) => String(registro.id))
      const pagamentosPorPedido = new Map<string, Array<{ forma_pagamento: string; valor: number }>>()

      if (idsPedidos.length > 0) {
        const { data: pagamentosData, error: pagamentosError } = await supabase
          .from('pagamentos_pedido')
          .select('pedido_id, forma_pagamento, valor')
          .in('pedido_id', idsPedidos)

        if (pagamentosError) {
          console.error('Erro ao carregar pagamentos do salão:', pagamentosError)
        } else {
          ;(pagamentosData || []).forEach((pagamento) => {
            const pedidoId = String(pagamento.pedido_id || '')
            if (!pedidoId) return

            const listaAtual = pagamentosPorPedido.get(pedidoId) || []
            listaAtual.push({
              forma_pagamento: String(pagamento.forma_pagamento || ''),
              valor: normalizarNumero(pagamento.valor),
            })
            pagamentosPorPedido.set(pedidoId, listaAtual)
          })
        }
      }

      const pedidos = (data || [])
        .map((registro) => ({
          id: String(registro.id),
          numero_pedido:
            registro.numero_pedido === null || registro.numero_pedido === undefined
              ? null
              : normalizarNumero(registro.numero_pedido),
          nome_cliente: String(registro.nome_cliente || 'Cliente'),
          telefone: registro.telefone || null,
          endereco: registro.endereco || null,
          bairro: registro.bairro || null,
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
          comanda: registro.comanda === null || registro.comanda === undefined ? null : normalizarNumero(registro.comanda),
          mesa_id: registro.mesa_id ? String(registro.mesa_id) : null,
          pagamentos_divididos: pagamentosPorPedido.get(String(registro.id)) || [],
          itens_pedido: Array.isArray(registro.itens_pedido)
            ? registro.itens_pedido.map((item) => ({
                id: String(item.id),
                nome_item: item.nome_item,
                quantidade: normalizarNumero(item.quantidade, 1),
                subtotal: normalizarNumero(item.subtotal),
                observacoes: item.observacoes || null,
                item_adicionais: Array.isArray(item.item_adicionais)
                  ? item.item_adicionais.map((adicional) => ({
                      nome: String(adicional.nome || 'Adicional'),
                      preco: normalizarNumero(adicional.preco),
                      quantidade: normalizarNumero(adicional.quantidade, 1),
                    }))
                  : [],
              }))
            : [],
        }))
        .filter((pedido) => !statusPedidoEncerrado(pedido.status) && estaNoDiaOperacionalAtual(pedido.created_at))

      setPedidosSalao(pedidos)
      setTaxaServicoPorPedido((estadoAnterior) => {
        const proximoEstado = { ...estadoAnterior }
        pedidos.forEach((pedido) => {
          if (!proximoEstado[pedido.id]) {
            proximoEstado[pedido.id] = pedido.taxa_servico.toFixed(2)
          }
        })
        return proximoEstado
      })
    } catch (erro) {
      console.error('Erro ao carregar pedidos de salão:', erro)
    }
  }, [])

  const carregarConfigTaxaServico = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('chave, valor')
        .in('chave', ['salao_taxa_servico_ativa', 'salao_taxa_servico_percentual'])

      if (error) throw error

      const ativa = data?.find((item) => item.chave === 'salao_taxa_servico_ativa')?.valor
      const percentual = data?.find((item) => item.chave === 'salao_taxa_servico_percentual')?.valor

      setTaxaServicoAtiva(String(ativa || 'false').toLowerCase() === 'true')
      setTaxaServicoPercentual(String(percentual || '10'))
    } catch (erro) {
      console.error('Erro ao carregar configurações da taxa de serviço:', erro)
    }
  }, [])

  const carregarTudo = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        carregarPontosSalao(),
        carregarPedidosSalao(),
        carregarConfigTaxaServico(),
      ])
    } finally {
      setLoading(false)
    }
  }, [carregarConfigTaxaServico, carregarPedidosSalao, carregarPontosSalao])

  useEffect(() => {
    carregarTudo()

    const intervalo = setInterval(() => {
      carregarPontosSalao()
      carregarPedidosSalao()
    }, 30000)

    const canalMesas = supabase
      .channel(`mesas-admin-salao-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        carregarPontosSalao()
      })
      .subscribe()

    const canalPedidos = supabase
      .channel(`pedidos-admin-salao-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        carregarPedidosSalao()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => {
        carregarPedidosSalao()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pedido' }, () => {
        carregarPedidosSalao()
      })
      .subscribe()

    return () => {
      clearInterval(intervalo)
      supabase.removeChannel(canalMesas)
      supabase.removeChannel(canalPedidos)
    }
  }, [carregarTudo, carregarPontosSalao, carregarPedidosSalao])

  const tipoAbaAtual = obterTipoAba(abaAtiva)

  const pontosVisiveis = useMemo(() => {
    if (abaAtiva === 'taxa_servico') return []
    return pontosSalao.filter((ponto) => ponto.tipo === tipoAbaAtual)
  }, [abaAtiva, pontosSalao, tipoAbaAtual])

  useEffect(() => {
    setIdsSelecionados((estadoAnterior) => estadoAnterior.filter((id) => pontosVisiveis.some((ponto) => ponto.id === id)))
  }, [pontosVisiveis])

  const idsSelecionadosSet = useMemo(() => new Set(idsSelecionados), [idsSelecionados])

  const pontosSelecionados = useMemo(
    () => pontosVisiveis.filter((ponto) => idsSelecionadosSet.has(ponto.id)),
    [idsSelecionadosSet, pontosVisiveis]
  )

  const pedidoTicketSelecionado = useMemo(
    () => pedidosSalao.find((pedido) => pedido.id === pedidoTicketSelecionadoId) || null,
    [pedidosSalao, pedidoTicketSelecionadoId]
  )

  const converterPedidoParaConferencia = useCallback(
    (pedido: PedidoSalao): DadosConferenciaPedido => ({
      id: pedido.id,
      numeroPedido: pedido.numero_pedido,
      nomeCliente: pedido.nome_cliente || 'Cliente',
      telefone: pedido.telefone,
      tipoEntrega: 'local',
      mesa: pedido.mesa,
      comanda: pedido.comanda,
      endereco: pedido.endereco,
      bairro: pedido.bairro,
      createdAt: pedido.created_at,
      formaPagamento: pedido.forma_pagamento,
      pagamentosDivididos: pedido.pagamentos_divididos,
      trocoPara: pedido.troco_para,
      observacoes: pedido.observacoes,
      subtotal: pedido.subtotal,
      taxaEntrega: pedido.taxa_entrega,
      taxaServico: pedido.taxa_servico,
      total: pedido.total,
      itens: pedido.itens_pedido.map((item) => ({
        id: item.id,
        nome: item.nome_item || 'Item',
        quantidade: item.quantidade,
        subtotal: item.subtotal,
        observacoes: item.observacoes,
        adicionais: item.item_adicionais.map((adicional) => ({
          nome: adicional.nome,
          preco: adicional.preco,
          quantidade: adicional.quantidade,
        })),
      })),
    }),
    []
  )

  const dadosConferenciaSelecionado = useMemo(
    () => (pedidoTicketSelecionado ? converterPedidoParaConferencia(pedidoTicketSelecionado) : null),
    [converterPedidoParaConferencia, pedidoTicketSelecionado]
  )

  const modeloConferenciaComTaxa = useMemo(
    () =>
      dadosConferenciaSelecionado
        ? montarModeloConferencia(dadosConferenciaSelecionado, 'com_taxa')
        : null,
    [dadosConferenciaSelecionado]
  )

  const modeloConferenciaSemTaxa = useMemo(
    () =>
      dadosConferenciaSelecionado
        ? montarModeloConferencia(dadosConferenciaSelecionado, 'sem_taxa')
        : null,
    [dadosConferenciaSelecionado]
  )

  const modeloConferenciaSelecionado = useMemo(
    () => (opcaoTaxaConferencia === 'sem_taxa' ? modeloConferenciaSemTaxa : modeloConferenciaComTaxa),
    [modeloConferenciaComTaxa, modeloConferenciaSemTaxa, opcaoTaxaConferencia]
  )

  const obterPedidoAtivoDoPonto = useCallback(
    (ponto: PontoSalao) => {
      if (ponto.pedido_id) {
        const porPedidoId = pedidosSalao.find((pedido) => pedido.id === ponto.pedido_id)
        if (porPedidoId) return porPedidoId
      }

      const porMesaId = pedidosSalao.find((pedido) => pedido.mesa_id === ponto.id)
      if (porMesaId) return porMesaId

      return pedidosSalao.find((pedido) =>
        ponto.tipo === 'comanda'
          ? pedido.comanda === ponto.numero
          : pedido.mesa === ponto.numero
      ) || null
    },
    [pedidosSalao]
  )

  const quantidadeLivres = useMemo(
    () => pontosVisiveis.filter((ponto) => ponto.status === 'livre').length,
    [pontosVisiveis]
  )

  const quantidadeOcupadas = useMemo(
    () => pontosVisiveis.filter((ponto) => ponto.status === 'ocupada').length,
    [pontosVisiveis]
  )

  useEffect(() => {
    if (!pedidoTicketSelecionadoId) return
    const aindaExiste = pedidosSalao.some((pedido) => pedido.id === pedidoTicketSelecionadoId)
    if (!aindaExiste) {
      setPedidoTicketSelecionadoId(null)
    }
  }, [pedidosSalao, pedidoTicketSelecionadoId])

  useEffect(() => {
    if (!pedidoTicketSelecionadoId) return
    setOpcaoTaxaConferencia('com_taxa')
  }, [pedidoTicketSelecionadoId])

  const calcularTempoRestante = (ponto: PontoSalao) => {
    if (!ponto.liberar_em && !ponto.ocupada_em) {
      return { texto: 'Sem limite', porcentagem: 0, urgente: false }
    }

    const agora = new Date()
    const tempoLimite = ponto.tempo_limite_minutos || TEMPO_PADRAO_MINUTOS

    let limite: Date
    if (ponto.liberar_em) {
      limite = new Date(ponto.liberar_em)
    } else {
      const inicio = new Date(ponto.ocupada_em as string)
      limite = new Date(inicio.getTime() + tempoLimite * 60 * 1000)
    }

    const minutosRestantes = differenceInMinutes(limite, agora)

    if (minutosRestantes <= 0) return { texto: 'Expirando...', porcentagem: 100, urgente: true }

    const horas = Math.floor(minutosRestantes / 60)
    const minutos = minutosRestantes % 60
    const porcentagem = ((tempoLimite - minutosRestantes) / tempoLimite) * 100

    if (horas > 0) {
      return { texto: `${horas}h ${minutos}min`, porcentagem, urgente: minutosRestantes < 15 }
    }
    return { texto: `${minutos}min`, porcentagem, urgente: minutosRestantes < 15 }
  }

  const obterCanvasQr = (idPonto: string) => document.getElementById(`qr-${idPonto}`) as HTMLCanvasElement | null

  const exportarQrPng = (ponto: PontoSalao) => {
    const canvas = obterCanvasQr(ponto.id)
    if (!canvas) {
      avisar('aviso', 'QR indisponível', 'Aguarde o carregamento do QR para exportar.')
      return
    }

    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${obterTituloPonto(ponto.tipo).toLowerCase()}-${ponto.numero}.png`
    link.click()
  }

  const exportarSelecionados = () => {
    if (pontosSelecionados.length === 0) {
      avisar('aviso', 'Nenhum item selecionado', 'Selecione ao menos um QR para exportar.')
      return
    }

    pontosSelecionados.forEach((ponto, indice) => {
      window.setTimeout(() => exportarQrPng(ponto), indice * 140)
    })
  }

  const imprimirSelecionados = () => {
    if (pontosSelecionados.length === 0) {
      avisar('aviso', 'Nenhum item selecionado', 'Selecione ao menos um QR para imprimir.')
      return
    }

    const blocos = pontosSelecionados
      .map((ponto) => {
        const canvas = obterCanvasQr(ponto.id)
        if (!canvas) return null
        const imagem = canvas.toDataURL('image/png')
        const titulo = ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`
        const url = montarUrlQrPonto(ponto)

        return `
          <article class="cartao">
            <h2>${titulo}</h2>
            <img src="${imagem}" alt="QR ${titulo}" />
            <p>${url}</p>
          </article>
        `
      })
      .filter(Boolean)
      .join('')

    if (!blocos) {
      avisar('aviso', 'QR indisponível', 'Não foi possível montar os QR Codes para impressão.')
      return
    }

    const janela = window.open('', '_blank', 'width=900,height=700')
    if (!janela) {
      avisar('erro', 'Popup bloqueado', 'Permita popups do navegador para imprimir os QR Codes.')
      return
    }

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Impressão QR - Bar da Ladeira</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 16px; font-size: 20px; }
            .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
            .cartao { border: 1px solid #d4d4d8; border-radius: 12px; padding: 14px; text-align: center; }
            .cartao img { width: 140px; height: 140px; object-fit: contain; }
            .cartao h2 { font-size: 16px; margin: 0 0 10px; }
            .cartao p { font-size: 11px; color: #52525b; word-break: break-all; margin: 8px 0 0; }
            @media print {
              body { margin: 0; padding: 14px; }
            }
          </style>
        </head>
        <body>
          <h1>Bar da Ladeira • QR Codes do salão</h1>
          <section class="grade">${blocos}</section>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    janela.document.close()
  }

  const alternarSelecao = (idPonto: string) => {
    setIdsSelecionados((estadoAnterior) =>
      estadoAnterior.includes(idPonto)
        ? estadoAnterior.filter((id) => id !== idPonto)
        : [...estadoAnterior, idPonto]
    )
  }

  const selecionarTodosVisiveis = () => {
    if (pontosVisiveis.length === 0) return

    const todosSelecionados = pontosVisiveis.every((ponto) => idsSelecionadosSet.has(ponto.id))
    if (todosSelecionados) {
      setIdsSelecionados((estadoAnterior) => estadoAnterior.filter((id) => !pontosVisiveis.some((ponto) => ponto.id === id)))
      return
    }

    const idsNovos = pontosVisiveis.map((ponto) => ponto.id)
    setIdsSelecionados((estadoAnterior) => Array.from(new Set([...estadoAnterior, ...idsNovos])))
  }

  const abrirCriacaoLote = (tipo: TipoPontoSalao) => {
    const pontosTipo = pontosSalao.filter((ponto) => ponto.tipo === tipo)
    const proximoNumero = pontosTipo.length > 0 ? Math.max(...pontosTipo.map((ponto) => ponto.numero)) + 1 : 1

    setModalCriarLote({ aberto: true, tipo })
    setNumeroInicialLote(String(proximoNumero))
    setQuantidadeLote('1')
  }

  const criarLote = async () => {
    const numeroInicial = parseInt(numeroInicialLote, 10)
    const quantidade = parseInt(quantidadeLote, 10)

    if (!Number.isFinite(numeroInicial) || numeroInicial <= 0) {
      avisar('aviso', 'Número inicial inválido', 'Informe um número inicial maior que zero.')
      return
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 200) {
      avisar('aviso', 'Quantidade inválida', 'A quantidade deve estar entre 1 e 200 itens.')
      return
    }

    const tipo = modalCriarLote.tipo
    const numerosNovos = Array.from({ length: quantidade }, (_, indice) => numeroInicial + indice)
    const numerosExistentes = new Set(
      pontosSalao
        .filter((ponto) => ponto.tipo === tipo)
        .map((ponto) => ponto.numero)
    )

    const conflituosos = numerosNovos.filter((numero) => numerosExistentes.has(numero))
    if (conflituosos.length > 0) {
      avisar('aviso', 'Numeração em uso', `Já existem ${obterTituloPonto(tipo).toLowerCase()}s com os números: ${conflituosos.join(', ')}.`)
      return
    }

    setCriandoLote(true)
    try {
      const registros = numerosNovos.map((numero) => ({
        numero,
        tipo,
        status: 'livre',
        tempo_limite_minutos: TEMPO_PADRAO_MINUTOS,
        codigo_qr: gerarCodigoQrLocal(tipo, numero),
        identificador: `${obterTituloPonto(tipo)} ${numero}`,
      }))

      const { error } = await supabase.from('mesas').insert(registros)
      if (error) throw error

      setModalCriarLote({ ...modalCriarLote, aberto: false })
      await carregarPontosSalao()
      avisar('sucesso', 'Cadastro concluído', `${quantidade} ${obterTituloPonto(tipo).toLowerCase()}${quantidade > 1 ? 's' : ''} criada${quantidade > 1 ? 's' : ''} com sucesso.`)
    } catch (erro) {
      console.error('Erro ao criar lote:', erro)
      avisar('erro', 'Falha ao criar lote', `Não foi possível criar ${obterTituloPonto(tipo).toLowerCase()}s neste momento.`)
    } finally {
      setCriandoLote(false)
    }
  }

  const abrirEdicaoPonto = (ponto: PontoSalao) => {
    setModalEditarPonto({
      aberto: true,
      ponto,
      numero: String(ponto.numero),
      identificador: ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`,
    })
  }

  const salvarEdicaoPonto = async () => {
    const ponto = modalEditarPonto.ponto
    if (!ponto) return

    const numeroNovo = parseInt(modalEditarPonto.numero, 10)
    if (!Number.isFinite(numeroNovo) || numeroNovo <= 0) {
      avisar('aviso', 'Número inválido', 'Informe um número maior que zero.')
      return
    }

    const duplicado = pontosSalao.some(
      (registro) => registro.id !== ponto.id && registro.tipo === ponto.tipo && registro.numero === numeroNovo
    )

    if (duplicado) {
      avisar('aviso', 'Numeração em uso', `Já existe ${obterTituloPonto(ponto.tipo).toLowerCase()} ${numeroNovo}.`)
      return
    }

    setSalvandoEdicao(true)
    try {
      const { error } = await supabase
        .from('mesas')
        .update({
          numero: numeroNovo,
          identificador: modalEditarPonto.identificador.trim() || `${obterTituloPonto(ponto.tipo)} ${numeroNovo}`,
        })
        .eq('id', ponto.id)

      if (error) throw error

      setModalEditarPonto({ aberto: false, ponto: null, numero: '', identificador: '' })
      await carregarPontosSalao()
      toast.success('Alterações salvas')
    } catch (erro) {
      console.error('Erro ao editar ponto:', erro)
      avisar('erro', 'Erro ao salvar', 'Não foi possível salvar as alterações.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const excluirPonto = async (ponto: PontoSalao): Promise<boolean> => {
    const nomePonto = ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`
    if (ponto.status === 'ocupada') {
      avisar('aviso', `${obterTituloPonto(ponto.tipo)} ocupada`, `Libere ${nomePonto} antes de excluir.`)
      return false
    }

    const ok = await confirmar({
      titulo: `Excluir ${nomePonto}?`,
      descricao: 'O QR Code impresso deixa de funcionar. Não dá para desfazer.',
      confirmar: 'Excluir',
      perigo: true,
    })
    if (!ok) return false

    try {
      const { error } = await supabase.from('mesas').delete().eq('id', ponto.id)
      if (error) throw error

      setIdsSelecionados((estadoAnterior) => estadoAnterior.filter((id) => id !== ponto.id))
      await carregarPontosSalao()
      toast.success(`${nomePonto} excluída`)
      return true
    } catch (erro) {
      console.error('Erro ao excluir ponto:', erro)
      toast.error('Não foi possível excluir.', { description: nomePonto })
      return false
    }
  }

  const excluirSelecionados = async () => {
    if (pontosSelecionados.length === 0) {
      avisar('aviso', 'Nada selecionado', 'Selecione ao menos um item para excluir.')
      return
    }

    const ocupados = pontosSelecionados.filter((ponto) => ponto.status === 'ocupada')
    if (ocupados.length > 0) {
      avisar('aviso', 'Itens ocupados', 'Existem itens ocupados na seleção. Libere antes de excluir em lote.')
      return
    }

    const ok = await confirmar({
      titulo: `Excluir ${pontosSelecionados.length} selecionada(s)?`,
      descricao: 'Os QR Codes impressos deixam de funcionar. Não dá para desfazer.',
      confirmar: 'Excluir',
      perigo: true,
    })
    if (!ok) return

    try {
      const ids = pontosSelecionados.map((ponto) => ponto.id)
      const { error } = await supabase.from('mesas').delete().in('id', ids)
      if (error) throw error

      setIdsSelecionados([])
      await carregarPontosSalao()
      toast.success(`${ids.length} excluída(s)`)
    } catch (erro) {
      console.error('Erro ao excluir seleção:', erro)
      toast.error('Não foi possível excluir a seleção.')
    }
  }

  const liberarPonto = async (ponto: PontoSalao) => {
    const nomePonto = ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`
    const ok = await confirmar({
      titulo: `Liberar ${nomePonto}?`,
      descricao: 'Ela volta a aparecer como livre.',
      confirmar: 'Liberar',
    })
    if (!ok) return

    setAtualizandoPonto(ponto.id)
    try {
      const { error } = await supabase
        .from('mesas')
        .update({
          status: 'livre',
          nome_cliente: null,
          ocupada_em: null,
          liberar_em: null,
          pedido_id: null,
          observacoes: null,
        })
        .eq('id', ponto.id)

      if (error) throw error

      await Promise.all([carregarPontosSalao(), carregarPedidosSalao()])
      toast.success(`${nomePonto} liberada`)
    } catch (erro) {
      console.error('Erro ao liberar ponto:', erro)
      avisar('erro', 'Erro ao liberar', 'Não foi possível liberar o ponto selecionado.')
    } finally {
      setAtualizandoPonto(null)
    }
  }

  const estenderTempoPonto = async (ponto: PontoSalao) => {
    setAtualizandoPonto(ponto.id)
    try {
      const liberarEmAtual = ponto.liberar_em ? new Date(ponto.liberar_em) : new Date()
      const novoLiberarEm = new Date(liberarEmAtual.getTime() + 30 * 60 * 1000)

      const { error } = await supabase
        .from('mesas')
        .update({ liberar_em: novoLiberarEm.toISOString() })
        .eq('id', ponto.id)

      if (error) throw error

      await carregarPontosSalao()
    } catch (erro) {
      console.error('Erro ao estender tempo:', erro)
    } finally {
      setAtualizandoPonto(null)
    }
  }

  const abrirPedidoPonto = (ponto: PontoSalao) => {
    const parametro = ponto.tipo === 'comanda' ? `comanda=${ponto.numero}` : `mesa=${ponto.numero}`
    router.push(`/admin/pedidos/novo?${parametro}`)
  }

  const abrirTicketPedido = (pedidoId: string) => {
    setPedidoTicketSelecionadoId(pedidoId)
  }

  const imprimirConferenciaPedido = async (pedido: PedidoSalao) => {
    const dadosConferencia = converterPedidoParaConferencia(pedido)
    const modeloSelecionado = montarModeloConferencia(dadosConferencia, opcaoTaxaConferencia)
    const dadosEscpos = converterConferenciaParaEscpos(dadosConferencia, opcaoTaxaConferencia)

    const itensSnapshot: ItemSnapshotImpressao[] = dadosConferencia.itens.map((item) => ({
      nome_item: item.nome,
      quantidade: item.quantidade,
      preco_unitario: Number((item.subtotal / Math.max(1, item.quantidade)).toFixed(2)),
      subtotal: item.subtotal,
      observacoes: item.observacoes || null,
      item_adicionais: (item.adicionais || []).map((adicional) => ({
        nome: adicional.nome,
        preco: Number(adicional.preco || 0),
        quantidade: Number(adicional.quantidade || 1),
      })),
    }))

    const pedidoSnapshot: PedidoSnapshotImpressao = {
      id: dadosConferencia.id,
      numero_pedido: dadosConferencia.numeroPedido || null,
      nome_cliente: dadosConferencia.nomeCliente,
      tipo_entrega: dadosConferencia.tipoEntrega,
      telefone: dadosConferencia.telefone || null,
      mesa: dadosConferencia.mesa || null,
      comanda: dadosConferencia.comanda || null,
      mesa_numero: dadosConferencia.mesa || null,
      endereco: dadosConferencia.endereco || null,
      bairro: dadosConferencia.bairro || null,
      observacoes: dadosConferencia.observacoes || null,
      subtotal: modeloSelecionado.subtotal,
      taxa_entrega: modeloSelecionado.taxaEntrega,
      taxa_servico: modeloSelecionado.taxaServico,
      total: modeloSelecionado.total,
      forma_pagamento: dadosConferencia.formaPagamento || null,
      pagamentos_divididos: (dadosConferencia.pagamentosDivididos || []).map((pagamento) => ({
        forma_pagamento: String(pagamento.forma_pagamento || ''),
        valor: Number(pagamento.valor || 0),
      })),
      troco_para: dadosConferencia.trocoPara || null,
      origem_conferencia: true,
      modo_taxa_conferencia: opcaoTaxaConferencia,
      created_at: dadosConferencia.createdAt || new Date().toISOString(),
    }

    const origem =
      opcaoTaxaConferencia === 'com_taxa'
        ? 'admin_conferencia_com_taxa'
        : 'admin_conferencia_sem_taxa'

    setImprimindoConferencia(true)
    try {
      let impressoLocal = false

      if (impressora && impressora.status === 'conectado') {
        impressoLocal = await impressora.imprimir(dadosEscpos, 'cliente')
      }

      if (impressoLocal) {
        avisar('sucesso', 'Conferência impressa', 'A conferência foi impressa na impressora local.')
        return
      }

      const hashEvento = gerarHashEventoImpressao(
        pedido.id,
        'cliente',
        'pedido_completo',
        itensSnapshot,
        origem
      )

      const resultadoFila = await enfileirarImpressao({
        pedidoId: pedido.id,
        tipo: 'cliente',
        escopo: 'pedido_completo',
        itensSnapshot,
        pedidoSnapshot,
        origem,
        hashEvento,
        automatico: false,
      })

      if (resultadoFila.sucesso || resultadoFila.duplicado) {
        avisar('sucesso', 'Conferência enviada', 'A conferência foi enviada para a fila de impressão.')
      } else {
        avisar('erro', 'Falha na impressão', resultadoFila.erro || 'Não foi possível enviar a conferência para impressão.')
      }
    } catch (erro) {
      console.error('Erro ao imprimir conferência:', erro)
      avisar('erro', 'Falha na conferência', 'Não foi possível imprimir a conferência neste momento.')
    } finally {
      setImprimindoConferencia(false)
    }
  }

  const salvarConfigTaxaServico = async () => {
    const percentual = Number(taxaServicoPercentual.replace(',', '.'))

    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      avisar('aviso', 'Percentual inválido', 'Informe um percentual entre 0 e 100.')
      return
    }

    setSalvandoTaxaServico(true)
    try {
      const { error } = await supabase.from('configuracoes_loja').upsert(
        [
          {
            chave: 'salao_taxa_servico_ativa',
            valor: String(taxaServicoAtiva),
            tipo: 'boolean',
            descricao: 'Controla aplicação padrão da taxa de serviço no salão',
          },
          {
            chave: 'salao_taxa_servico_percentual',
            valor: percentual.toFixed(2),
            tipo: 'number',
            descricao: 'Percentual padrão da taxa de serviço no salão',
          },
        ],
        { onConflict: 'chave' }
      )

      if (error) throw error

      avisar('sucesso', 'Configuração salva', 'A taxa de serviço padrão foi atualizada com sucesso.')
    } catch (erro) {
      console.error('Erro ao salvar configuração da taxa:', erro)
      avisar('erro', 'Erro ao salvar', 'Não foi possível salvar a configuração da taxa de serviço.')
    } finally {
      setSalvandoTaxaServico(false)
    }
  }

  const atualizarTaxaServicoPedido = async (pedido: PedidoSalao) => {
    const valorTexto = taxaServicoPorPedido[pedido.id] || '0'
    const valorTaxa = Number(valorTexto.replace(',', '.'))

    if (!Number.isFinite(valorTaxa) || valorTaxa < 0) {
      avisar('aviso', 'Valor inválido', 'Informe um valor de taxa de serviço válido (igual ou maior que zero).')
      return
    }

    setSalvandoTaxaPedido(pedido.id)
    try {
      const novoTotal = pedido.subtotal + pedido.taxa_entrega + valorTaxa
      const { error } = await supabase
        .from('pedidos')
        .update({
          taxa_servico: Number(valorTaxa.toFixed(2)),
          total: Number(novoTotal.toFixed(2)),
        })
        .eq('id', pedido.id)

      if (error) throw error

      await carregarPedidosSalao()
    } catch (erro) {
      console.error('Erro ao atualizar taxa do pedido:', erro)
      avisar('erro', 'Falha ao atualizar taxa', 'Não foi possível atualizar a taxa de serviço deste pedido.')
    } finally {
      setSalvandoTaxaPedido(null)
    }
  }

  const fecharEdicao = () => setModalEditarPonto({ aberto: false, ponto: null, numero: '', identificador: '' })
  const nomeDoPonto = (ponto: PontoSalao) => ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`
  const plural = tipoAbaAtual === 'comanda' ? 'comandas' : 'mesas'
  const todosSelecionados = pontosVisiveis.length > 0 && pontosVisiveis.every((ponto) => idsSelecionadosSet.has(ponto.id))
  const rotuloAtendimento = (pedido: PedidoSalao) =>
    pedido.comanda ? `Comanda ${pedido.comanda}` : pedido.mesa ? `Mesa ${pedido.mesa}` : 'Salão'

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina>
          <CabecalhoPagina
            titulo="Mesas e comandas"
            descricao={
              abaAtiva === 'taxa_servico'
                ? 'Taxa padrão e conferência dos pedidos abertos.'
                : `${pontosVisiveis.length} ${plural} · ${quantidadeLivres} livres · ${quantidadeOcupadas} ocupadas`
            }
            acoes={
              <>
                <Botao variante="contorno" onClick={() => carregarTudo()} aria-label="Atualizar">
                  <ArrowsClockwise className={cn('size-4', loading && 'animate-spin')} />
                  <span className="sm:hidden">Atualizar</span>
                </Botao>
                {abaAtiva !== 'taxa_servico' && (
                  <Botao onClick={() => abrirCriacaoLote(tipoAbaAtual)}>
                    <Plus className="size-4" />
                    {tipoAbaAtual === 'comanda' ? 'Nova comanda' : 'Nova mesa'}
                  </Botao>
                )}
              </>
            }
          />

          <div role="tablist" aria-label="Seções do salão" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {ABAS_SALAO.map((aba) => (
              <Chip
                key={aba.id}
                role="tab"
                aria-selected={aba.id === abaAtiva}
                ativo={aba.id === abaAtiva}
                onClick={() => setAbaAtiva(aba.id)}
                className="h-10"
              >
                {aba.titulo}
              </Chip>
            ))}
          </div>

          {loading ? (
            <ListaCarregando linhas={5} />
          ) : abaAtiva !== 'taxa_servico' ? (
            pontosVisiveis.length === 0 ? (
              <ListaVazia
                icone={<QrCode />}
                titulo={`Nenhuma ${obterTituloPonto(tipoAbaAtual).toLowerCase()} cadastrada`}
                descricao="Cada uma ganha um QR Code para o cliente abrir o cardápio."
                acao={
                  <Botao onClick={() => abrirCriacaoLote(tipoAbaAtual)}>
                    <Plus className="size-4" />
                    {tipoAbaAtual === 'comanda' ? 'Criar comandas' : 'Criar mesas'}
                  </Botao>
                }
              />
            ) : (
              <div className="space-y-2">
                <div className="flex min-h-11 flex-wrap items-center gap-2 px-1">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 pr-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      onChange={selecionarTodosVisiveis}
                      className="size-4 accent-[hsl(var(--primary))]"
                    />
                    {pontosSelecionados.length > 0 ? `${pontosSelecionados.length} selecionada(s)` : 'Selecionar todas'}
                  </label>
                  {pontosSelecionados.length > 0 && (
                    <div className="ml-auto flex flex-wrap gap-1">
                      <Botao variante="fantasma" tamanho="sm" onClick={imprimirSelecionados}>
                        <Printer className="size-4" />
                        Imprimir QR
                      </Botao>
                      <Botao variante="fantasma" tamanho="sm" onClick={exportarSelecionados}>
                        <DownloadSimple className="size-4" />
                        Baixar
                      </Botao>
                      <Botao variante="perigoSuave" tamanho="sm" onClick={() => void excluirSelecionados()}>
                        Excluir
                      </Botao>
                    </div>
                  )}
                </div>

                <Lista>
                  {pontosVisiveis.map((ponto) => {
                    const ocupada = ponto.status === 'ocupada'
                    const tempo = ocupada ? calcularTempoRestante(ponto) : null
                    const pedidoAtivoPonto = ocupada ? obterPedidoAtivoDoPonto(ponto) : null
                    const ocupado = atualizandoPonto === ponto.id

                    return (
                      <li key={ponto.id} className={cn('px-3 py-3 sm:px-4', ocupada && tempo?.urgente && 'bg-destructive/5')}>
                        <div className="flex items-start gap-3">
                          <label className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={idsSelecionadosSet.has(ponto.id)}
                              onChange={() => alternarSelecao(ponto.id)}
                              aria-label={`Selecionar ${nomeDoPonto(ponto)}`}
                              className="size-4 accent-[hsl(var(--primary))]"
                            />
                          </label>

                          <div className="shrink-0 rounded-md border border-border/70 bg-white p-1">
                            <QRCodeCanvas
                              id={`qr-${ponto.id}`}
                              value={montarUrlQrPonto(ponto)}
                              size={100}
                              marginSize={1}
                              fgColor="#0f172a"
                              bgColor="#ffffff"
                              style={{ width: 52, height: 52 }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => abrirEdicaoPonto(ponto)}
                            className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Editar ${nomeDoPonto(ponto)}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-foreground">{nomeDoPonto(ponto)}</p>
                              {ocupada ? (
                                <Selo tom={tempo?.urgente ? 'perigo' : 'primario'}>Ocupada</Selo>
                              ) : (
                                <Selo tom="sucesso">Livre</Selo>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {ocupada
                                ? [ponto.nome_cliente, tempo ? `${tempo.texto} restantes` : null].filter(Boolean).join(' · ') || 'Em atendimento'
                                : `Número ${ponto.numero}`}
                            </p>
                            {ocupada && tempo && tempo.porcentagem > 0 && (
                              <div className="mt-2 h-1 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn('h-full rounded-full', tempo.urgente ? 'bg-destructive' : 'bg-primary')}
                                  style={{ width: `${Math.min(Math.max(tempo.porcentagem, 0), 100)}%` }}
                                />
                              </div>
                            )}
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 sm:pl-[7rem]">
                          <Botao tamanho="sm" className="h-11 sm:h-9" onClick={() => abrirPedidoPonto(ponto)}>
                            <ShoppingCart className="size-4" />
                            Novo pedido
                          </Botao>
                          {pedidoAtivoPonto && (
                            <Botao variante="contorno" tamanho="sm" className="h-11 sm:h-9" onClick={() => abrirTicketPedido(pedidoAtivoPonto.id)}>
                              <Eye className="size-4" />
                              Conferência
                            </Botao>
                          )}
                          {ocupada && (
                            <Botao
                              variante="contorno"
                              tamanho="sm"
                              className="h-11 sm:h-9"
                              onClick={() => estenderTempoPonto(ponto)}
                              disabled={ocupado}
                            >
                              <Timer className="size-4" />
                              +30 min
                            </Botao>
                          )}
                          {ocupada && (
                            <Botao
                              variante="contorno"
                              tamanho="sm"
                              className="h-11 sm:h-9"
                              onClick={() => void liberarPonto(ponto)}
                              carregando={ocupado}
                            >
                              {!ocupado && <Check className="size-4" />}
                              Liberar
                            </Botao>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </Lista>
                <p className="px-1 text-sm text-muted-foreground">
                  Toque no nome para editar, baixar o QR ou excluir.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-6">
              <Secao titulo="Taxa padrão" descricao="Vale para os novos pedidos de salão.">
                <Cartao className="space-y-4 p-4">
                  <LinhaInterruptor
                    titulo="Cobrar taxa de serviço"
                    descricao="Já entra no pedido. Dá para ajustar em cada conferência."
                    marcado={taxaServicoAtiva}
                    aoMudar={setTaxaServicoAtiva}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <Campo rotulo="Percentual" htmlFor="taxa-servico-percentual" className="sm:w-40">
                      <div className="relative">
                        <Entrada
                          id="taxa-servico-percentual"
                          inputMode="decimal"
                          value={taxaServicoPercentual}
                          onChange={(evento) => setTaxaServicoPercentual(evento.target.value.replace(/[^\d.,]/g, ''))}
                          className="pr-8 tabular-nums"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                    </Campo>
                    <Botao onClick={salvarConfigTaxaServico} carregando={salvandoTaxaServico}>
                      Salvar
                    </Botao>
                  </div>
                </Cartao>
              </Secao>

              <Secao titulo="Pedidos abertos no salão" descricao="Abra a conferência para imprimir ou ajustar a taxa.">
                {pedidosSalao.length === 0 ? (
                  <ListaVazia icone={<Package />} titulo="Nenhum pedido aberto" descricao="Os pedidos de hoje no salão aparecem aqui." />
                ) : (
                  <Lista>
                    {pedidosSalao.map((pedido) => (
                      <li key={pedido.id}>
                        <button
                          type="button"
                          onClick={() => abrirTicketPedido(pedido.id)}
                          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">
                              {rotuloAtendimento(pedido)} · {pedido.nome_cliente}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {pedido.itens_pedido.length} itens · {format(new Date(pedido.created_at), 'HH:mm', { locale: ptBR })} · {pedido.status}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-medium tabular-nums text-foreground">{formatarMoeda(pedido.total)}</p>
                            {pedido.taxa_servico > 0 && (
                              <p className="text-xs tabular-nums text-muted-foreground">taxa {formatarMoeda(pedido.taxa_servico)}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </Lista>
                )}
              </Secao>
            </div>
          )}
        </Pagina>

        <Gaveta
          aberto={Boolean(pedidoTicketSelecionado && modeloConferenciaSelecionado)}
          aoFechar={() => setPedidoTicketSelecionadoId(null)}
          bloqueada={imprimindoConferencia}
          largura="lg"
          titulo="Conferência"
          descricao={
            pedidoTicketSelecionado
              ? `${rotuloAtendimento(pedidoTicketSelecionado)} · ${pedidoTicketSelecionado.nome_cliente} · ${format(new Date(pedidoTicketSelecionado.created_at), 'dd/MM HH:mm', { locale: ptBR })}`
              : undefined
          }
          cabecalho={
            <Segmentos
              rotuloAcessivel="Versão da conferência"
              valor={opcaoTaxaConferencia}
              aoMudar={setOpcaoTaxaConferencia}
              opcoes={[
                { valor: 'com_taxa', rotulo: 'Com taxa de serviço' },
                { valor: 'sem_taxa', rotulo: 'Sem taxa' },
              ]}
            />
          }
          rodape={
            pedidoTicketSelecionado ? (
              <>
                <Botao variante="contorno" onClick={() => setPedidoTicketSelecionadoId(null)} disabled={imprimindoConferencia}>
                  Fechar
                </Botao>
                <Botao onClick={() => imprimirConferenciaPedido(pedidoTicketSelecionado)} carregando={imprimindoConferencia}>
                  {!imprimindoConferencia && <Printer className="size-4" />}
                  {imprimindoConferencia ? 'Imprimindo...' : 'Imprimir'}
                </Botao>
              </>
            ) : null
          }
        >
          {pedidoTicketSelecionado && modeloConferenciaSelecionado && (
            <div className="space-y-5">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Itens</dt>
                  <dd className="tabular-nums text-foreground">{modeloConferenciaSelecionado.totalItens}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums text-foreground">{formatarMoeda(modeloConferenciaSelecionado.subtotal)}</dd>
                </div>
                {modeloConferenciaSelecionado.taxaEntrega > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Taxa de entrega</dt>
                    <dd className="tabular-nums text-foreground">{formatarMoeda(modeloConferenciaSelecionado.taxaEntrega)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <dt>Taxa de serviço</dt>
                  <dd className="tabular-nums text-foreground">{formatarMoeda(modeloConferenciaSelecionado.taxaServico)}</dd>
                </div>
                <div className="flex justify-between border-t border-border/70 pt-2 text-base font-semibold text-foreground">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatarMoeda(modeloConferenciaSelecionado.total)}</dd>
                </div>
              </dl>
              {opcaoTaxaConferencia === 'sem_taxa' && (
                <p className="text-[13px] text-muted-foreground">Sem taxa muda só esta impressão. O pedido continua igual.</p>
              )}

              <details className="group rounded-lg border border-border/70">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-foreground">
                  Ver ticket
                  <span className="text-muted-foreground group-open:hidden">Mostrar</span>
                  <span className="hidden text-muted-foreground group-open:inline">Ocultar</span>
                </summary>
                <div className="max-h-[50dvh] overflow-auto border-t border-border/70 bg-muted/30 p-3">
                  <pre className="whitespace-pre font-mono text-[11px] leading-[1.3] text-foreground">
                    {modeloConferenciaSelecionado.linhasTicket.join('\n')}
                  </pre>
                </div>
              </details>

              <Campo
                rotulo="Taxa de serviço deste pedido"
                htmlFor="taxa-servico-pedido"
                ajuda="Muda o total do pedido, não só a impressão."
              >
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <EntradaPreco
                      id="taxa-servico-pedido"
                      valor={taxaServicoPorPedido[pedidoTicketSelecionado.id] || '0'}
                      aoMudar={(valor) =>
                        setTaxaServicoPorPedido((estadoAnterior) => ({
                          ...estadoAnterior,
                          [pedidoTicketSelecionado.id]: valor,
                        }))
                      }
                    />
                  </div>
                  <Botao
                    variante="contorno"
                    className="h-11 md:h-10"
                    onClick={() => atualizarTaxaServicoPedido(pedidoTicketSelecionado)}
                    carregando={salvandoTaxaPedido === pedidoTicketSelecionado.id}
                  >
                    Salvar taxa
                  </Botao>
                </div>
              </Campo>
            </div>
          )}
        </Gaveta>

        <Gaveta
          aberto={modalCriarLote.aberto}
          aoFechar={() => setModalCriarLote({ ...modalCriarLote, aberto: false })}
          bloqueada={criandoLote}
          titulo={modalCriarLote.tipo === 'comanda' ? 'Criar comandas' : 'Criar mesas'}
          descricao="Cada uma ganha um QR Code próprio."
          rodape={
            <>
              <Botao variante="contorno" onClick={() => setModalCriarLote({ ...modalCriarLote, aberto: false })} disabled={criandoLote}>
                Cancelar
              </Botao>
              <Botao onClick={criarLote} carregando={criandoLote}>
                Criar {Number(quantidadeLote) > 1 ? quantidadeLote : ''}
              </Botao>
            </>
          }
        >
          <form
            className="space-y-4"
            onSubmit={(evento) => {
              evento.preventDefault()
              void criarLote()
            }}
          >
            <Campo rotulo="Começar no número" htmlFor="lote-numero-inicial">
              <Entrada
                id="lote-numero-inicial"
                type="number"
                inputMode="numeric"
                min={1}
                value={numeroInicialLote}
                onChange={(evento) => setNumeroInicialLote(evento.target.value)}
              />
            </Campo>
            <Campo
              rotulo="Quantas"
              ajuda={(() => {
                const inicio = parseInt(numeroInicialLote, 10)
                const quantidade = parseInt(quantidadeLote, 10)
                if (!Number.isFinite(inicio) || !Number.isFinite(quantidade) || quantidade < 1) return 'De 1 a 200.'
                const titulo = obterTituloPonto(modalCriarLote.tipo)
                return quantidade === 1 ? `Cria ${titulo} ${inicio}.` : `Cria de ${titulo} ${inicio} até ${inicio + quantidade - 1}.`
              })()}
            >
              <div>
                <Contador
                  valor={Number(quantidadeLote) || 1}
                  aoMudar={(valor) => setQuantidadeLote(String(valor))}
                  minimo={1}
                  maximo={200}
                  rotuloAcessivel="quantidade"
                />
              </div>
            </Campo>
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </Gaveta>

        <Gaveta
          aberto={modalEditarPonto.aberto && Boolean(modalEditarPonto.ponto)}
          aoFechar={fecharEdicao}
          bloqueada={salvandoEdicao}
          titulo={modalEditarPonto.ponto ? `Editar ${nomeDoPonto(modalEditarPonto.ponto)}` : 'Editar'}
          rodape={
            <>
              <Botao
                variante="perigoSuave"
                className="md:mr-auto"
                disabled={salvandoEdicao}
                onClick={async () => {
                  if (modalEditarPonto.ponto && (await excluirPonto(modalEditarPonto.ponto))) fecharEdicao()
                }}
              >
                Excluir
              </Botao>
              <Botao onClick={salvarEdicaoPonto} carregando={salvandoEdicao}>
                Salvar
              </Botao>
            </>
          }
        >
          {modalEditarPonto.ponto && (
            <form
              className="space-y-4"
              onSubmit={(evento) => {
                evento.preventDefault()
                void salvarEdicaoPonto()
              }}
            >
              <Campo rotulo="Número" htmlFor="ponto-numero">
                <Entrada
                  id="ponto-numero"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={modalEditarPonto.numero}
                  onChange={(evento) =>
                    setModalEditarPonto((estadoAnterior) => ({ ...estadoAnterior, numero: evento.target.value }))
                  }
                />
              </Campo>
              <Campo rotulo="Nome exibido" htmlFor="ponto-identificador" ajuda="Aparece no QR impresso e nas listas.">
                <Entrada
                  id="ponto-identificador"
                  value={modalEditarPonto.identificador}
                  onChange={(evento) =>
                    setModalEditarPonto((estadoAnterior) => ({ ...estadoAnterior, identificador: evento.target.value }))
                  }
                  autoComplete="off"
                />
              </Campo>
              <div className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
                <div className="shrink-0 rounded-md bg-white p-1">
                  <QRCodeCanvas value={montarUrlQrPonto(modalEditarPonto.ponto)} size={88} marginSize={1} fgColor="#0f172a" bgColor="#ffffff" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">QR Code</p>
                  <p className="text-[13px] text-muted-foreground">Baixe para imprimir ou mandar para a gráfica.</p>
                  <Botao
                    variante="contorno"
                    tamanho="sm"
                    className="mt-2 h-11 md:h-9"
                    onClick={() => modalEditarPonto.ponto && exportarQrPng(modalEditarPonto.ponto)}
                  >
                    <DownloadSimple className="size-4" />
                    Baixar PNG
                  </Botao>
                </div>
              </div>
              <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>
          )}
        </Gaveta>
      </AdminLayout>
    </ProtectedRoute>
  )
}
