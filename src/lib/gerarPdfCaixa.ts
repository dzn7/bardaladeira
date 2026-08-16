import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Caixa, MovimentacaoCaixa } from '@/lib/tipos-caixa'

type DadosPdf = {
  caixa: Caixa
  movimentacoes: MovimentacaoCaixa[]
  estatisticas: {
    saldoAtual: number
    totalEntradas: number
    totalSaidas: number
    quantidadeMovimentacoes: number
  }
}

export function gerarPdfCaixa({ caixa, movimentacoes, estatisticas }: DadosPdf) {
  const doc = new jsPDF()
  const larguraPagina = doc.internal.pageSize.getWidth()
  
  // Cores
  const corPrimaria = [15, 23, 42] as [number, number, number] // Azul escuro
  const corDestaque = [37, 99, 235] as [number, number, number] // Azul profissional
  const corTexto = [30, 30, 30] as [number, number, number]
  const corVerde = [34, 197, 94] as [number, number, number]
  const corVermelha = [239, 68, 68] as [number, number, number]

  // Cabeçalho
  doc.setFillColor(...corPrimaria)
  doc.rect(0, 0, larguraPagina, 35, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Bar da Ladeira', 14, 18)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Relatório de Caixa', 14, 28)

  // Data do relatório
  doc.setFontSize(10)
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, larguraPagina - 14, 28, { align: 'right' })

  // Informações do Caixa
  let posY = 50
  
  doc.setTextColor(...corTexto)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Informações do Caixa', 14, posY)
  
  posY += 10
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  const dataAbertura = format(new Date(caixa.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const dataFechamento = caixa.data_fechamento 
    ? format(new Date(caixa.data_fechamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : 'Em aberto'
  
  doc.text(`Status: ${caixa.status === 'aberto' ? 'ABERTO' : 'FECHADO'}`, 14, posY)
  posY += 6
  doc.text(`Abertura: ${dataAbertura}`, 14, posY)
  doc.text(`Responsável: ${caixa.responsavel_abertura || '-'}`, larguraPagina / 2, posY)
  posY += 6
  doc.text(`Fechamento: ${dataFechamento}`, 14, posY)
  if (caixa.responsavel_fechamento) {
    doc.text(`Responsável: ${caixa.responsavel_fechamento}`, larguraPagina / 2, posY)
  }

  // Resumo Financeiro
  posY += 15
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo Financeiro', 14, posY)
  
  posY += 8
  
  // Caixas de resumo
  const boxWidth = (larguraPagina - 42) / 4
  const boxHeight = 25
  const boxY = posY
  
  // Valor Abertura
  doc.setFillColor(244, 244, 245)
  doc.roundedRect(14, boxY, boxWidth, boxHeight, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Valor Abertura', 14 + boxWidth/2, boxY + 8, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(...corTexto)
  doc.setFont('helvetica', 'bold')
  doc.text(`R$ ${Number(caixa.valor_abertura).toFixed(2)}`, 14 + boxWidth/2, boxY + 18, { align: 'center' })
  
  // Total Entradas
  doc.setFillColor(220, 252, 231)
  doc.roundedRect(14 + boxWidth + 5, boxY, boxWidth, boxHeight, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Total Entradas', 14 + boxWidth + 5 + boxWidth/2, boxY + 8, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(...corVerde)
  doc.setFont('helvetica', 'bold')
  doc.text(`R$ ${estatisticas.totalEntradas.toFixed(2)}`, 14 + boxWidth + 5 + boxWidth/2, boxY + 18, { align: 'center' })
  
  // Total Saídas
  doc.setFillColor(254, 226, 226)
  doc.roundedRect(14 + (boxWidth + 5) * 2, boxY, boxWidth, boxHeight, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Total Saídas', 14 + (boxWidth + 5) * 2 + boxWidth/2, boxY + 8, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(...corVermelha)
  doc.setFont('helvetica', 'bold')
  doc.text(`R$ ${estatisticas.totalSaidas.toFixed(2)}`, 14 + (boxWidth + 5) * 2 + boxWidth/2, boxY + 18, { align: 'center' })
  
  // Saldo Final
  doc.setFillColor(219, 234, 254)
  doc.roundedRect(14 + (boxWidth + 5) * 3, boxY, boxWidth, boxHeight, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Saldo Final', 14 + (boxWidth + 5) * 3 + boxWidth/2, boxY + 8, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(...corDestaque)
  doc.setFont('helvetica', 'bold')
  doc.text(`R$ ${estatisticas.saldoAtual.toFixed(2)}`, 14 + (boxWidth + 5) * 3 + boxWidth/2, boxY + 18, { align: 'center' })

  // Diferença (se houver)
  posY = boxY + boxHeight + 10
  if (caixa.diferenca !== null && caixa.diferenca !== 0) {
    const corDiferenca = caixa.diferenca > 0 ? corVerde : corVermelha
    doc.setTextColor(...corDiferenca)
    doc.setFontSize(10)
    doc.text(
      `Diferença no fechamento: ${caixa.diferenca > 0 ? '+' : ''}R$ ${caixa.diferenca.toFixed(2)}`,
      14, posY
    )
    posY += 8
  }

  // Tabela de Movimentações
  posY += 5
  doc.setTextColor(...corTexto)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Movimentações', 14, posY)
  
  posY += 5

  if (movimentacoes.length > 0) {
    const dadosTabela = movimentacoes.map(mov => [
      format(new Date(mov.created_at), 'dd/MM HH:mm', { locale: ptBR }),
      mov.tipo === 'entrada' ? 'Entrada' : 'Saída',
      mov.categoria?.nome || '-',
      mov.funcionario?.nome || '-',
      mov.forma_pagamento || '-',
      mov.descricao || '-',
      `R$ ${Number(mov.valor).toFixed(2)}`
    ])

    autoTable(doc, {
      startY: posY,
      head: [['Data/Hora', 'Tipo', 'Categoria', 'Funcionário', 'Pagamento', 'Descrição', 'Valor']],
      body: dadosTabela,
      theme: 'striped',
      headStyles: {
        fillColor: corDestaque,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        textColor: corTexto
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 22 },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 22, halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    })
  } else {
    posY += 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text('Nenhuma movimentação registrada.', 14, posY)
  }

  // Observações
  if (caixa.observacoes) {
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || posY + 20
    doc.setTextColor(...corTexto)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Observações', 14, finalY + 15)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(caixa.observacoes, 14, finalY + 23)
  }

  // Rodapé
  const totalPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Página ${i} de ${totalPaginas}`,
      larguraPagina / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Salvar
  const nomeArquivo = `caixa_${format(new Date(caixa.data_abertura), 'yyyy-MM-dd_HH-mm')}.pdf`
  doc.save(nomeArquivo)
}
