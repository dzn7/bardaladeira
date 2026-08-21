'use client'

import { CSSProperties, Fragment, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Armchair,
  AlertTriangle,
  Bell,
  BellOff,
  MoreHorizontal,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Receipt,
  Search,
  Settings2,
  Sun,
  ShoppingBasket,
  UserCog,
  X,
} from 'lucide-react'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { TEMPO_AVISO_MESA_MINUTOS } from '@/lib/mesas-tempo'
import {
  ITENS_MENU_ADMIN,
  isRotaAtivaSidebar,
  mesclarConfigSidebar,
  type SidebarConfigItem,
} from '@/lib/admin-sidebar-routes'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { SidebarPersonalizarModal } from '@/components/admin/SidebarPersonalizarModal'
import { CentralNotificacoes } from '@/features/notificacoes'
import {
  normalizarConfigVisibilidade,
  telaEstaVisivel,
  type ConfigVisibilidadeTela,
} from '@/lib/visibilidade-telas'

type AdminLayoutProps = {
  children: ReactNode
}

type MesaTempoSalao = {
  id: string
  numero: number
  identificador: string | null
  liberar_em: string | null
}

type AlertaTempoSalao = {
  acabando: number
  vencidas: number
}

const CHAVE_SIDEBAR_COLAPSADA = 'admin_sidebar_colapsada'
const CHAVE_ALERTAS_MESA = 'admin:alertas-mesa'
const CHAVE_CACHE_SIDEBAR_CONFIG = 'admin_sidebar_config_v1'

const LARGURA_COLAPSADA = 112
const LARGURA_ABERTA = 224

const chaveCacheSidebarConfig = (usuarioId: string) =>
  `${CHAVE_CACHE_SIDEBAR_CONFIG}:${usuarioId}`

const lerCacheSidebarConfig = (usuarioId: string): SidebarConfigItem[] | null => {
  try {
    const raw = sessionStorage.getItem(chaveCacheSidebarConfig(usuarioId))
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as SidebarConfigItem[]) : null
  } catch {
    return null
  }
}

const gravarCacheSidebarConfig = (usuarioId: string, config: SidebarConfigItem[]) => {
  try {
    sessionStorage.setItem(chaveCacheSidebarConfig(usuarioId), JSON.stringify(config))
  } catch {
    /* ignore */
  }
}

const formatarMesasAlerta = (mesas: MesaTempoSalao[]) => {
  const nomes = mesas.slice(0, 3).map((mesa) => mesa.identificador || `Mesa ${mesa.numero}`)
  const restantes = mesas.length - nomes.length

  return restantes > 0 ? `${nomes.join(', ')} e mais ${restantes}` : nomes.join(', ')
}

