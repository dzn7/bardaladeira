'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2, LogOut, ShieldCheck, UserRoundCog } from 'lucide-react'
import { toast } from 'sonner'
import Interruptor from '@/components/admin/Interruptor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ITENS_MENU_ADMIN } from '@/lib/admin-sidebar-routes'
import GerenciadorPermissoesEquipe from '@/components/admin/GerenciadorPermissoesEquipe'
import {
  TELAS_GARCOM,
  normalizarConfigVisibilidade,
  telaEstaVisivel,
  type ConfigVisibilidadeTela,
} from '@/lib/visibilidade-telas'

type RespostaVisibilidade = {
  sucesso?: boolean
  config?: unknown
  erro?: string
}

type PerfilAtivo = 'admin' | 'garcom'
type SecaoAtiva = 'telas' | 'acessos'

const gruposAdmin = Array.from(new Set(ITENS_MENU_ADMIN.map((item) => item.categoria)))

export default function GerenciadorVisibilidadeTelas() {
  const [nomeUsuario, setNomeUsuario] = useState('dzn')
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [autenticando, setAutenticando] = useState(false)
  const [config, setConfig] = useState<ConfigVisibilidadeTela[]>([])
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [perfilAtivo, setPerfilAtivo] = useState<PerfilAtivo>('admin')
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoAtiva>('telas')

  const totalAdminAtivo = useMemo(
    () => ITENS_MENU_ADMIN.filter((item) => telaEstaVisivel(config, item.id)).length,
    [config],
  )
  const totalGarcomAtivo = useMemo(
    () => TELAS_GARCOM.filter((item) => telaEstaVisivel(config, item.id)).length,
    [config],
  )

  const autenticar = async (event: FormEvent) => {
    event.preventDefault()
    setAutenticando(true)
    try {
      const resposta = await fetch('/api/dzn/visibilidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeUsuario, senha }),
      })
      const json = (await resposta.json()) as RespostaVisibilidade
      if (!resposta.ok || !json.sucesso) {
        throw new Error(json.erro || 'Não foi possível entrar.')
      }

      setConfig(normalizarConfigVisibilidade(json.config) ?? [])
      setAutenticado(true)
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao entrar.')
    } finally {
      setAutenticando(false)
    }
  }

  const alternarTela = async (id: string, visible: boolean) => {
    const anterior = config
    const proxima = [...config.filter((item) => item.id !== id), { id, visible }]
    setConfig(proxima)
    setSalvandoId(id)

    try {
      const resposta = await fetch('/api/dzn/visibilidade', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeUsuario, senha, config: proxima }),
      })
      const json = (await resposta.json()) as RespostaVisibilidade
      if (!resposta.ok || !json.sucesso) {
        throw new Error(json.erro || 'Não foi possível salvar.')
      }

      setConfig(normalizarConfigVisibilidade(json.config) ?? proxima)
      toast.success(visible ? 'Tela ativada.' : 'Tela ocultada.')
    } catch (erro) {
      setConfig(anterior)
      toast.error(erro instanceof Error ? erro.message : 'Falha ao salvar.')
    } finally {
      setSalvandoId(null)
    }
  }

  const sair = () => {
    setAutenticado(false)
    setSenha('')
    setConfig([])
    setSecaoAtiva('telas')
  }

  if (!autenticado) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <form
          onSubmit={autenticar}
          className="w-full max-w-sm space-y-5 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="space-y-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="size-6 text-primary" strokeWidth={1.6} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">DZN</h1>
              <p className="mt-1 text-sm text-muted-foreground">Controle de telas do sistema</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="dzn-usuario" className="text-sm font-medium text-foreground">
                Usuário
              </label>
              <Input
                id="dzn-usuario"
                value={nomeUsuario}
                onChange={(event) => setNomeUsuario(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dzn-senha" className="text-sm font-medium text-foreground">
                Senha
              </label>
              <Input
                id="dzn-senha"
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                autoComplete="current-password"
                minLength={4}
                required
              />
            </div>
          </div>

          <Button type="submit" className="h-11 w-full" disabled={autenticando}>
            {autenticando ? <Loader2 className="size-4 animate-spin" /> : null}
            Entrar
          </Button>
        </form>
      </div>
    )
  }

  const renderLinha = (item: { id: string; texto: string }) => {
    const visivel = telaEstaVisivel(config, item.id)
    const salvando = salvandoId === item.id

    return (
      <div
        key={item.id}
        className="flex min-h-16 items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {visivel ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{item.texto}</p>
            <p className="truncate text-xs text-muted-foreground">{item.id}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {salvando ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          <Interruptor
            ativado={visivel}
            aoAlternar={(novoValor) => void alternarTela(item.id, novoValor)}
            desabilitado={salvandoId !== null}
            tamanho="md"
            aria-label={`${visivel ? 'Ocultar' : 'Mostrar'} ${item.texto}`}
          />
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-dvh bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <ShieldCheck className="size-6 text-primary" strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                  Superadmin DZN
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Telas, permissões e manutenção.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={sair}>
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        </header>

        <Tabs value={secaoAtiva} onValueChange={(valor) => setSecaoAtiva(valor as SecaoAtiva)}>
          <TabsList className="grid h-auto w-full grid-cols-2 p-1 sm:w-96">
            <TabsTrigger value="telas" className="min-h-11">
              <Eye className="mr-1.5 size-4" /> Telas
            </TabsTrigger>
            <TabsTrigger value="acessos" className="min-h-11">
              <UserRoundCog className="mr-1.5 size-4" /> Acessos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="telas" className="mt-4">
            <Tabs value={perfilAtivo} onValueChange={(valor) => setPerfilAtivo(valor as PerfilAtivo)}>
              <TabsList className="grid h-auto w-full grid-cols-2 p-1 sm:w-80">
                <TabsTrigger value="admin" className="min-h-11">
                  Admin · {totalAdminAtivo}/{ITENS_MENU_ADMIN.length}
                </TabsTrigger>
                <TabsTrigger value="garcom" className="min-h-11">
                  Garçom · {totalGarcomAtivo}/{TELAS_GARCOM.length}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="admin" className="mt-4 space-y-4">
                {gruposAdmin.map((grupo) => (
                  <section key={grupo} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                    <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {grupo}
                      </h2>
                    </div>
                    {ITENS_MENU_ADMIN.filter((item) => item.categoria === grupo).map(renderLinha)}
                  </section>
                ))}
              </TabsContent>

              <TabsContent value="garcom" className="mt-4">
                <section className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  {TELAS_GARCOM.map(renderLinha)}
                </section>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="acessos" className="mt-4">
            <GerenciadorPermissoesEquipe
              modo="dzn"
              credenciaisDzn={{ nomeUsuario, senha }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
