import * as React from 'react'
import { Input } from '@/components/ui/input'

type CampoNumeroProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  valor: number
  aoAlterar: (valor: number) => void
  min?: number
  max?: number
  step?: number
}

const limitar = (valor: number, min?: number, max?: number) => {
  let resultado = valor
  if (typeof min === 'number') resultado = Math.max(min, resultado)
  if (typeof max === 'number') resultado = Math.min(max, resultado)
  return resultado
}

/**
 * Campo numérico com rascunho de texto: o usuário consegue apagar o conteúdo e
 * digitar livremente. A normalização (mínimo/máximo/fallback) só acontece ao sair
 * do campo — antes, cada tecla reescrevia o valor e o cursor pulava.
 */
export const CampoNumero = ({ valor, aoAlterar, min, max, step, ...props }: CampoNumeroProps) => {
  const [texto, setTexto] = React.useState(String(valor))
  const focadoRef = React.useRef(false)

  React.useEffect(() => {
    if (focadoRef.current) return
    setTexto(String(valor))
  }, [valor])

  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={texto}
      onFocus={(evento) => {
        focadoRef.current = true
        props.onFocus?.(evento)
      }}
      onChange={(evento) => {
        const bruto = evento.target.value
        setTexto(bruto)
        const numero = Number(bruto)
        if (bruto.trim() !== '' && Number.isFinite(numero)) {
          aoAlterar(numero)
        }
      }}
      onBlur={(evento) => {
        focadoRef.current = false
        const numero = Number(evento.target.value)
        const normalizado = Number.isFinite(numero) && evento.target.value.trim() !== ''
          ? limitar(numero, min, max)
          : valor
        setTexto(String(normalizado))
        aoAlterar(normalizado)
        props.onBlur?.(evento)
      }}
    />
  )
}
