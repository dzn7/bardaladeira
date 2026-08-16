/**
 * Declaracoes minimas da Web Serial API usadas pelo fallback de impressoras
 * Bluetooth Classic (RFCOMM/SPP) no Chrome desktop.
 */

interface SerialPort {
  connected?: boolean
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>
  close(): Promise<void>
  getInfo?(): Record<string, unknown>
}

interface Serial {
  requestPort(): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

interface Navigator {
  serial: Serial
}
