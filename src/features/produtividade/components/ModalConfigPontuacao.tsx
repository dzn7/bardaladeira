'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Botao, Entrada, Gaveta, Secao } from '@/components/admin/ui'
import {
  CONFIG_PRODUTIVIDADE_PADRAO,
  type ChaveConfigProdutividade,
  type ConfigProdutividade,
} from '../types'

type Props = {
  aberto: boolean
  config: ConfigProdutividade
  onFechar: () => void
  onSalvo: (config: ConfigProdutividade) => void
}

type CampoConfig = {
  chave: ChaveConfigProdutividade
  rotulo: string
  ajuda: string
}

const GANHOS: CampoConfig[] = [
  { chave: 'pontos_pedido_criado', rotulo: 'Pedido criado', ajuda: 'Vale para qualquer status, menos cancelado.' },
  { chave: 'pontos_pedido_fechado', rotulo: 'Pedido entregue', ajuda: 'Somado quando o pedido chega a entregue.' },
  { chave: 'pontos_item_adicionado', rotulo: 'Item adicionado', ajuda: 'Cada item incluído na edição do pedido.' },
  { chave: 'pontos_pedido_editado', rotulo: 'Pedido editado', ajuda: 'Uma vez por pedido editado no dia.' },
  { chave: 'bonus_cadastro_completo', rotulo: 'Cadastro completo', ajuda: 'Nome de verdade + telefone válido.' },
]

const PERDAS: CampoConfig[] = [
  { chave: 'penalidade_nome_generico', rotulo: 'Sem nome do cliente', ajuda: '“Cliente”, “Mesa 7”, vazio, só números.' },
  { chave: 'penalidade_contato_ausente', rotulo: 'Sem telefone/endereço', ajuda: 'Retirada ou entrega sem contato utilizável.' },
  { chave: 'penalidade_pedido_cancelado', rotulo: 'Pedido cancelado', ajuda: 'Deixe 0 para não penalizar cancelamento.' },
]

const METAS: CampoConfig[] = [
  { chave: 'meta_pontos_dia', rotulo: 'Meta do dia', ajuda: 'Pontos somados por toda a equipe.' },
  { chave: 'meta_pontos_semana', rotulo: 'Meta da semana', ajuda: 'Segunda a domingo.' },
  { chave: 'meta_pontos_mes', rotulo: 'Meta do mês', ajuda: 'Mês corrente.' },
]

const paraTexto = (config: ConfigProdutividade) =>
  Object.fromEntries(
    Object.entries(config).map(([chave, valor]) => [chave, String(valor)]),
  ) as Record<ChaveConfigProdutividade, string>

export function ModalConfigPontuacao({ aberto, config, onFechar, onSalvo }: Props) {
  const [valores, setValores] = useState<Record<ChaveConfigProdutividade, string>>(() =>
    paraTexto(config),
  )
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (aberto) setValores(paraTexto(config))
  }, [aberto, config])

  const alterar = (chave: ChaveConfigProdutividade, valor: string) => {
    setValores((anterior) => ({ ...anterior, [chave]: valor }))
  }

  const salvar = async () => {
    const convertido: Partial<ConfigProdutividade> = {}

    for (const [chave, texto] of Object.entries(valores)) {
      const numero = Number(String(texto).replace(',', '.'))
      if (!Number.isFinite(numero) || numero < 0) {
        toast.error('Use apenas números iguais ou maiores que zero.')
        return
      }
      convertido[chave as ChaveConfigProdutividade] = numero
    }

    try {
      setSalvando(true)
      const resposta = await fetch('/api/admin/produtividade/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: convertido }),
      })
      const corpo = (await resposta.json()) as {
        sucesso?: boolean
        erro?: string
        config?: ConfigProdutividade
      }

      if (!resposta.ok || !corpo.sucesso || !corpo.config) {
        throw new Error(corpo.erro || 'Falha ao salvar configuração.')
      }

      onSalvo(corpo.config)
      toast.success('Pontuação atualizada')
      onFechar()
    } catch (erro) {
      console.error('[Produtividade] Erro ao salvar config:', erro)
      toast.error(erro instanceof Error ? erro.message : 'Falha ao salvar configuração.')
    } finally {
      setSalvando(false)
    }
  }

  const restaurarPadrao = () => {
    setValores(paraTexto(CONFIG_PRODUTIVIDADE_PADRAO))
    toast.info('Valores padrão preenchidos — salve para aplicar.')
  }

  const renderGrupo = (titulo: string, descricao: string, campos: CampoConfig[]) => (
    <Secao titulo={titulo} descricao={descricao}>
      <ul className="divide-y divide-border/70 rounded-xl border border-border/70">
        {campos.map((campo) => (
          <li key={campo.chave} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <label htmlFor={campo.chave} className="text-sm font-medium text-foreground">
                {campo.rotulo}
              </label>
              <p className="text-[13px] leading-5 text-muted-foreground">{campo.ajuda}</p>
            </div>
            <Entrada
              id={campo.chave}
              inputMode="decimal"
              value={valores[campo.chave] ?? ''}
              onChange={(evento) => alterar(campo.chave, evento.target.value)}
              className="w-24 shrink-0 text-right tabular-nums"
            />
          </li>
        ))}
      </ul>
    </Secao>
  )

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      bloqueada={salvando}
      titulo="Pontuação e metas"
      descricao="Vale para todo o histórico: mudar um peso recalcula os períodos já passados."
      rodape={
        <>
          <Botao variante="fantasma" className="md:mr-auto" onClick={restaurarPadrao} disabled={salvando}>
            Restaurar padrão
          </Botao>
          <Botao carregando={salvando} onClick={() => void salvar()}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-6">
        {renderGrupo('Ganhos', 'Pontos somados a cada ação do garçom.', GANHOS)}
        {renderGrupo(
          'Descontos',
          'Use números positivos: eles são tirados do total.',
          PERDAS,
        )}
        {renderGrupo('Metas da equipe', 'Usadas nas barras de progresso das metas.', METAS)}
      </div>
    </Gaveta>
  )
}
