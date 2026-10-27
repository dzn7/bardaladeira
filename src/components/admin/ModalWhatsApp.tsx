'use client'

import { useState } from 'react'
import { AreaTexto, Botao, Campo, Chip, Gaveta } from '@/components/admin/ui'
import { toast } from 'sonner'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'

type Pedido = {
  id: string
  nome_cliente: string
  telefone?: string
  total: number
  status: string
}

type ModalWhatsAppProps = {
  pedido: Pedido | null
  aberto: boolean
  onFechar: () => void
}

const mensagensPredefinidas = [
  {
    titulo: 'Pedido confirmado',
    template: (pedido: Pedido) => 
      `Olá ${pedido.nome_cliente}! 😊\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} foi confirmado!\n\n💰 Valor: R$ ${pedido.total.toFixed(2)}\n\nEstamos preparando com muito carinho! 🍔`
  },
  {
    titulo: 'Em preparo',
    template: (pedido: Pedido) => 
      `Oi ${pedido.nome_cliente}! 👨‍🍳\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} está sendo preparado agora!\n\nEm breve estará prontinho! ⏰`
  },
  {
    titulo: 'Pedido pronto',
    template: (pedido: Pedido) => 
      `${pedido.nome_cliente}, tudo pronto! 🎉\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} está prontinho e quentinho!\n\nPode vir buscar! 😋`
  },
  {
    titulo: 'Saiu para entrega',
    template: (pedido: Pedido) => 
      `Olá ${pedido.nome_cliente}! 🚗\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} saiu para entrega!\n\nChega aí rapidinho! 🍔💨`
  },
  {
    titulo: 'Agradecimento',
    template: (pedido: Pedido) => 
      `Muito obrigado pela preferência, ${pedido.nome_cliente}! 🙏\n\nEsperamos que tenha gostado do seu pedido!\n\nVolte sempre! ❤️🍔`
  },
  {
    titulo: 'Escrever outra',
    template: () => ''
  }
]

export default function ModalWhatsApp({ pedido, aberto, onFechar }: ModalWhatsAppProps) {
  const [mensagemSelecionada, setMensagemSelecionada] = useState(0)
  const [mensagemCustom, setMensagemCustom] = useState('')

  if (!pedido) return null

  const handleEnviarWhatsApp = () => {
    const mensagem = mensagemSelecionada === mensagensPredefinidas.length - 1
      ? mensagemCustom
      : mensagensPredefinidas[mensagemSelecionada].template(pedido)

    if (!mensagem.trim()) {
      toast.warning('Escreva uma mensagem')
      return
    }

    // Remove caracteres especiais do telefone
    const telefone = (pedido.telefone || '').replace(/\D/g, '')
    if (!telefone) {
      toast.error('Telefone não disponível para este pedido')
      return
    }
    const telefoneCompleto = telefone.startsWith('55') ? telefone : `55${telefone}`

    // Abre WhatsApp
    window.open(
      `https://wa.me/${telefoneCompleto}?text=${encodeURIComponent(mensagem)}`,
      '_blank'
    )

    onFechar()
  }

  const mensagemAtual = mensagemSelecionada === mensagensPredefinidas.length - 1
    ? mensagemCustom
    : mensagensPredefinidas[mensagemSelecionada].template(pedido)

  const ehPersonalizada = mensagemSelecionada === mensagensPredefinidas.length - 1

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      titulo="Enviar WhatsApp"
      descricao={[pedido.nome_cliente, pedido.telefone].filter(Boolean).join(' · ')}
      largura="lg"
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={handleEnviarWhatsApp} disabled={!mensagemAtual.trim()}>
            <IconeWhatsApp className="size-4" />
            Abrir no WhatsApp
          </Botao>
        </>
      }
    >
      <div className="space-y-5">
        <Campo rotulo="Mensagem">
          <div className="flex flex-wrap gap-2">
            {mensagensPredefinidas.map((msg, index) => (
              <Chip
                key={msg.titulo}
                ativo={mensagemSelecionada === index}
                className="h-11 normal-case md:h-9"
                onClick={() => {
                  setMensagemSelecionada(index)
                  if (index === mensagensPredefinidas.length - 1) setMensagemCustom('')
                }}
              >
                {msg.titulo}
              </Chip>
            ))}
          </div>
        </Campo>

        {ehPersonalizada ? (
          <Campo rotulo="Escreva a mensagem" htmlFor="whatsapp-mensagem">
            <AreaTexto
              id="whatsapp-mensagem"
              rows={7}
              value={mensagemCustom}
              onChange={(e) => setMensagemCustom(e.target.value)}
              placeholder="Digite a mensagem para o cliente"
            />
          </Campo>
        ) : (
          <Campo rotulo="Como o cliente vai receber">
            <div className="min-h-40 whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/40 p-4 text-sm text-foreground">
              {mensagemAtual}
            </div>
          </Campo>
        )}
      </div>
    </Gaveta>
  )
}
