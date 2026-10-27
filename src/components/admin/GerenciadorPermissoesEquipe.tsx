'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CircleNotch as Loader2, Gear as Settings, ShieldCheck, UserGear as UserRoundCog, Wrench } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import {
  Botao,
  Campo,
  Cartao,
  Entrada,
  Interruptor,
  ListaCarregando,
  ListaVazia,
  Secao,
  Segmentos,
  Selecao,
} from '@/components/admin/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
      <Secao key={modulo.id} titulo={modulo.nome} descricao={modulo.descricao}>
        <Cartao className="divide-y divide-border/70">
          {modulo.acoes.map((acao) => {
            const chave = chavePermissao(modulo.id, acao)
            const ativo = efetivas[chave] !== false
            return (
              <div key={acao} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-foreground">{ROTULOS_ACAO[acao]}</span>
                <div className="flex items-center gap-3">
                  {salvando === `papel:${chave}` ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                  <Interruptor
                    marcado={ativo}
                    aoMudar={(valor) => void alternarPapel(modulo.perfil, modulo.id, acao, valor)}
                    desabilitado={salvando !== null}
                    rotuloAcessivel={`${ativo ? 'Bloquear' : 'Permitir'} ${ROTULOS_ACAO[acao]} em ${modulo.nome}`}
                  />
                </div>
              </div>
            )
          })}
        </Cartao>
      </Secao>
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
      <Cartao className="mx-auto max-w-sm p-5">
        <form onSubmit={confirmarAdmin} className="space-y-4">
          <div className="space-y-1">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <h2 className="pt-2 text-base font-semibold text-foreground">Confirme seu acesso</h2>
            <p className="text-sm text-muted-foreground">Digite seu usuário e senha para mudar as permissões.</p>
          </div>
          <Campo rotulo="Usuário" htmlFor="permissoes-admin-usuario">
            <Entrada
              id="permissoes-admin-usuario"
              value={usuarioAdminInput}
              onChange={(event) => setUsuarioAdminInput(event.target.value)}
              autoComplete="username"
              required
            />
          </Campo>
          <Campo rotulo="Senha" htmlFor="permissoes-admin-senha">
            <Entrada
              id="permissoes-admin-senha"
              type="password"
              value={senhaAdmin}
              onChange={(event) => setSenhaAdmin(event.target.value)}
              autoComplete="current-password"
              minLength={4}
              required
            />
          </Campo>
          <Botao type="submit" tamanho="lg" className="w-full md:h-10 md:text-sm">Continuar</Botao>
        </form>
      </Cartao>
    )
  }

  if (carregando || !ator) {
    return <ListaCarregando linhas={4} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Escolha o que garçons e entregadores podem fazer. Dá para abrir exceção por pessoa.
        </p>
        <Botao variante="contorno" tamanho="sm" className="h-11 md:h-9" onClick={() => void carregar()}>
          Atualizar
        </Botao>
      </div>

      <Tabs defaultValue="cargos">
        <TabsList className={`grid h-auto w-full p-1 ${modo === 'dzn' ? 'grid-cols-3' : 'grid-cols-2'} sm:w-auto sm:inline-grid`}>
          <TabsTrigger value="cargos" className="min-h-11">
            <Settings className="mr-1.5 size-4" /> Cargos
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="min-h-11">
            <UserRoundCog className="mr-1.5 size-4" /> Pessoas
          </TabsTrigger>
          {modo === 'dzn' ? (
            <TabsTrigger value="manutencao" className="min-h-11">
              <Wrench className="mr-1.5 size-4" /> Manutenção
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="cargos" className="mt-4 space-y-5">
          <Segmentos
            rotuloAcessivel="Cargo"
            opcoes={(['garcom', 'entregador'] as const).map((perfil) => ({ valor: perfil, rotulo: rotuloPerfil(perfil) }))}
            valor={perfilAtivo}
            aoMudar={setPerfilAtivo}
          />
          {modulosPerfil.map(renderModuloPapel)}
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4 space-y-5">
          <Campo rotulo="Pessoa da equipe" htmlFor="controle-usuario" className="sm:max-w-md">
            <Selecao id="controle-usuario" value={usuarioId} onChange={(event) => setUsuarioId(event.target.value)}>
              {usuarios.length === 0 ? <option value="">Nenhuma pessoa</option> : null}
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome} · {usuario.papel === 'garcom' ? 'Garçom' : 'Entregador'}
                  {!usuario.ativo ? ' · Inativo' : ''}
                </option>
              ))}
            </Selecao>
          </Campo>

          {usuarioSelecionado ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 px-1">
                <AvatarUsuario nome={usuarioSelecionado.nome} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{usuarioSelecionado.nome}</p>
                  <p className="truncate text-[13px] text-muted-foreground">@{usuarioSelecionado.nome_usuario}</p>
                </div>
              </div>

              {modulosUsuario.map((modulo) => (
                <Secao key={modulo.id} titulo={modulo.nome} descricao="“Igual ao cargo” segue a regra de Cargos.">
                  <Cartao className="divide-y divide-border/70">
                    {modulo.acoes.map((acao) => {
                      const chave = chavePermissao(modulo.id, acao)
                      const override = usuariosConfig[usuarioSelecionado.id]?.[chave]
                      const valor = override === undefined ? 'herdar' : override ? 'permitir' : 'bloquear'
                      return (
                        <div key={acao} className="space-y-2.5 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-foreground">{ROTULOS_ACAO[acao]}</p>
                            {salvando === `usuario:${usuarioSelecionado.id}:${chave}` ? (
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            ) : null}
                          </div>
                          <fieldset disabled={salvando !== null} className="disabled:opacity-60">
                            <Segmentos
                              rotuloAcessivel={`${ROTULOS_ACAO[acao]} em ${modulo.nome}`}
                              opcoes={[
                                { valor: 'herdar', rotulo: 'Igual ao cargo' },
                                { valor: 'permitir', rotulo: 'Permitir' },
                                { valor: 'bloquear', rotulo: 'Bloquear' },
                              ]}
                              valor={valor}
                              aoMudar={(novoValor) => {
                                if (novoValor !== valor) void alterarUsuario(usuarioSelecionado, modulo.id, acao, novoValor)
                              }}
                            />
                          </fieldset>
                        </div>
                      )
                    })}
                  </Cartao>
                </Secao>
              ))}
            </div>
          ) : (
            <ListaVazia icone={<UserRoundCog />} titulo="Nenhuma pessoa da equipe" descricao="Cadastre garçons ou entregadores em Usuários do sistema." />
          )}
        </TabsContent>

        {modo === 'dzn' ? (
          <TabsContent value="manutencao" className="mt-4">
            <Cartao className="divide-y divide-border/70">
              {MODULOS_CONTROLE_ACESSO.map((modulo) => {
                const ativo = manutencao[modulo.id] === true
                return (
                  <div key={modulo.id} className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{modulo.nome}</p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {ativo ? 'Temporariamente bloqueado' : 'Funcionamento normal'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {salvando === `manutencao:${modulo.id}` ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                      <Interruptor
                        marcado={ativo}
                        aoMudar={(valor) => void alternarManutencao(modulo.id, valor)}
                        desabilitado={salvando !== null}
                        rotuloAcessivel={`${ativo ? 'Liberar' : 'Pausar'} ${modulo.nome}`}
                      />
                    </div>
                  </div>
                )
              })}
            </Cartao>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
