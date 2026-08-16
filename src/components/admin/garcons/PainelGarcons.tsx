'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { obterIntervaloDiaOperacionalAtual } from '@/lib/dia-operacional'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import ListaGarcons from './ListaGarcons'
import type { GarcomComMetricas } from './tipos'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const contarPorGarcom = (lista: { garcom_id: string | null }[], id: string) =>
  lista.filter((item) => item.garcom_id === id).length

const contarPedidosDistintos = (
  lista: { garcom_id: string | null; pedido_id?: string | null }[],
  id: string,
) => {
  const vistos = new Set<string>()
  for (const item of lista) {
    if (item.garcom_id !== id || !item.pedido_id) continue
    vistos.add(item.pedido_id)
  }
  return vistos.size
}

const somarVendasPorGarcom = (
  lista: { garcom_id: string | null; total: number | null }[],
  id: string,
) =>
  lista
    .filter((item) => item.garcom_id === id)
    .reduce((soma, item) => soma + Number(item.total || 0), 0)

export default function PainelGarcons() {
  const [garcons, setGarcons] = useState<GarcomComMetricas[]>([])
  const [carregando, setCarregando] = useState(true)
  const [urlCopiada, setUrlCopiada] = useState(false)

  const urlGarcom =
    typeof window !== 'undefined' ? `${window.location.origin}/garcom/login` : '/garcom/login'

  const carregarGarcons = useCallback(async (opcoes?: { silencioso?: boolean }) => {
    const silencioso = Boolean(opcoes?.silencioso)
    try {
      if (!silencioso) setCarregando(true)

      const { data: usuarios, error: erroUsuarios } = await supabase
        .from('usuarios_sistema')
        .select('id, nome, nome_usuario, papel, avatar_url, cor_avatar, ativo, ultimo_acesso, created_at')
        .eq('papel', 'garcom')
        .order('nome')

      if (erroUsuarios) throw erroUsuarios

      if (!usuarios || usuarios.length === 0) {
        setGarcons([])
        return
      }

      const idsGarcons = usuarios.map((u) => u.id)
      const { inicio, fim } = obterIntervaloDiaOperacionalAtual()
      const inicioIso = inicio.toISOString()
      const fimIso = fim.toISOString()

      const [pedidosTotalResult, pedidosHojeResult, editadosHojeResult, editadosTotalResult, itensHojeResult] =
        await Promise.all([
          supabase.from('pedidos').select('garcom_id').in('garcom_id', idsGarcons),
          supabase
            .from('pedidos')
            .select('garcom_id, total')
            .in('garcom_id', idsGarcons)
            .gte('created_at', inicioIso)
            .lt('created_at', fimIso)
            .neq('status', 'cancelado')
            .neq('status', 'aguardando_pagamento'),
          supabase
            .from('atividade_garcom')
            .select('garcom_id, pedido_id')
            .in('garcom_id', idsGarcons)
            .eq('tipo_acao', 'pedido_modificado')
            .gte('created_at', inicioIso)
            .lt('created_at', fimIso),
          supabase
            .from('atividade_garcom')
            .select('garcom_id, pedido_id')
            .in('garcom_id', idsGarcons)
            .eq('tipo_acao', 'pedido_modificado'),
          supabase
            .from('atividade_garcom')
            .select('garcom_id')
            .in('garcom_id', idsGarcons)
            .eq('tipo_acao', 'item_adicionado')
            .gte('created_at', inicioIso)
            .lt('created_at', fimIso),
        ])

      if (pedidosTotalResult.error) throw pedidosTotalResult.error
      if (pedidosHojeResult.error) throw pedidosHojeResult.error
      if (editadosHojeResult.error) throw editadosHojeResult.error
      if (editadosTotalResult.error) throw editadosTotalResult.error
      if (itensHojeResult.error) throw itensHojeResult.error

      const pedidosTotal = pedidosTotalResult.data || []
      const pedidosHoje = pedidosHojeResult.data || []
      const editadosHoje = editadosHojeResult.data || []
      const editadosTotal = editadosTotalResult.data || []
      const itensHoje = itensHojeResult.data || []

      setGarcons(
        usuarios.map((u) => {
          const criadosHoje = contarPorGarcom(pedidosHoje, u.id)
          const vendasHoje = somarVendasPorGarcom(pedidosHoje, u.id)
          return {
            id: u.id,
            nome: u.nome,
            nomeUsuario: u.nome_usuario,
            avatarUrl: u.avatar_url,
            corAvatar: u.cor_avatar || '#0296F9',
            ativo: u.ativo,
            ultimoAcesso: u.ultimo_acesso,
            criadoEm: u.created_at,
            pedidosCriadosTotal: contarPorGarcom(pedidosTotal, u.id),
            pedidosModificadosTotal: contarPedidosDistintos(editadosTotal, u.id),
            pedidosCriadosHoje: criadosHoje,
            pedidosModificadosHoje: contarPedidosDistintos(editadosHoje, u.id),
            itensAdicionadosHoje: contarPorGarcom(itensHoje, u.id),
            vendasHoje,
            ticketMedioHoje: criadosHoje > 0 ? vendasHoje / criadosHoje : 0,
          }
        }),
      )
    } catch (erro) {
      console.error('[Admin Garcons] Erro ao carregar:', erro)
      toast.error('Erro ao carregar dados dos garçons')
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarGarcons()
  }, [carregarGarcons])

  const copiarUrl = async () => {
    try {
      await navigator.clipboard.writeText(urlGarcom)
      setUrlCopiada(true)
      toast.success('URL copiada')
      setTimeout(() => setUrlCopiada(false), 2000)
    } catch {
      toast.error('Erro ao copiar URL')
    }
  }

  const resumo = useMemo(() => {
    const ativos = garcons.filter((g) => g.ativo).length
    const criadosHoje = garcons.reduce((s, g) => s + g.pedidosCriadosHoje, 0)
    const editadosHoje = garcons.reduce((s, g) => s + g.pedidosModificadosHoje, 0)
    const vendasHoje = garcons.reduce((s, g) => s + g.vendasHoje, 0)
    return { total: garcons.length, ativos, criadosHoje, editadosHoje, vendasHoje }
  }, [garcons])

  return (
    <div className="space-y-5">
      <div className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Garçons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desempenho do dia operacional (até 3h) · acesso ao app
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Equipe</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.total}</p>
            <p className="text-xs text-muted-foreground">{resumo.ativos} ativos</p>
          </div>
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Criados hoje</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.criadosHoje}</p>
          </div>
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Editados hoje</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.editadosHoje}</p>
          </div>
          <div className="min-w-[100px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Vendas hoje</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
              {moeda.format(resumo.vendasHoje)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shadow-none"
            onClick={() => void carregarGarcons()}
            disabled={carregando}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', carregando && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Link de acesso</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Envie para o garçom entrar no app. Cadastro e senha ficam em Usuários.
            </p>
          </div>
          <Button type="button" size="sm" className="h-9 shrink-0 shadow-none" onClick={() => void copiarUrl()}>
            {urlCopiada ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
            {urlCopiada ? 'Copiado' : 'Copiar link'}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 truncate font-mono text-sm tabular-nums text-foreground">{urlGarcom}</p>
        </div>
      </div>

      <ListaGarcons
        garcons={garcons}
        carregando={carregando}
        onAtualizar={() => void carregarGarcons({ silencioso: true })}
      />
    </div>
  )
}
