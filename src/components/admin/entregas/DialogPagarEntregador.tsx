'use client'

import { useEffect, useState } from 'react'
import {
  AreaTexto,
  Botao,
  Campo,
  Chip,
  EntradaPreco,
  Gaveta,
  LinhaInterruptor,
  Segmentos,
  formatarPreco,
  lerPreco,
} from '@/components/admin/ui'
import type { ResumoEntregadorDia } from '@/lib/tipos-entregas'

const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Transferência', 'Cartão']

type Props = {
  registro: ResumoEntregadorDia | null
  aberto: boolean
  salvando: boolean
  onFechar: () => void
  onConfirmar: (params: {
    registroId: string
    valor: number
    acumularRestante: boolean
    metodoPagamento: string
    observacoes?: string
  }) => Promise<boolean>
}

export default function DialogPagarEntregador({
  registro,
  aberto,
  salvando,
  onFechar,
  onConfirmar,
}: Props) {
  const [valor, setValor] = useState('')
  const [acumularRestante, setAcumularRestante] = useState(true)
  const [metodoPagamento, setMetodoPagamento] = useState('Dinheiro')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (registro && aberto) {
      setValor(registro.saldo.toFixed(2).replace('.', ','))
      setAcumularRestante(true)
      setMetodoPagamento('Dinheiro')
      setObservacoes('')
    }
  }, [registro, aberto])

  if (!registro) return null

  const valorNumero = lerPreco(valor) ?? 0
  const restante = Math.max(0, registro.saldo - valorNumero)
  const valorValido = valorNumero > 0 && valorNumero <= registro.saldo
  const pagandoTudo = restante <= 0.001

  const handleConfirmar = async () => {
    if (!valorValido || !registro.registro_id) return
    const ok = await onConfirmar({
      registroId: registro.registro_id,
      valor: valorNumero,
      acumularRestante: !pagandoTudo && acumularRestante,
      metodoPagamento,
      observacoes,
    })
    if (ok) onFechar()
  }

  const dataFormatada = new Date(registro.data_referencia + 'T00:00:00').toLocaleDateString(
    'pt-BR',
    { day: '2-digit', month: 'long', year: 'numeric' }
  )

  const definirValor = (numero: number) => setValor(numero.toFixed(2).replace('.', ','))

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={() => !salvando && onFechar()}
      bloqueada={salvando}
      titulo="Pagar entregador"
      descricao={`${registro.entregador_nome} · ${dataFormatada}`}
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={handleConfirmar} disabled={!valorValido} carregando={salvando}>
            Confirmar pagamento
          </Botao>
        </>
      }
    >
      <div className="space-y-5">
        <dl className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Entregas no dia</dt>
            <dd className="tabular-nums">{registro.total_entregas}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total do dia</dt>
            <dd className="tabular-nums">{formatarPreco(registro.total_devido)}</dd>
          </div>
          {registro.valor_pago > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Já pago</dt>
              <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatarPreco(registro.valor_pago)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border/70 pt-2 font-medium">
            <dt>Falta pagar</dt>
            <dd className="tabular-nums">{formatarPreco(registro.saldo)}</dd>
          </div>
        </dl>

        <Campo
          rotulo="Quanto vai pagar agora"
          htmlFor="valor-pagamento"
          erro={valorNumero > registro.saldo ? `O máximo é ${formatarPreco(registro.saldo)}.` : null}
          ajuda={!pagandoTudo && valorNumero > 0 ? `Vai faltar ${formatarPreco(restante)}.` : undefined}
        >
          <EntradaPreco
            id="valor-pagamento"
            valor={valor}
            aoMudar={setValor}
            disabled={salvando}
          />
          <div className="flex gap-2 pt-1">
            <Chip onClick={() => definirValor(registro.saldo)} disabled={salvando} className="h-10">
              Tudo
            </Chip>
            <Chip onClick={() => definirValor(registro.saldo / 2)} disabled={salvando} className="h-10">
              Metade
            </Chip>
          </div>
        </Campo>

        {!pagandoTudo && valorNumero > 0 && (
          <LinhaInterruptor
            titulo="Guardar o restante"
            descricao="O que faltar fica anotado para pagar em outro dia."
            marcado={acumularRestante}
            aoMudar={setAcumularRestante}
            desabilitado={salvando}
          />
        )}

        <Campo rotulo="Como vai pagar">
          <Segmentos
            rotuloAcessivel="Forma de pagamento"
            opcoes={FORMAS_PAGAMENTO.map((forma) => ({ valor: forma, rotulo: forma }))}
            valor={metodoPagamento}
            aoMudar={(forma) => !salvando && setMetodoPagamento(forma)}
          />
        </Campo>

        <Campo rotulo="Observação" htmlFor="observacoes-pagamento" opcional>
          <AreaTexto
            id="observacoes-pagamento"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            disabled={salvando}
            placeholder="Algum detalhe sobre este pagamento"
            rows={2}
          />
        </Campo>
      </div>
    </Gaveta>
  )
}
