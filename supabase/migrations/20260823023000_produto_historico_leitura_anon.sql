alter function public.listar_historico_produto(uuid, text, timestamptz, uuid, integer)
  security definer;

alter function public.obter_inteligencia_produto(uuid, timestamptz, timestamptz)
  security definer;

revoke all on function public.listar_historico_produto(uuid, text, timestamptz, uuid, integer)
  from public;
revoke all on function public.obter_inteligencia_produto(uuid, timestamptz, timestamptz)
  from public;

grant execute on function public.listar_historico_produto(uuid, text, timestamptz, uuid, integer)
  to anon, authenticated, service_role;
grant execute on function public.obter_inteligencia_produto(uuid, timestamptz, timestamptz)
  to anon, authenticated, service_role;
