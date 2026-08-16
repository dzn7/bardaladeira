type IconeMesaProps = {
  className?: string
}

export default function IconeMesa({ className = 'w-6 h-6' }: IconeMesaProps) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Mesa redonda simples e limpa */}
      
      {/* Tampo circular */}
      <circle 
        cx="12" 
        cy="8" 
        r="7" 
        fill="currentColor"
      />
      
      {/* Pé da mesa */}
      <rect 
        x="10" 
        y="14" 
        width="4" 
        height="6" 
        rx="1"
        fill="currentColor"
      />
      
      {/* Base */}
      <rect 
        x="6" 
        y="19" 
        width="12" 
        height="2" 
        rx="1"
        fill="currentColor"
      />
    </svg>
  )
}
