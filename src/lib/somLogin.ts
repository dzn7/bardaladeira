/**
 * Gera e toca um som de sucesso de login usando Web Audio API
 * Nao depende de arquivos externos
 */
export function tocarSomLogin(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    // Nota 1 - tom curto ascendente
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // E5
    gain1.gain.setValueAtTime(0.3, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.25)

    // Nota 2 - tom mais alto
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12) // G5
    gain2.gain.setValueAtTime(0, ctx.currentTime)
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ctx.currentTime + 0.12)
    osc2.stop(ctx.currentTime + 0.4)

    // Limpa contexto apos o som
    setTimeout(() => ctx.close().catch(() => {}), 500)
  } catch {
    // Silencioso se Web Audio nao estiver disponivel
  }
}
