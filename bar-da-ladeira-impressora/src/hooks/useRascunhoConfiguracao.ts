import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConfiguracaoAplicacao } from '../../electron/servicos/tipos'
import { configuracoesIguais } from '@/dominio/configuracao'

/**
 * Rascunho local do formulário de configurações.
 *
 * Antes, o painel sincronizava o formulário só na primeira mensagem do processo
 * principal: qualquer alteração vinda de fora ficava invisível e o formulário
 * nascia com valores errados se a primeira mensagem chegasse antes do
 * electron-store responder. Agora o rascunho acompanha o estado salvo enquanto
 * não houver edição pendente e trava assim que o usuário mexe em algum campo.
 */
export const useRascunhoConfiguracao = (configuracaoSalva: ConfiguracaoAplicacao) => {
  const [rascunho, setRascunho] = useState<ConfiguracaoAplicacao>(configuracaoSalva)
  const editandoRef = useRef(false)

  useEffect(() => {
    if (editandoRef.current) return
    setRascunho((atual) => (configuracoesIguais(atual, configuracaoSalva) ? atual : configuracaoSalva))
  }, [configuracaoSalva])

  const alterar = useCallback(<Chave extends keyof ConfiguracaoAplicacao>(
    chave: Chave,
    valor: ConfiguracaoAplicacao[Chave]
  ) => {
    editandoRef.current = true
    setRascunho((atual) => (atual[chave] === valor ? atual : { ...atual, [chave]: valor }))
  }, [])

  const confirmarSalvo = useCallback((configuracao: ConfiguracaoAplicacao) => {
    editandoRef.current = false
    setRascunho(configuracao)
  }, [])

  const descartar = useCallback(() => {
    editandoRef.current = false
    setRascunho(configuracaoSalva)
  }, [configuracaoSalva])

  const alterado = !configuracoesIguais(rascunho, configuracaoSalva)

  return { rascunho, alterar, alterado, confirmarSalvo, descartar }
}
