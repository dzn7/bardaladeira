'use client'

type CoroaDouradaProps = {
  className?: string
  tamanho?: number
}

export default function CoroaDourada({ className = '', tamanho = 24 }: CoroaDouradaProps) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="coroaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="coroaBrilho" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <filter id="coroaSombra" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#92400e" floodOpacity="0.3"/>
        </filter>
      </defs>
      
      {/* Base da coroa */}
      <path
        d="M3 18L4.5 8L8 12L12 6L16 12L19.5 8L21 18H3Z"
        fill="url(#coroaGradient)"
        filter="url(#coroaSombra)"
      />
      
      {/* Brilho superior */}
      <path
        d="M4.5 8L8 12L12 6L16 12L19.5 8"
        stroke="url(#coroaBrilho)"
        strokeWidth="0.5"
        fill="none"
      />
      
      {/* Detalhes das pontas */}
      <circle cx="4.5" cy="7" r="1.2" fill="url(#coroaBrilho)" />
      <circle cx="12" cy="5" r="1.5" fill="url(#coroaBrilho)" />
      <circle cx="19.5" cy="7" r="1.2" fill="url(#coroaBrilho)" />
      
      {/* Pedras preciosas */}
      <circle cx="8" cy="14" r="1" fill="#fef3c7" />
      <circle cx="12" cy="13" r="1.2" fill="#fef3c7" />
      <circle cx="16" cy="14" r="1" fill="#fef3c7" />
      
      {/* Base inferior */}
      <rect x="3" y="17" width="18" height="2" rx="0.5" fill="url(#coroaGradient)" />
      
      {/* Brilho na base */}
      <rect x="4" y="17.5" width="16" height="0.5" fill="#fef3c7" opacity="0.5" />
    </svg>
  )
}
