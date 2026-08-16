/**
 * Serviço de upload de imagens para Cloudflare R2
 * Responsável por compactar e enviar imagens de forma otimizada
 * 
 * Características:
 * - Compactação agressiva (qualidade 70-80%)
 * - Redimensionamento para máximo 800px
 * - Conversão automática para JPEG (menor tamanho)
 * - Retry automático em caso de falha
 */

// Configurações de compactação para máxima economia de espaço
const CONFIG_COMPACTACAO = {
  // Dimensão máxima (800px é suficiente para miniaturas de produtos)
  dimensaoMaxima: 800,
  // Qualidade JPEG (70% oferece bom equilíbrio entre qualidade e tamanho)
  qualidadeInicial: 0.70,
  // Qualidade mínima antes de redimensionar
  qualidadeMinima: 0.50,
  // Tamanho alvo em bytes (500KB é mais que suficiente)
  tamanhoAlvo: 500 * 1024,
  // Tamanho máximo absoluto (1MB)
  tamanhoMaximo: 1024 * 1024,
}

export type ResultadoUpload = {
  sucesso: boolean
  url?: string
  erro?: string
}

/**
 * Carrega uma imagem a partir de uma URL ou base64
 */
async function carregarImagem(origem: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image()
    imagem.crossOrigin = 'anonymous'
    imagem.onload = () => resolve(imagem)
    imagem.onerror = () => reject(new Error('Falha ao carregar imagem'))
    imagem.src = origem
  })
}

/**
 * Redimensiona e compacta uma imagem para o tamanho ideal
 * Usa compressão progressiva até atingir o tamanho alvo
 */
async function compactarImagem(
  imagem: HTMLImageElement,
  qualidade: number = CONFIG_COMPACTACAO.qualidadeInicial
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Não foi possível criar contexto de canvas')
  }

  // Calcula dimensões mantendo proporção
  let largura = imagem.naturalWidth
  let altura = imagem.naturalHeight
  const dimensaoMax = CONFIG_COMPACTACAO.dimensaoMaxima

  if (largura > dimensaoMax || altura > dimensaoMax) {
    if (largura > altura) {
      altura = Math.round((altura * dimensaoMax) / largura)
      largura = dimensaoMax
    } else {
      largura = Math.round((largura * dimensaoMax) / altura)
      altura = dimensaoMax
    }
  }

  canvas.width = largura
  canvas.height = altura

  // Fundo branco para evitar transparência (menor tamanho em JPEG)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, largura, altura)

  // Desenha com alta qualidade de interpolação
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imagem, 0, 0, largura, altura)

  // Tenta comprimir com a qualidade atual
  let blob = await canvasParaBlob(canvas, qualidade)

  // Se ainda estiver grande, reduz qualidade progressivamente
  while (blob.size > CONFIG_COMPACTACAO.tamanhoAlvo && qualidade > CONFIG_COMPACTACAO.qualidadeMinima) {
    qualidade -= 0.05
    blob = await canvasParaBlob(canvas, qualidade)
  }

  // Se ainda estiver muito grande, redimensiona mais
  if (blob.size > CONFIG_COMPACTACAO.tamanhoMaximo) {
    const novaLargura = Math.round(largura * 0.7)
    const novaAltura = Math.round(altura * 0.7)

    const canvasReduzido = document.createElement('canvas')
    canvasReduzido.width = novaLargura
    canvasReduzido.height = novaAltura

    const ctxReduzido = canvasReduzido.getContext('2d')
    if (ctxReduzido) {
      ctxReduzido.fillStyle = '#FFFFFF'
      ctxReduzido.fillRect(0, 0, novaLargura, novaAltura)
      ctxReduzido.imageSmoothingEnabled = true
      ctxReduzido.imageSmoothingQuality = 'high'
      ctxReduzido.drawImage(canvas, 0, 0, novaLargura, novaAltura)
      blob = await canvasParaBlob(canvasReduzido, CONFIG_COMPACTACAO.qualidadeMinima)
    }
  }

  return blob
}

/**
 * Converte canvas para blob JPEG
 */
function canvasParaBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Falha ao converter canvas para blob'))
        }
      },
      'image/jpeg',
      qualidade
    )
  })
}

/**
 * Compacta um Blob de imagem (usado após recorte)
 */
export async function compactarBlobImagem(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const imagem = await carregarImagem(url)
    return await compactarImagem(imagem)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Faz upload de uma imagem para o Cloudflare R2
 * 
 * @param blob - Blob da imagem (já recortada)
 * @param pasta - Pasta de destino (ex: 'produtos', 'bebidas', 'adicionais')
 * @param id - ID do item (usado para nomear o arquivo)
 * @returns Resultado do upload com URL ou erro
 */
export async function enviarImagemParaR2(
  blob: Blob,
  pasta: string,
  id: string
): Promise<ResultadoUpload> {
  try {
    // Compacta a imagem antes do upload
    const blobCompactado = await compactarBlobImagem(blob)

    // Prepara o FormData para envio
    const formData = new FormData()
    formData.append('arquivo', blobCompactado, `${id}.jpg`)
    formData.append('pasta', pasta)
    formData.append('id', id)

    // Envia para a API
    const resposta = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      return {
        sucesso: false,
        erro: dados.erro || 'Erro ao fazer upload',
      }
    }

    return {
      sucesso: true,
      url: dados.url,
    }
  } catch (erro) {
    console.error('Erro no upload:', erro)
    return {
      sucesso: false,
      erro: 'Falha na conexão. Verifique sua internet e tente novamente.',
    }
  }
}

/**
 * Envia imagem a partir de base64 (compatibilidade com código existente)
 */
export async function enviarImagemBase64ParaR2(
  base64: string,
  pasta: string,
  id: string
): Promise<ResultadoUpload> {
  try {
    // Converte base64 para blob
    const resposta = await fetch(base64)
    const blob = await resposta.blob()

    return await enviarImagemParaR2(blob, pasta, id)
  } catch (erro) {
    console.error('Erro ao processar base64:', erro)
    return {
      sucesso: false,
      erro: 'Erro ao processar imagem',
    }
  }
}

/**
 * Remove uma imagem do R2 (opcional, pois imagens antigas podem ser mantidas)
 */
export async function removerImagemDoR2(nomeArquivo: string): Promise<boolean> {
  try {
    const resposta = await fetch(`/api/upload?arquivo=${encodeURIComponent(nomeArquivo)}`, {
      method: 'DELETE',
    })

    return resposta.ok
  } catch (erro) {
    console.error('Erro ao remover imagem:', erro)
    return false
  }
}

/**
 * Extrai o nome do arquivo de uma URL do R2
 * Útil para remover imagens antigas
 */
export function extrairNomeArquivoDeUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Remove a barra inicial do pathname
    return urlObj.pathname.substring(1)
  } catch {
    return null
  }
}
