-- Corrige a leitura da agenda no RPC transacional de pagamento.

set search_path = pg_catalog, public, extensions;

create or replace function public.registrar_pagamento_funcionario_admin(
  p_funcionario_id uuid,
  p_competencia date,
  p_pago_em timestamptz,
  p_valor numeric,
  p_forma_pagamento text,
  p_categoria_id uuid default null,
  p_observacoes text default null
)
returns table (pagamento_id uuid, movimentacao_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia_vencimento smallint;
  v_inicia_em date;
  v_nome text;
  v_caixa_id uuid;
  v_movimentacao_id uuid;
  v_pagamento_id uuid;
  v_competencia date := date_trunc('month', p_competencia)::date;
begin
  if p_valor is null or p_valor <= 0 or p_valor > 999999999.99 then
    raise exception 'Valor do pagamento inválido.';
  end if;
  if p_pago_em is null or p_pago_em > now() + interval '1 day' then
    raise exception 'Data do pagamento inválida.';
  end if;
  if char_length(btrim(coalesce(p_forma_pagamento, ''))) not between 1 and 40 then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_observacoes is not null and char_length(p_observacoes) > 500 then
    raise exception 'Observações excedem 500 caracteres.';
  end if;

  select c.dia_vencimento, c.inicia_em, f.nome
    into v_dia_vencimento, v_inicia_em, v_nome
  from public.funcionarios_pagamento_config c
  join public.funcionarios f on f.id = c.funcionario_id
  where c.funcionario_id = p_funcionario_id and c.ativo is true and f.ativo is true
  for update of c;
  if not found then raise exception 'Agenda de pagamento ativa não encontrada.'; end if;
  if v_competencia < v_inicia_em or v_competencia > date_trunc('month', current_date)::date then
    raise exception 'Competência fora do período permitido.';
  end if;
  if p_categoria_id is not null and not exists (
    select 1 from public.categorias_caixa c where c.id = p_categoria_id and c.tipo = 'saida' and c.ativo is true
  ) then
    raise exception 'Categoria de saída inválida.';
  end if;

  select c.id into v_caixa_id from public.caixas c
  where c.status = 'aberto' order by c.data_abertura desc limit 1;

  insert into public.movimentacoes_caixa (
    caixa_id, categoria_id, funcionario_id, tipo, valor, descricao, forma_pagamento, created_at
  ) values (
    v_caixa_id, p_categoria_id, p_funcionario_id, 'saida', round(p_valor, 2),
    'Salário – ' || v_nome || ' (' || to_char(v_competencia, 'MM/YYYY') || ')',
    btrim(p_forma_pagamento), p_pago_em
  ) returning id into v_movimentacao_id;

  insert into public.funcionarios_pagamentos (
    funcionario_id, competencia, vencimento, pago_em, valor, forma_pagamento,
    categoria_id, movimentacao_id, observacoes
  ) values (
    p_funcionario_id, v_competencia,
    public.vencimento_pagamento_funcionario_admin(v_competencia, v_dia_vencimento),
    p_pago_em, round(p_valor, 2), btrim(p_forma_pagamento), p_categoria_id,
    v_movimentacao_id, nullif(btrim(p_observacoes), '')
  ) returning id into v_pagamento_id;

  perform public.sincronizar_notificacoes_pagamento_funcionario_admin(p_funcionario_id);
  return query select v_pagamento_id, v_movimentacao_id;
end;
$$;

revoke all on function public.registrar_pagamento_funcionario_admin(uuid, date, timestamptz, numeric, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pagamento_funcionario_admin(uuid, date, timestamptz, numeric, text, uuid, text)
  to service_role;
