-- As funções de leitura do histórico são exclusivas do route handler administrativo.
-- Revoga grants legados amplos que podem existir em projetos criados pelo template.

revoke all on function public.listar_historico_produto(uuid, text, timestamptz, uuid, integer)
  from anon, authenticated;
revoke all on function public.obter_inteligencia_produto(uuid, timestamptz, timestamptz)
  from anon, authenticated;

grant execute on function public.listar_historico_produto(uuid, text, timestamptz, uuid, integer)
  to service_role;
grant execute on function public.obter_inteligencia_produto(uuid, timestamptz, timestamptz)
  to service_role;
