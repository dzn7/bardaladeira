-- O histórico é append-only: ON DELETE SET NULL tentava atualizar pedido_id
-- ao excluir o pedido e era corretamente bloqueado pelo trigger de imutabilidade.
-- O UUID permanece como snapshot histórico, sem integridade referencial mutável.
alter table public.produto_historico_eventos
  drop constraint if exists produto_historico_eventos_pedido_id_fkey;

comment on column public.produto_historico_eventos.pedido_id is
  'Snapshot imutável do UUID do pedido de origem; não possui FK para permitir excluir o pedido sem alterar o audit trail.';
