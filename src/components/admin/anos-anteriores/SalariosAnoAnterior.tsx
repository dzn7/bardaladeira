'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, CurrencyDollar as DollarSign } from '@phosphor-icons/react'
import { Cartao, Esqueleto, Lista, ListaCarregando, ListaVazia, Secao } from '@/components/admin/ui'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { obterDataInicioAno, obterDataFimAno } from '@/lib/filtros-ano'

type PagamentoFuncionario = {
  id: string
  funcionario_nome: string
  cargo: string
  valor: number
  data: string
}

type ResumoFuncionario = {
  nome: string
  cargo: string
  totalPago: number
  quantidadePagamentos: number
}

type SalariosAnoAnteriorProps = {
  ano: number
}

export default function SalariosAnoAnterior({ ano }: SalariosAnoAnteriorProps) {
  const [pagamentos, setPagamentos] = useState<PagamentoFuncionario[]>([])
  const [resumoPorFuncionario, setResumoPorFuncionario] = useState<ResumoFuncionario[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const formatarMoeda = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor)
  }

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      const dataInicio = obterDataInicioAno(ano)
      const dataFim = obterDataFimAno(ano)

      // Buscar ID da categoria "Pagamento Funcionário" dinamicamente
      const { data: categoriaData } = await supabase
        .from('categorias_caixa')
        .select('id')
        .eq('nome', 'Pagamento Funcionário')
        .single()

      if (!categoriaData) {
        setCarregando(false)
        return
      }

      const { data: pagamentosData, error } = await supabase
        .from('movimentacoes_caixa')
        .select(`
          id,
          valor,
          created_at,
          funcionario:funcionarios(nome, cargo)
        `)
        .eq('categoria_id', categoriaData.id)
        .gte('created_at', dataInicio)
        .lt('created_at', dataFim)
        .order('created_at', { ascending: false })

      if (error) throw error

      const pagamentosFormatados: PagamentoFuncionario[] = (pagamentosData || []).map((p: any) => ({
        id: p.id,
        funcionario_nome: p.funcionario?.nome || 'Não informado',
        cargo: p.funcionario?.cargo || 'Não informado',
        valor: Number(p.valor) || 0,
        data: p.created_at
      }))

      setPagamentos(pagamentosFormatados)

      const resumoMap = new Map<string, ResumoFuncionario>()
      let total = 0

      pagamentosFormatados.forEach(p => {
        total += p.valor
        const existing = resumoMap.get(p.funcionario_nome)
        if (existing) {
          existing.totalPago += p.valor
          existing.quantidadePagamentos += 1
        } else {
          resumoMap.set(p.funcionario_nome, {
            nome: p.funcionario_nome,
            cargo: p.cargo,
            totalPago: p.valor,
            quantidadePagamentos: 1
          })
        }
      })

      const resumoArray = Array.from(resumoMap.values())
        .sort((a, b) => b.totalPago - a.totalPago)

      setResumoPorFuncionario(resumoArray)
      setTotalGeral(total)
    } catch (erro) {
      console.error('Erro ao carregar salários:', erro)
    } finally {
      setCarregando(false)
    }
  }, [ano])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  if (carregando) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={`Carregando salários de ${ano}`}>
        <Esqueleto className="h-[76px] w-full rounded-xl" />
        <ListaCarregando linhas={4} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Cartao className="grid grid-cols-2">
        <div className="min-w-0 px-4 py-3.5 md:px-5 md:py-4">
          <p className="truncate text-[13px] text-muted-foreground">Gasto com salários</p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-foreground md:text-xl">
            {formatarMoeda(totalGeral)}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {pagamentos.length} {pagamentos.length === 1 ? 'pagamento' : 'pagamentos'} em {ano}
          </p>
        </div>
        <div className="min-w-0 border-l border-border/70 px-4 py-3.5 md:px-5 md:py-4">
          <p className="truncate text-[13px] text-muted-foreground">Funcionários pagos</p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-foreground md:text-xl">
            {resumoPorFuncionario.length}
          </p>
        </div>
      </Cartao>

      <Secao titulo="Por funcionário">
        {resumoPorFuncionario.length === 0 ? (
          <ListaVazia icone={<Users />} titulo={`Nenhum pagamento de salário em ${ano}`} />
        ) : (
          <Lista>
            {resumoPorFuncionario.map((funcionario) => {
              const percentual = totalGeral > 0 ? (funcionario.totalPago / totalGeral) * 100 : 0
              return (
                <li key={funcionario.nome} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground" aria-hidden>
                      {funcionario.nome.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{funcionario.nome}</p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {funcionario.cargo} · {funcionario.quantidadePagamentos} {funcionario.quantidadePagamentos === 1 ? 'pagamento' : 'pagamentos'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatarMoeda(funcionario.totalPago)}</p>
                      <p className="text-[13px] tabular-nums text-muted-foreground">{percentual.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${percentual}%` }} />
                  </div>
                </li>
              )
            })}
          </Lista>
        )}
      </Secao>

      <Secao titulo="Todos os pagamentos">
        {pagamentos.length === 0 ? (
          <ListaVazia icone={<DollarSign />} titulo="Nenhum pagamento registrado" />
        ) : (
          <Lista className="max-h-[28rem] overflow-y-auto">
            {pagamentos.map((pagamento) => (
              <li key={pagamento.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{pagamento.funcionario_nome}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {pagamento.cargo} · <span className="tabular-nums">{format(new Date(pagamento.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatarMoeda(pagamento.valor)}
                </span>
              </li>
            ))}
          </Lista>
        )}
      </Secao>
    </div>
  )
}
