import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Tipos de arquivo permitidos
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Tamanho máximo: 5MB (já comprimido no cliente)
const TAMANHO_MAXIMO = 5 * 1024 * 1024

/**
 * Cria o cliente S3 para Backblaze B2 (lazy initialization)
 */
function criarClienteB2(): S3Client {
  return new S3Client({
    region: process.env.B2_REGION || 'us-east-005',
    endpoint: process.env.NEXT_PUBLIC_B2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.B2_APPLICATION_KEY_ID || '',
      secretAccessKey: process.env.B2_APPLICATION_KEY || '',
    },
    forcePathStyle: true, // Necessário para B2
  })
}

/**
 * Gera um nome único para o arquivo baseado no contexto
 */
function gerarNomeArquivo(pasta: string, id: string, extensao: string): string {
  const timestamp = Date.now()
  const aleatorio = Math.random().toString(36).substring(2, 8)
  return `${pasta}/${id}_${timestamp}_${aleatorio}.${extensao}`
}

/**
 * Extrai a extensão do tipo MIME
 */
function obterExtensao(tipoMime: string): string {
  const mapa: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return mapa[tipoMime] || 'jpg'
}

/**
 * POST - Faz upload de uma imagem para o Backblaze B2
 */
export async function POST(requisicao: NextRequest) {
  try {
    const urlPublicaB2 = process.env.NEXT_PUBLIC_B2_PUBLIC_URL || ''
    const nomeBucket = process.env.NEXT_PUBLIC_B2_BUCKET_NAME || 'derick-mackenzie'

    // Verifica se as credenciais estão configuradas
    if (!process.env.NEXT_PUBLIC_B2_ENDPOINT || !process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY) {
      console.error('Credenciais do B2 não configuradas:', {
        endpoint: !!process.env.NEXT_PUBLIC_B2_ENDPOINT,
        keyId: !!process.env.B2_APPLICATION_KEY_ID,
        key: !!process.env.B2_APPLICATION_KEY,
      })
      return NextResponse.json(
        { erro: 'Serviço de armazenamento não configurado corretamente' },
        { status: 500 }
      )
    }

    if (!urlPublicaB2) {
      console.error('URL pública do B2 não configurada')
      return NextResponse.json(
        { erro: 'URL pública do B2 não configurada' },
        { status: 500 }
      )
    }

    const formData = await requisicao.formData()
    const arquivo = formData.get('arquivo') as File | null
    const pasta = (formData.get('pasta') as string) || 'geral'
    const id = (formData.get('id') as string) || 'arquivo'

    if (!arquivo) {
      return NextResponse.json(
        { erro: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    // Validação do tipo de arquivo
    if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
      return NextResponse.json(
        { erro: 'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.' },
        { status: 400 }
      )
    }

    // Validação do tamanho
    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        { erro: 'Arquivo muito grande. O tamanho máximo é 5MB.' },
        { status: 400 }
      )
    }

    // Converte o arquivo para buffer
    const arrayBuffer = await arquivo.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Gera o nome do arquivo
    const extensao = obterExtensao(arquivo.type)
    const nomeArquivo = gerarNomeArquivo(pasta, id, extensao)

    // Cria cliente B2 (lazy initialization)
    const clienteB2 = criarClienteB2()

    // Faz o upload para o B2
    const comandoUpload = new PutObjectCommand({
      Bucket: nomeBucket,
      Key: nomeArquivo,
      Body: buffer,
      ContentType: arquivo.type,
      // Cache de 1 ano para imagens (são imutáveis pelo nome único)
      CacheControl: 'public, max-age=31536000, immutable',
    })

    await clienteB2.send(comandoUpload)

    // Monta a URL pública da imagem
    const urlPublica = `${urlPublicaB2}/${nomeArquivo}`

    return NextResponse.json({
      sucesso: true,
      url: urlPublica,
      nomeArquivo,
    })
  } catch (erro) {
    console.error('Erro ao fazer upload para B2:', erro)
    return NextResponse.json(
      { erro: 'Falha ao fazer upload da imagem. Tente novamente.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove uma imagem do Backblaze B2
 */
export async function DELETE(requisicao: NextRequest) {
  try {
    const nomeBucket = process.env.NEXT_PUBLIC_B2_BUCKET_NAME || 'derick-mackenzie'

    // Verifica se as credenciais estão configuradas
    if (!process.env.NEXT_PUBLIC_B2_ENDPOINT || !process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY) {
      return NextResponse.json(
        { erro: 'Serviço de armazenamento não configurado' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(requisicao.url)
    const nomeArquivo = searchParams.get('arquivo')

    if (!nomeArquivo) {
      return NextResponse.json(
        { erro: 'Nome do arquivo não informado' },
        { status: 400 }
      )
    }

    // Cria cliente B2 (lazy initialization)
    const clienteB2 = criarClienteB2()

    // Remove o arquivo do B2
    const comandoDelete = new DeleteObjectCommand({
      Bucket: nomeBucket,
      Key: nomeArquivo,
    })

    await clienteB2.send(comandoDelete)

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Arquivo removido com sucesso',
    })
  } catch (erro) {
    console.error('Erro ao remover arquivo do B2:', erro)
    return NextResponse.json(
      { erro: 'Falha ao remover o arquivo' },
      { status: 500 }
    )
  }
}
