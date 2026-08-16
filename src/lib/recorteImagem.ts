/**
 * Utilitário para processamento de recorte de imagens
 * Utiliza Canvas API para manipulação eficiente de imagens
 * Otimizado para economizar espaço no Supabase Storage (plano Free)
 * 
 * LIMITES OTIMIZADOS:
 * - Tamanho máximo: 1MB (para economizar storage)
 * - Dimensão máxima: 1200px (suficiente para web)
 * - Qualidade: 85% (bom equilíbrio qualidade/tamanho)
 */

// Limite máximo de tamanho do arquivo em bytes (1MB para economizar storage)
const TAMANHO_MAXIMO_BYTES = 1 * 1024 * 1024

// Dimensão máxima para redimensionamento automático (1200px é suficiente para web)
const DIMENSAO_MAXIMA = 1200

// Qualidade inicial para compressão JPEG (85% é um bom equilíbrio)
const QUALIDADE_INICIAL = 0.85

export type AreaRecorte = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Cria uma imagem a partir de uma URL
 */
export const criarImagem = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const imagem = new Image()
    imagem.addEventListener('load', () => resolve(imagem))
    imagem.addEventListener('error', (erro) => reject(erro))
    imagem.setAttribute('crossOrigin', 'anonymous')
    imagem.src = url
  })

/**
 * Converte graus para radianos
 */
export const grausParaRadianos = (graus: number): number => {
  return (graus * Math.PI) / 180
}

/**
 * Retorna o tamanho rotacionado de uma imagem
 */
export const obterTamanhoRotacionado = (
  largura: number,
  altura: number,
  rotacao: number
): { largura: number; altura: number } => {
  const rotacaoRadianos = grausParaRadianos(rotacao)

  return {
    largura:
      Math.abs(Math.cos(rotacaoRadianos) * largura) +
      Math.abs(Math.sin(rotacaoRadianos) * altura),
    altura:
      Math.abs(Math.sin(rotacaoRadianos) * largura) +
      Math.abs(Math.cos(rotacaoRadianos) * altura),
  }
}

/**
 * Comprime um canvas até que o blob resultante esteja abaixo do limite
 * Usa redução progressiva de qualidade
 */
async function comprimirCanvasParaBlob(
  canvas: HTMLCanvasElement,
  qualidadeInicial: number = QUALIDADE_INICIAL,
  manterTransparencia: boolean = false
): Promise<Blob | null> {
  let qualidade = qualidadeInicial
  let blob: Blob | null = null
  
  // Formato: PNG para transparência, JPEG para compressão
  const formato = manterTransparencia ? 'image/png' : 'image/jpeg'
  
  // Para PNG, não usamos qualidade progressiva
  if (manterTransparencia) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png')
    })
    
    // Se PNG estiver muito grande, converte para JPEG com fundo branco
    if (blob && blob.size > TAMANHO_MAXIMO_BYTES) {
      const canvasJpeg = document.createElement('canvas')
      canvasJpeg.width = canvas.width
      canvasJpeg.height = canvas.height
      const ctxJpeg = canvasJpeg.getContext('2d')
      if (ctxJpeg) {
        ctxJpeg.fillStyle = '#FFFFFF'
        ctxJpeg.fillRect(0, 0, canvas.width, canvas.height)
        ctxJpeg.drawImage(canvas, 0, 0)
        return comprimirCanvasParaBlob(canvasJpeg, 0.85, false)
      }
    }
    
    return blob
  }
  
  // Tenta comprimir reduzindo a qualidade progressivamente (JPEG)
  while (qualidade >= 0.1) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        'image/jpeg',
        qualidade
      )
    })
    
    if (blob && blob.size <= TAMANHO_MAXIMO_BYTES) {
      return blob
    }
    
    // Reduz a qualidade em 10% a cada iteração
    qualidade -= 0.1
  }
  
  // Se ainda estiver grande, redimensiona o canvas
  if (blob && blob.size > TAMANHO_MAXIMO_BYTES) {
    const novaLargura = Math.floor(canvas.width * 0.8)
    const novaAltura = Math.floor(canvas.height * 0.8)
    
    const canvasReduzido = document.createElement('canvas')
    canvasReduzido.width = novaLargura
    canvasReduzido.height = novaAltura
    
    const ctxReduzido = canvasReduzido.getContext('2d')
    if (ctxReduzido) {
      ctxReduzido.imageSmoothingEnabled = true
      ctxReduzido.imageSmoothingQuality = 'high'
      ctxReduzido.drawImage(canvas, 0, 0, novaLargura, novaAltura)
      
      // Tenta novamente com o canvas reduzido
      return comprimirCanvasParaBlob(canvasReduzido, 0.85, false)
    }
  }
  
  return blob
}

