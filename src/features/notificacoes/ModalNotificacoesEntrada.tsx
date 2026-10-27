'use client'

import { useState } from 'react'
import { Package as PackageX } from '@phosphor-icons/react'
import { Botao, Gaveta, LinhaInterruptor } from '@/components/admin/ui'
import { useNotificacoesAdmin } from './NotificacoesAdminContext'

export function ModalNotificacoesEntrada() {
  const { notificacoesModal, fecharModalEntrada } = useNotificacoesAdmin()
  const [naoMostrar, setNaoMostrar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const aberto = notificacoesModal.length > 0

  const fechar = async () => {
    if (salvando) return
    setSalvando(true)
    try {
      await fecharModalEntrada(naoMostrar)
    } catch {
      /* o estado será reconciliado no próximo carregamento da Central */
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={() => void fechar()}
      bloqueada={salvando}
      titulo={<span id="titulo-notificacoes-entrada">Atenção necessária</span>}
      descricao="Estes avisos precisam de você."
      rodape={
        <Botao carregando={salvando} onClick={() => void fechar()} autoFocus>
          {salvando ? 'Salvando…' : 'Entendi'}
        </Botao>
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
          {notificacoesModal.map((item) => (
            <li key={item.id} className="flex gap-3 px-4 py-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <PackageX className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.titulo}</p>
                <p className="mt-0.5 break-words text-[13px] leading-5 text-muted-foreground">{item.mensagem}</p>
              </div>
            </li>
          ))}
        </ul>
        <LinhaInterruptor
          titulo="Não mostrar de novo"
          descricao="Dá para ligar outra vez nas Notificações."
          marcado={naoMostrar}
          aoMudar={setNaoMostrar}
          rotuloAcessivel="Não mostrar novamente ao entrar"
        />
      </div>
    </Gaveta>
  )
}
