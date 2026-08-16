'use client'

import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
    titulo: 'Pedido Confirmado',
    template: (pedido: Pedido) => 
      `Olá ${pedido.nome_cliente}! 😊\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} foi confirmado!\n\n💰 Valor: R$ ${pedido.total.toFixed(2)}\n\nEstamos preparando com muito carinho! 🍔`
  },
  {
    titulo: 'Pedido em Preparo',
    template: (pedido: Pedido) => 
      `Oi ${pedido.nome_cliente}! 👨‍🍳\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} está sendo preparado agora!\n\nEm breve estará prontinho! ⏰`
  },
  {
    titulo: 'Pedido Pronto',
    template: (pedido: Pedido) => 
      `${pedido.nome_cliente}, tudo pronto! 🎉\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} está prontinho e quentinho!\n\nPode vir buscar! 😋`
  },
  {
    titulo: 'Saiu para Entrega',
    template: (pedido: Pedido) => 
      `Olá ${pedido.nome_cliente}! 🚗\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} saiu para entrega!\n\nChega aí rapidinho! 🍔💨`
  },
  {
    titulo: 'Agradecimento',
    template: (pedido: Pedido) => 
      `Muito obrigado pela preferência, ${pedido.nome_cliente}! 🙏\n\nEsperamos que tenha gostado do seu pedido!\n\nVolte sempre! ❤️🍔`
  },
  {
    titulo: 'Mensagem Personalizada',
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
      toast.warning('Por favor, escreva uma mensagem')
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

  return (
    <AnimatePresence>
      {aberto && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onFechar}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-4 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                     md:inset-auto z-[9999] w-auto md:w-full md:max-w-2xl 
                     bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl 
                     border border-zinc-200 dark:border-zinc-800 overflow-hidden
                     max-h-[90vh] md:max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 md:p-6 text-white flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <IconeWhatsApp className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold">Enviar WhatsApp</h3>
                    <p className="text-xs md:text-sm text-green-50">
                      {pedido.nome_cliente} • {pedido.telefone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onFechar}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto flex-1">
              {/* Mensagens Predefinidas */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Escolha uma mensagem:
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {mensagensPredefinidas.map((msg, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setMensagemSelecionada(index)
                        if (index === mensagensPredefinidas.length - 1) {
                          setMensagemCustom('')
                        }
                      }}
                      className={`p-3 rounded-lg text-xs md:text-sm font-medium transition-all ${
                        mensagemSelecionada === index
                          ? 'bg-green-500 text-white shadow-lg scale-105'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {msg.titulo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview/Editor da Mensagem */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {mensagemSelecionada === mensagensPredefinidas.length - 1 ? 'Escreva sua mensagem:' : 'Preview da mensagem:'}
                </label>
                {mensagemSelecionada === mensagensPredefinidas.length - 1 ? (
                  <textarea
                    value={mensagemCustom}
                    onChange={(e) => setMensagemCustom(e.target.value)}
                    placeholder="Digite sua mensagem personalizada..."
                    className="w-full h-40 md:h-48 p-4 rounded-lg border border-zinc-300 dark:border-zinc-700 
                             bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white
                             focus:ring-2 focus:ring-green-500 focus:border-transparent
                             resize-none text-sm"
                  />
                ) : (
                  <div className="w-full min-h-[10rem] md:min-h-[12rem] p-4 rounded-lg 
                                bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
                                text-zinc-900 dark:text-white whitespace-pre-wrap text-sm">
                    {mensagemAtual}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 flex-shrink-0">
              <button
                onClick={onFechar}
                className="flex-1 px-4 py-2.5 md:py-3 text-sm md:text-base font-medium text-zinc-700 dark:text-zinc-300
                         bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700
                         rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarWhatsApp}
                disabled={!mensagemAtual.trim()}
                className="flex-1 px-4 py-2.5 md:py-3 text-sm md:text-base font-medium text-white
                         bg-gradient-to-r from-green-500 to-green-600 
                         hover:from-green-600 hover:to-green-700
                         rounded-xl transition-all shadow-lg hover:shadow-xl
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
                Enviar WhatsApp
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
