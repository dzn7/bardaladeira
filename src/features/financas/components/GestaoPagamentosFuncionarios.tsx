'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Loader2, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import Interruptor from '@/components/admin/Interruptor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { competenciaAtual, formatarCompetencia, hojeIso, situacaoPagamentoFuncionario } from '@/lib/pagamentos-funcionarios.mjs'
import type { CategoriaCaixa, Funcionario } from '@/lib/tipos-caixa'
import { cn } from '@/lib/utils'

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

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" data-onboarding="financas-salario" className="h-10 gap-2 rounded-xl border-border/70 px-3 text-sm font-medium shadow-none">
          <Users className="h-4 w-4" /> Pagamentos da equipe
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[96dvh] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-card p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="text-base">Pagamentos da equipe</DialogTitle>
          <DialogDescription>Defina o vencimento mensal e registre o pagamento de cada competência.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 max-md:[&_input]:text-base">
          {carregando ? (
            <div className="flex min-h-56 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : funcionarios.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum funcionário ativo.</div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Funcionário</Label>
                <Select value={funcionarioId} onValueChange={setFuncionarioId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{funcionarios.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}{item.cargo ? ` · ${item.cargo}` : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">Agenda mensal</h3>
                    <p className="text-xs text-muted-foreground">O lembrete usa esta antecedência em todos os meses.</p>
                  </div>
                  <Interruptor ativado={agendaAtiva} aoAlternar={setAgendaAtiva} tamanho="md" aria-label="Ativar lembretes deste funcionário" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label htmlFor={idDia}>Dia do pagamento</Label><Input id={idDia} type="number" min={1} max={31} value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor={idAntecedencia}>Avisar antes</Label><div className="relative"><Input id={idAntecedencia} type="number" min={0} max={30} value={antecedenciaDias} onChange={(e) => setAntecedenciaDias(e.target.value)} className="pr-12" /><span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">dias</span></div></div>
                  <div className="space-y-1.5"><Label htmlFor={idPrevisto}>Valor previsto</Label><Input id={idPrevisto} inputMode="decimal" placeholder="Opcional" value={valorPrevisto} onChange={(e) => setValorPrevisto(e.target.value)} /></div>
                </div>
                <div className="mt-4 flex justify-end"><Button type="button" variant="outline" disabled={salvando || !funcionarioId} onClick={() => void salvarAgenda()} className="gap-2"><Save className="h-4 w-4" /> Salvar agenda</Button></div>
              </section>

              <section className="rounded-xl border border-border/70 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[190px] space-y-1.5"><Label>Competência</Label><Select value={competencia} onValueChange={setCompetencia}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{competencias.map((item) => <SelectItem key={item} value={item}><span className="capitalize">{formatarCompetencia(item)}</span></SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{funcionario?.nome}</p></div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', pagamentoAtual ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : situacao?.estado === 'atrasado' || situacao?.estado === 'vence_hoje' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300')}>{status}</span>
                </div>

                {pagamentoAtual ? (
                  <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /><div><p className="text-sm font-medium">Pagamento registrado</p><p className="text-xs opacity-80">R$ {Number(pagamentoAtual.valor).toFixed(2).replace('.', ',')} · {new Date(pagamentoAtual.pago_em).toLocaleDateString('pt-BR')}</p></div></div>
                ) : (
                  <div className="space-y-4">
                    {!config ? <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/25 dark:text-amber-300">Salve a agenda antes de registrar o primeiro pagamento.</div> : null}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label htmlFor={idValor}>Valor pago</Label><Input id={idValor} inputMode="decimal" placeholder="0,00" value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor={idData}>Data do pagamento</Label><Input id={idData} type="date" max={hojeIso()} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Forma</Label><Select value={formaPagamento} onValueChange={setFormaPagamento}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMAS.map((item) => <SelectItem key={item.valor} value={item.valor}>{item.rotulo}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-1.5"><Label>Categoria</Label><Select value={categoriaId} onValueChange={setCategoriaId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sem-categoria">Sem categoria</SelectItem>{categoriasSaida.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor={idObservacoes}>Observações</Label><Textarea id={idObservacoes} maxLength={500} rows={2} placeholder="Opcional" /></div>
                    <div className="flex justify-end"><Button type="button" disabled={salvando || !funcionarioId || !config || !agendaAtiva} onClick={() => void registrarPagamento()} className="gap-2"><CalendarClock className="h-4 w-4" /> Registrar pagamento</Button></div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <div className="border-t border-border/60 bg-muted/20 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-right"><Button variant="ghost" onClick={() => setAberto(false)}>Fechar</Button></div>
      </DialogContent>
    </Dialog>
  )
}
