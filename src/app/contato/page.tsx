'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'

// Ícone WhatsApp SVG
const IconeWhatsApp = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

// Ícone Instagram SVG
const IconeInstagram = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
)

// Ícone Globe/Web SVG
const IconeWeb = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

// Ícone Localização SVG
const IconeLocalizacao = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C7.802 0 4 3.403 4 7.602 4 11.8 7.469 16.812 12 24c4.531-7.188 8-12.2 8-16.398C20 3.403 16.199 0 12 0zm0 11a3 3 0 110-6 3 3 0 010 6z"/>
  </svg>
)

// Links de contato
const LINKS = [
  {
    id: 'whatsapp',
    titulo: 'Faça seu Pedido',
    subtitulo: 'WhatsApp',
    icone: IconeWhatsApp,
    url: 'https://wa.me/5586981480835',
    cor: 'bg-[#25D366]',
    corHover: 'hover:bg-[#20BD5A]',
  },
  {
    id: 'site',
    titulo: 'Faça seu pedido pelo Site',
    subtitulo: 'Bar da Ladeira',
    icone: IconeWeb,
    url: '/',
    cor: 'bg-orange-500',
    corHover: 'hover:bg-orange-600',
  },
  {
    id: 'instagram',
    titulo: 'Instagram',
    subtitulo: 'Bar da Ladeira',
    icone: IconeInstagram,
    url: 'https://instagram.com/',
    cor: 'bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]',
    corHover: 'hover:opacity-90',
  },
  {
    id: 'localizacao',
    titulo: 'Nossa Localização',
    subtitulo: 'Ver no mapa',
    icone: IconeLocalizacao,
    url: 'https://maps.google.com/?q=Porto+Piaui',
    cor: 'bg-[#EA4335]',
    corHover: 'hover:bg-[#D33426]',
  },
]

export default function ContatoPage() {
  return (
    <div 
      className="min-h-screen w-full relative overflow-hidden bg-[#050505]"
    >
      {/* Foto em baixa opacidade ao fundo */}
      <Image
        src="/assets/imglinktree.jpg"
        alt="Bar da Ladeira"
        fill
        className="object-cover opacity-85"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/75" />

      {/* Conteúdo central */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-xl rounded-3xl bg-white/5 backdrop-blur-lg border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-8 sm:p-10 space-y-8"
        >
          {/* Logo e heading */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 rounded-full overflow-hidden border border-white/20 shadow-lg">
              <Image
                src="/logo.webp"
                alt="Bar da Ladeira"
                width={120}
                height={120}
                className="object-cover w-full h-full"
                priority
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/60 mb-2">Contato</p>
              <h1 className="text-3xl font-semibold text-white">Bar da Ladeira</h1>
              <p className="text-sm text-white/60 mt-1">Delivery e salão</p>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            {LINKS.map((link, index) => {
              const Icone = link.icone

              return (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * (index + 1), duration: 0.25 }}
                >
                  <Link
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                      <Icone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{link.titulo}</p>
                      <p className="text-white/50 text-sm">{link.subtitulo}</p>
                    </div>
                    <span className="text-white/40 group-hover:text-white/80 transition-colors text-sm">abrir</span>
                  </Link>
                </motion.div>
              )
            })}
          </div>

          {/* Rodapé */}
          <div className="text-center text-white/40 text-xs">
            © {new Date().getFullYear()} Bar da Ladeira
          </div>
        </motion.div>
      </div>
    </div>
  )
}
