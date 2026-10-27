'use client'

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ComponentType,
  type CSSProperties,
} from 'react'
import dynamic from 'next/dynamic'
import { MagnifyingGlassPlus as ZoomIn, MagnifyingGlassMinus as ZoomOut, ArrowClockwise as RotateCw, ArrowCounterClockwise as RotateCcw, FlipHorizontal, FlipVertical, ArrowsClockwise as RefreshCw, CircleNotch as Loader2 } from '@phosphor-icons/react'
import {
  obterImagemRecortada,
  blobParaBase64,
  type AreaRecorte,
} from '@/lib/recorteImagem'
import { Botao, Chip, Gaveta } from '@/components/admin/ui'
const Cropper = dynamic(() => import('react-easy-crop'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
})

type Point = { x: number; y: number }
type Area = { x: number; y: number; width: number; height: number }

type ProporcoesPreset = {
  nome: string
  valor: number
}

type ModalRecorteImagemProps = {
  aberto: boolean
  imagemUrl: string
  onFechar: () => void
  onConfirmar: (imagemRecortadaBase64: string, blob: Blob) => void
  proporcaoInicial?: number
  titulo?: string
}

const PROPORCOES_PRESET: ProporcoesPreset[] = [
  { nome: 'Livre', valor: 0 },
  { nome: 'Quadrada', valor: 1 },
  { nome: '4:3', valor: 4 / 3 },
  { nome: '16:9', valor: 16 / 9 },
  { nome: '3:4', valor: 3 / 4 },
]

