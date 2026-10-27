'use client'

import { useEffect, useMemo, useState } from 'react'
import { MagnifyingGlass, Plus, SealPercent } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { supabase, Combo, Produto } from '@/lib/supabase'
import { Cupom, normalizarCodigoCupom, TipoAplicacaoCupom, TipoDescontoCupom } from '@/lib/cupons'
import {
  AreaTexto,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Chip,
  Entrada,
  EntradaPreco,
  Gaveta,
  Interruptor,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Segmentos,
  Selecao,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'

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
  return data.toLocaleDateString('pt-BR')
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


// Vírgula vira ponto para o Number() de paraNumero/montarPayload continuar igual.
const decimal = (valor: string) => valor.replace(',', '.')

const descreverDesconto = (cupom: Cupom) =>
  cupom.tipo_desconto === 'percentual'
    ? `${cupom.valor_desconto}% off`
    : cupom.tipo_desconto === 'valor_fixo'
      ? `${formatarMoeda(cupom.valor_desconto)} off`
      : 'Frete grátis'

type ErrosFormulario = Partial<Record<'codigo' | 'nome' | 'valorDesconto' | 'produtoId' | 'comboId' | 'validadeFim', string>>

const OPCOES_TIPO: { valor: TipoDescontoCupom; rotulo: string }[] = [
  { valor: 'percentual', rotulo: 'Porcentagem' },
  { valor: 'valor_fixo', rotulo: 'Valor em R$' },
  { valor: 'frete_gratis', rotulo: 'Frete grátis' },
]

const OPCOES_APLICACAO: { valor: TipoAplicacaoCupom; rotulo: string }[] = [
  { valor: 'pedido', rotulo: 'Pedido inteiro' },
  { valor: 'produto', rotulo: 'Um produto' },
  { valor: 'combo', rotulo: 'Um combo' },
]

export default function GerenciadorCupons() {
  const confirmar = useConfirmar()
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
  const [erros, setErros] = useState<ErrosFormulario>({})

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
    setErros({})
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

  const validarFormulario = (): ErrosFormulario => {
    const proximos: ErrosFormulario = {}
    if (!formulario.codigo.trim()) proximos.codigo = 'Informe o código do cupom.'
    if (!formulario.nome.trim()) proximos.nome = 'Informe o nome do cupom.'

    if (formulario.tipoDesconto !== 'frete_gratis' && paraNumero(formulario.valorDesconto) <= 0) {
      proximos.valorDesconto = 'Informe um desconto maior que zero.'
    }

    if (formulario.aplicaEm === 'produto' && !formulario.produtoId) {
      proximos.produtoId = 'Escolha o produto.'
    }

    if (formulario.aplicaEm === 'combo' && !formulario.comboId) {
      proximos.comboId = 'Escolha o combo.'
    }

    if (formulario.validadeInicio && formulario.validadeFim) {
      const inicio = new Date(formulario.validadeInicio).getTime()
      const fim = new Date(formulario.validadeFim).getTime()
      if (fim < inicio) {
        proximos.validadeFim = 'O fim não pode ser antes do início.'
      }
    }

    return proximos
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
    const proximosErros = validarFormulario()
    setErros(proximosErros)
    if (Object.keys(proximosErros).length > 0) return

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

      toast.success(idCupomEditando ? 'Cupom salvo' : 'Cupom criado', { description: payload.codigo })
      setModalFormularioAberto(false)
      limparFormulario()
      await carregarDados()
    } catch (erro: any) {
      console.error('[Cupons] Erro ao salvar cupom:', erro)
      if (erro?.message?.includes('idx_cupons_codigo_unico')) {
        setErros({ codigo: 'Já existe um cupom com este código.' })
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
    setErros({})
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
    const marcar = (ativo: boolean) =>
      setCupons((atual) => atual.map((item) => (item.id === cupom.id ? { ...item, ativo } : item)))
    marcar(!cupom.ativo)
    try {
      const { error } = await supabase
        .from('cupons')
        .update({ ativo: !cupom.ativo })
        .eq('id', cupom.id)
      if (error) throw error
      toast.success(cupom.ativo ? 'Cupom pausado' : 'Cupom ativado', { description: cupom.codigo })
    } catch (erro) {
      console.error('[Cupons] Erro ao alterar status:', erro)
      marcar(cupom.ativo)
      toast.error('Não foi possível alterar o status do cupom.')
    }
  }

  const excluirCupomConfirmado = async (cupom: CupomComMetricas) => {
    setSalvando(true)
    try {
      const { error } = await supabase.from('cupons').delete().eq('id', cupom.id)
      if (error) throw error
      toast.success(`Cupom ${cupom.codigo} excluído`)
      setModalFormularioAberto(false)
      limparFormulario()
    } catch (erro) {
      console.error('[Cupons] Erro ao excluir cupom:', erro)
      toast.error('Não foi possível excluir o cupom.', { description: 'Pause o cupom para ele parar de valer.' })
    } finally {
      setSalvando(false)
    }
  }

  const pedirExclusao = async () => {
    const cupom = cupons.find((item) => item.id === idCupomEditando)
    if (!cupom) return
    const ok = await confirmar({
      titulo: `Excluir o cupom ${cupom.codigo}?`,
      descricao: 'O código para de funcionar no checkout. Não dá para desfazer.',
      confirmar: 'Excluir cupom',
      perigo: true,
    })
    if (ok) await excluirCupomConfirmado(cupom)
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

  const mudar = <K extends keyof EstadoFormularioCupom>(campo: K, valor: EstadoFormularioCupom[K]) =>
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }))

  const alvoDoCupom = (cupom: Cupom) => {
    if (cupom.aplica_em === 'produto') return produtos.find((p) => p.id === cupom.produto_id)?.nome ?? 'Um produto'
    if (cupom.aplica_em === 'combo') return combos.find((c) => c.id === cupom.combo_id)?.nome ?? 'Um combo'
    return null
  }

  const filtrosAtivos = filtroBusca.trim() !== '' || filtroStatus !== 'todos' || filtroAplicacao !== 'todos'
  const editando = idCupomEditando !== null

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Cupons"
        descricao={`${quantidadeAtivos} ativos · ${quantidadeInativos} pausados · ${formatarMoeda(totalDescontosConcedidos)} em descontos`}
        acoes={
          <Botao onClick={abrirModalNovo}>
            <Plus className="size-4" />
            Criar cupom
          </Botao>
        }
      />

      {cupons.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Entrada
              type="search"
              value={filtroBusca}
              onChange={(evento) => setFiltroBusca(evento.target.value)}
              placeholder="Buscar por código ou nome"
              aria-label="Buscar cupom"
              className="pl-9"
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:flex-wrap md:px-0">
            {([
              ['todos', 'Todos'],
              ['ativos', 'Ativos'],
              ['inativos', 'Pausados'],
            ] as const).map(([valor, rotulo]) => (
              <Chip key={valor} ativo={filtroStatus === valor} onClick={() => setFiltroStatus(valor)}>
                {rotulo}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-border/70" aria-hidden />
            {([['todos', 'Qualquer alvo'], ...OPCOES_APLICACAO.map((o) => [o.valor, o.rotulo])] as [
              'todos' | TipoAplicacaoCupom,
              string,
            ][]).map(([valor, rotulo]) => (
              <Chip key={valor} ativo={filtroAplicacao === valor} onClick={() => setFiltroAplicacao(valor)}>
                {rotulo}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {carregando && cupons.length === 0 ? (
        <ListaCarregando linhas={4} />
      ) : cupons.length === 0 ? (
        <ListaVazia
          icone={<SealPercent />}
          titulo="Nenhum cupom ainda"
          descricao="Crie um código de desconto para divulgar aos clientes."
          acao={
            <Botao onClick={abrirModalNovo}>
              <Plus className="size-4" />
              Criar cupom
            </Botao>
          }
        />
      ) : cuponsFiltrados.length === 0 ? (
        <ListaVazia
          icone={<MagnifyingGlass />}
          titulo="Nenhum cupom encontrado"
          descricao="Tente outra busca ou filtro."
          acao={
            filtrosAtivos ? (
              <Botao
                variante="contorno"
                onClick={() => {
                  setFiltroBusca('')
                  setFiltroStatus('todos')
                  setFiltroAplicacao('todos')
                }}
              >
                Limpar filtros
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <Lista>
          {cuponsFiltrados.map((cupom) => {
            const alvo = alvoDoCupom(cupom)
            const concedido = cupom.totalDescontoAplicado + cupom.totalFreteConcedido
            return (
              <li key={cupom.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => iniciarEdicao(cupom)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') iniciarEdicao(cupom)
                  }}
                  className={cn(
                    'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    !cupom.ativo && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <p className="shrink-0 font-mono text-sm font-semibold text-foreground">{cupom.codigo}</p>
                      <p className="truncate text-sm text-muted-foreground">{cupom.nome}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Selo tom="primario">{descreverDesconto(cupom)}</Selo>
                      {alvo && <Selo>Só em {alvo}</Selo>}
                      {!cupom.ativo && <Selo>Pausado</Selo>}
                      <span className="text-[13px] tabular-nums text-muted-foreground">
                        {cupom.quantidadeUsosConfirmados}
                        {cupom.uso_maximo_total ? `/${cupom.uso_maximo_total}` : ''}{' '}
                        {cupom.quantidadeUsosConfirmados === 1 ? 'uso' : 'usos'}
                        {concedido > 0 ? ` · ${formatarMoeda(concedido)}` : ''}
                        {cupom.validade_fim ? ` · até ${formatarData(cupom.validade_fim)}` : ''}
                      </span>
                    </div>
                  </div>
                  <Interruptor
                    marcado={cupom.ativo}
                    aoMudar={() => void alternarStatusCupom(cupom)}
                    rotuloAcessivel={`${cupom.ativo ? 'Pausar' : 'Ativar'} cupom ${cupom.codigo}`}
                  />
                </div>
              </li>
            )
          })}
        </Lista>
      )}

      <p className="px-1 text-sm text-muted-foreground">
        Cupom pausado não vale no checkout. Frete grátis só funciona em pedidos de entrega.
      </p>

      <Gaveta
        aberto={modalFormularioAberto}
        aoFechar={fecharModalFormulario}
        bloqueada={salvando}
        largura="lg"
        titulo={editando ? 'Editar cupom' : 'Criar cupom'}
        descricao="Código, desconto e onde ele vale. Limites e validade são opcionais."
        rodape={
          editando ? (
            <>
              <Botao variante="perigoSuave" className="md:mr-auto" onClick={() => void pedirExclusao()} disabled={salvando}>
                Excluir
              </Botao>
              <Botao carregando={salvando} onClick={() => void salvarCupom()}>Salvar</Botao>
            </>
          ) : (
            <>
              <Botao variante="contorno" onClick={fecharModalFormulario} disabled={salvando}>Cancelar</Botao>
              <Botao carregando={salvando} onClick={() => void salvarCupom()}>Criar cupom</Botao>
            </>
          )
        }
      >
        <form
          className="space-y-6"
          onSubmit={(evento) => {
            evento.preventDefault()
            void salvarCupom()
          }}
        >
          <div className="space-y-4">
            <Campo rotulo="Código" htmlFor="cupom-codigo" erro={erros.codigo} ajuda="O que o cliente digita no checkout.">
              <Entrada
                id="cupom-codigo"
                value={formulario.codigo}
                onChange={(evento) => mudar('codigo', normalizarCodigoCupom(evento.target.value))}
                placeholder="Ex.: PRIMEIRA10"
                autoComplete="off"
                autoCapitalize="characters"
                className="font-mono"
              />
            </Campo>
            <Campo rotulo="Nome" htmlFor="cupom-nome" erro={erros.nome} ajuda="Só a equipe vê.">
              <Entrada
                id="cupom-nome"
                value={formulario.nome}
                onChange={(evento) => mudar('nome', evento.target.value)}
                placeholder="Ex.: Boas-vindas"
                autoComplete="off"
              />
            </Campo>
            <Campo rotulo="Anotação" htmlFor="cupom-descricao" opcional>
              <AreaTexto
                id="cupom-descricao"
                rows={2}
                value={formulario.descricao}
                onChange={(evento) => mudar('descricao', evento.target.value)}
                placeholder="Para que serve este cupom."
              />
            </Campo>
          </div>

          <Secao titulo="Desconto">
            <div className="space-y-4">
              <Segmentos
                opcoes={OPCOES_TIPO}
                valor={formulario.tipoDesconto}
                aoMudar={(valor) => mudar('tipoDesconto', valor)}
                rotuloAcessivel="Tipo de desconto"
              />
              {formulario.tipoDesconto === 'percentual' && (
                <Campo rotulo="Porcentagem" htmlFor="cupom-valor" erro={erros.valorDesconto}>
                  <div className="relative">
                    <Entrada
                      id="cupom-valor"
                      inputMode="decimal"
                      value={formulario.valorDesconto}
                      onChange={(evento) => mudar('valorDesconto', decimal(evento.target.value.replace(/[^\d.,]/g, '')))}
                      placeholder="10"
                      className="pr-9 font-mono tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </Campo>
              )}
              {formulario.tipoDesconto === 'valor_fixo' && (
                <Campo rotulo="Valor" htmlFor="cupom-valor" erro={erros.valorDesconto}>
                  <EntradaPreco
                    id="cupom-valor"
                    valor={formulario.valorDesconto}
                    aoMudar={(valor) => mudar('valorDesconto', decimal(valor))}
                  />
                </Campo>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Pedido mínimo" htmlFor="cupom-minimo" ajuda="Use 0 para qualquer valor.">
                  <EntradaPreco
                    id="cupom-minimo"
                    valor={formulario.pedidoMinimo}
                    aoMudar={(valor) => mudar('pedidoMinimo', decimal(valor))}
                  />
                </Campo>
                {formulario.tipoDesconto !== 'frete_gratis' && (
                  <Campo rotulo="Desconto máximo" htmlFor="cupom-limite" opcional>
                    <EntradaPreco
                      id="cupom-limite"
                      valor={formulario.limiteDesconto}
                      aoMudar={(valor) => mudar('limiteDesconto', decimal(valor))}
                      placeholder="Sem teto"
                    />
                  </Campo>
                )}
              </div>
              <Cartao className="bg-muted/40 p-4 text-sm">
                <p className="text-muted-foreground">
                  Pedido de {formatarMoeda(previsaoDesconto.subtotalExemplo)} + frete {formatarMoeda(previsaoDesconto.freteExemplo)}
                </p>
                <p className="mt-1 text-foreground">
                  Desconto de {formatarMoeda(previsaoDesconto.desconto + previsaoDesconto.descontoFrete)} · cliente paga{' '}
                  <span className="font-semibold tabular-nums">{formatarMoeda(previsaoDesconto.total)}</span>
                </p>
              </Cartao>
            </div>
          </Secao>

          <Secao titulo="Onde vale">
            <div className="space-y-4">
              <Segmentos
                opcoes={OPCOES_APLICACAO}
                valor={formulario.aplicaEm}
                aoMudar={(valor) =>
                  setFormulario((anterior) => ({
                    ...anterior,
                    aplicaEm: valor,
                    produtoId: valor === 'produto' ? anterior.produtoId : '',
                    comboId: valor === 'combo' ? anterior.comboId : '',
                  }))
                }
                rotuloAcessivel="Onde o cupom vale"
              />
              {formulario.aplicaEm === 'produto' && (
                <Campo rotulo="Produto" htmlFor="cupom-produto" erro={erros.produtoId}>
                  <Selecao id="cupom-produto" value={formulario.produtoId} onChange={(evento) => mudar('produtoId', evento.target.value)}>
                    <option value="">Escolha um produto</option>
                    {produtos.map((produto) => (
                      <option key={produto.id} value={produto.id}>{produto.nome}</option>
                    ))}
                  </Selecao>
                </Campo>
              )}
              {formulario.aplicaEm === 'combo' && (
                <Campo rotulo="Combo" htmlFor="cupom-combo" erro={erros.comboId}>
                  <Selecao id="cupom-combo" value={formulario.comboId} onChange={(evento) => mudar('comboId', evento.target.value)}>
                    <option value="">Escolha um combo</option>
                    {combos.map((combo) => (
                      <option key={combo.id} value={combo.id}>{combo.nome}</option>
                    ))}
                  </Selecao>
                </Campo>
              )}
            </div>
          </Secao>

          <Secao titulo="Limites e validade">
            <div className="space-y-4">
              <LinhaInterruptor
                titulo="Uso único"
                descricao="Vale uma vez só, para o primeiro cliente que usar."
                marcado={formulario.usoUnico}
                aoMudar={(marcado) =>
                  setFormulario((anterior) => ({
                    ...anterior,
                    usoUnico: marcado,
                    usoMaximoTotal: marcado ? '1' : anterior.usoMaximoTotal,
                  }))
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Usos no total" htmlFor="cupom-uso-total" opcional>
                  <Entrada
                    id="cupom-uso-total"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    disabled={formulario.usoUnico}
                    value={formulario.usoMaximoTotal}
                    onChange={(evento) => mudar('usoMaximoTotal', evento.target.value)}
                    placeholder="Sem limite"
                  />
                </Campo>
                <Campo rotulo="Usos por cliente" htmlFor="cupom-uso-cliente" opcional>
                  <Entrada
                    id="cupom-uso-cliente"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={formulario.usoMaximoPorCliente}
                    onChange={(evento) => mudar('usoMaximoPorCliente', evento.target.value)}
                    placeholder="Sem limite"
                  />
                </Campo>
                <Campo rotulo="Começa em" htmlFor="cupom-inicio" opcional>
                  <Entrada
                    id="cupom-inicio"
                    type="datetime-local"
                    value={formulario.validadeInicio}
                    onChange={(evento) => mudar('validadeInicio', evento.target.value)}
                    className="min-w-0"
                  />
                </Campo>
                <Campo rotulo="Termina em" htmlFor="cupom-fim" opcional erro={erros.validadeFim}>
                  <Entrada
                    id="cupom-fim"
                    type="datetime-local"
                    value={formulario.validadeFim}
                    onChange={(evento) => mudar('validadeFim', evento.target.value)}
                    className="min-w-0"
                  />
                </Campo>
              </div>
              <LinhaInterruptor
                titulo="Cupom ativo"
                descricao="Desligue para pausar sem excluir."
                marcado={formulario.ativo}
                aoMudar={(marcado) => mudar('ativo', marcado)}
              />
            </div>
          </Secao>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Gaveta>
    </Pagina>
  )
}
