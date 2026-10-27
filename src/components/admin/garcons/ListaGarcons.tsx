'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretDown as ChevronDown, MagnifyingGlass as Search, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { Botao, Chip, Entrada, Lista, ListaCarregando, ListaVazia, Selo } from '@/components/admin/ui'
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

  const filtrosAtivos = Boolean(busca.trim()) || filtroStatus !== 'todos' || ordenacao !== 'vendas'

  const opcoesStatus: { valor: FiltroStatus; rotulo: string }[] = [
    { valor: 'todos', rotulo: 'Todos' },
    { valor: 'ativos', rotulo: 'Ativos' },
    { valor: 'inativos', rotulo: 'Inativos' },
  ]
  const opcoesOrdem: { valor: Ordenacao; rotulo: string }[] = [
    { valor: 'vendas', rotulo: 'Mais vendas' },
    { valor: 'criados', rotulo: 'Mais pedidos' },
    { valor: 'nome', rotulo: 'Nome' },
  ]

  const seloStatus = (garcom: GarcomComMetricas) => (
    <Selo tom={garcom.ativo ? 'sucesso' : 'neutro'}>{garcom.ativo ? 'Ativo' : 'Inativo'}</Selo>
  )

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-foreground">Equipe</h2>
        <span className="text-[13px] text-muted-foreground">
          {filtrados.length} {filtrados.length === 1 ? 'garçom' : 'garçons'}
        </span>
      </div>

      <div className="relative sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Entrada
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou usuário"
          className="pl-9"
          aria-label="Buscar garçom"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filtro de status" className="flex flex-wrap gap-2">
          {opcoesStatus.map((opcao) => (
            <Chip
              key={opcao.valor}
              ativo={filtroStatus === opcao.valor}
              onClick={() => setFiltroStatus(opcao.valor)}
              className="h-10"
            >
              {opcao.rotulo}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Ordenar equipe" className="flex flex-wrap gap-2">
          {opcoesOrdem.map((opcao) => (
            <Chip
              key={opcao.valor}
              ativo={ordenacao === opcao.valor}
              onClick={() => setOrdenacao(opcao.valor)}
              className="h-10"
            >
              {opcao.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      {carregando ? (
        <ListaCarregando linhas={5} />
      ) : filtrados.length === 0 ? (
        <ListaVazia
          icone={<Users />}
          titulo={garcons.length === 0 ? 'Nenhum garçom cadastrado' : 'Nenhum garçom encontrado'}
          descricao={
            garcons.length === 0
              ? 'Cadastre um usuário com o papel Garçom em Usuários.'
              : 'Mude a busca ou o filtro.'
          }
          acao={
            garcons.length > 0 && filtrosAtivos ? (
              <Botao variante="contorno" onClick={handleLimparFiltros}>
                Limpar filtros
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop: tabela compacta */}
          <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70 text-[13px] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Garçom</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pedidos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Editados</th>
                  <th className="px-4 py-2.5 text-right font-medium">Vendas hoje</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ticket médio</th>
                  <th className="px-4 py-2.5 text-left font-medium">Último acesso</th>
                  <th className="w-12 px-2 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filtrados.map((garcom) => (
                  <tr key={garcom.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-2.5">
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
                          <p className="truncate text-[13px] text-muted-foreground">@{garcom.nomeUsuario}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{seloStatus(garcom)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {garcom.pedidosCriadosHoje}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {garcom.pedidosModificadosHoje}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
                      {moeda.format(garcom.vendasHoje)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {moeda.format(garcom.ticketMedioHoje)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatarUltimoAcesso(garcom.ultimoAcesso)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <MenuAcoes
                        ariaLabel={`Ações de ${garcom.nome}`}
                        items={itensAcao(garcom)}
                        triggerClassName="size-9"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular e tablet: lista expansível */}
          <Lista className="lg:hidden">
            {filtrados.map((garcom) => {
              const aberto = abertos.has(garcom.id)
              return (
                <li key={garcom.id}>
                  <button
                    type="button"
                    onClick={() => handleToggleAccordion(garcom.id)}
                    className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                    aria-expanded={aberto}
                    aria-controls={`painel-garcom-${garcom.id}`}
                  >
                    <AvatarUsuario
                      nome={garcom.nome}
                      src={garcom.avatarUrl}
                      cor={garcom.corAvatar}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{garcom.nome}</span>
                        {!garcom.ativo && <Selo>Inativo</Selo>}
                      </p>
                      <p className="truncate text-[13px] text-muted-foreground">@{garcom.nomeUsuario}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {moeda.format(garcom.vendasHoje)}
                      </p>
                      <p className="text-[13px] text-muted-foreground">hoje</p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
                        aberto && 'rotate-180',
                      )}
                    />
                  </button>

                  {aberto ? (
                    <div id={`painel-garcom-${garcom.id}`} className="space-y-3 px-4 pb-4">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-[13px] text-muted-foreground">Pedidos hoje</dt>
                          <dd className="font-medium tabular-nums text-foreground">{garcom.pedidosCriadosHoje}</dd>
                        </div>
                        <div>
                          <dt className="text-[13px] text-muted-foreground">Editados hoje</dt>
                          <dd className="font-medium tabular-nums text-foreground">
                            {garcom.pedidosModificadosHoje}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[13px] text-muted-foreground">Ticket médio</dt>
                          <dd className="font-medium tabular-nums text-foreground">
                            {moeda.format(garcom.ticketMedioHoje)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[13px] text-muted-foreground">Pedidos no total</dt>
                          <dd className="font-medium tabular-nums text-foreground">{garcom.pedidosCriadosTotal}</dd>
                        </div>
                      </dl>
                      <p className="text-[13px] text-muted-foreground">
                        Último acesso: {formatarUltimoAcesso(garcom.ultimoAcesso)}
                      </p>
                      <div className="flex gap-2">
                        <Botao
                          className="h-11 flex-1"
                          onClick={() => router.push(`/admin/garcons/${garcom.id}/pedidos`)}
                        >
                          Ver pedidos
                        </Botao>
                        <MenuAcoes
                          ariaLabel={`Ações de ${garcom.nome}`}
                          items={itensAcao(garcom)}
                          triggerClassName="size-11 rounded-lg border border-border/70"
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </Lista>
        </>
      )}
    </section>
  )
}
