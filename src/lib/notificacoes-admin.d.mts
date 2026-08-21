export type TipoNotificacaoAdmin = 'estoque_baixo' | 'estoque_esgotado' | 'pedido_novo' | 'pagamento_funcionario'
export type PrioridadeNotificacaoAdmin = 'urgente' | 'normal'
export type EstadoNotificacaoAdmin = 'ativa' | 'resolvida'
export interface NotificacaoAdmin {
  id: string; tipo: TipoNotificacaoAdmin; prioridade: PrioridadeNotificacaoAdmin
  titulo: string; mensagem: string; entidade_tipo: 'produto' | 'pedido' | 'funcionario'; entidade_id: string
  dados: Record<string, unknown>; estado: EstadoNotificacaoAdmin; chave_dedupe: string
  criada_em: string; atualizada_em?: string; resolvida_em?: string | null
  apresentada_em: string | null; lida_em: string | null; silenciada_em: string | null
}
export const TIPOS_NOTIFICACAO_ADMIN: Readonly<{ ESTOQUE_ESGOTADO: 'estoque_esgotado'; ESTOQUE_BAIXO: 'estoque_baixo'; PEDIDO_NOVO: 'pedido_novo'; PAGAMENTO_FUNCIONARIO: 'pagamento_funcionario' }>
export const PRIORIDADES_NOTIFICACAO: Readonly<{ URGENTE: 'urgente'; NORMAL: 'normal' }>
export const LIMITE_MODAL_NOTIFICACOES: number
export function lerRespostaApiNotificacoes<T extends { sucesso?: boolean; erro?: string } = { sucesso?: boolean; erro?: string }>(resposta: Response): Promise<T>
export function descreverNotificacaoEstoque(produto: Record<string, unknown>): Record<string, unknown> | null
export function descreverNotificacaoPedido(pedido: Record<string, unknown>): Record<string, unknown> | null
export function notificacaoAbreModal(notificacao: Partial<NotificacaoAdmin>): boolean
export function selecionarNotificacoesDoModal<T extends Partial<NotificacaoAdmin>>(lista: T[], limite?: number): T[]
export function notificacaoVisivelNaCentral(notificacao: Partial<NotificacaoAdmin>): boolean
export function resumirNotificacoes(lista: Array<Partial<NotificacaoAdmin>>): { urgentes: number; urgentesNaoLidas: number; normais: number; naoLidas: number; total: number }
export function aplicarLeituraLocal<T extends Partial<NotificacaoAdmin>>(notificacao: T, agora?: string): T & { apresentada_em: string; lida_em: string }
export function tipoPermitidoPelasPreferencias(tipo: TipoNotificacaoAdmin, preferencias?: { estoque?: boolean; pedidos?: boolean; pagamentosFuncionarios?: boolean }): boolean
export function rotaDaNotificacao(notificacao: Partial<NotificacaoAdmin>): string | null
