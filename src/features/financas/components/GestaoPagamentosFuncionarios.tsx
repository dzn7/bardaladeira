'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { CalendarCheck as CalendarClock, CheckCircle as CheckCircle2, FloppyDisk as Save, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  AreaTexto,
  Botao,
  Campo,
  Cartao,
  Entrada,
  EntradaPreco,
  Gaveta,
  LinhaInterruptor,
  ListaCarregando,
  ListaVazia,
  Secao,
  Segmentos,
  Selecao,
  Selo,
  formatarPreco,
} from '@/components/admin/ui'
import { competenciaAtual, formatarCompetencia, hojeIso, situacaoPagamentoFuncionario } from '@/lib/pagamentos-funcionarios.mjs'
import type { CategoriaCaixa, Funcionario } from '@/lib/tipos-caixa'

type Configuracao = {
  funcionario_id: string
  dia_vencimento: number
  antecedencia_dias: number
  valor_previsto: number | null
  ativo: boolean
  inicia_em: string
}

type Pagamento = {
  id: string
  funcionario_id: string
  competencia: string
  vencimento: string
  pago_em: string
  valor: number
  forma_pagamento: string
  categoria_id: string | null
  observacoes: string | null
}

type Resposta = {
  sucesso?: boolean
  erro?: string
  funcionarios?: Funcionario[]
  configuracoes?: Configuracao[]
  pagamentos?: Pagamento[]
}

const FORMAS = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cheque', rotulo: 'Cheque' },
]

const requisitar = async (init?: RequestInit) => {
  const headers = new Headers(init?.headers)
  const token = window.localStorage.getItem('adminToken')
  if (token) headers.set('x-admin-token', token)
  const resposta = await fetch('/api/admin/financas/pagamentos-funcionarios', { ...init, headers })
  const texto = await resposta.text()
  let json: Resposta = {}
  try {
    json = texto ? JSON.parse(texto) as Resposta : {}
  } catch {
    throw new Error('Serviço de pagamentos indisponível. Tente novamente em instantes.')
  }
  if (!resposta.ok || !json.sucesso) throw new Error(json.erro || 'Não foi possível concluir a operação.')
  return json
}

const moedaInput = (valor: number | null | undefined) => valor == null ? '' : String(Number(valor).toFixed(2)).replace('.', ',')
const numeroMoeda = (valor: string) => Number(valor.replace(',', '.'))