export default function ModalRecorteImagem({
  aberto,
  imagemUrl,
  onFechar,
  onConfirmar,
  proporcaoInicial = 1,
  titulo = 'Ajustar foto',
}: ModalRecorteImagemProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotacao, setRotacao] = useState(0)
  const [areaRecortada, setAreaRecortada] = useState<AreaRecorte | null>(null)
  const [proporcao, setProporcao] = useState(proporcaoInicial)
  const [flip, setFlip] = useState({ horizontal: false, vertical: false })
  const [processando, setProcessando] = useState(false)
  const [erroProcessamento, setErroProcessamento] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [gerandoPreview, setGerandoPreview] = useState(false)
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const zoomMinimo = 1
  const zoomMaximo = 3

  const gerarPreview = useCallback(async () => {
    if (!areaRecortada || !imagemUrl) return

    setGerandoPreview(true)
    try {
      const blobRecortado = await obterImagemRecortada(imagemUrl, areaRecortada, rotacao, flip)
      if (blobRecortado) {
        const url = URL.createObjectURL(blobRecortado)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      }
    } catch {
      /* preview é best-effort */
    } finally {
      setGerandoPreview(false)
    }
  }, [areaRecortada, imagemUrl, rotacao, flip])

  useEffect(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => {
      void gerarPreview()
    }, 300)
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    }
  }, [gerarPreview])

  useEffect(() => {
    if (!aberto && previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [aberto, previewUrl])

  useEffect(() => {
    if (!aberto) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotacao(0)
    setFlip({ horizontal: false, vertical: false })
    setProporcao(proporcaoInicial)
    setErroProcessamento(null)
    setAreaRecortada(null)
  }, [aberto, proporcaoInicial, imagemUrl])

  const aoCompletarRecorte = useCallback((_areaCortada: Area, areaPixels: Area) => {
    setAreaRecortada(areaPixels)
  }, [])

  const resetarAjustes = useCallback(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotacao(0)
    setFlip({ horizontal: false, vertical: false })
    setProporcao(proporcaoInicial)
    setErroProcessamento(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [proporcaoInicial, previewUrl])

  const confirmarRecorte = async () => {
    if (!areaRecortada) {
      setErroProcessamento('Selecione uma área para recortar')
      return
    }

    setProcessando(true)
    setErroProcessamento(null)

    try {
      const blobRecortado = await obterImagemRecortada(imagemUrl, areaRecortada, rotacao, flip)
      if (!blobRecortado) throw new Error('Falha ao processar a imagem')
      const base64 = await blobParaBase64(blobRecortado)
      onConfirmar(base64, blobRecortado)
      resetarAjustes()
    } catch {
      setErroProcessamento('Não foi possível processar a imagem. Tente novamente.')
    } finally {
      setProcessando(false)
    }
  }

  const fecharModal = () => {
    resetarAjustes()
    onFechar()
  }

  const CropperAny = Cropper as unknown as ComponentType<{
    image: string
    crop: Point
    zoom: number
    rotation: number
    aspect?: number
    onCropChange: (valor: Point) => void
    onZoomChange: (valor: number) => void
    onCropComplete: (area: Area, pixels: Area) => void
    cropShape?: 'rect' | 'round'
    showGrid?: boolean
    style?: {
      containerStyle?: CSSProperties
      cropAreaStyle?: CSSProperties
    }
  }>

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={fecharModal}
      largura="xl"
      bloqueada={processando}
      titulo={titulo}
      descricao="Arraste a foto para posicionar. Use o zoom para aproximar."
      rodape={
        <>
          <Botao variante="contorno" onClick={fecharModal} disabled={processando}>
            Cancelar
          </Botao>
          <Botao onClick={() => void confirmarRecorte()} carregando={processando} disabled={!areaRecortada}>
            Usar esta foto
          </Botao>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="relative h-[42dvh] min-h-[220px] flex-1 overflow-hidden rounded-xl bg-muted md:h-[400px]">
            <CropperAny
              image={imagemUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotacao}
              aspect={proporcao > 0 ? proporcao : undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={aoCompletarRecorte}
              cropShape="rect"
              showGrid
              style={{
                containerStyle: { backgroundColor: 'hsl(var(--muted))' },
                cropAreaStyle: {
                  border: '2px solid hsl(var(--primary))',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                },
              }}
            />
          </div>

          <div className="hidden w-32 shrink-0 space-y-2 md:block">
            <p className="text-[13px] text-muted-foreground">Como vai ficar</p>
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border/70 bg-muted">
              {gerandoPreview ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="Prévia do recorte" className="size-full object-cover" />
              ) : imagemUrl ? (
                <img src={imagemUrl} alt="" className="size-full object-cover opacity-50" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Formato</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:flex-wrap md:px-0">
            {PROPORCOES_PRESET.map((preset) => (
              <Chip key={preset.nome} ativo={proporcao === preset.valor} onClick={() => setProporcao(preset.valor)}>
                {preset.nome}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Zoom</p>
          <div className="flex items-center gap-2">
            <Botao
              variante="contorno"
              tamanho="icone"
              className="size-11 md:size-10"
              onClick={() => setZoom((prev) => Math.max(prev - 0.1, zoomMinimo))}
              disabled={zoom <= zoomMinimo}
              aria-label="Diminuir zoom"
            >
              <ZoomOut />
            </Botao>
            <input
              type="range"
              min={zoomMinimo}
              max={zoomMaximo}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              aria-label="Zoom"
            />
            <Botao
              variante="contorno"
              tamanho="icone"
              className="size-11 md:size-10"
              onClick={() => setZoom((prev) => Math.min(prev + 0.1, zoomMaximo))}
              disabled={zoom >= zoomMaximo}
              aria-label="Aumentar zoom"
            >
              <ZoomIn />
            </Botao>
            <span className="w-11 text-right text-sm tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Botao
            variante="contorno"
            tamanho="icone"
            className="size-11 md:size-10"
            onClick={() => setRotacao((prev) => (prev - 90) % 360)}
            aria-label="Girar para a esquerda"
          >
            <RotateCcw />
          </Botao>
          <Botao
            variante="contorno"
            tamanho="icone"
            className="size-11 md:size-10"
            onClick={() => setRotacao((prev) => (prev + 90) % 360)}
            aria-label="Girar para a direita"
          >
            <RotateCw />
          </Botao>
          <Botao
            variante={flip.horizontal ? 'primario' : 'contorno'}
            tamanho="icone"
            className="size-11 md:size-10"
            aria-pressed={flip.horizontal}
            onClick={() => setFlip((prev) => ({ ...prev, horizontal: !prev.horizontal }))}
            aria-label="Espelhar na horizontal"
          >
            <FlipHorizontal />
          </Botao>
          <Botao
            variante={flip.vertical ? 'primario' : 'contorno'}
            tamanho="icone"
            className="size-11 md:size-10"
            aria-pressed={flip.vertical}
            onClick={() => setFlip((prev) => ({ ...prev, vertical: !prev.vertical }))}
            aria-label="Espelhar na vertical"
          >
            <FlipVertical />
          </Botao>
          <Botao variante="fantasma" className="ml-auto h-11 md:h-10" onClick={resetarAjustes}>
            <RefreshCw />
            Desfazer ajustes
          </Botao>
        </div>

        {erroProcessamento ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {erroProcessamento}
          </p>
        ) : null}
      </div>
    </Gaveta>
  )
}
