import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type DadosRelatorio = {
  vendasPorDia: { data: string; total: number; quantidade: number }[]
  produtosMaisVendidos: { nome: string; quantidade: number; receita: number }[]
  vendasPorCategoria: { categoria: string; quantidade: number; receita: number }[]
  estatisticas: {
    receitaTotal: number
    pedidosTotal: number
    ticketMedio: number
    crescimento: number
  }
  horariosPico: { hora: number; quantidade: number }[]
  faturamentoPorPagamento: { forma: string; total: number; quantidade: number }[]
  pedidosPorTipo: {
    entregas: { total: number; quantidade: number }
    retiradas: { total: number; quantidade: number }
    local: { total: number; quantidade: number }
  }
  entregasPorPeriodo: {
    hoje: number
    semana: number
    mes: number
  }
}

const FORMAS_PAGAMENTO_NOMES: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  vale_refeicao: 'Vale Refeição',
}

export function gerarPdfRelatorios(
  dados: DadosRelatorio,
  dataInicio: string,
  dataFim: string,
  nomeEstabelecimento: string = 'Bar da Ladeira'
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let yPos = margin

  // Cores do tema
  const corPrimaria = [37, 99, 235] as [number, number, number] // Azul principal
  const corSecundaria = [15, 23, 42] as [number, number, number] // Azul escuro
  const corTexto = [63, 63, 70] as [number, number, number] // Zinc-700
  const corVerde = [34, 197, 94] as [number, number, number]
  const corAzul = [14, 116, 144] as [number, number, number]
  const corRoxa = [79, 70, 229] as [number, number, number]

  // ============ CABEÇALHO ============
  // Fundo do cabeçalho
  doc.setFillColor(...corSecundaria)
  doc.rect(0, 0, pageWidth, 45, 'F')

  // Logo/Nome do estabelecimento
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(nomeEstabelecimento, margin, 20)

  // Subtítulo
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Relatório de Vendas e Desempenho', margin, 30)

  // Período
  const dataInicioFormatada = format(new Date(dataInicio + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const dataFimFormatada = format(new Date(dataFim + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  doc.setFontSize(10)
  doc.setTextColor(209, 213, 219)
  doc.text(`Período: ${dataInicioFormatada} até ${dataFimFormatada}`, margin, 40)

  // Data de geração
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth - margin,
    40,
    { align: 'right' }
  )

  yPos = 55

  // ============ CARDS DE ESTATÍSTICAS ============
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...corSecundaria)
  doc.text('Resumo do Período', margin, yPos)
  yPos += 8

  const cardWidth = (pageWidth - margin * 2 - 15) / 4
  const cardHeight = 28
  const cards = [
    { 
      label: 'Receita Total', 
      valor: `R$ ${dados.estatisticas.receitaTotal.toFixed(2)}`,
      fundo: [240, 253, 244] as [number, number, number],
      borda: [134, 239, 172] as [number, number, number],
      valorCor: corVerde
    },
    { 
      label: 'Total de Pedidos', 
      valor: dados.estatisticas.pedidosTotal.toString(),
      fundo: [239, 246, 255] as [number, number, number],
      borda: [147, 197, 253] as [number, number, number],
      valorCor: corAzul
    },
    { 
      label: 'Ticket Médio', 
      valor: `R$ ${dados.estatisticas.ticketMedio.toFixed(2)}`,
      fundo: [238, 242, 255] as [number, number, number],
      borda: [165, 180, 252] as [number, number, number],
      valorCor: corRoxa
    },
    { 
      label: 'Crescimento', 
      valor: `${dados.estatisticas.crescimento >= 0 ? '+' : ''}${dados.estatisticas.crescimento.toFixed(1)}%`,
      fundo: dados.estatisticas.crescimento >= 0
        ? ([240, 253, 244] as [number, number, number])
        : ([254, 242, 242] as [number, number, number]),
      borda: dados.estatisticas.crescimento >= 0
        ? ([134, 239, 172] as [number, number, number])
        : ([252, 165, 165] as [number, number, number]),
      valorCor: dados.estatisticas.crescimento >= 0
        ? corVerde
        : ([220, 38, 38] as [number, number, number]),
    },
  ]

  cards.forEach((card, index) => {
    const x = margin + index * (cardWidth + 5)
    
    // Fundo do card
    doc.setFillColor(...card.fundo)
    doc.setDrawColor(...card.borda)
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 3, 3, 'FD')
    
    // Texto do card
    doc.setTextColor(...corTexto)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(card.label, x + 5, yPos + 8)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...card.valorCor)
    doc.text(card.valor, x + 5, yPos + 20)
  })

  yPos += cardHeight + 15

  // ============ PEDIDOS POR TIPO ============
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...corSecundaria)
  doc.text('Pedidos por Tipo', margin, yPos)
  yPos += 5

  const totalPedidosTipo = dados.pedidosPorTipo.entregas.quantidade + 
                           dados.pedidosPorTipo.retiradas.quantidade + 
                           dados.pedidosPorTipo.local.quantidade

  if (totalPedidosTipo > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Quantidade', 'Valor Total', '% do Total']],
      body: [
        ['Entregas (Delivery)', 
          dados.pedidosPorTipo.entregas.quantidade.toString(),
          `R$ ${dados.pedidosPorTipo.entregas.total.toFixed(2)}`,
          `${((dados.pedidosPorTipo.entregas.quantidade / totalPedidosTipo) * 100).toFixed(1)}%`
        ],
        ['Retiradas (Balcão)', 
          dados.pedidosPorTipo.retiradas.quantidade.toString(),
          `R$ ${dados.pedidosPorTipo.retiradas.total.toFixed(2)}`,
          `${((dados.pedidosPorTipo.retiradas.quantidade / totalPedidosTipo) * 100).toFixed(1)}%`
        ],
        ['No Local (Mesa)', 
          dados.pedidosPorTipo.local.quantidade.toString(),
          `R$ ${dados.pedidosPorTipo.local.total.toFixed(2)}`,
          `${((dados.pedidosPorTipo.local.quantidade / totalPedidosTipo) * 100).toFixed(1)}%`
        ],
      ],
      foot: [['TOTAL', 
        totalPedidosTipo.toString(),
        `R$ ${(dados.pedidosPorTipo.entregas.total + dados.pedidosPorTipo.retiradas.total + dados.pedidosPorTipo.local.total).toFixed(2)}`,
        '100%'
      ]],
      theme: 'striped',
      headStyles: { 
        fillColor: corPrimaria,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      footStyles: {
        fillColor: corSecundaria,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: corTexto
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'center', cellWidth: 30 }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15
  } else {
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text('Nenhum pedido registrado no período', margin, yPos + 10)
    yPos += 20
  }

  // ============ FATURAMENTO POR FORMA DE PAGAMENTO ============
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...corSecundaria)
  doc.text('Faturamento por Forma de Pagamento', margin, yPos)
  yPos += 5

  if (dados.faturamentoPorPagamento.length > 0) {
    const totalGeral = dados.faturamentoPorPagamento.reduce((acc, p) => acc + p.total, 0)
    
    autoTable(doc, {
      startY: yPos,
      head: [['Forma de Pagamento', 'Transações', 'Valor Total', '% do Total']],
      body: dados.faturamentoPorPagamento.map(p => [
        FORMAS_PAGAMENTO_NOMES[p.forma] || p.forma,
        p.quantidade.toString(),
        `R$ ${p.total.toFixed(2)}`,
        `${((p.total / totalGeral) * 100).toFixed(1)}%`
      ]),
      foot: [['TOTAL', 
        dados.faturamentoPorPagamento.reduce((acc, p) => acc + p.quantidade, 0).toString(),
        `R$ ${totalGeral.toFixed(2)}`,
        '100%'
      ]],
      theme: 'striped',
      headStyles: { 
        fillColor: corPrimaria,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      footStyles: {
        fillColor: corSecundaria,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: corTexto
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'center', cellWidth: 30 }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15
  } else {
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text('Nenhum pagamento registrado no período', margin, yPos + 10)
    yPos += 20
  }

  // ============ VENDAS POR DIA ============
  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...corSecundaria)
  doc.text('Vendas por Dia', margin, yPos)
  yPos += 5

  if (dados.vendasPorDia.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Quantidade de Pedidos', 'Receita']],
      body: dados.vendasPorDia.map(v => [
        v.data,
        v.quantidade.toString(),
        `R$ ${v.total.toFixed(2)}`
      ]),
      foot: [['TOTAL', 
        dados.vendasPorDia.reduce((acc, v) => acc + v.quantidade, 0).toString(),
        `R$ ${dados.vendasPorDia.reduce((acc, v) => acc + v.total, 0).toFixed(2)}`
      ]],
      theme: 'striped',
      headStyles: { 
        fillColor: corAzul,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      footStyles: {
        fillColor: corSecundaria,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: corTexto
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'right', cellWidth: 50 }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15
  }

  // ============ PRODUTOS MAIS VENDIDOS ============
  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...corSecundaria)
  doc.text('Top 10 Produtos Mais Vendidos', margin, yPos)
  yPos += 5

  if (dados.produtosMaisVendidos.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Produto', 'Quantidade', 'Receita']],
      body: dados.produtosMaisVendidos.slice(0, 10).map((p, i) => [
        (i + 1).toString(),
        p.nome,
        `${p.quantidade}x`,
        `R$ ${p.receita.toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { 
        fillColor: corVerde,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: corTexto
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 80 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15
  }

  // ============ VENDAS POR CATEGORIA ============
  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...corSecundaria)
  doc.text('Vendas por Categoria', margin, yPos)
  yPos += 5

  if (dados.vendasPorCategoria.length > 0) {
    const totalCategoria = dados.vendasPorCategoria.reduce((acc, c) => acc + c.receita, 0)
    
    autoTable(doc, {
      startY: yPos,
      head: [['Categoria', 'Quantidade', 'Receita', '% do Total']],
      body: dados.vendasPorCategoria.map(c => [
        c.categoria,
        c.quantidade.toString(),
        `R$ ${c.receita.toFixed(2)}`,
        `${((c.receita / totalCategoria) * 100).toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { 
        fillColor: corRoxa,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: corTexto
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'center', cellWidth: 30 }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15
  }

  // ============ HORÁRIOS DE PICO ============
  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...corSecundaria)
  doc.text('Horários de Pico', margin, yPos)
  yPos += 5

  if (dados.horariosPico.length > 0) {
    const maxPedidos = Math.max(...dados.horariosPico.map(h => h.quantidade))
    
    autoTable(doc, {
      startY: yPos,
      head: [['Horário', 'Pedidos', 'Intensidade']],
      body: dados.horariosPico.map(h => {
        const intensidade = Math.round((h.quantidade / maxPedidos) * 100)
        const barras = '█'.repeat(Math.ceil(intensidade / 10)) + '░'.repeat(10 - Math.ceil(intensidade / 10))
        return [
          `${h.hora.toString().padStart(2, '0')}:00 - ${(h.hora + 1).toString().padStart(2, '0')}:00`,
          h.quantidade.toString(),
          `${barras} ${intensidade}%`
        ]
      }),
      theme: 'striped',
      headStyles: { 
        fillColor: corPrimaria,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: corTexto
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 30 },
        2: { cellWidth: 80 }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15
  }

  // ============ RODAPÉ ============
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    
    // Linha separadora
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
    
    // Texto do rodapé
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `${nomeEstabelecimento} - Relatório de Vendas`,
      margin,
      pageHeight - 8
    )
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    )
  }

  // Salvar o PDF
  const nomeArquivo = `relatorio_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`
  doc.save(nomeArquivo)
}
