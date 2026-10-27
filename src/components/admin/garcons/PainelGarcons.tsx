'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, ArrowSquareOut as ExternalLink, ArrowsClockwise as RefreshCw } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Botao, CabecalhoPagina, Cartao, Pagina } from '@/components/admin/ui'
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

  const indicadores = [
    { rotulo: 'Equipe', valor: String(resumo.total), detalhe: `${resumo.ativos} ativos` },
    { rotulo: 'Pedidos hoje', valor: String(resumo.criadosHoje) },
    { rotulo: 'Editados hoje', valor: String(resumo.editadosHoje) },
    { rotulo: 'Vendas hoje', valor: moeda.format(resumo.vendasHoje) },
  ]

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Garçons"
        descricao="Desempenho do dia (o dia vira às 3h) e link de acesso ao app."
        acoes={
          <Botao variante="contorno" onClick={() => void carregarGarcons()} disabled={carregando}>
            <RefreshCw className={cn(carregando && 'animate-spin')} />
            Atualizar
          </Botao>
        }
      />

      <Cartao className="grid grid-cols-2 gap-px overflow-hidden bg-border/70 md:grid-cols-4">
        {indicadores.map((item) => (
          <div key={item.rotulo} className="min-w-0 bg-card p-4">
            <p className="text-[13px] text-muted-foreground">{item.rotulo}</p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{item.valor}</p>
            {item.detalhe && <p className="text-[13px] text-muted-foreground">{item.detalhe}</p>}
          </div>
        ))}
      </Cartao>

      <Cartao className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Link de acesso</p>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            Mande para o garçom entrar no app. Cadastro e senha ficam em Usuários.
          </p>
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-foreground">
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono">{urlGarcom}</span>
          </p>
        </div>
        <Botao className="h-11 shrink-0 md:h-10" onClick={() => void copiarUrl()}>
          {urlCopiada ? <Check /> : <Copy />}
          {urlCopiada ? 'Copiado' : 'Copiar link'}
        </Botao>
      </Cartao>

      <ListaGarcons
        garcons={garcons}
        carregando={carregando}
        onAtualizar={() => void carregarGarcons({ silencioso: true })}
      />
    </Pagina>
  )
}