const listarCompetencias = (inicio: string | undefined) => {
  const atual = competenciaAtual()
  const primeira = /^\d{4}-\d{2}-01$/.test(inicio || '') ? inicio as string : atual
  const lista: string[] = []
  const limite = new Date(`${atual}T12:00:00Z`)
  const inicioVisivel = new Date(limite)
  inicioVisivel.setUTCMonth(inicioVisivel.getUTCMonth() - 59)
  const inicioAgenda = new Date(`${primeira}T12:00:00Z`)
  const cursor = inicioAgenda > inicioVisivel ? inicioAgenda : inicioVisivel
  while (cursor <= limite) {
    lista.unshift(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-01`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return lista
}

export function GestaoPagamentosFuncionarios({
  funcionarios: funcionariosIniciais,
  categorias,
  aoAtualizar,
}: {
  funcionarios: Funcionario[]
  categorias: CategoriaCaixa[]
  aoAtualizar: () => Promise<void>
}) {
  const idDia = useId()
  const idAntecedencia = useId()
  const idPrevisto = useId()
  const idValor = useId()
  const idData = useId()
  const idObservacoes = useId()
  const idFuncionario = useId()
  const idCompetencia = useId()
  const idCategoria = useId()
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [funcionarios, setFuncionarios] = useState(funcionariosIniciais)
  const [configuracoes, setConfiguracoes] = useState<Configuracao[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [funcionarioId, setFuncionarioId] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('5')
  const [antecedenciaDias, setAntecedenciaDias] = useState('3')
  const [valorPrevisto, setValorPrevisto] = useState('')
  const [agendaAtiva, setAgendaAtiva] = useState(true)
  const [valorPagamento, setValorPagamento] = useState('')
  const [dataPagamento, setDataPagamento] = useState(hojeIso())
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [categoriaId, setCategoriaId] = useState('sem-categoria')
  const [competencia, setCompetencia] = useState(competenciaAtual())

  const carregar = async () => {
    setCarregando(true)
    try {
      const json = await requisitar()
      const lista = json.funcionarios || []
      setFuncionarios(lista)
      setConfiguracoes(json.configuracoes || [])
      setPagamentos(json.pagamentos || [])
      setFuncionarioId((atual) => atual && lista.some((item) => item.id === atual) ? atual : (lista[0]?.id || ''))
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao carregar pagamentos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    if (parametros.get('secao') === 'pagamentos-equipe') setAberto(true)
    const funcionarioRota = parametros.get('funcionario')
    if (funcionarioRota) setFuncionarioId(funcionarioRota)
    const competenciaRota = parametros.get('competencia')
    if (competenciaRota && /^\d{4}-\d{2}-01$/.test(competenciaRota)) setCompetencia(competenciaRota)
  }, [])

  useEffect(() => {
    if (aberto) void carregar()
  }, [aberto])

  const config = configuracoes.find((item) => item.funcionario_id === funcionarioId)
  const pagamentoAtual = pagamentos.find((item) => item.funcionario_id === funcionarioId && item.competencia === competencia)
  const funcionario = funcionarios.find((item) => item.id === funcionarioId)

  useEffect(() => {
    setDiaVencimento(String(config?.dia_vencimento ?? 5))
    setAntecedenciaDias(String(config?.antecedencia_dias ?? 3))
    setValorPrevisto(moedaInput(config?.valor_previsto))
    setAgendaAtiva(config?.ativo !== false)
    setValorPagamento(moedaInput(config?.valor_previsto))
    setDataPagamento(hojeIso())
  }, [config, funcionarioId])

  useEffect(() => {
    if (config && !listarCompetencias(config.inicia_em).includes(competencia)) setCompetencia(competenciaAtual())
  }, [competencia, config])

  const situacao = useMemo(() => situacaoPagamentoFuncionario({
    competencia,
    diaVencimento: Number(diaVencimento),
    antecedenciaDias: Number(antecedenciaDias),
    hoje: hojeIso(),
    pagoEm: pagamentoAtual?.pago_em,
  }), [antecedenciaDias, diaVencimento, competencia, pagamentoAtual?.pago_em])

  const postar = async (corpo: Record<string, unknown>) => requisitar({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

  const salvarAgenda = async () => {
    setSalvando(true)
    try {
      await postar({
        acao: 'configurar', funcionarioId, diaVencimento: Number(diaVencimento),
        antecedenciaDias: Number(antecedenciaDias),
        valorPrevisto: valorPrevisto.trim() ? numeroMoeda(valorPrevisto) : null,
        ativo: agendaAtiva,
      })
      toast.success('Agenda de pagamento salva')
      await carregar()
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao salvar agenda.')
    } finally {
      setSalvando(false)
    }
  }

  const registrarPagamento = async () => {
    setSalvando(true)
    try {
      await postar({
        acao: 'registrar_pagamento', funcionarioId, competencia,
        pagoEm: new Date(`${dataPagamento}T12:00:00`).toISOString(),
        valor: numeroMoeda(valorPagamento), formaPagamento,
        categoriaId: categoriaId === 'sem-categoria' ? null : categoriaId,
        observacoes: (document.getElementById(idObservacoes) as HTMLTextAreaElement | null)?.value || null,
      })
      toast.success('Pagamento registrado e lançado no caixa')
      await Promise.all([carregar(), aoAtualizar()])
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao registrar pagamento.')
    } finally {
      setSalvando(false)
    }
  }

  const categoriasSaida = categorias.filter((item) => item.tipo === 'saida')
  const competencias = listarCompetencias(config?.inicia_em)
  const status = pagamentoAtual ? 'Pago' : situacao?.estado === 'atrasado' ? `Atrasado ${situacao.dias}d`
    : situacao?.estado === 'vence_hoje' ? 'Vence hoje'
      : situacao?.estado === 'proximo' ? `Vence em ${situacao.dias}d` : 'Agendado'

  const tomStatus = pagamentoAtual
    ? 'sucesso'
    : situacao?.estado === 'atrasado' || situacao?.estado === 'vence_hoje'
      ? 'perigo'
      : 'alerta'

  return (
    <>
      <Botao variante="contorno" data-onboarding="financas-salario" onClick={() => setAberto(true)}>
        <Users className="size-4" /> Pagamentos da equipe
      </Botao>
      <Gaveta
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        bloqueada={salvando}
        largura="lg"
        titulo="Pagamentos da equipe"
        descricao="Dia do pagamento de cada pessoa e registro do que já foi pago."
        rodape={<Botao variante="contorno" onClick={() => setAberto(false)}>Fechar</Botao>}
      >
        {carregando ? (
          <ListaCarregando linhas={3} />
        ) : funcionarios.length === 0 ? (
          <ListaVazia icone={<Users />} titulo="Nenhum funcionário ativo" descricao="Cadastre a equipe para agendar pagamentos." />
        ) : (
          <div className="space-y-6">
            <Campo rotulo="Funcionário" htmlFor={idFuncionario}>
              <Selecao id={idFuncionario} value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}>
                {!funcionarioId ? <option value="">Selecionar</option> : null}
                {funcionarios.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}{item.cargo ? ` · ${item.cargo}` : ''}</option>
                ))}
              </Selecao>
            </Campo>

            <Secao titulo="Agenda mensal" descricao="O lembrete usa esta antecedência todo mês.">
              <div className="space-y-4">
                <LinhaInterruptor
                  titulo="Lembrete ativo"
                  descricao="Avisa quando o pagamento estiver chegando."
                  marcado={agendaAtiva}
                  aoMudar={setAgendaAtiva}
                  rotuloAcessivel="Ativar lembretes deste funcionário"
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Campo rotulo="Dia do pagamento" htmlFor={idDia}>
                    <Entrada id={idDia} type="number" inputMode="numeric" min={1} max={31} value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} />
                  </Campo>
                  <Campo rotulo="Avisar antes" htmlFor={idAntecedencia}>
                    <div className="relative">
                      <Entrada id={idAntecedencia} type="number" inputMode="numeric" min={0} max={30} value={antecedenciaDias} onChange={(e) => setAntecedenciaDias(e.target.value)} className="pr-12" />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">dias</span>
                    </div>
                  </Campo>
                  <Campo rotulo="Valor previsto" htmlFor={idPrevisto} opcional className="col-span-2 sm:col-span-1">
                    <EntradaPreco id={idPrevisto} valor={valorPrevisto} aoMudar={setValorPrevisto} />
                  </Campo>
                </div>
                <Botao variante="contorno" className="w-full sm:w-auto" carregando={salvando} disabled={!funcionarioId} onClick={() => void salvarAgenda()}>
                  <Save className="size-4" /> Salvar agenda
                </Botao>
              </div>
            </Secao>

            <Secao
              titulo="Pagamento do mês"
              descricao={funcionario?.nome}
              acao={<Selo tom={tomStatus}>{status}</Selo>}
            >
              <div className="space-y-4">
                <Campo rotulo="Competência" htmlFor={idCompetencia}>
                  <Selecao id={idCompetencia} value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="capitalize">
                    {competencias.map((item) => (
                      <option key={item} value={item}>{formatarCompetencia(item)}</option>
                    ))}
                  </Selecao>
                </Campo>

                {pagamentoAtual ? (
                  <Cartao className="flex items-center gap-3 p-4">
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" weight="fill" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Pagamento registrado</p>
                      <p className="text-sm text-muted-foreground">
                        {formatarPreco(Number(pagamentoAtual.valor))} · {new Date(pagamentoAtual.pago_em).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </Cartao>
                ) : (
                  <>
                    {!config ? (
                      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                        Salve a agenda antes de registrar o primeiro pagamento.
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      <Campo rotulo="Valor pago" htmlFor={idValor}>
                        <EntradaPreco id={idValor} valor={valorPagamento} aoMudar={setValorPagamento} />
                      </Campo>
                      <Campo rotulo="Data" htmlFor={idData}>
                        <Entrada id={idData} type="date" max={hojeIso()} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
                      </Campo>
                    </div>
                    <Campo rotulo="Forma">
                      <Segmentos opcoes={FORMAS} valor={formaPagamento} aoMudar={setFormaPagamento} rotuloAcessivel="Forma de pagamento" />
                    </Campo>
                    <Campo rotulo="Categoria" htmlFor={idCategoria}>
                      <Selecao id={idCategoria} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                        <option value="sem-categoria">Sem categoria</option>
                        {categoriasSaida.map((item) => (
                          <option key={item.id} value={item.id}>{item.nome}</option>
                        ))}
                      </Selecao>
                    </Campo>
                    <Campo rotulo="Observações" htmlFor={idObservacoes} opcional>
                      <AreaTexto id={idObservacoes} maxLength={500} rows={2} />
                    </Campo>
                    <Botao
                      className="w-full sm:w-auto"
                      carregando={salvando}
                      disabled={!funcionarioId || !config || !agendaAtiva}
                      onClick={() => void registrarPagamento()}
                    >
                      <CalendarClock className="size-4" /> Registrar pagamento
                    </Botao>
                  </>
                )}
              </div>
            </Secao>
          </div>
        )}
      </Gaveta>
    </>
  )
}