const atalhosHeader = [
  { texto: 'Novo pedido', path: '/admin/pedidos/novo', icone: PlusCircle, tecla: 'Alt+N' },
  { texto: 'PDV', path: '/admin/pdv', icone: ShoppingBasket, tecla: 'Alt+P' },
  { texto: 'Salão', path: '/admin/salao', icone: Armchair, tecla: 'Alt+S' },
  { texto: 'Pedidos', path: '/admin/pedidos', icone: Receipt, tecla: 'Alt+M' },
  { texto: 'Usuários', path: '/admin/usuarios', icone: UserCog, tecla: 'Alt+U' },
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarColapsada, setSidebarColapsada] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [commandAberto, setCommandAberto] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [alertaTempoSalao, setAlertaTempoSalao] = useState<AlertaTempoSalao>({ acabando: 0, vencidas: 0 })
  const [alertasMesaAtivos, setAlertasMesaAtivos] = useState(true)
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfigItem[] | null>(null)
  const [visibilidadeGlobal, setVisibilidadeGlobal] = useState<ConfigVisibilidadeTela[]>([])
  const [personalizarAberto, setPersonalizarAberto] = useState(false)
  const [salvandoSidebar, setSalvandoSidebar] = useState(false)
  const [maisAberto, setMaisAberto] = useState(false)
  const mesasAvisadasRef = useRef<Set<string>>(new Set())
  const alertasMesaAtivosRef = useRef(true)
  const mainRef = useRef<HTMLElement | null>(null)
  const sidebarNavRef = useRef<HTMLElement | null>(null)
  const sidebarScrollTopRef = useRef(0)
  const { logout, usuarioAtual } = useAdminAuth()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const temaEscuroAtivo = (resolvedTheme || theme) === 'dark'
  const estiloLayout = {
    '--largura-sidebar-admin': `${sidebarColapsada ? LARGURA_COLAPSADA : LARGURA_ABERTA}px`,
  } as CSSProperties

  const fecharSidebarMobile = useCallback(() => setSidebarOpen(false), [])
  const handleAbrirPersonalizar = useCallback(() => {
    setSidebarOpen(false)
    setMaisAberto(false)
    setPersonalizarAberto(true)
  }, [])
  const navegarPara = useCallback((path: string) => {
    setCommandAberto(false)
    setUserMenuOpen(false)
    setSidebarOpen(false)
    setMaisAberto(false)
    router.push(path)
  }, [router])

  const sidebarMesclada = useMemo(
    () => mesclarConfigSidebar(sidebarConfig),
    [sidebarConfig],
  )

  const idsOcultosGlobais = useMemo(
    () => new Set(visibilidadeGlobal.filter((item) => !item.visible).map((item) => item.id)),
    [visibilidadeGlobal],
  )

  const gruposMenuVisiveis = useMemo(
    () =>
      sidebarMesclada.visiveis
        .map((grupo) => ({
          ...grupo,
          itens: grupo.itens.filter((item) => telaEstaVisivel(visibilidadeGlobal, item.id)),
        }))
        .filter((grupo) => grupo.itens.length > 0),
    [sidebarMesclada.visiveis, visibilidadeGlobal],
  )

  const itensOcultos = useMemo(
    () => sidebarMesclada.ocultos.filter((item) => telaEstaVisivel(visibilidadeGlobal, item.id)),
    [sidebarMesclada.ocultos, visibilidadeGlobal],
  )

  const atalhosVisiveis = useMemo(
    () => atalhosHeader.filter((item) => telaEstaVisivel(visibilidadeGlobal, item.path)),
    [visibilidadeGlobal],
  )

  const itensCommand = useMemo(() => {
    const atalhosPaths = new Set(atalhosVisiveis.map((item) => item.path))
    return [
      ...atalhosVisiveis,
      ...ITENS_MENU_ADMIN
        .filter(
          (item) =>
            !atalhosPaths.has(item.path) && telaEstaVisivel(visibilidadeGlobal, item.path),
        )
        .map((item) => ({ ...item, tecla: '' })),
    ]
  }, [atalhosVisiveis, visibilidadeGlobal])

  useEffect(() => {
    let cancelado = false
    const carregar = async () => {
      try {
        const resposta = await fetch('/api/dzn/visibilidade')
        const json = (await resposta.json()) as { sucesso?: boolean; config?: unknown }
        if (!cancelado && resposta.ok && json.sucesso) {
          setVisibilidadeGlobal(normalizarConfigVisibilidade(json.config) ?? [])
        }
      } catch {
        /* mantém todas as telas visíveis */
      }
    }

    void carregar()
    return () => {
      cancelado = true
    }
  }, [])

  useLayoutEffect(() => {
    const usuarioId = usuarioAtual?.id
    if (!usuarioId) {
      setSidebarConfig(null)
      return
    }

    const cache = lerCacheSidebarConfig(usuarioId)
    if (cache !== null) {
      setSidebarConfig(cache)
    }

    let cancelado = false
    const carregar = async () => {
      try {
        const resposta = await fetch(
          `/api/admin/sidebar-config?usuarioId=${encodeURIComponent(usuarioId)}`,
        )
        const json = (await resposta.json()) as {
          sucesso?: boolean
          config?: SidebarConfigItem[]
        }
        if (cancelado) return
        if (resposta.ok && json.sucesso) {
          const config = Array.isArray(json.config) ? json.config : []
          setSidebarConfig(config)
          gravarCacheSidebarConfig(usuarioId, config)
          return
        }
        setSidebarConfig([])
        gravarCacheSidebarConfig(usuarioId, [])
      } catch {
        if (!cancelado) {
          if (cache === null) setSidebarConfig([])
        }
      }
    }

    void carregar()
    return () => {
      cancelado = true
    }
  }, [usuarioAtual?.id])

  const handleSalvarSidebarConfig = useCallback(
    async (config: SidebarConfigItem[]) => {
      const usuarioId = usuarioAtual?.id
      if (!usuarioId) throw new Error('Usuário não autenticado')
      setSalvandoSidebar(true)
      const configAnterior = sidebarConfig
      setSidebarConfig(config)
      try {
        const resposta = await fetch('/api/admin/sidebar-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuarioId, config }),
        })
        const json = (await resposta.json()) as {
          sucesso?: boolean
          config?: SidebarConfigItem[]
          erro?: string
        }
        if (!resposta.ok || !json.sucesso) {
          throw new Error(json.erro || 'Não foi possível salvar')
        }
        const configFinal = Array.isArray(json.config) ? json.config : config
        setSidebarConfig(configFinal)
        gravarCacheSidebarConfig(usuarioId, configFinal)
        toast.success('Sidebar personalizada')
      } catch (erro) {
        setSidebarConfig(configAnterior)
        toast.error(erro instanceof Error ? erro.message : 'Falha ao salvar sidebar')
        throw erro
      } finally {
        setSalvandoSidebar(false)
      }
    },
    [usuarioAtual?.id, sidebarConfig],
  )

  const handleRestaurarSidebarConfig = useCallback(async () => {
    const usuarioId = usuarioAtual?.id
    if (!usuarioId) throw new Error('Usuário não autenticado')
    setSalvandoSidebar(true)
    try {
      const resposta = await fetch(
        `/api/admin/sidebar-config?usuarioId=${encodeURIComponent(usuarioId)}`,
        { method: 'DELETE' },
      )
      const json = (await resposta.json()) as { sucesso?: boolean; erro?: string }
      if (!resposta.ok || !json.sucesso) {
        throw new Error(json.erro || 'Não foi possível restaurar')
      }
      setSidebarConfig([])
      gravarCacheSidebarConfig(usuarioId, [])
      toast.success('Sidebar restaurada')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao restaurar sidebar')
      throw erro
    } finally {
      setSalvandoSidebar(false)
    }
  }, [usuarioAtual?.id])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const valorSalvo = window.localStorage.getItem(CHAVE_SIDEBAR_COLAPSADA)
      if (valorSalvo === 'true' || valorSalvo === 'false') {
        setSidebarColapsada(valorSalvo === 'true')
      } else {
        setSidebarColapsada(window.innerWidth < 1280)
      }
      const alertasSalvos = window.localStorage.getItem(CHAVE_ALERTAS_MESA)
      const alertasAtivos = alertasSalvos !== '0'
      setAlertasMesaAtivos(alertasAtivos)
      alertasMesaAtivosRef.current = alertasAtivos
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    alertasMesaAtivosRef.current = alertasMesaAtivos
  }, [alertasMesaAtivos])

  const handleAlternarAlertasMesa = () => {
    setAlertasMesaAtivos((atual) => {
      const novo = !atual
      try {
        window.localStorage.setItem(CHAVE_ALERTAS_MESA, novo ? '1' : '0')
      } catch {
        /* ignore */
      }
      return novo
    })
  }

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    window.localStorage.setItem(CHAVE_SIDEBAR_COLAPSADA, String(sidebarColapsada))
  }, [mounted, sidebarColapsada])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  useLayoutEffect(() => {
    const nav = sidebarNavRef.current
    if (!nav) return
    nav.scrollTop = sidebarScrollTopRef.current
  }, [pathname])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return

    const aoPressionarTecla = (event: KeyboardEvent) => {
      const tecla = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && tecla === 'k') {
        event.preventDefault()
        setCommandAberto(true)
        return
      }

      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return

      const atalho = atalhosVisiveis.find((item) => item.tecla.toLowerCase().endsWith(tecla))
      if (!atalho) return

      event.preventDefault()
      navegarPara(atalho.path)
    }

    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [atalhosVisiveis, mounted, navegarPara])

  useEffect(() => {
    if (!mounted) return

    let ativo = true

    const verificarTempoSalao = async () => {
      const { data, error } = await supabase
        .from('mesas')
        .select('id, numero, identificador, liberar_em')
        .eq('tipo', 'mesa')
        .eq('status', 'ocupada')
        .not('liberar_em', 'is', null)

      if (error) {
        console.error('[AdminLayout] Erro ao verificar tempo do salão:', error)
        return
      }

      const agora = Date.now()
      const mesas = (data || []).map((mesa) => ({
        id: String(mesa.id),
        numero: Number(mesa.numero || 0),
        identificador: mesa.identificador ? String(mesa.identificador) : null,
        liberar_em: mesa.liberar_em ? String(mesa.liberar_em) : null,
      })) satisfies MesaTempoSalao[]

      const acabando: MesaTempoSalao[] = []
      const vencidas: MesaTempoSalao[] = []

      mesas.forEach((mesa) => {
        if (!mesa.liberar_em) return
        const liberarEm = new Date(mesa.liberar_em).getTime()
        if (Number.isNaN(liberarEm)) return

        const minutosRestantes = Math.ceil((liberarEm - agora) / 60000)
        if (minutosRestantes <= 0) {
          vencidas.push(mesa)
          return
        }
        if (minutosRestantes <= TEMPO_AVISO_MESA_MINUTOS) acabando.push(mesa)
      })

      if (!ativo) return
      setAlertaTempoSalao({ acabando: acabando.length, vencidas: vencidas.length })

      if (!alertasMesaAtivosRef.current) return

      const usuarioJaEstaNoFluxo = pathname?.startsWith('/admin/salao') || pathname?.startsWith('/admin/mesas')

      if (!usuarioJaEstaNoFluxo && acabando.length > 0) {
        const chave = `acabando:${acabando.map((mesa) => `${mesa.id}:${mesa.liberar_em}`).join('|')}`
        if (!mesasAvisadasRef.current.has(chave)) {
          mesasAvisadasRef.current.add(chave)
          toast.warning(
            `${acabando.length} mesa${acabando.length === 1 ? '' : 's'} perto do limite`,
            {
              description: formatarMesasAlerta(acabando),
              duration: 6500,
              closeButton: true,
              dismissible: true,
              action: {
                label: 'Ver salão',
                onClick: () => router.push('/admin/salao'),
              },
            },
          )
        }
      }

      if (!usuarioJaEstaNoFluxo && vencidas.length > 0) {
        const chave = `vencida:${vencidas.map((mesa) => `${mesa.id}:${mesa.liberar_em}`).join('|')}`
        if (!mesasAvisadasRef.current.has(chave)) {
          mesasAvisadasRef.current.add(chave)
          toast.error(`${vencidas.length} mesa${vencidas.length === 1 ? '' : 's'} com tempo vencido`, {
            description: formatarMesasAlerta(vencidas),
            duration: 8000,
            closeButton: true,
            dismissible: true,
            action: {
              label: 'Ver salão',
              onClick: () => router.push('/admin/salao'),
            },
          })
        }
      }
    }

    void verificarTempoSalao()
    const intervalo = window.setInterval(() => {
      void verificarTempoSalao()
    }, 60000)

    return () => {
      ativo = false
      window.clearInterval(intervalo)
    }
  }, [mounted, pathname, router])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [sidebarOpen])

  const nomeUsuario = usuarioAtual?.nome || 'Administrador'
  const avatarUrl = usuarioAtual?.avatar_url
  const corAvatar = usuarioAtual?.cor_avatar
  const papelUsuario = usuarioAtual?.papel || 'admin'

  const getPageTitle = () => {
    const itemExato = ITENS_MENU_ADMIN.find((item) => pathname === item.path)
    if (itemExato) return itemExato.texto

    if (pathname?.includes('/admin/pedidos/') && pathname?.includes('/editar')) return 'Editar pedido'
    if (pathname?.includes('/admin/pedidos/')) return 'Detalhes do pedido'
    if (pathname === '/admin/caixa/relatorios') return 'Relatórios de caixa'

    return 'Admin'
  }

  type SidebarContentProps = {
    colapsada?: boolean
    onToggle?: () => void
    mobile?: boolean
  }

  const renderSidebarContent = ({ colapsada = false, onToggle, mobile = false }: SidebarContentProps) => (
    <div className={cn('flex h-full flex-col bg-sidebar text-sidebar-foreground')}>
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-sidebar-border',
          colapsada ? 'h-16 justify-center px-2' : 'h-14 gap-3 px-3',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent/40',
            colapsada ? 'size-10' : 'size-9',
          )}
        >
          <Image
            src="/logo.webp"
            alt="Bar da Ladeira"
            width={28}
            height={28}
            className={cn('rounded-sm object-contain', colapsada ? 'size-7' : 'size-7')}
            priority
          />
        </div>

        {!colapsada && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">Bar da Ladeira</p>
            <p className="truncate text-[11px] text-muted-foreground">Painel operacional</p>
          </div>
        )}

        {mobile && (
          <button
            onClick={fecharSidebarMobile}
            className="ml-auto flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Fechar menu"
          >
            <X strokeWidth={1.6} className="size-[18px]" />
          </button>
        )}
      </div>

      <nav
        ref={mobile ? undefined : sidebarNavRef}
        onScroll={
          mobile
            ? undefined
            : (event) => {
                sidebarScrollTopRef.current = event.currentTarget.scrollTop
              }
        }
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin',
          colapsada ? 'px-2 py-3' : 'space-y-4 px-2 py-3',
        )}
      >
        {gruposMenuVisiveis.map((grupo, grupoIndex) => (
          <div
            key={grupo.titulo}
            className={cn(
              'flex flex-col',
              colapsada ? 'mb-2 gap-1' : 'gap-0.5',
              colapsada && grupoIndex > 0 && 'border-t border-sidebar-border/80 pt-2',
            )}
          >
            {!colapsada && (
              <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                {grupo.titulo}
              </p>
            )}
            {colapsada && (
              <p className="px-1 pb-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {grupo.titulo === 'Operações'
                  ? 'OPS'
                  : grupo.titulo === 'Operação'
                    ? 'OP'
                    : grupo.titulo === 'Catálogo e canais'
                      ? 'CAT'
                      : grupo.titulo === 'Análise'
                        ? 'AN'
                        : grupo.titulo.slice(0, 3)}
              </p>
            )}

            <div className={cn('flex flex-col', colapsada ? 'gap-1' : 'gap-0.5')}>
              {grupo.itens.map((item) => {
                const isActive = isRotaAtivaSidebar(item.path, pathname)
                const Icone = item.icone
                const mostrarAlertaSalao = item.path === '/admin/salao' && (alertaTempoSalao.acabando > 0 || alertaTempoSalao.vencidas > 0)
                const totalAlertasSalao = alertaTempoSalao.acabando + alertaTempoSalao.vencidas

                const link = (
                  <Link
                    href={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={colapsada ? item.texto : undefined}
                    onClick={() => {
                      if (!mobile && sidebarNavRef.current) {
                        sidebarScrollTopRef.current = sidebarNavRef.current.scrollTop
                      }
                      if (mobile) fecharSidebarMobile()
                    }}
                    className={cn(
                      'group relative flex items-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      colapsada
                        ? 'h-10 w-full justify-center'
                        : 'h-9 gap-2.5 border-l-[3px] px-3',
                      mobile && 'min-h-11',
                      colapsada
                        ? isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        : isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {colapsada && isActive && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary"
                        aria-hidden
                      />
                    )}
                    <span className="relative flex shrink-0">
                      <Icone
                        strokeWidth={isActive ? 1.85 : 1.6}
                        className={cn(
                          'size-[18px] shrink-0',
                          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      />
                      {mostrarAlertaSalao && colapsada && (
                        <span className="absolute -right-1.5 -top-1.5 flex size-2.5 rounded-full bg-destructive ring-2 ring-sidebar" />
                      )}
                    </span>
                    {!colapsada && <span className="truncate">{item.texto}</span>}
                    {mostrarAlertaSalao && !colapsada && (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                        {totalAlertasSalao > 9 ? '9+' : totalAlertasSalao}
                      </span>
                    )}
                  </Link>
                )

                if (colapsada) {
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {mostrarAlertaSalao ? (
                          <span className="inline-flex items-center gap-2">
                            <AlertTriangle className="size-3.5 text-destructive" />
                            {item.texto}: {totalAlertasSalao} alerta{totalAlertasSalao === 1 ? '' : 's'}
                          </span>
                        ) : (
                          item.texto
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return <Fragment key={item.path}>{link}</Fragment>
              })}
            </div>
          </div>
        ))}

        {itensOcultos.length > 0 && (
          <div
            className={cn(
              'flex flex-col gap-1',
              colapsada ? 'mt-1 border-t border-sidebar-border/80 pt-2' : 'pt-1',
            )}
          >
            {!colapsada && (
              <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                Mais
              </p>
            )}
            {mobile ? (
              <>
                <button
                  type="button"
                  onClick={() => setMaisAberto((aberto) => !aberto)}
                  aria-expanded={maisAberto}
                  aria-controls="sidebar-mais-itens-mobile"
                  className={cn(
                    'flex w-full items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    'h-9 min-h-11 gap-2.5 border-l-[3px] border-transparent px-3',
                    maisAberto && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )}
                  aria-label="Mais itens do menu"
                >
                  <MoreHorizontal strokeWidth={1.6} className="size-[18px] shrink-0" />
                  <span>Mais</span>
                </button>
                {maisAberto ? (
                  <div
                    id="sidebar-mais-itens-mobile"
                    className="flex flex-col gap-0.5 border-l border-sidebar-border/80 pb-1 pl-2"
                    role="group"
                    aria-label="Itens ocultos do menu"
                  >
                    {itensOcultos.map((item) => {
                      const Icone = item.icone
                      const isActive = isRotaAtivaSidebar(item.path, pathname)
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={() => {
                            setMaisAberto(false)
                            fecharSidebarMobile()
                          }}
                          className={cn(
                            'flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                            isActive
                              ? 'bg-primary/10 font-medium text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Icone strokeWidth={1.6} className="size-4 shrink-0" />
                          <span className="truncate">{item.texto}</span>
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              <Popover modal={false} open={maisAberto} onOpenChange={setMaisAberto}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      colapsada ? 'h-10 justify-center' : 'h-9 gap-2.5 border-l-[3px] border-transparent px-3',
                    )}
                    aria-label="Mais itens do menu"
                  >
                    <MoreHorizontal strokeWidth={1.6} className="size-[18px] shrink-0" />
                    {!colapsada && <span>Mais</span>}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side={colapsada ? 'right' : 'top'}
                  align="start"
                  sideOffset={8}
                  className="z-[1100] w-56 p-1"
                >
                  <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                    {itensOcultos.map((item) => {
                      const Icone = item.icone
                      const isActive = isRotaAtivaSidebar(item.path, pathname)
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={() => setMaisAberto(false)}
                          className={cn(
                            'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                            isActive
                              ? 'bg-primary/10 font-medium text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Icone strokeWidth={1.6} className="size-4 shrink-0" />
                          <span className="truncate">{item.texto}</span>
                        </Link>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </nav>

      <div
        className={cn(
          'shrink-0 border-t border-sidebar-border',
          colapsada ? 'flex flex-col items-center gap-1 p-2' : 'space-y-1 p-2',
        )}
      >
        {colapsada ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex size-10 items-center justify-center">
                <AvatarUsuario
                  nome={nomeUsuario}
                  src={avatarUrl}
                  cor={corAvatar}
                  size="sm"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <span className="block font-medium">{nomeUsuario}</span>
              <span className="block capitalize text-muted-foreground">{papelUsuario}</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <AvatarUsuario
              nome={nomeUsuario}
              src={avatarUrl}
              cor={corAvatar}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{nomeUsuario}</p>
              <p className="truncate text-[11px] capitalize text-muted-foreground">{papelUsuario}</p>
            </div>
          </div>
        )}

        {colapsada ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleAbrirPersonalizar}
                className={cn(
                  'flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  mobile && 'min-h-11 min-w-11',
                )}
                aria-label="Personalizar sidebar"
              >
                <Settings2 strokeWidth={1.6} className="size-[18px] shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Personalizar</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={handleAbrirPersonalizar}
            className={cn(
              'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              mobile && 'min-h-11',
            )}
            aria-label="Personalizar sidebar"
          >
            <Settings2 strokeWidth={1.6} className="size-[18px] shrink-0" />
            <span>Personalizar</span>
          </button>
        )}

        {colapsada ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className={cn(
                  'flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  mobile && 'min-h-11 min-w-11',
                )}
                aria-label="Sair"
              >
                <LogOut strokeWidth={1.6} className="size-[18px] shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Sair</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={logout}
            className={cn(
              'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              mobile && 'min-h-11',
            )}
          >
            <LogOut strokeWidth={1.6} className="size-[18px] shrink-0" />
            <span>Sair</span>
          </button>
        )}

        {onToggle && (
          colapsada ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-label="Expandir sidebar"
                >
                  <PanelLeftOpen strokeWidth={1.6} className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Expandir sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={onToggle}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <PanelLeftClose strokeWidth={1.6} className="size-[18px]" />
              <span>Recolher</span>
            </button>
          )
        )}
      </div>
    </div>
  )

  if (!mounted) return null

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex h-[100dvh] overflow-hidden bg-background" style={estiloLayout}>
      {/* Sidebar desktop */}
      <aside
        className={cn(
          'hidden border-r border-sidebar-border bg-sidebar shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-[width] duration-300 ease-out md:fixed md:inset-y-0 md:z-30 md:flex md:w-[var(--largura-sidebar-admin)] md:flex-col dark:shadow-[0_1px_3px_rgba(0,0,0,0.1)]',
        )}
      >
        {renderSidebarContent({
          colapsada: sidebarColapsada,
          onToggle: () => setSidebarColapsada(!sidebarColapsada),
        })}
      </aside>

      <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DrawerContent className="h-[96dvh] max-h-[96dvh] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground md:hidden">
          <div className="flex shrink-0 justify-end px-1">
            <DrawerClose
              aria-label="Fechar menu"
              className="flex h-11 w-11 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <X strokeWidth={1.6} className="size-5" />
              <span className="sr-only">Fechar menu</span>
            </DrawerClose>
          </div>
          <DrawerTitle className="sr-only">Menu administrativo</DrawerTitle>
          <DrawerDescription className="sr-only">
            Navegue pelas áreas do painel operacional.
          </DrawerDescription>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {renderSidebarContent({ colapsada: false, mobile: true })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Conteúdo */}
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300 ease-out md:ml-[var(--largura-sidebar-admin)]"
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Abrir menu"
          >
            <Menu strokeWidth={1.6} className="size-[18px]" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {getPageTitle()}
            </h1>
          </div>

          <div className="hidden items-center gap-1 lg:flex">
            {atalhosVisiveis.slice(0, 4).map((atalho) => {
              const Icone = atalho.icone
              const ativo = isRotaAtivaSidebar(atalho.path, pathname)
              return (
                <Tooltip key={atalho.path}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => navegarPara(atalho.path)}
                      aria-label={`${atalho.texto} (${atalho.tecla})`}
                      className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaryBlue/40',
                        ativo
                          ? 'bg-primaryBlue/[0.08] text-primaryBlue dark:bg-primaryBlue/[0.12]'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Icone strokeWidth={1.6} className="size-[17px]" />
                      <span>{atalho.texto}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {atalho.texto} · {atalho.tecla}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCommandAberto(true)}
                  className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-label="Abrir atalhos e busca do painel"
                >
                  <Search strokeWidth={1.6} className="size-[18px]" />
                  <span className="hidden sm:inline">Atalhos</span>
                  <kbd className="hidden rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground xl:inline">
                    ⌘K
                  </kbd>
                </button>
              </TooltipTrigger>
              <TooltipContent>Buscar tela ou ação · Ctrl/Cmd+K</TooltipContent>
            </Tooltip>

            <button
              onClick={() => setTheme(temaEscuroAtivo ? 'light' : 'dark')}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={temaEscuroAtivo ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {temaEscuroAtivo ? (
                <Sun strokeWidth={1.6} className="size-[18px]" />
              ) : (
                <Moon strokeWidth={1.6} className="size-[18px]" />
              )}
            </button>

            <CentralNotificacoes />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex h-9 items-center gap-2 rounded-md px-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Menu do usuário"
                aria-expanded={userMenuOpen}
              >
                <AvatarUsuario
                  nome={nomeUsuario}
                  src={avatarUrl}
                  cor={corAvatar}
                  size="xs"
                  className="size-7"
                />
                <span className="hidden max-w-[120px] truncate lg:block">{nomeUsuario}</span>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border/70 bg-popover py-1 shadow-md">
                    <div className="border-b border-border/70 px-3 py-2.5">
                      <p className="truncate text-sm font-medium text-foreground">{nomeUsuario}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {papelUsuario}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAlternarAlertasMesa}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-pressed={alertasMesaAtivos}
                      aria-label={alertasMesaAtivos ? 'Desligar alertas de mesa' : 'Ligar alertas de mesa'}
                    >
                      {alertasMesaAtivos ? (
                        <Bell strokeWidth={1.6} className="size-4" />
                      ) : (
                        <BellOff strokeWidth={1.6} className="size-4" />
                      )}
                      <span className="flex-1 text-left">Alertas de mesa</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          alertasMesaAtivos
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {alertasMesaAtivos ? 'On' : 'Off'}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        logout()
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <LogOut strokeWidth={1.6} className="size-4" />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <Dialog open={commandAberto} onOpenChange={setCommandAberto}>
          <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Atalhos do painel</DialogTitle>
              <DialogDescription>Busque telas e ações administrativas.</DialogDescription>
            </DialogHeader>
            <Command>
              <CommandInput placeholder="Buscar tela, ação ou atalho..." />
              <CommandList>
                <CommandEmpty>Nenhum atalho encontrado.</CommandEmpty>
                <CommandGroup heading="Atalhos rápidos">
                  {itensCommand.map((item) => {
                    const Icone = item.icone
                    return (
                      <CommandItem
                        key={item.path}
                        value={`${item.texto} ${item.path} ${item.tecla}`}
                        onSelect={() => navegarPara(item.path)}
                        className="cursor-pointer"
                      >
                        <Icone strokeWidth={1.6} className="mr-2 size-4" />
                        <span className="flex-1">{item.texto}</span>
                        {item.tecla && (
                          <kbd className="rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {item.tecla}
                          </kbd>
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>

        <main
          ref={mainRef}
          data-admin-scroll-container
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-6"
        >
          <div className="w-full max-w-full min-w-0">{children}</div>
        </main>
      </div>
    </div>

    <SidebarPersonalizarModal
      aberto={personalizarAberto}
      onFechar={() => setPersonalizarAberto(false)}
      configSalva={sidebarConfig}
      onSalvar={handleSalvarSidebarConfig}
      onRestaurar={handleRestaurarSidebarConfig}
      salvando={salvandoSidebar}
      idsOcultosGlobais={idsOcultosGlobais}
    />
    </TooltipProvider>
  )
}
