'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { obterSessao } from '@/lib/autenticacao'
import {
  chavePermissao,
  permissoesPadrao,
  type AcaoPermissao,
  type ChavePermissao,
  type ConfigManutencao,
  type ConfigPermissoes,
  type ModuloControleAcesso,
} from '@/lib/controle-acesso'

type ControleAcessoContextValue = {
  carregando: boolean
  pode: (modulo: ModuloControleAcesso, acao: AcaoPermissao) => boolean
  emManutencao: (modulo: ModuloControleAcesso) => boolean
}

const ControleAcessoContext = createContext<ControleAcessoContextValue | null>(null)

export function ControleAcessoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [carregando, setCarregando] = useState(true)
  const [permissoes, setPermissoes] = useState<ConfigPermissoes>(permissoesPadrao())
  const [manutencao, setManutencao] = useState<ConfigManutencao>({})

  useEffect(() => {
    let cancelado = false
    const sessao = obterSessao()

    if (!sessao?.id) {
      setPermissoes(permissoesPadrao())
      setManutencao({})
      setCarregando(false)
      return
    }

    const carregar = async () => {
      setCarregando(true)
      try {
        const resposta = await fetch(`/api/controle-acesso?usuarioId=${encodeURIComponent(sessao.id)}`)
        const json = (await resposta.json()) as {
          sucesso?: boolean
          permissoes?: ConfigPermissoes
          manutencao?: ConfigManutencao
        }

        if (!cancelado && resposta.ok && json.sucesso) {
          setPermissoes({ ...permissoesPadrao(), ...(json.permissoes ?? {}) })
          setManutencao(json.manutencao ?? {})
        }
      } catch {
        /* falha aberta para preservar a operação existente */
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      cancelado = true
    }
  }, [pathname])

  const pode = useCallback(
    (modulo: ModuloControleAcesso, acao: AcaoPermissao) =>
      permissoes[chavePermissao(modulo, acao) as ChavePermissao] !== false,
    [permissoes],
  )
  const emManutencao = useCallback(
    (modulo: ModuloControleAcesso) => manutencao[modulo] === true,
    [manutencao],
  )

  const value = useMemo(
    () => ({ carregando, pode, emManutencao }),
    [carregando, pode, emManutencao],
  )

  return <ControleAcessoContext.Provider value={value}>{children}</ControleAcessoContext.Provider>
}

export function useControleAcesso() {
  const context = useContext(ControleAcessoContext)
  if (!context) {
    throw new Error('useControleAcesso requer ControleAcessoProvider')
  }
  return context
}
