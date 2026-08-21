-- Marca todas as ocorrências ativas/visíveis como lidas sem carregar a lista.
-- Evita truncar a ação pelo limite de paginação da Central.

set search_path = pg_catalog, public, extensions;

create or replace function public.marcar_todas_notificacoes_admin_lidas(p_usuario_chave text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_total integer;
begin
  insert into public.notificacoes_admin_leituras as leitura (
    notificacao_id, usuario_chave, apresentada_em, lida_em, atualizada_em
  )
  select n.id, p_usuario_chave, v_agora, v_agora, v_agora
  from public.notificacoes_admin n
  left join public.notificacoes_admin_leituras existente
    on existente.notificacao_id = n.id
   and existente.usuario_chave = p_usuario_chave
  where n.estado = 'ativa'
    and existente.silenciada_em is null
    and existente.lida_em is null
  on conflict (notificacao_id, usuario_chave)
  do update set
    apresentada_em = coalesce(leitura.apresentada_em, excluded.apresentada_em),
    lida_em = excluded.lida_em,
    atualizada_em = excluded.atualizada_em;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.marcar_todas_notificacoes_admin_lidas(text)
  from public, anon, authenticated;
grant execute on function public.marcar_todas_notificacoes_admin_lidas(text)
  to service_role;
