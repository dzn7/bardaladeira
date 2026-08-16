'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BadgePercent,
  CheckCircle2,
  Gift,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, Combo, Produto } from '@/lib/supabase'
import { Cupom, normalizarCodigoCupom, TipoAplicacaoCupom, TipoDescontoCupom } from '@/lib/cupons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type CupomComMetricas = Cupom & {
  totalDescontoAplicado: number
  totalFreteConcedido: number
  quantidadeUsosConfirmados: number
}

type EstadoFormularioCupom = {
  codigo: string
  nome: string
  descricao: string
  tipoDesconto: TipoDescontoCupom
  valorDesconto: string
  pedidoMinimo: string
  limiteDesconto: string
  aplicaEm: TipoAplicacaoCupom
  produtoId: string
  comboId: string
  usoUnico: boolean
  usoMaximoTotal: string
  usoMaximoPorCliente: string
  validadeInicio: string
  validadeFim: string
  ativo: boolean
}

const ESTADO_INICIAL_FORMULARIO: EstadoFormularioCupom = {
  codigo: '',
  nome: '',
  descricao: '',
  tipoDesconto: 'percentual',
  valorDesconto: '',
  pedidoMinimo: '0',
  limiteDesconto: '',
  aplicaEm: 'pedido',
  produtoId: '',
  comboId: '',
  usoUnico: false,
  usoMaximoTotal: '',
  usoMaximoPorCliente: '',
  validadeInicio: '',
  validadeFim: '',
  ativo: true,
}

type UsoCupom = {
  cupom_id: string
  valor_desconto: number
  valor_frete_descontado: number
}

const formatarMoeda = (valor: number): string =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatarData = (valor: string | null): string => {
  if (!valor) return 'Sem data'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Data inválida'
  return data.toLocaleString('pt-BR')
}

