import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contato - Bar da Ladeira',
  description: 'Entre em contato com o Bar da Ladeira. Faça seu pedido via WhatsApp!',
}

export default function ContatoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
