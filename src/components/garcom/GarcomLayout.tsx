'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardList, PlusCircle, Sun, Moon, LogOut, Loader2, ShieldX, Wrench } from 'lucide-react'
import { useTheme } from 'next-themes'
import { obterSessao, limparSessao } from '@/lib/autenticacao'
import IconeMesa from '@/components/icons/IconeMesa'
import {
  TELAS_GARCOM,
  normalizarConfigVisibilidade,
  telaEstaVisivel,
  type ConfigVisibilidadeTela,
} from '@/lib/visibilidade-telas'
import { useControleAcesso } from '@/contexts/ControleAcessoContext'
import { obterRegraRota } from '@/lib/controle-acesso'

type Props = {
  children: ReactNode
}

const MENU_GARCOM = [
  { ...TELAS_GARCOM[0], icon: IconeMesa },
  { ...TELAS_GARCOM[1], icon: ClipboardList },
  { ...TELAS_GARCOM[2], icon: PlusCircle },
]

export default function GarcomLayout({ children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [visibilidadeGlobal, setVisibilidadeGlobal] = useState<ConfigVisibilidadeTela[]>([])
  const { carregando: carregandoAcesso, pode, emManutencao } = useControleAcesso()

  useEffect(() => {
    setMounted(true)
    const sessao = obterSessao()
    if (sessao) setNomeUsuario(sessao.nome)
  }, [])

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

  useEffect(() => {
    const linkManifest = document.querySelector('link[rel="manifest"]')
    if (linkManifest) {
      linkManifest.setAttribute('href', '/manifest-garcom.json')
    } else {
      const newLink = document.createElement('link')
      newLink.rel = 'manifest'
      newLink.href = '/manifest-garcom.json'
      document.head.appendChild(newLink)
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', '#ea580c')
    }
  }, [])

  const handleLogout = () => {
    limparSessao()
    localStorage.removeItem('garcomToken')
    router.push('/garcom/login')
  }

  const menuItems = useMemo(
    () =>
      MENU_GARCOM
        .filter((item) => {
          if (!telaEstaVisivel(visibilidadeGlobal, item.id)) return false
          if (item.id === '/garcom/mesas') {
            return pode('garcom.mesas', 'ver') && !emManutencao('garcom.mesas')
          }
          if (item.id === '/garcom/novo') {
            return pode('garcom.pedidos', 'criar') && !emManutencao('garcom.pedidos')
          }
          return pode('garcom.pedidos', 'ver') && !emManutencao('garcom.pedidos')
        })
        .map((item) => ({ href: item.id, label: item.texto, icon: item.icon })),
    [emManutencao, pode, visibilidadeGlobal],
  )

  const regraRota = obterRegraRota(pathname)
  const rotaEmManutencao = regraRota ? emManutencao(regraRota.modulo) : false
  const rotaPermitida = regraRota ? pode(regraRota.modulo, regraRota.acao) : true

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  if (carregandoAcesso) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    )
  }

  if (rotaEmManutencao || !rotaPermitida) {
    const Icone = rotaEmManutencao ? Wrench : ShieldX
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
            <Icone className="size-6 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            {rotaEmManutencao ? 'Módulo em manutenção' : 'Acesso desativado'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rotaEmManutencao ? 'Tente novamente mais tarde.' : 'Fale com o administrador.'}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-border/70 px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Sair
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between min-h-[56px] py-2 gap-2 sm:gap-3">
            <Link href="/garcom" className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.webp"
                alt="Bar da Ladeira"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg shadow-sm"
              />
              <div className="min-w-0 hidden sm:block">
                <h1 className="font-bold text-sm leading-tight truncate text-zinc-900 dark:text-white">Bar da Ladeira</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">Garçom • {nomeUsuario || 'Atendimento'}</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all text-sm font-medium ${
                      isActive
                        ? 'bg-bordo-600 text-white shadow-sm shadow-bordo-600/20'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-1.5">
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  aria-label="Alternar tema"
                >
                  {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
                </button>
              )}
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Sair"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
        {children}
      </main>

      {menuItems.length > 0 ? <footer
        data-barra-navegacao-garcom="mobile"
        className="fixed md:hidden bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-950/80"
      >
        <nav className="flex items-center justify-around py-1.5 px-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.375rem)' }}>
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all min-w-[64px] min-h-[48px] justify-center ${
                  isActive
                    ? 'text-bordo-600 dark:text-dourado-400 bg-bordo-50 dark:bg-dourado-950/20'
                    : 'text-zinc-400 dark:text-zinc-500 active:bg-zinc-100 dark:active:bg-zinc-800'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </footer> : null}

      <style jsx global>{`
        .modal-garcom-aberto [data-barra-navegacao-garcom='mobile'],
        .modal-garcom-aberto [data-acao-rapida-garcom='novo'] {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
