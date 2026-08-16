/**
 * Serviço de integração com Backblaze B2 Cloud Storage
 * Usando a API S3-Compatible para upload e gerenciamento de arquivos
 */

// Configurações do Backblaze B2
const B2_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_B2_ENDPOINT || '',
  bucketName: process.env.NEXT_PUBLIC_B2_BUCKET_NAME || '',
  bucketId: process.env.NEXT_PUBLIC_B2_BUCKET_ID || '',
  publicUrl: process.env.NEXT_PUBLIC_B2_PUBLIC_URL || '',
  region: process.env.B2_REGION || 'us-east-005',
}

/**
 * Gera a URL pública de uma imagem no Backblaze B2
 * @param nomeArquivo - Nome do arquivo no bucket
 * @returns URL pública completa
 */
export function obterUrlPublicaB2(nomeArquivo: string): string {
  if (!nomeArquivo) return ''
  
  // Se já for uma URL completa, retorna como está
  if (nomeArquivo.startsWith('http')) {
    return nomeArquivo
  }
  
  // Remove barra inicial se existir
  const arquivo = nomeArquivo.startsWith('/') ? nomeArquivo.slice(1) : nomeArquivo
  
  return `${B2_CONFIG.publicUrl}/${arquivo}`
}

/**
 * Gera um nome único para o arquivo baseado no timestamp e nome original
 * @param nomeOriginal - Nome original do arquivo
 * @param pasta - Pasta de destino (produtos, bebidas, etc)
 * @returns Nome único do arquivo
 */
export function gerarNomeArquivoUnico(nomeOriginal: string, pasta: string = 'produtos'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extensao = nomeOriginal.split('.').pop()?.toLowerCase() || 'jpg'
  const nomeBase = nomeOriginal
    .split('.')[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .substring(0, 30)
  
  return `${pasta}/${timestamp}-${random}-${nomeBase}.${extensao}`
}

/**
 * Valida se o arquivo é uma imagem válida
 * @param arquivo - Arquivo a ser validado
 * @returns Objeto com resultado da validação
 */
export function validarImagem(arquivo: File): { valido: boolean; erro?: string } {
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const tamanhoMaximo = 5 * 1024 * 1024 // 5MB
  
  if (!tiposPermitidos.includes(arquivo.type)) {
    return {
      valido: false,
      erro: 'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.',
    }
  }
  
  if (arquivo.size > tamanhoMaximo) {
    return {
      valido: false,
      erro: 'Arquivo muito grande. O tamanho máximo é 5MB.',
    }
  }
  
  return { valido: true }
}

/**
 * Comprime uma imagem antes do upload
 * @param arquivo - Arquivo de imagem
 * @param qualidade - Qualidade da compressão (0-1)
 * @param larguraMaxima - Largura máxima da imagem
 * @returns Promise com o arquivo comprimido
 */
export async function comprimirImagem(
  arquivo: File,
  qualidade: number = 0.8,
  larguraMaxima: number = 1200
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    img.onload = () => {
      let largura = img.width
      let altura = img.height
      
      // Redimensiona mantendo proporção
      if (largura > larguraMaxima) {
        altura = (altura * larguraMaxima) / largura
        largura = larguraMaxima
      }
      
      canvas.width = largura
      canvas.height = altura
      
      if (!ctx) {
        reject(new Error('Erro ao criar contexto do canvas'))
        return
      }
      
      ctx.drawImage(img, 0, 0, largura, altura)
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Erro ao converter imagem'))
            return
          }
          
          const arquivoComprimido = new File([blob], arquivo.name, {
            type: 'image/webp',
            lastModified: Date.now(),
          })
          
          resolve(arquivoComprimido)
        },
        'image/webp',
        qualidade
      )
    }
    
    img.onerror = () => reject(new Error('Erro ao carregar imagem'))
    img.src = URL.createObjectURL(arquivo)
  })
}

/**
 * Tipo de retorno do upload
 */
export type ResultadoUpload = {
  sucesso: boolean
  url?: string
  nomeArquivo?: string
  erro?: string
}

/**
 * Faz upload de uma imagem para o Backblaze B2 via API route
 * @param arquivo - Arquivo a ser enviado
 * @param pasta - Pasta de destino no bucket
 * @returns Promise com o resultado do upload
 */
export async function uploadImagemB2(
  arquivo: File,
  pasta: string = 'produtos'
): Promise<ResultadoUpload> {
  try {
    // Valida a imagem
    const validacao = validarImagem(arquivo)
    if (!validacao.valido) {
      return { sucesso: false, erro: validacao.erro }
    }
    
    // Comprime a imagem
    const arquivoComprimido = await comprimirImagem(arquivo)
    
    // Gera nome único
    const nomeArquivo = gerarNomeArquivoUnico(arquivo.name, pasta)
    
    // Cria FormData para enviar
    const formData = new FormData()
    formData.append('arquivo', arquivoComprimido)
    formData.append('nomeArquivo', nomeArquivo)
    
    // Envia para a API route
    const resposta = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    
    if (!resposta.ok) {
      const erro = await resposta.json()
      throw new Error(erro.message || 'Erro ao fazer upload')
    }
    
    const dados = await resposta.json()
    
    return {
      sucesso: true,
      url: dados.url,
      nomeArquivo: dados.nomeArquivo,
    }
  } catch (erro) {
    console.error('Erro no upload:', erro)
    return {
      sucesso: false,
      erro: erro instanceof Error ? erro.message : 'Erro desconhecido no upload',
    }
  }
}

/**
 * Remove uma imagem do Backblaze B2 via API route
 * @param nomeArquivo - Nome do arquivo a ser removido
 * @returns Promise com o resultado da remoção
 */
export async function removerImagemB2(nomeArquivo: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const resposta = await fetch('/api/upload', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nomeArquivo }),
    })
    
    if (!resposta.ok) {
      const erro = await resposta.json()
      throw new Error(erro.message || 'Erro ao remover imagem')
    }
    
    return { sucesso: true }
  } catch (erro) {
    console.error('Erro ao remover imagem:', erro)
    return {
      sucesso: false,
      erro: erro instanceof Error ? erro.message : 'Erro desconhecido ao remover',
    }
  }
}

export { B2_CONFIG }
