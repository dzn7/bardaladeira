export const TEMPO_PADRAO_MESA_MINUTOS = 180
export const TEMPO_AVISO_MESA_MINUTOS = 15

export function calcularLiberacaoMesa(
  base: Date = new Date(),
  minutos: number = TEMPO_PADRAO_MESA_MINUTOS,
) {
  return new Date(base.getTime() + minutos * 60 * 1000)
}
