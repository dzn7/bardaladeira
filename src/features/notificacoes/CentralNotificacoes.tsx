'use client'

import { useState } from 'react'
import { Money as Banknote, Bell, BellRinging as BellRing, Checks as CheckCheck, CaretDown as ChevronDown, CaretRight as ChevronRight, Package as PackageX, ArrowsClockwise as RefreshCw, GearSix as Settings2, ShoppingBag, X } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { Botao, Gaveta, LinhaInterruptor, ListaCarregando, ListaVazia } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { rotaDaNotificacao, type NotificacaoAdmin } from '@/lib/notificacoes-admin.mjs'
import { useNotificacoesAdmin } from './NotificacoesAdminContext'

function ItemNotificacao({ item, aoNavegar }: { item: NotificacaoAdmin; aoNavegar: () => void }) {
  const router = useRouter()
  const { marcarLida, dispensar } = useNotificacoesAdmin()
  const urgente = item.prioridade === 'urgente'
  const rota = rotaDaNotificacao(item)

  const abrir = async () => {
    if (!item.lida_em) await marcarLida(item.id).catch(() => undefined)
    if (rota) {
      aoNavegar()
      router.push(rota)
    }
  }

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => void abrir()}
        className="flex min-h-16 w-full gap-3 px-4 py-3 pr-14 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          urgente ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
        )}>
          {item.entidade_tipo === 'produto' ? <PackageX className="size-[18px]" />
            : item.entidade_tipo === 'funcionario' ? <Banknote className="size-[18px]" />
              : <ShoppingBag className="size-[18px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {!item.lida_em ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" /> : null}
            <span className={cn('block text-sm font-medium', urgente ? 'text-destructive' : 'text-foreground')}>
              {item.titulo}
            </span>
          </span>
          <span className="mt-0.5 block break-words text-[13px] leading-5 text-muted-foreground">{item.mensagem}</span>
        </span>
        {rota ? <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </button>
      <Botao
        variante="fantasma"
        tamanho="icone"
        onClick={() => void dispensar(item.id).catch(() => undefined)}
        aria-label={`Dispensar ${item.titulo}`}
        className="absolute right-1.5 top-1.5 size-11 text-muted-foreground"
      >
        <X />
      </Botao>
    </li>
  )
}

function ConteudoCentral({ fechar }: { fechar: () => void }) {
  const [configurando, setConfigurando] = useState(false)
  const {
    notificacoes, carregando, erro, modalAtivo, preferencias,
    carregarCentral, definirModalAtivo, definirPreferencias,
  } = useNotificacoesAdmin()

  const alternarPreferencia = (chave: keyof typeof preferencias, ativo: boolean) => {
    void definirPreferencias({ ...preferencias, [chave]: ativo }).catch(() => undefined)
  }

  return (
    <div className="space-y-4">
      {carregando ? (
        <ListaCarregando linhas={3} />
      ) : erro ? (
        <ListaVazia
          icone={<Bell />}
          titulo="Não deu para carregar"
          descricao={erro}
          acao={
            <Botao variante="contorno" onClick={() => void carregarCentral(false)}>
              <RefreshCw /> Tentar de novo
            </Botao>
          }
        />
      ) : notificacoes.length === 0 ? (
        <ListaVazia icone={<Bell />} titulo="Tudo em dia" descricao="Nenhum aviso no momento." />
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
          {notificacoes.map((item) => <ItemNotificacao key={item.id} item={item} aoNavegar={fechar} />)}
        </ul>
      )}

      <div className="overflow-hidden rounded-xl border border-border/70">
        <button
          type="button"
          onClick={() => setConfigurando((atual) => !atual)}
          aria-expanded={configurando}
          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground"><Settings2 className="size-4" /> O que avisar</span>
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', configurando && 'rotate-180')} />
        </button>
        {configurando ? (
          <div className="space-y-2 border-t border-border/70 p-3">
            {[
              { chave: 'estoque' as const, titulo: 'Estoque', descricao: 'Estoque baixo e produtos esgotados' },
              { chave: 'pedidos' as const, titulo: 'Pedidos', descricao: 'Novos pedidos esperando alguém' },
              { chave: 'pagamentosFuncionarios' as const, titulo: 'Pagamentos da equipe', descricao: 'Pagamentos perto de vencer ou atrasados' },
            ].map((item) => (
              <LinhaInterruptor
                key={item.chave}
                titulo={item.titulo}
                descricao={item.descricao}
                marcado={preferencias[item.chave]}
                aoMudar={(ativo) => alternarPreferencia(item.chave, ativo)}
                rotuloAcessivel={`Notificar ${item.titulo.toLowerCase()}`}
              />
            ))}
            <LinhaInterruptor
              titulo="Avisar ao entrar"
              descricao="Mostra os avisos novos assim que você abre o painel"
              marcado={modalAtivo}
              aoMudar={(ativo) => void definirModalAtivo(ativo).catch(() => undefined)}
              rotuloAcessivel="Mostrar avisos ao entrar"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function CentralNotificacoes() {
  const { resumo, carregarCentral, marcarTodasLidas } = useNotificacoesAdmin()
  const [aberto, setAberto] = useState(false)
  const urgente = resumo.urgentesNaoLidas > 0

  const alterar = (valor: boolean) => {
    setAberto(valor)
    if (valor) void carregarCentral(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => alterar(!aberto)}
        aria-label={`Notificações: ${resumo.naoLidas} não lidas`}
        aria-expanded={aberto}
        className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {urgente ? <BellRing className="size-[18px] text-destructive" /> : <Bell className="size-[18px]" />}
        {resumo.naoLidas > 0 ? (
          <span className={cn(
            'absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4 ring-2 ring-background',
            urgente ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
          )}>{Math.min(resumo.naoLidas, 99)}</span>
        ) : null}
      </button>

      <Gaveta
        aberto={aberto}
        aoFechar={() => alterar(false)}
        titulo="Notificações"
        descricao={resumo.naoLidas > 0 ? `${resumo.naoLidas} não lida${resumo.naoLidas === 1 ? '' : 's'}` : 'Nada novo'}
        rodape={
          resumo.naoLidas > 0 ? (
            <Botao variante="contorno" onClick={() => void marcarTodasLidas().catch(() => undefined)}>
              <CheckCheck /> Marcar todas como lidas
            </Botao>
          ) : undefined
        }
      >
        <ConteudoCentral fechar={() => alterar(false)} />
      </Gaveta>
    </div>
  )
}
