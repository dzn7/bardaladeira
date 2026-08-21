-- Pedido confirmado cujo pagamento online ainda aguarda não é receita realizada.

set search_path = pg_catalog, public, extensions;

create or replace function public.obter_lucro_produtos_admin(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  mes date,
  produto_id uuid,
  nome_produto text,
  quantidade bigint,
  receita_com_custo numeric,
  custo_mercadorias numeric,
  lucro_bruto numeric,
  margem_bruta numeric,
  receita_sem_custo numeric,
  itens_sem_custo bigint
)
language sql
stable
set search_path = ''
as $$
  select
    date_trunc('month', p.created_at)::date,
    i.produto_id,
    coalesce(nullif(i.nome_item, ''), nullif(i.nome_produto, ''), 'Item')::text,
    sum(coalesce(i.quantidade, 1))::bigint,
    coalesce(sum(case when i.custo_unitario is not null then i.subtotal else 0 end), 0)::numeric,
    coalesce(sum(case when i.custo_unitario is not null
      then i.custo_unitario * coalesce(i.quantidade, 1) else 0 end), 0)::numeric,
    coalesce(sum(case when i.custo_unitario is not null
      then i.subtotal - i.custo_unitario * coalesce(i.quantidade, 1) else 0 end), 0)::numeric,
    case
      when coalesce(sum(case when i.custo_unitario is not null then i.subtotal else 0 end), 0) = 0 then 0
      else round(
        coalesce(sum(case when i.custo_unitario is not null
          then i.subtotal - i.custo_unitario * coalesce(i.quantidade, 1) else 0 end), 0)
        / sum(case when i.custo_unitario is not null then i.subtotal else 0 end) * 100,
        2
      )
    end::numeric,
    coalesce(sum(case when i.custo_unitario is null then i.subtotal else 0 end), 0)::numeric,
    coalesce(sum(case when i.custo_unitario is null then coalesce(i.quantidade, 1) else 0 end), 0)::bigint
  from public.itens_pedido i
  join public.pedidos p on p.id = i.pedido_id
  where p.created_at >= p_inicio
    and p.created_at <= p_fim
    and coalesce(lower(p.status), '') not in ('cancelado', 'aguardando_pagamento', 'pendente')
    and coalesce(lower(p.pagamento_online_status), '') <> 'aguardando_pagamento'
  group by 1, 2, 3;
$$;

revoke all on function public.obter_lucro_produtos_admin(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.obter_lucro_produtos_admin(timestamptz, timestamptz)
  to service_role;

