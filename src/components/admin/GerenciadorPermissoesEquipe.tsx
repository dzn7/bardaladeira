'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Loader2, Settings, ShieldCheck, UserRoundCog, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import Interruptor from '@/components/admin/Interruptor'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MODULOS_CONTROLE_ACESSO,
  ROTULOS_ACAO,
  chavePermissao,
  permissoesPadrao,
  resolverPermissoes,
  type AcaoPermissao,
  type ConfigManutencao,
  type ConfigPermissoes,
  type ModuloControleAcesso,
  type PerfilControlado,
} from '@/lib/controle-acesso'

type UsuarioEquipe = {
  id: string
  nome: string
  nome_usuario: string
  papel: PerfilControlado
  ativo: boolean
}

type AtorControle = { nomeUsuario: string; senha: string }

type RespostaPainel = {
  sucesso?: boolean
  erro?: string
  usuarios?: UsuarioEquipe[]
  papeis?: Record<PerfilControlado, ConfigPermissoes>
  usuariosConfig?: Record<string, ConfigPermissoes>
  manutencao?: ConfigManutencao
}

type Props = {
  modo: 'admin' | 'dzn'
  nomeUsuarioAdmin?: string
  credenciaisDzn?: { nomeUsuario: string; senha: string }
}

const rotuloPerfil = (perfil: PerfilControlado) =>
  perfil === 'garcom' ? 'Garçons' : 'Entregadores'

