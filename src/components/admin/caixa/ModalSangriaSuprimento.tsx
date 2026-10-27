'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AreaTexto, Botao, Campo, EntradaPreco, Gaveta, Selecao } from '@/components/admin/ui'
import type { Funcionario } from '@/lib/tipos-caixa'

type TipoOperacao = 'sangria' | 'suprimento'

type Props = {
  aberto: boolean
  tipo: TipoOperacao
  funcionarios: Funcionario[]
  onFechar: () => void
  onConfirmar: (valor: number, descricao?: string, funcionarioId?: string) => Promise<boolean>
}

export default function ModalSangriaSuprimento({
  aberto,
  tipo,
  funcionarios,
  onFechar,
  onConfirmar,
}: Props) {
  const ativos = useMemo(
    () => funcionarios.filter((f) => f.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  )
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [funcionarioId, setFuncionarioId] = useState<string>('')
  const [processando, setProcessando] = useState(false)

  const ehSangria = tipo === 'sangria'

  useEffect(() => {
    if (!aberto) return
    setValor('')
    setDescricao('')
    setFuncionarioId('')
  }, [aberto, tipo])

  const handleConfirmar = async () => {
    const numero = Number(String(valor).replace(',', '.'))
    if (!numero || numero <= 0) {
      toast.error('Informe um valor maior que zero')
      return
    }
    setProcessando(true)
    const ok = await onConfirmar(numero, descricao.trim() || undefined, funcionarioId || undefined)
    setProcessando(false)
    if (ok) onFechar()
  }

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      bloqueada={processando}
      titulo={ehSangria ? 'Tirar dinheiro (sangria)' : 'Colocar dinheiro (suprimento)'}
      descricao={
        ehSangria
          ? 'Registra dinheiro que saiu da gaveta.'
          : 'Registra dinheiro que entrou na gaveta, como troco extra.'
      }
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar} disabled={processando}>
            Cancelar
          </Botao>
          <Botao
            variante={ehSangria ? 'perigo' : 'primario'}
            carregando={processando}
            onClick={() => void handleConfirmar()}
          >
            {ehSangria ? 'Registrar sangria' : 'Registrar suprimento'}
          </Botao>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(evento) => {
          evento.preventDefault()
          void handleConfirmar()
        }}
      >
        <Campo rotulo="Valor" htmlFor="valor-op">
          <EntradaPreco id="valor-op" valor={valor} aoMudar={setValor} autoFocus />
        </Campo>
        <Campo rotulo="Funcionário" htmlFor="funcionario-op" opcional>
          <Selecao id="funcionario-op" value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}>
            <option value="">Nenhum</option>
            {ativos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Motivo" htmlFor="desc-op" opcional>
          <AreaTexto
            id="desc-op"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder={ehSangria ? 'Ex.: pagamento de fornecedor' : 'Ex.: troco extra'}
          />
        </Campo>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Gaveta>
  )
}
