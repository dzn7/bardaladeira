import { useEffect, useRef, useState } from 'react'
import type { EstadoAplicacao } from '../../electron/servicos/tipos'
import { configuracaoPadrao } from '@/dominio/configuracao'

export const estadoPadrao: EstadoAplicacao = {
  fila: [],
  pedidos: [],
  impressoras: [],
  conexao: {
    conectado: false,
    mensagem: 'Inicializando…',
    ultimaAtualizacao: new Date().toISOString()
  },
  configuracao: configuracaoPadrao,
  logs: []
}

/**
 * O processo principal reemite o estado inteiro a cada log, heartbeat e polling.
 * Aqui reaproveitamos as referências das fatias que não mudaram, para que as
 * seções memoizadas do painel não re-renderizem (e a tela pare de "piscar").
 */
const mesclarPreservandoReferencias = (
  anterior: EstadoAplicacao,
  recebido: EstadoAplicacao
): EstadoAplicacao => {
  const mesmaLista = <T,>(a: T[], b: T[]) => a === b || (a.length === b.length && a.every((item, indice) => item === b[indice]))

  const fila = mesmaLista(anterior.fila, recebido.fila) ? anterior.fila : recebido.fila
  const pedidos = mesmaLista(anterior.pedidos, recebido.pedidos) ? anterior.pedidos : recebido.pedidos
  const logs = mesmaLista(anterior.logs, recebido.logs) ? anterior.logs : recebido.logs
  const impressoras = mesmaLista(anterior.impressoras, recebido.impressoras)
    ? anterior.impressoras
    : recebido.impressoras

  const conexaoIgual =
    anterior.conexao.conectado === recebido.conexao.conectado &&
    anterior.conexao.mensagem === recebido.conexao.mensagem &&
    anterior.conexao.ultimaAtualizacao === recebido.conexao.ultimaAtualizacao
  const conexao = conexaoIgual ? anterior.conexao : recebido.conexao

  const configuracaoIgual =
    JSON.stringify(anterior.configuracao) === JSON.stringify(recebido.configuracao)
  const configuracao = configuracaoIgual ? anterior.configuracao : recebido.configuracao

  if (
    fila === anterior.fila &&
    pedidos === anterior.pedidos &&
    logs === anterior.logs &&
    impressoras === anterior.impressoras &&
    conexao === anterior.conexao &&
    configuracao === anterior.configuracao
  ) {
    return anterior
  }

  return { fila, pedidos, logs, impressoras, conexao, configuracao }
}

export const useEstadoImpressao = () => {
  const [estado, setEstado] = useState<EstadoAplicacao>(estadoPadrao)
  const [carregando, setCarregando] = useState(true)
  const montadoRef = useRef(true)

  useEffect(() => {
    montadoRef.current = true

    const aplicar = (recebido: EstadoAplicacao) => {
      if (!montadoRef.current) return
      setEstado((atual) => mesclarPreservandoReferencias(atual, recebido))
    }

    const removerInscricao = window.barDaLadeiraImpressao.aoAtualizarEstado(aplicar)

    window.barDaLadeiraImpressao
      .obterEstadoInicial()
      .then((estadoInicial) => {
        aplicar(estadoInicial)
      })
      .catch(() => {
        /* o estado chega pelo canal de eventos assim que o serviço subir */
      })
      .finally(() => {
        if (montadoRef.current) setCarregando(false)
      })

    return () => {
      montadoRef.current = false
      removerInscricao()
    }
  }, [])

  return { estado, carregando }
}