export default function GerenciadorPermissoesEquipe({
  modo,
  nomeUsuarioAdmin = 'admin',
  credenciaisDzn,
}: Props) {
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioEquipe[]>([])
  const [papeis, setPapeis] = useState<Record<PerfilControlado, ConfigPermissoes>>({
    garcom: {},
    entregador: {},
  })
  const [usuariosConfig, setUsuariosConfig] = useState<Record<string, ConfigPermissoes>>({})
  const [manutencao, setManutencao] = useState<ConfigManutencao>({})
  const [perfilAtivo, setPerfilAtivo] = useState<PerfilControlado>('garcom')
  const [usuarioId, setUsuarioId] = useState('')
  const [usuarioAdminInput, setUsuarioAdminInput] = useState(nomeUsuarioAdmin)
  const [senhaAdmin, setSenhaAdmin] = useState('')
  const [credenciaisAdmin, setCredenciaisAdmin] = useState<AtorControle | null>(null)

  const ator = useMemo<AtorControle | null>(() => {
    if (modo === 'dzn') {
      if (!credenciaisDzn) return null
      return credenciaisDzn
    }
    return credenciaisAdmin
  }, [credenciaisAdmin, credenciaisDzn, modo])

  const carregar = useCallback(async () => {
    if (!ator) return
    setCarregando(true)
    try {
      const resposta = await fetch('/api/controle-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ator }),
      })
      const json = (await resposta.json()) as RespostaPainel
      if (!resposta.ok || !json.sucesso) {
        throw new Error(json.erro || 'Falha ao carregar permissões.')
      }

      const lista = json.usuarios ?? []
      setUsuarios(lista)
      setPapeis(json.papeis ?? { garcom: {}, entregador: {} })
      setUsuariosConfig(json.usuariosConfig ?? {})
      setManutencao(json.manutencao ?? {})
      setUsuarioId((atual) => atual || lista[0]?.id || '')
    } catch (erro) {
      if (modo === 'admin') setCredenciaisAdmin(null)
      toast.error(erro instanceof Error ? erro.message : 'Falha ao carregar permissões.')
    } finally {
      setCarregando(false)
    }
  }, [ator, modo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const salvarPayload = async (chave: string, payload: Record<string, unknown>) => {
    if (!ator) return false
    setSalvando(chave)
    try {
      const resposta = await fetch('/api/controle-acesso', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ator, ...payload }),
      })
      const json = (await resposta.json()) as { sucesso?: boolean; erro?: string }
      if (!resposta.ok || !json.sucesso) {
        throw new Error(json.erro || 'Falha ao salvar.')
      }
      return true
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao salvar.')
      return false
    } finally {
      setSalvando(null)
    }
  }

  const alternarPapel = async (
    perfil: PerfilControlado,
    modulo: ModuloControleAcesso,
    acao: AcaoPermissao,
    valor: boolean,
  ) => {
    const chave = chavePermissao(modulo, acao)
    const anterior = papeis[perfil]
    const proxima = { ...permissoesPadrao(perfil), ...anterior, [chave]: valor }
    setPapeis((atual) => ({ ...atual, [perfil]: proxima }))

    const sucesso = await salvarPayload(`papel:${chave}`, {
      tipo: 'papel',
      papel: perfil,
      permissoes: proxima,
    })
    if (!sucesso) {
      setPapeis((atual) => ({ ...atual, [perfil]: anterior }))
      return
    }
    toast.success('Permissão do cargo atualizada.')
  }

  const alterarUsuario = async (
    usuario: UsuarioEquipe,
    modulo: ModuloControleAcesso,
    acao: AcaoPermissao,
    valor: 'herdar' | 'permitir' | 'bloquear',
  ) => {
    const chave = chavePermissao(modulo, acao)
    const anterior = usuariosConfig[usuario.id] ?? {}
    const proxima = { ...anterior }
    if (valor === 'herdar') delete proxima[chave]
    else proxima[chave] = valor === 'permitir'

    setUsuariosConfig((atual) => ({ ...atual, [usuario.id]: proxima }))
    const sucesso = await salvarPayload(`usuario:${usuario.id}:${chave}`, {
      tipo: 'usuario',
      usuarioId: usuario.id,
      permissoes: proxima,
    })
    if (!sucesso) {
      setUsuariosConfig((atual) => ({ ...atual, [usuario.id]: anterior }))
      return
    }
    toast.success('Permissão individual atualizada.')
  }

  const alternarManutencao = async (modulo: ModuloControleAcesso, ativo: boolean) => {
    const anterior = manutencao[modulo] === true
    setManutencao((atual) => ({ ...atual, [modulo]: ativo }))
    const sucesso = await salvarPayload(`manutencao:${modulo}`, {
      tipo: 'manutencao',
      moduloId: modulo,
      ativo,
    })
    if (!sucesso) {
      setManutencao((atual) => ({ ...atual, [modulo]: anterior }))
      return
    }
    toast.success(ativo ? 'Módulo pausado.' : 'Módulo liberado.')
  }

  const usuarioSelecionado = usuarios.find((usuario) => usuario.id === usuarioId) ?? null
  const modulosPerfil = MODULOS_CONTROLE_ACESSO.filter((modulo) => modulo.perfil === perfilAtivo)
  const modulosUsuario = usuarioSelecionado
    ? MODULOS_CONTROLE_ACESSO.filter((modulo) => modulo.perfil === usuarioSelecionado.papel)
    : []

  const renderModuloPapel = (modulo: (typeof MODULOS_CONTROLE_ACESSO)[number]) => {
    const efetivas = resolverPermissoes(modulo.perfil, papeis[modulo.perfil])
    return (
      <section key={modulo.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{modulo.nome}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{modulo.descricao}</p>
        </div>
        {modulo.acoes.map((acao) => {
          const chave = chavePermissao(modulo.id, acao)
          const ativo = efetivas[chave] !== false
          return (
            <div key={acao} className="flex min-h-14 items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0">
              <span className="text-sm font-medium text-foreground">{ROTULOS_ACAO[acao]}</span>
              <div className="flex items-center gap-2">
                {salvando === `papel:${chave}` ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                <Interruptor
                  ativado={ativo}
                  aoAlternar={(valor) => void alternarPapel(modulo.perfil, modulo.id, acao, valor)}
                  desabilitado={salvando !== null}
                  tamanho="md"
                  aria-label={`${ativo ? 'Bloquear' : 'Permitir'} ${ROTULOS_ACAO[acao]} em ${modulo.nome}`}
                />
              </div>
            </div>
          )
        })}
      </section>
    )
  }

  const confirmarAdmin = (event: FormEvent) => {
    event.preventDefault()
    if (senhaAdmin.length < 4) return
    if (!usuarioAdminInput.trim()) return
    setCredenciaisAdmin({ nomeUsuario: usuarioAdminInput.trim(), senha: senhaAdmin })
  }

  if (modo === 'admin' && !credenciaisAdmin) {
    return (
      <form onSubmit={confirmarAdmin} className="mx-auto max-w-sm space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="space-y-1 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <h2 className="pt-2 font-semibold text-foreground">Confirme seu acesso</h2>
          <p className="text-sm text-muted-foreground">Necessário para alterar permissões.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="permissoes-admin-usuario" className="text-sm font-medium text-foreground">Usuário</label>
          <Input
            id="permissoes-admin-usuario"
            value={usuarioAdminInput}
            onChange={(event) => setUsuarioAdminInput(event.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="permissoes-admin-senha" className="text-sm font-medium text-foreground">Senha</label>
          <Input
            id="permissoes-admin-senha"
            type="password"
            value={senhaAdmin}
            onChange={(event) => setSenhaAdmin(event.target.value)}
            autoComplete="current-password"
            minLength={4}
            required
          />
        </div>
        <Button type="submit" className="h-11 w-full">Continuar</Button>
      </form>
    )
  }

  if (carregando || !ator) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-border/70 bg-card">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Permissões da equipe</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Controles visuais por cargo e usuário.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}>
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cargos">
        <TabsList className={`grid h-auto w-full p-1 ${modo === 'dzn' ? 'grid-cols-3' : 'grid-cols-2'} sm:w-auto sm:inline-grid`}>
          <TabsTrigger value="cargos" className="min-h-11">
            <Settings className="mr-1.5 size-4" /> Cargos
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="min-h-11">
            <UserRoundCog className="mr-1.5 size-4" /> Usuários
          </TabsTrigger>
          {modo === 'dzn' ? (
            <TabsTrigger value="manutencao" className="min-h-11">
              <Wrench className="mr-1.5 size-4" /> Manutenção
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="cargos" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-card p-2 sm:max-w-md">
            {(['garcom', 'entregador'] as const).map((perfil) => (
              <Button
                key={perfil}
                type="button"
                variant={perfilAtivo === perfil ? 'default' : 'ghost'}
                onClick={() => setPerfilAtivo(perfil)}
              >
                {rotuloPerfil(perfil)}
              </Button>
            ))}
          </div>
          {modulosPerfil.map(renderModuloPapel)}
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4 space-y-4">
          <section className="rounded-xl border border-border/70 bg-card p-4">
            <label htmlFor="controle-usuario" className="mb-2 block text-sm font-medium text-foreground">
              Usuário da equipe
            </label>
            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger id="controle-usuario" className="w-full sm:max-w-md">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.id} value={usuario.id}>
                    {usuario.nome} · {usuario.papel === 'garcom' ? 'Garçom' : 'Entregador'}
                    {!usuario.ativo ? ' · Inativo' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {usuarioSelecionado ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4">
                <AvatarUsuario nome={usuarioSelecionado.nome} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{usuarioSelecionado.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">@{usuarioSelecionado.nome_usuario}</p>
                </div>
              </div>

              {modulosUsuario.map((modulo) => (
                <section key={modulo.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">{modulo.nome}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Padrão usa a configuração do cargo.</p>
                  </div>
                  {modulo.acoes.map((acao) => {
                    const chave = chavePermissao(modulo.id, acao)
                    const override = usuariosConfig[usuarioSelecionado.id]?.[chave]
                    const valor = override === undefined ? 'herdar' : override ? 'permitir' : 'bloquear'
                    return (
                      <div key={acao} className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{ROTULOS_ACAO[acao]}</p>
                          <p className="text-xs text-muted-foreground">
                            {override === undefined ? 'Padrão do cargo' : 'Regra individual'}
                          </p>
                        </div>
                        <Select
                          value={valor}
                          disabled={salvando !== null}
                          onValueChange={(novoValor) => void alterarUsuario(
                            usuarioSelecionado,
                            modulo.id,
                            acao,
                            novoValor as 'herdar' | 'permitir' | 'bloquear',
                          )}
                        >
                          <SelectTrigger className="w-40">
                            {salvando === `usuario:${usuarioSelecionado.id}:${chave}`
                              ? <Loader2 className="size-4 animate-spin" />
                              : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="herdar">Padrão do cargo</SelectItem>
                            <SelectItem value="permitir">Permitir</SelectItem>
                            <SelectItem value="bloquear">Bloquear</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  })}
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum usuário disponível.
            </div>
          )}
        </TabsContent>

        {modo === 'dzn' ? (
          <TabsContent value="manutencao" className="mt-4">
            <section className="overflow-hidden rounded-xl border border-border/70 bg-card">
              {MODULOS_CONTROLE_ACESSO.map((modulo) => {
                const ativo = manutencao[modulo.id] === true
                return (
                  <div key={modulo.id} className="flex min-h-16 items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{modulo.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ativo ? 'Temporariamente bloqueado' : 'Funcionamento normal'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {salvando === `manutencao:${modulo.id}` ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                      <Interruptor
                        ativado={ativo}
                        aoAlternar={(valor) => void alternarManutencao(modulo.id, valor)}
                        desabilitado={salvando !== null}
                        tamanho="md"
                        aria-label={`${ativo ? 'Liberar' : 'Pausar'} ${modulo.nome}`}
                      />
                    </div>
                  </div>
                )
              })}
            </section>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