/**
 * Processa o recorte da imagem e retorna um Blob otimizado
 * Garante que o arquivo final não ultrapasse 5MB
 */
export async function obterImagemRecortada(
  imagemSrc: string,
  areaPixels: AreaRecorte,
  rotacao = 0,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const imagem = await criarImagem(imagemSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const tamanhoRotacionado = obterTamanhoRotacionado(
    imagem.width,
    imagem.height,
    rotacao
  )

  // Define o tamanho do canvas para conter a imagem rotacionada
  canvas.width = tamanhoRotacionado.largura
  canvas.height = tamanhoRotacionado.altura

  // Translada o contexto para o centro do canvas
  ctx.translate(tamanhoRotacionado.largura / 2, tamanhoRotacionado.altura / 2)
  ctx.rotate(grausParaRadianos(rotacao))
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-imagem.width / 2, -imagem.height / 2)

  // Desenha a imagem rotacionada
  ctx.drawImage(imagem, 0, 0)

  // Extrai a área recortada
  const dados = ctx.getImageData(
    areaPixels.x,
    areaPixels.y,
    areaPixels.width,
    areaPixels.height
  )

  // Calcula dimensões finais respeitando o limite máximo
  let larguraFinal = areaPixels.width
  let alturaFinal = areaPixels.height
  
  if (larguraFinal > DIMENSAO_MAXIMA || alturaFinal > DIMENSAO_MAXIMA) {
    const escala = Math.min(DIMENSAO_MAXIMA / larguraFinal, DIMENSAO_MAXIMA / alturaFinal)
    larguraFinal = Math.floor(larguraFinal * escala)
    alturaFinal = Math.floor(alturaFinal * escala)
  }

  // Cria canvas temporário com os dados originais
  const canvasTemp = document.createElement('canvas')
  canvasTemp.width = areaPixels.width
  canvasTemp.height = areaPixels.height
  const ctxTemp = canvasTemp.getContext('2d')
  
  if (!ctxTemp) {
    return null
  }
  
  ctxTemp.putImageData(dados, 0, 0)

  // Cria canvas final com as dimensões otimizadas
  const canvasFinal = document.createElement('canvas')
  canvasFinal.width = larguraFinal
  canvasFinal.height = alturaFinal
  
  const ctxFinal = canvasFinal.getContext('2d')
  if (!ctxFinal) {
    return null
  }
  
  // Usa interpolação de alta qualidade
  ctxFinal.imageSmoothingEnabled = true
  ctxFinal.imageSmoothingQuality = 'high'
  ctxFinal.drawImage(canvasTemp, 0, 0, larguraFinal, alturaFinal)

  // Comprime e retorna o blob otimizado (mantendo transparência se possível)
  return comprimirCanvasParaBlob(canvasFinal, QUALIDADE_INICIAL, true)
}

/**
 * Converte um Blob para base64
 * Útil para preview antes do upload
 */
export const blobParaBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Redimensiona uma imagem mantendo a proporção
 */
export async function redimensionarImagem(
  imagemSrc: string,
  larguraMaxima: number,
  alturaMaxima: number
): Promise<Blob | null> {
  const imagem = await criarImagem(imagemSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  let largura = imagem.width
  let altura = imagem.height

  // Calcula as novas dimensões mantendo a proporção
  if (largura > larguraMaxima) {
    altura = (altura * larguraMaxima) / largura
    largura = larguraMaxima
  }

  if (altura > alturaMaxima) {
    largura = (largura * alturaMaxima) / altura
    altura = alturaMaxima
  }

  canvas.width = largura
  canvas.height = altura

  // Usa interpolação de alta qualidade
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(imagem, 0, 0, largura, altura)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      'image/jpeg',
      0.92
    )
  })
}

/**
 * Valida se o arquivo é uma imagem válida
 */
export const validarArquivoImagem = (arquivo: File): { valido: boolean; erro?: string } => {
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const tamanhoMaximo = 10 * 1024 * 1024 // 10MB

  if (!tiposPermitidos.includes(arquivo.type)) {
    return {
      valido: false,
      erro: 'Formato não suportado. Use JPG, PNG, WebP ou GIF.',
    }
  }

  if (arquivo.size > tamanhoMaximo) {
    return {
      valido: false,
      erro: 'Arquivo muito grande. O tamanho máximo é 10MB.',
    }
  }

  return { valido: true }
}

/**
 * Converte arquivo para URL de preview
 */
export const arquivoParaUrl = (arquivo: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(arquivo)
  })
}
