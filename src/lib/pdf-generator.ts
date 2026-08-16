import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ItemPedido = {
  produto?: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  adicionais?: string
  observacoes?: string
}

type Pagamento = {
  forma_pagamento: string
  valor: number
}

type Pedido = {
  id: string
  nome_cliente: string
  telefone: string
  endereco?: string
  bairro?: string
  referencia?: string
  tipo_entrega: string
  status: string
  subtotal?: number
  taxa_entrega?: number
  taxa_pagamento?: number
  taxa_servico?: number
  total: number
  created_at: string
  forma_pagamento?: string
  troco_para?: number | null
  observacoes?: string
  mesa?: number | null
  comanda?: number | null
  itens: ItemPedido[]
  pagamentos?: Pagamento[]
}

export function gerarPDFPedido(pedido: Pedido) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 14
  const contentWidth = pageWidth - marginX * 2

  const colors = {
    header: [15, 23, 42] as [number, number, number],
    accent: [37, 99, 235] as [number, number, number],
    accentSoft: [219, 234, 254] as [number, number, number],
    text: [24, 24, 27] as [number, number, number],
    muted: [82, 82, 91] as [number, number, number],
    border: [212, 212, 216] as [number, number, number],
    rowAlt: [248, 250, 252] as [number, number, number],
    successSoft: [220, 252, 231] as [number, number, number],
  }

  const moeda = (valor: number) => `R$ ${Number(valor || 0).toFixed(2)}`

  const subtotal = Number(
    pedido.subtotal ??
      pedido.itens.reduce((acc, item) => acc + Number(item.subtotal || 0), 0)
  )
  const taxaEntrega = Number(pedido.taxa_entrega || 0)
  const taxaPagamento = Number(pedido.taxa_pagamento || 0)
  const taxaServico = Number(pedido.taxa_servico || 0)

  const formaPagamento = pedido.forma_pagamento || 'Não informado'
  const tipoEntrega =
    pedido.tipo_entrega === 'entrega'
      ? 'Entrega'
      : pedido.tipo_entrega === 'retirada'
        ? 'Retirada'
        : 'No local'

  // Header
  doc.setFillColor(...colors.header)
  doc.rect(0, 0, pageWidth, 34, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.text('Bar da Ladeira', marginX, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Comprovante de Pedido', marginX, 22)
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    marginX,
    28
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Pedido #${pedido.id.slice(0, 8).toUpperCase()}`, pageWidth - marginX, 22, {
    align: 'right',
  })

  let y = 44

  // Bloco informativo
  doc.setDrawColor(...colors.border)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(marginX, y - 6, contentWidth, 34, 2, 2, 'FD')

  doc.setTextColor(...colors.text)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Cliente', marginX + 4, y)
  doc.text('Resumo do Pedido', pageWidth / 2 + 2, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...colors.muted)
  doc.setFontSize(9)

  const nomeLinha = doc.splitTextToSize(`Nome: ${pedido.nome_cliente}`, contentWidth / 2 - 8)
  doc.text(nomeLinha, marginX + 4, y + 6)
  doc.text(`Telefone: ${pedido.telefone || '-'}`, marginX + 4, y + 12)
  doc.text(`Data: ${format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, marginX + 4, y + 18)

  doc.text(`Status: ${pedido.status}`, pageWidth / 2 + 2, y + 6)
  doc.text(`Entrega: ${tipoEntrega}`, pageWidth / 2 + 2, y + 12)
  doc.text(`Pagamento: ${formaPagamento}`, pageWidth / 2 + 2, y + 18)

  if (pedido.comanda) {
    doc.text(`Comanda: ${pedido.comanda}`, pageWidth / 2 + 2, y + 24)
  } else if (pedido.mesa) {
    doc.text(`Mesa: ${pedido.mesa}`, pageWidth / 2 + 2, y + 24)
  }

  y += 36

  if (pedido.tipo_entrega === 'entrega') {
    const enderecoCompleto = [pedido.endereco, pedido.bairro, pedido.referencia]
      .filter(Boolean)
      .join(' • ')

    if (enderecoCompleto) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...colors.text)
      doc.setFontSize(10)
      doc.text('Endereço de Entrega', marginX, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...colors.muted)
      doc.setFontSize(9)
      const linhasEndereco = doc.splitTextToSize(enderecoCompleto, contentWidth)
      doc.text(linhasEndereco, marginX, y)
      y += linhasEndereco.length * 4 + 2
    }
  }

  const tableData: any[] = pedido.itens
    .map((item) => {
      const nomeProduto = item.produto || item.nome_item || 'Produto'
      const rows: any[] = [
        [
          nomeProduto,
          item.quantidade.toString(),
          moeda(item.preco_unitario),
          moeda(item.subtotal),
        ],
      ]

      if (item.adicionais) {
        rows.push([
          {
            content: `+ Adicionais: ${item.adicionais}`,
            colSpan: 4,
            styles: {
              fontStyle: 'italic',
              textColor: colors.muted,
              fillColor: [250, 250, 250],
            },
          },
        ])
      }

      if (item.observacoes) {
        rows.push([
          {
            content: `Obs: ${item.observacoes}`,
            colSpan: 4,
            styles: {
              fontStyle: 'italic',
              textColor: colors.muted,
              fillColor: [250, 250, 250],
            },
          },
        ])
      }

      return rows
    })
    .flat()

  autoTable(doc, {
    startY: y + 2,
    head: [['Item', 'Qtd', 'Preço Un.', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      textColor: colors.text,
      lineColor: colors.border,
      lineWidth: 0.1,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: colors.accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: colors.rowAlt,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: marginX, right: marginX },
  })

  let finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 20
  finalY += 8

  const resumoLinhas: [string, string][] = [
    ['Subtotal', moeda(subtotal)],
  ]

  if (taxaEntrega > 0) {
    resumoLinhas.push(['Taxa de entrega', moeda(taxaEntrega)])
  } else if (pedido.tipo_entrega === 'entrega') {
    resumoLinhas.push(['Taxa de entrega', 'Grátis'])
  }

  if (taxaPagamento > 0) {
    resumoLinhas.push([`Taxa do meio (${formaPagamento})`, `+ ${moeda(taxaPagamento)}`])
  }

  if (taxaServico > 0) {
    resumoLinhas.push(['Taxa de serviço', `+ ${moeda(taxaServico)}`])
  }

  resumoLinhas.push(['TOTAL', moeda(pedido.total)])

  autoTable(doc, {
    startY: finalY,
    body: resumoLinhas,
    theme: 'plain',
    styles: {
      fontSize: 10,
      textColor: colors.text,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
    },
    didParseCell: (hook) => {
      const isTotal = hook.row.index === resumoLinhas.length - 1
      if (isTotal) {
        hook.cell.styles.fontStyle = 'bold'
        hook.cell.styles.fillColor = colors.successSoft
      }
      if (hook.column.index === 1) {
        hook.cell.styles.halign = 'right'
      }
    },
    margin: { left: pageWidth - 88, right: marginX },
    tableWidth: 74,
  })

  finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || finalY + 20

  // Pagamento dividido
  if (pedido.forma_pagamento === 'Dividido' && pedido.pagamentos && pedido.pagamentos.length > 0) {
    finalY += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...colors.text)
    doc.text('Detalhamento do pagamento dividido', marginX, finalY)
    finalY += 5

    const formaLabels: Record<string, string> = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      credito: 'Cartão de Crédito',
      debito: 'Cartão de Débito',
      vale_refeicao: 'Vale Refeição',
    }

    autoTable(doc, {
      startY: finalY,
      head: [['Forma', 'Valor']],
      body: pedido.pagamentos.map((p) => [
        formaLabels[p.forma_pagamento] || p.forma_pagamento,
        moeda(Number(p.valor)),
      ]),
      theme: 'grid',
      styles: { fontSize: 9, textColor: colors.text, lineColor: colors.border, lineWidth: 0.1 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 36, halign: 'right' },
      },
      margin: { left: marginX, right: marginX },
      tableWidth: 146,
    })
    finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || finalY + 20
  }

  if (pedido.observacoes) {
    finalY += 8
    if (finalY > pageHeight - 30) {
      doc.addPage()
      finalY = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...colors.text)
    doc.text('Observações do pedido', marginX, finalY)
    finalY += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...colors.muted)
    const linhasObs = doc.splitTextToSize(pedido.observacoes, contentWidth)
    doc.text(linhasObs, marginX, finalY)
    finalY += linhasObs.length * 4
  }

  // Rodapé
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...colors.border)
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...colors.muted)
    doc.text('Bar da Ladeira • Documento gerado automaticamente', marginX, pageHeight - 8)
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' })
  }

  doc.save(`pedido-${pedido.id.slice(0, 8)}.pdf`)
}

/**
 * Gera um PDF em formato de ticket/cupom (80mm de largura) para impressão manual.
 * Simula o layout de uma impressora térmica em formato PDF portátil.
 */
export function gerarTicketPDF(pedido: Pedido) {
  const LARGURA_MM = 80
  const MARGEM = 5
  const LARGURA_UTIL = LARGURA_MM - (MARGEM * 2)
  const LINHA_CHARS = 32

  // Calcula altura estimada do documento
  let alturaEstimada = 120 // Base mínima
  alturaEstimada += pedido.itens.length * 12
  pedido.itens.forEach(item => {
    if (item.adicionais) alturaEstimada += 5
    if (item.observacoes) alturaEstimada += 5
  })
  if (pedido.tipo_entrega === 'entrega') alturaEstimada += 20
  if (pedido.observacoes) alturaEstimada += 10
  if (pedido.forma_pagamento === 'Dividido' && pedido.pagamentos) {
    alturaEstimada += pedido.pagamentos.length * 6 + 10
  }
  if (pedido.troco_para && pedido.troco_para > 0) alturaEstimada += 12

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [LARGURA_MM, alturaEstimada]
  })

  let y = 8
  const centroX = LARGURA_MM / 2

  // Função auxiliar para linha separadora
  const linhaSeparadora = (tipo: 'simples' | 'dupla' = 'simples') => {
    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(tipo === 'dupla' ? 0.4 : 0.2)
    doc.line(MARGEM, y, LARGURA_MM - MARGEM, y)
    y += 3
  }

  // Função auxiliar para texto em duas colunas
  const duasColunas = (esquerda: string, direita: string, negrito = false) => {
    doc.setFont('courier', negrito ? 'bold' : 'normal')
    doc.text(esquerda, MARGEM, y)
    doc.text(direita, LARGURA_MM - MARGEM, y, { align: 'right' })
    y += 4
  }

  // ===== CABEÇALHO =====
  doc.setFont('courier', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('BAR DA LADEIRA', centroX, y, { align: 'center' })
  y += 5

  doc.setFont('courier', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text('Bar da Ladeira', centroX, y, { align: 'center' })
  y += 5

  linhaSeparadora('dupla')

  // ===== NÚMERO DO PEDIDO =====
  doc.setFont('courier', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text(`PEDIDO #${pedido.id.slice(0, 8).toUpperCase()}`, centroX, y, { align: 'center' })
  y += 5

  doc.setFont('courier', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text(
    format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    centroX, y, { align: 'center' }
  )
  y += 4

  linhaSeparadora('dupla')

  // ===== TIPO DE ENTREGA =====
  doc.setFont('courier', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)

  const tiposEntrega: Record<string, string> = {
    'entrega': 'ENTREGA',
    'retirada': 'RETIRADA NO LOCAL',
    'local': pedido.comanda ? `COMANDA ${pedido.comanda}` : pedido.mesa ? `MESA ${pedido.mesa}` : 'CONSUMO LOCAL'
  }
  doc.text(tiposEntrega[pedido.tipo_entrega] || pedido.tipo_entrega.toUpperCase(), MARGEM, y)
  y += 5

  // ===== DADOS DO CLIENTE =====
  doc.setFont('courier', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(40, 40, 40)

  if (pedido.nome_cliente) {
    doc.text(`Cliente: ${pedido.nome_cliente}`, MARGEM, y)
    y += 4
  }
  if (pedido.telefone) {
    doc.text(`Tel: ${pedido.telefone}`, MARGEM, y)
    y += 4
  }
  if (pedido.tipo_entrega === 'entrega') {
    if (pedido.endereco) {
      const linhasEnd = doc.splitTextToSize(`End: ${pedido.endereco}`, LARGURA_UTIL)
      doc.text(linhasEnd, MARGEM, y)
      y += linhasEnd.length * 3.5
    }
    if (pedido.bairro) {
      doc.text(`Bairro: ${pedido.bairro}`, MARGEM, y)
      y += 4
    }
    if (pedido.referencia) {
      const linhasRef = doc.splitTextToSize(`Ref: ${pedido.referencia}`, LARGURA_UTIL)
      doc.text(linhasRef, MARGEM, y)
      y += linhasRef.length * 3.5
    }
  }

  linhaSeparadora()

  // ===== ITENS DO PEDIDO =====
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  doc.text('ITENS DO PEDIDO', MARGEM, y)
  y += 4
  linhaSeparadora()

  doc.setFontSize(7)
  pedido.itens.forEach(item => {
    const nomeItem = item.produto || item.nome_item || 'Produto'

    // Nome e quantidade
    doc.setFont('courier', 'bold')
    doc.setTextColor(0, 0, 0)
    const textoItem = `${item.quantidade}x ${nomeItem}`
    const linhasItem = doc.splitTextToSize(textoItem, LARGURA_UTIL - 20)
    doc.text(linhasItem, MARGEM, y)

    // Preço alinhado à direita na primeira linha
    doc.text(`R$ ${item.subtotal.toFixed(2)}`, LARGURA_MM - MARGEM, y, { align: 'right' })
    y += linhasItem.length * 3.5

    // Adicionais
    if (item.adicionais) {
      doc.setFont('courier', 'normal')
      doc.setTextColor(80, 80, 80)
      const linhasAd = doc.splitTextToSize(`  + ${item.adicionais}`, LARGURA_UTIL)
      doc.text(linhasAd, MARGEM, y)
      y += linhasAd.length * 3.5
    }

    // Observações do item
    if (item.observacoes) {
      doc.setFont('courier', 'normal')
      doc.setTextColor(100, 100, 100)
      const linhasObs = doc.splitTextToSize(`  Obs: ${item.observacoes}`, LARGURA_UTIL)
      doc.text(linhasObs, MARGEM, y)
      y += linhasObs.length * 3.5
    }

    y += 1
  })

  linhaSeparadora()

  // ===== TOTAIS =====
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)

  const subtotal = pedido.subtotal ?? pedido.itens.reduce((acc, i) => acc + i.subtotal, 0)
  duasColunas('Subtotal:', `R$ ${subtotal.toFixed(2)}`)

  if (pedido.taxa_entrega && pedido.taxa_entrega > 0) {
    duasColunas('Taxa Entrega:', `R$ ${pedido.taxa_entrega.toFixed(2)}`)
  } else if (pedido.tipo_entrega === 'entrega') {
    duasColunas('Taxa Entrega:', 'GRATIS')
  }

  if ((pedido.taxa_pagamento || 0) > 0) {
    duasColunas('Taxa Pagto:', `R$ ${Number(pedido.taxa_pagamento || 0).toFixed(2)}`)
  }

  if ((pedido.taxa_servico || 0) > 0) {
    duasColunas('Taxa Servico:', `R$ ${Number(pedido.taxa_servico || 0).toFixed(2)}`)
  }

  linhaSeparadora('dupla')

  doc.setFontSize(10)
  duasColunas('TOTAL:', `R$ ${pedido.total.toFixed(2)}`, true)

  linhaSeparadora()

  // ===== FORMA DE PAGAMENTO =====
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)

  if (pedido.forma_pagamento === 'Dividido' && pedido.pagamentos && pedido.pagamentos.length > 0) {
    doc.setFont('courier', 'bold')
    doc.text('PAGAMENTO DIVIDIDO:', MARGEM, y)
    y += 4

    const formaLabels: Record<string, string> = {
      'pix': 'PIX',
      'dinheiro': 'Dinheiro',
      'credito': 'Cartao Credito',
      'debito': 'Cartao Debito',
      'vale_refeicao': 'Vale Refeicao'
    }

    doc.setFont('courier', 'normal')
    pedido.pagamentos.forEach(p => {
      const label = formaLabels[p.forma_pagamento] || p.forma_pagamento
      duasColunas(`  ${label}:`, `R$ ${Number(p.valor).toFixed(2)}`)
    })
  } else {
    duasColunas('Pagamento:', (pedido.forma_pagamento || 'Nao informado').toUpperCase())
  }

  // Troco
  if (pedido.troco_para && pedido.troco_para > 0) {
    duasColunas('Troco para:', `R$ ${pedido.troco_para.toFixed(2)}`)
    const troco = pedido.troco_para - pedido.total
    if (troco > 0) {
      duasColunas('Troco:', `R$ ${troco.toFixed(2)}`, true)
    }
  }

  // ===== OBSERVAÇÕES =====
  if (pedido.observacoes) {
    y += 1
    doc.setFont('courier', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    const linhasObs = doc.splitTextToSize(`Obs: ${pedido.observacoes}`, LARGURA_UTIL)
    doc.text(linhasObs, MARGEM, y)
    y += linhasObs.length * 3.5
  }

  // ===== RODAPÉ =====
  y += 2
  linhaSeparadora()
  doc.setFont('courier', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text('Obrigado pela preferencia!', centroX, y, { align: 'center' })
  y += 4
  doc.text('Bar da Ladeira', centroX, y, { align: 'center' })
  y += 3
  doc.setFontSize(6)
  doc.text('Comercio de Alimentos', centroX, y, { align: 'center' })

  doc.save(`ticket-${pedido.id.slice(0, 8)}.pdf`)
}