const converterIsoParaInput = (valor: string | null): string => {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  const ano = data.getFullYear()
  const mes = `${data.getMonth() + 1}`.padStart(2, '0')
  const dia = `${data.getDate()}`.padStart(2, '0')
  const hora = `${data.getHours()}`.padStart(2, '0')
  const minuto = `${data.getMinutes()}`.padStart(2, '0')
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`
}

const converterInputParaIso = (valor: string): string | null => {
  if (!valor) return null
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return null
  return data.toISOString()
}

const paraNumero = (valor: string): number => {
  if (!valor) return 0
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const CLASSE_CAMPO = 'min-w-0 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white'

export default function GerenciadorCupons() {
  const [cupons, setCupons] = useState<CupomComMetricas[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [modalFormularioAberto, setModalFormularioAberto] = useState(false)
  const [idCupomEditando, setIdCupomEditando] = useState<string | null>(null)
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [filtroAplicacao, setFiltroAplicacao] = useState<'todos' | TipoAplicacaoCupom>('todos')
  const [formulario, setFormulario] = useState<EstadoFormularioCupom>(ESTADO_INICIAL_FORMULARIO)
  const [cupomParaExcluir, setCupomParaExcluir] = useState<CupomComMetricas | null>(null)

  useEffect(() => {
    void carregarDados()

    const canal = supabase
      .channel('admin-cupons-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cupons' }, () => {
        void carregarDados()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cupons_usos' }, () => {
        void carregarDados()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  const carregarDados = async () => {
    setCarregando(true)
    try {
      const [respostaCupons, respostaUsos, respostaProdutos, respostaCombos] = await Promise.all([
        supabase.from('cupons').select('*').order('created_at', { ascending: false }),
        supabase.from('cupons_usos').select('cupom_id, valor_desconto, valor_frete_descontado'),
        supabase
          .from('produtos')
          .select('id, nome, descricao, preco, categoria, imagem_url, disponivel, ordem, destaque, created_at, updated_at')
          .eq('disponivel', true)
          .order('nome'),
        supabase.from('combos').select('*').eq('disponivel', true).order('nome'),
      ])

      if (respostaCupons.error) throw respostaCupons.error
      if (respostaUsos.error) throw respostaUsos.error
      if (respostaProdutos.error) throw respostaProdutos.error
      if (respostaCombos.error) throw respostaCombos.error

      const usos = (respostaUsos.data || []).map((uso: any) => ({
        cupom_id: uso.cupom_id,
        valor_desconto: Number(uso.valor_desconto || 0),
        valor_frete_descontado: Number(uso.valor_frete_descontado || 0),
      })) as UsoCupom[]

      const metricasPorCupom = usos.reduce<Record<string, { usos: number; desconto: number; frete: number }>>((acumulado, uso) => {
        const atual = acumulado[uso.cupom_id] || { usos: 0, desconto: 0, frete: 0 }
        atual.usos += 1
        atual.desconto += uso.valor_desconto
        atual.frete += uso.valor_frete_descontado
        acumulado[uso.cupom_id] = atual
        return acumulado
      }, {})

      const cuponsComMetricas = (respostaCupons.data || []).map((registro: any) => {
        const metrica = metricasPorCupom[registro.id] || { usos: 0, desconto: 0, frete: 0 }
        return {
          ...registro,
          valor_desconto: Number(registro.valor_desconto || 0),
          pedido_minimo: Number(registro.pedido_minimo || 0),
          limite_desconto: registro.limite_desconto === null ? null : Number(registro.limite_desconto),
          uso_maximo_total: registro.uso_maximo_total === null ? null : Number(registro.uso_maximo_total),
          uso_maximo_por_cliente: registro.uso_maximo_por_cliente === null ? null : Number(registro.uso_maximo_por_cliente),
          total_usos: Number(registro.total_usos || 0),
          totalDescontoAplicado: metrica.desconto,
          totalFreteConcedido: metrica.frete,
          quantidadeUsosConfirmados: metrica.usos,
        } as CupomComMetricas
      })

      setCupons(cuponsComMetricas)
      setProdutos(respostaProdutos.data || [])
      setCombos(respostaCombos.data || [])
    } catch (erro) {
      console.error('[Cupons] Falha ao carregar dados:', erro)
      toast.error('Não foi possível carregar os dados de cupons.')
    } finally {
      setCarregando(false)
    }
  }

  const limparFormulario = () => {
    setFormulario(ESTADO_INICIAL_FORMULARIO)
    setIdCupomEditando(null)
  }

  const abrirModalNovo = () => {
    limparFormulario()
    setModalFormularioAberto(true)
  }

  const fecharModalFormulario = () => {
    if (salvando) return
    setModalFormularioAberto(false)
    limparFormulario()
  }

  const validarFormulario = (): string | null => {
    if (!formulario.codigo.trim()) return 'Informe o código do cupom.'
    if (!formulario.nome.trim()) return 'Informe o nome do cupom.'

    if (formulario.tipoDesconto !== 'frete_gratis' && paraNumero(formulario.valorDesconto) <= 0) {
      return 'Informe um valor de desconto maior que zero.'
    }

    if (formulario.aplicaEm === 'produto' && !formulario.produtoId) {
      return 'Selecione o produto para este cupom.'
    }

    if (formulario.aplicaEm === 'combo' && !formulario.comboId) {
      return 'Selecione o combo para este cupom.'
    }

    if (formulario.validadeInicio && formulario.validadeFim) {
      const inicio = new Date(formulario.validadeInicio).getTime()
      const fim = new Date(formulario.validadeFim).getTime()
      if (fim < inicio) {
        return 'A validade final não pode ser menor que a validade inicial.'
      }
    }

    return null
  }

  const montarPayload = () => {
    const codigoNormalizado = normalizarCodigoCupom(formulario.codigo)
    const tipoDesconto = formulario.tipoDesconto
    const valorDesconto = tipoDesconto === 'frete_gratis' ? 0 : paraNumero(formulario.valorDesconto)
    const usoMaximoTotal = formulario.usoUnico
      ? 1
      : (formulario.usoMaximoTotal ? Number(formulario.usoMaximoTotal) : null)

    return {
      codigo: codigoNormalizado,
      nome: formulario.nome.trim(),
      descricao: formulario.descricao.trim() || null,
      ativo: formulario.ativo,
      tipo_desconto: tipoDesconto,
      valor_desconto: valorDesconto,
      pedido_minimo: paraNumero(formulario.pedidoMinimo),
      limite_desconto: formulario.limiteDesconto ? Number(formulario.limiteDesconto) : null,
      uso_unico: formulario.usoUnico,
      uso_maximo_total: usoMaximoTotal,
      uso_maximo_por_cliente: formulario.usoMaximoPorCliente ? Number(formulario.usoMaximoPorCliente) : null,
      aplica_em: formulario.aplicaEm,
      produto_id: formulario.aplicaEm === 'produto' ? formulario.produtoId : null,
      combo_id: formulario.aplicaEm === 'combo' ? formulario.comboId : null,
      validade_inicio: converterInputParaIso(formulario.validadeInicio),
      validade_fim: converterInputParaIso(formulario.validadeFim),
    }
  }

  const salvarCupom = async () => {
    const erroValidacao = validarFormulario()
    if (erroValidacao) {
      toast.warning(erroValidacao)
      return
    }

    setSalvando(true)
    try {
      const payload = montarPayload()

      if (idCupomEditando) {
        const { error } = await supabase
          .from('cupons')
          .update(payload)
          .eq('id', idCupomEditando)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('cupons')
          .insert(payload)

        if (error) throw error
      }

      setModalFormularioAberto(false)
      limparFormulario()
      await carregarDados()
    } catch (erro: any) {
      console.error('[Cupons] Erro ao salvar cupom:', erro)
      if (erro?.message?.includes('idx_cupons_codigo_unico')) {
        toast.error('Já existe um cupom com este código.')
      } else {
        toast.error('Não foi possível salvar o cupom.')
      }
    } finally {
      setSalvando(false)
    }
  }

  const iniciarEdicao = (cupom: CupomComMetricas) => {
    setIdCupomEditando(cupom.id)
    setFormulario({
      codigo: cupom.codigo,
      nome: cupom.nome,
      descricao: cupom.descricao || '',
      tipoDesconto: cupom.tipo_desconto,
      valorDesconto: cupom.tipo_desconto === 'frete_gratis' ? '' : String(cupom.valor_desconto),
      pedidoMinimo: String(cupom.pedido_minimo || 0),
      limiteDesconto: cupom.limite_desconto !== null ? String(cupom.limite_desconto) : '',
      aplicaEm: cupom.aplica_em,
      produtoId: cupom.produto_id || '',
      comboId: cupom.combo_id || '',
      usoUnico: cupom.uso_unico,
      usoMaximoTotal: cupom.uso_maximo_total !== null ? String(cupom.uso_maximo_total) : '',
      usoMaximoPorCliente: cupom.uso_maximo_por_cliente !== null ? String(cupom.uso_maximo_por_cliente) : '',
      validadeInicio: converterIsoParaInput(cupom.validade_inicio),
      validadeFim: converterIsoParaInput(cupom.validade_fim),
      ativo: cupom.ativo,
    })
    setModalFormularioAberto(true)
  }

  const alternarStatusCupom = async (cupom: CupomComMetricas) => {
    try {
      const { error } = await supabase
        .from('cupons')
        .update({ ativo: !cupom.ativo })
        .eq('id', cupom.id)
      if (error) throw error
    } catch (erro) {
      console.error('[Cupons] Erro ao alterar status:', erro)
      toast.error('Não foi possível alterar o status do cupom.')
    }
  }

  const excluirCupomConfirmado = async (cupom: CupomComMetricas) => {
    try {
      const { error } = await supabase.from('cupons').delete().eq('id', cupom.id)
      if (error) throw error
      toast.success(`Cupom ${cupom.codigo} excluído`)
      if (idCupomEditando === cupom.id) limparFormulario()
    } catch (erro) {
      console.error('[Cupons] Erro ao excluir cupom:', erro)
      toast.error('Não foi possível excluir o cupom.')
    } finally {
      setCupomParaExcluir(null)
    }
  }

  const cuponsFiltrados = useMemo(() => {
    return cupons.filter((cupom) => {
      const textoBusca = filtroBusca.trim().toLowerCase()
      const bateBusca = !textoBusca
        || cupom.codigo.toLowerCase().includes(textoBusca)
        || cupom.nome.toLowerCase().includes(textoBusca)
        || (cupom.descricao || '').toLowerCase().includes(textoBusca)

      const bateStatus = filtroStatus === 'todos'
        || (filtroStatus === 'ativos' && cupom.ativo)
        || (filtroStatus === 'inativos' && !cupom.ativo)

      const bateAplicacao = filtroAplicacao === 'todos' || cupom.aplica_em === filtroAplicacao
      return bateBusca && bateStatus && bateAplicacao
    })
  }, [cupons, filtroBusca, filtroStatus, filtroAplicacao])

  const quantidadeAtivos = cupons.filter((cupom) => cupom.ativo).length
  const quantidadeInativos = cupons.length - quantidadeAtivos
  const totalDescontosConcedidos = cupons.reduce((acc, cupom) => acc + cupom.totalDescontoAplicado + cupom.totalFreteConcedido, 0)

  const previsaoDesconto = useMemo(() => {
    const subtotalExemplo = 60
    const freteExemplo = 6
    let desconto = 0
    let descontoFrete = 0

    if (formulario.tipoDesconto === 'frete_gratis') {
      descontoFrete = freteExemplo
    } else if (formulario.tipoDesconto === 'percentual') {
      desconto = (subtotalExemplo * paraNumero(formulario.valorDesconto)) / 100
    } else {
      desconto = paraNumero(formulario.valorDesconto)
    }

    const limite = paraNumero(formulario.limiteDesconto)
    if (limite > 0) desconto = Math.min(desconto, limite)
    desconto = Math.min(desconto, subtotalExemplo)

    const total = Math.max(0, subtotalExemplo + freteExemplo - desconto - descontoFrete)

    return {
      subtotalExemplo,
      freteExemplo,
      desconto,
      descontoFrete,
      total,
    }
  }, [formulario.tipoDesconto, formulario.valorDesconto, formulario.limiteDesconto])

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid flex-1 gap-4 md:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cupons ativos</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{quantidadeAtivos}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cupons inativos</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">{quantidadeInativos}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Desconto concedido</p>
            <p className="mt-2 truncate text-2xl font-semibold text-zinc-900 dark:text-white">{formatarMoeda(totalDescontosConcedidos)}</p>
          </div>
        </div>

        <Button
          onClick={abrirModalNovo}
          className="h-11 gap-2 rounded-lg px-4"
        >
          <Plus className="h-4 w-4" />
          Criar cupom
        </Button>
      </div>

      <section className="min-w-0 space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Cupons cadastrados</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Lista em tempo real com métricas de uso e regras.</p>
          </div>
          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 lg:w-auto">
            <label className="relative min-w-0">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                value={filtroBusca}
                onChange={(evento) => setFiltroBusca(evento.target.value)}
                placeholder="Buscar cupom..."
                className="h-10 rounded-lg pl-8"
              />
            </label>
            <select
              value={filtroStatus}
              onChange={(evento) => setFiltroStatus(evento.target.value as 'todos' | 'ativos' | 'inativos')}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="todos">Todos os status</option>
              <option value="ativos">Somente ativos</option>
              <option value="inativos">Somente inativos</option>
            </select>
            <select
              value={filtroAplicacao}
              onChange={(evento) => setFiltroAplicacao(evento.target.value as 'todos' | TipoAplicacaoCupom)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="todos">Todas aplicações</option>
              <option value="pedido">Pedido</option>
              <option value="produto">Produto</option>
              <option value="combo">Combo</option>
            </select>
          </div>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : cuponsFiltrados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <Gift className="mx-auto h-10 w-10 text-zinc-400" />
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhum cupom encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cuponsFiltrados.map((cupom) => (
              <article key={cupom.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold text-white dark:bg-zinc-200 dark:text-zinc-900">
                        <BadgePercent className="h-3.5 w-3.5" />
                        {cupom.codigo}
                      </span>
                      {cupom.ativo ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                          <XCircle className="h-3.5 w-3.5" />
                          Inativo
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {cupom.tipo_desconto === 'frete_gratis' ? (
                          <Truck className="h-3.5 w-3.5" />
                        ) : cupom.tipo_desconto === 'percentual' ? (
                          <Gift className="h-3.5 w-3.5" />
                        ) : (
                          <Layers className="h-3.5 w-3.5" />
                        )}
                        {cupom.tipo_desconto === 'percentual' ? `${cupom.valor_desconto}%` : cupom.tipo_desconto === 'valor_fixo' ? formatarMoeda(cupom.valor_desconto) : 'Frete grátis'}
                      </span>
                    </div>
                    <h3 className="break-words text-base font-semibold text-zinc-900 dark:text-white">{cupom.nome}</h3>
                    {cupom.descricao && (
                      <p className="break-words text-sm text-zinc-600 dark:text-zinc-300">{cupom.descricao}</p>
                    )}
                    <div className="grid gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2 xl:grid-cols-3">
                      <p>Aplicação: <strong className="text-zinc-700 dark:text-zinc-200">{cupom.aplica_em}</strong></p>
                      <p>Pedido mínimo: <strong className="text-zinc-700 dark:text-zinc-200">{formatarMoeda(cupom.pedido_minimo)}</strong></p>
                      <p>Usos: <strong className="text-zinc-700 dark:text-zinc-200">{cupom.quantidadeUsosConfirmados}</strong>{cupom.uso_maximo_total ? `/${cupom.uso_maximo_total}` : ''}</p>
                      <p>Desconto concedido: <strong className="text-zinc-700 dark:text-zinc-200">{formatarMoeda(cupom.totalDescontoAplicado + cupom.totalFreteConcedido)}</strong></p>
                      <p>Validade início: <strong className="text-zinc-700 dark:text-zinc-200">{formatarData(cupom.validade_inicio)}</strong></p>
                      <p>Validade fim: <strong className="text-zinc-700 dark:text-zinc-200">{formatarData(cupom.validade_fim)}</strong></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:w-[230px]">
                    <button
                      onClick={() => iniciarEdicao(cupom)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => alternarStatusCupom(cupom)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      {cupom.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => setCupomParaExcluir(cupom)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-300 px-2 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <p className="font-medium text-zinc-800 dark:text-zinc-100">Como configurar os principais tipos de cupom</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Cupom de um pedido:</strong> marque <em>Uso único global</em> para permitir somente 1 uso total.</li>
          <li><strong>Cupom de frete grátis:</strong> selecione <em>Frete grátis</em>; só funciona para entrega.</li>
          <li><strong>Cupom limitado:</strong> defina limite total e/ou limite por cliente.</li>
          <li><strong>Cupom só para combo:</strong> escolha aplicação em <em>Combo</em> e selecione o combo alvo.</li>
          <li><strong>Cupom só para produto:</strong> escolha aplicação em <em>Produto</em> e selecione o produto alvo.</li>
        </ul>
      </div>

      {modalFormularioAberto && (
        <div className="fixed inset-0 z-[1000]">
          <button
            aria-label="Fechar modal de cupom"
            onClick={fecharModalFormulario}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative flex min-h-full items-end justify-center p-3 sm:items-center sm:p-4">
            <div className="relative z-[1001] flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-6 sm:py-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white sm:text-lg">
                    {idCupomEditando ? 'Editar cupom' : 'Criar cupom'}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
                    Configure regras de desconto com validações, limite e validade.
                  </p>
                </div>
                <button
                  onClick={fecharModalFormulario}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="min-w-0">
                        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Código</span>
                        <Input
                          value={formulario.codigo}
                          onChange={(evento) => setFormulario((anterior) => ({ ...anterior, codigo: normalizarCodigoCupom(evento.target.value) }))}
                          placeholder="EX: PRIMEIRA10"
                          className={CLASSE_CAMPO}
                        />
                      </label>

                      <label className="min-w-0">
                        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Nome interno</span>
                        <Input
                          value={formulario.nome}
                          onChange={(evento) => setFormulario((anterior) => ({ ...anterior, nome: evento.target.value }))}
                          placeholder="Campanha de boas-vindas"
                          className={CLASSE_CAMPO}
                        />
                      </label>

                      <label className="min-w-0 sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Descrição</span>
                        <textarea
                          value={formulario.descricao}
                          onChange={(evento) => setFormulario((anterior) => ({ ...anterior, descricao: evento.target.value }))}
                          rows={2}
                          placeholder="Anotação interna sobre objetivo do cupom."
                          className={CLASSE_CAMPO}
                        />
                      </label>
                    </div>

                    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Regras de desconto</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Tipo de desconto</span>
                          <select
                            value={formulario.tipoDesconto}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, tipoDesconto: evento.target.value as TipoDescontoCupom }))}
                            className={CLASSE_CAMPO}
                          >
                            <option value="percentual">Percentual (%)</option>
                            <option value="valor_fixo">Valor fixo (R$)</option>
                            <option value="frete_gratis">Frete grátis</option>
                          </select>
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Valor do desconto</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={formulario.tipoDesconto === 'frete_gratis'}
                            value={formulario.valorDesconto}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, valorDesconto: evento.target.value }))}
                            placeholder={formulario.tipoDesconto === 'percentual' ? 'Ex: 10' : 'Ex: 12.50'}
                            className={`${CLASSE_CAMPO} disabled:cursor-not-allowed disabled:bg-zinc-100 dark:disabled:bg-zinc-700`}
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Pedido mínimo (R$)</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formulario.pedidoMinimo}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, pedidoMinimo: evento.target.value }))}
                            className={CLASSE_CAMPO}
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Limite de desconto (R$)</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formulario.limiteDesconto}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, limiteDesconto: evento.target.value }))}
                            placeholder="Opcional"
                            className={CLASSE_CAMPO}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Escopo do cupom</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Aplicar em</span>
                          <select
                            value={formulario.aplicaEm}
                            onChange={(evento) => setFormulario((anterior) => ({
                              ...anterior,
                              aplicaEm: evento.target.value as TipoAplicacaoCupom,
                              produtoId: evento.target.value === 'produto' ? anterior.produtoId : '',
                              comboId: evento.target.value === 'combo' ? anterior.comboId : '',
                            }))}
                            className={CLASSE_CAMPO}
                          >
                            <option value="pedido">Pedido inteiro</option>
                            <option value="produto">Produto específico</option>
                            <option value="combo">Combo específico</option>
                          </select>
                        </label>

                        <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                          <Input
                            type="checkbox"
                            checked={formulario.ativo}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, ativo: evento.target.checked }))}
                            className="h-4 w-4 rounded border-zinc-300 text-bordo-600"
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">Cupom ativo</span>
                        </label>

                        {formulario.aplicaEm === 'produto' && (
                          <label className="min-w-0 sm:col-span-2">
                            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Produto alvo</span>
                            <select
                              value={formulario.produtoId}
                              onChange={(evento) => setFormulario((anterior) => ({ ...anterior, produtoId: evento.target.value }))}
                              className={CLASSE_CAMPO}
                            >
                              <option value="">Selecione um produto</option>
                              {produtos.map((produto) => (
                                <option key={produto.id} value={produto.id}>{produto.nome}</option>
                              ))}
                            </select>
                          </label>
                        )}

                        {formulario.aplicaEm === 'combo' && (
                          <label className="min-w-0 sm:col-span-2">
                            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Combo alvo</span>
                            <select
                              value={formulario.comboId}
                              onChange={(evento) => setFormulario((anterior) => ({ ...anterior, comboId: evento.target.value }))}
                              className={CLASSE_CAMPO}
                            >
                              <option value="">Selecione um combo</option>
                              {combos.map((combo) => (
                                <option key={combo.id} value={combo.id}>{combo.nome}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Limites e validade</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 sm:col-span-2">
                          <Input
                            type="checkbox"
                            checked={formulario.usoUnico}
                            onChange={(evento) => setFormulario((anterior) => ({
                              ...anterior,
                              usoUnico: evento.target.checked,
                              usoMaximoTotal: evento.target.checked ? '1' : anterior.usoMaximoTotal,
                            }))}
                            className="h-4 w-4 rounded border-zinc-300 text-bordo-600"
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">Uso único global</span>
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Limite total de usos</span>
                          <Input
                            type="number"
                            min="1"
                            disabled={formulario.usoUnico}
                            value={formulario.usoMaximoTotal}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, usoMaximoTotal: evento.target.value }))}
                            placeholder="Opcional"
                            className={`${CLASSE_CAMPO} disabled:cursor-not-allowed disabled:bg-zinc-100 dark:disabled:bg-zinc-700`}
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Limite por cliente</span>
                          <Input
                            type="number"
                            min="1"
                            value={formulario.usoMaximoPorCliente}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, usoMaximoPorCliente: evento.target.value }))}
                            placeholder="Opcional"
                            className={CLASSE_CAMPO}
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Validade início</span>
                          <Input
                            type="datetime-local"
                            value={formulario.validadeInicio}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, validadeInicio: evento.target.value }))}
                            className={`${CLASSE_CAMPO} min-w-0 max-w-full text-[13px] sm:text-sm`}
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Validade fim</span>
                          <Input
                            type="datetime-local"
                            value={formulario.validadeFim}
                            onChange={(evento) => setFormulario((anterior) => ({ ...anterior, validadeFim: evento.target.value }))}
                            className={`${CLASSE_CAMPO} min-w-0 max-w-full text-[13px] sm:text-sm`}
                          />
                        </label>
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/60">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">Prévia rápida (pedido de exemplo)</p>
                      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                        Subtotal {formatarMoeda(previsaoDesconto.subtotalExemplo)} + frete {formatarMoeda(previsaoDesconto.freteExemplo)}.
                      </p>
                      <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                        Desconto estimado: {formatarMoeda(previsaoDesconto.desconto + previsaoDesconto.descontoFrete)}
                      </p>
                      <p className="mt-1 font-semibold text-zinc-900 dark:text-white">
                        Total final estimado: {formatarMoeda(previsaoDesconto.total)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">Boas práticas</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Use códigos simples e fáceis de lembrar.</li>
                        <li>Defina validade para evitar cupons antigos ativos.</li>
                        <li>Quando for promoção agressiva, limite uso por cliente.</li>
                      </ul>
                    </div>
                  </aside>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:justify-end sm:gap-3 sm:p-5">
                <Button
                  variant="outline"
                  onClick={fecharModalFormulario}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={salvarCupom}
                  disabled={salvando}
                  className="w-full gap-2 sm:w-auto"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : idCupomEditando ? (
                    <>
                      <Save className="h-4 w-4" />
                      Atualizar cupom
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Criar cupom
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!cupomParaExcluir} onOpenChange={(open) => !open && setCupomParaExcluir(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir cupom</DialogTitle>
            <DialogDescription>
              Deseja realmente excluir o cupom <span className="font-mono font-semibold">{cupomParaExcluir?.codigo}</span>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setCupomParaExcluir(null)}
              className="inline-flex h-9 items-center px-4 rounded-md border border-border/70 bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => cupomParaExcluir && excluirCupomConfirmado(cupomParaExcluir)}
              className="inline-flex h-9 items-center px-4 rounded-md bg-destructive text-sm font-medium text-white hover:bg-destructive/90 transition-colors"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
