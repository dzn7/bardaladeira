'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { GarcomComMetricas } from './tipos'

type Props = {
  garcons: GarcomComMetricas[]
  carregando: boolean
  onAtualizar: () => void
}

type FiltroStatus = 'todos' | 'ativos' | 'inativos'
type Ordenacao = 'vendas' | 'criados' | 'nome'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const formatarData = (data: string | null) => {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatarUltimoAcesso = (data: string | null) => {
  if (!data) return 'Nunca'
  const diff = Date.now() - new Date(data).getTime()
  const minutos = Math.floor(diff / 60000)
  if (minutos < 1) return 'Agora'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `${dias}d`
  return formatarData(data)
}

export default function ListaGarcons({ garcons, carregando, onAtualizar }: Props) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('vendas')
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = garcons.filter((g) => {
      if (filtroStatus === 'ativos' && !g.ativo) return false
      if (filtroStatus === 'inativos' && g.ativo) return false
      if (!termo) return true
      return (
        g.nome.toLowerCase().includes(termo) ||
        g.nomeUsuario.toLowerCase().includes(termo)
      )
    })

    return lista.sort((a, b) => {
      if (ordenacao === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR')
      if (ordenacao === 'criados') return b.pedidosCriadosHoje - a.pedidosCriadosHoje
      return b.vendasHoje - a.vendasHoje || b.pedidosCriadosHoje - a.pedidosCriadosHoje
    })
  }, [garcons, busca, filtroStatus, ordenacao])

  const chipsFiltro: ChipFiltroAtivo[] = useMemo(() => {
    const chips: ChipFiltroAtivo[] = []
    if (busca.trim()) {
      chips.push({ key: 'busca', label: 'Busca', value: busca.trim() })
    }
    if (filtroStatus !== 'todos') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: filtroStatus === 'ativos' ? 'Ativos' : 'Inativos',
      })
    }
    if (ordenacao !== 'vendas') {
      chips.push({
        key: 'ordem',
        label: 'Ordem',
        value: ordenacao === 'criados' ? 'Mais pedidos' : 'Nome',
      })
    }
    return chips
  }, [busca, filtroStatus, ordenacao])

  const handleLimparFiltros = () => {
    setBusca('')
    setFiltroStatus('todos')
    setOrdenacao('vendas')
  }

  const handleToggleAccordion = (id: string) => {
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleAtivo = async (garcom: GarcomComMetricas) => {
    try {
      setProcessandoId(garcom.id)
      const { error } = await supabase
        .from('usuarios_sistema')
        .update({ ativo: !garcom.ativo })
        .eq('id', garcom.id)
      if (error) throw error
      toast.success(garcom.ativo ? 'Garçom desativado' : 'Garçom ativado')
      onAtualizar()
    } catch (erro) {
      console.error('[Admin Garcons] Erro ao alterar status:', erro)
      toast.error('Erro ao alterar status')
    } finally {
      setProcessandoId(null)
    }
  }

  const itensAcao = (garcom: GarcomComMetricas): MenuAcaoItem[] => [
    {
      key: 'pedidos',
      label: 'Ver pedidos',
      onSelect: () => router.push(`/admin/garcons/${garcom.id}/pedidos`),
    },
    {
      key: 'toggle',
      label: garcom.ativo ? 'Desativar' : 'Ativar',
      disabled: processandoId === garcom.id,
      separatorBefore: true,
      variant: garcom.ativo ? 'destructive' : 'default',
      onSelect: () => void handleToggleAtivo(garcom),
    },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-foreground/90">Equipe</span>
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {filtrados.length} {filtrados.length === 1 ? 'garçom' : 'garçons'}
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="relative min-w-0 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou usuário…"
            className="h-10 border-border/70 bg-background pl-9 shadow-none"
            aria-label="Buscar garçom"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <ToggleGroup
            type="single"
            value={filtroStatus}
            onValueChange={(v) => {
              if (v) setFiltroStatus(v as FiltroStatus)
            }}
            aria-label="Filtro de status"
            className="flex w-max flex-wrap items-center justify-start gap-2"
          >
            <ToggleGroupItem value="todos" className={CHIP_FILTRO_DEFAULT}>
              Todos
            </ToggleGroupItem>
            <ToggleGroupItem value="ativos" className={CHIP_FILTRO_DEFAULT}>
              Ativos
            </ToggleGroupItem>
            <ToggleGroupItem value="inativos" className={CHIP_FILTRO_DEFAULT}>
              Inativos
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={ordenacao}
            onValueChange={(v) => {
              if (v) setOrdenacao(v as Ordenacao)
            }}
            aria-label="Ordenar equipe"
            className="flex w-max flex-wrap items-center justify-start gap-2"
          >
            <ToggleGroupItem value="vendas" className={CHIP_FILTRO_DEFAULT}>
              Vendas
            </ToggleGroupItem>
            <ToggleGroupItem value="criados" className={CHIP_FILTRO_DEFAULT}>
              Pedidos
            </ToggleGroupItem>
            <ToggleGroupItem value="nome" className={CHIP_FILTRO_DEFAULT}>
              Nome
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <FiltrosAtivosChips chips={chipsFiltro} onLimpar={handleLimparFiltros} className="mb-4" />

      {carregando ? (
        <TabelaSkeleton linhas={6} />
      ) : filtrados.length === 0 ? (
        <ListaVazia
          icone={<Users className="h-5 w-5" />}
          titulo={garcons.length === 0 ? 'Nenhum garçom cadastrado' : 'Nenhum resultado'}
          descricao={
            garcons.length === 0
              ? 'Cadastre um usuário com papel Garçom em Usuários.'
              : 'Ajuste a busca ou o filtro de status.'
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Garçom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Criados</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Editados</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Vendas hoje</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Acesso</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((garcom) => (
                  <tr
                    key={garcom.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarUsuario
                          nome={garcom.nome}
                          src={garcom.avatarUrl}
                          cor={garcom.corAvatar}
                          size="sm"
                          className="size-9"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{garcom.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">@{garcom.nomeUsuario}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          garcom.ativo
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-border/70 bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {garcom.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {garcom.pedidosCriadosHoje}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {garcom.pedidosModificadosHoje}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                      {moeda.format(garcom.vendasHoje)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {moeda.format(garcom.ticketMedioHoje)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatarUltimoAcesso(garcom.ultimoAcesso)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MenuAcoes ariaLabel={`Ações de ${garcom.nome}`} items={itensAcao(garcom)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {filtrados.map((garcom) => {
              const aberto = abertos.has(garcom.id)
              return (
                <div
                  key={garcom.id}
                  className="overflow-hidden rounded-xl border border-border/70 bg-background"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleAccordion(garcom.id)}
                    className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/20"
                    aria-expanded={aberto}
                    aria-controls={`painel-garcom-${garcom.id}`}
                  >
                    <span
                      className={cn(
                        'h-10 w-0.5 shrink-0 self-stretch rounded-full',
                        garcom.ativo ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                      )}
                    />
                    <AvatarUsuario
                      nome={garcom.nome}
                      src={garcom.avatarUrl}
                      cor={garcom.corAvatar}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{garcom.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">@{garcom.nomeUsuario}</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                        {moeda.format(garcom.vendasHoje)}
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">hoje</span>
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        aberto && 'rotate-180',
                      )}
                      strokeWidth={1.6}
                    />
                  </button>

                  {aberto ? (
                    <div
                      id={`painel-garcom-${garcom.id}`}
                      className="border-t border-border/60 px-3.5 pb-3.5 pt-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            garcom.ativo
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-border/70 bg-muted/40 text-muted-foreground',
                          )}
                        >
                          {garcom.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Acesso: {formatarUltimoAcesso(garcom.ultimoAcesso)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Criados
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">{garcom.pedidosCriadosHoje}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Editados
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">
                            {garcom.pedidosModificadosHoje}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Ticket
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">
                            {moeda.format(garcom.ticketMedioHoje)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Histórico
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">
                            {garcom.pedidosCriadosTotal}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          className="h-9 flex-1 shadow-none"
                          onClick={() => router.push(`/admin/garcons/${garcom.id}/pedidos`)}
                        >
                          Ver pedidos
                        </Button>
                        <MenuAcoes ariaLabel={`Ações de ${garcom.nome}`} items={itensAcao(garcom)} />
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
