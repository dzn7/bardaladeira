-- O snapshot não pode morar em itens_pedido: a tabela legada é legível por anon
-- e vários consumidores usam select('*'). Move o dado para uma relação privada.

set search_path = pg_catalog, public, extensions;

create table if not exists public.custos_itens_pedido_admin (
  item_pedido_id uuid primary key references public.itens_pedido(id) on delete cascade,
  produto_id uuid not null,
  custo_unitario numeric(12,2) not null,
  criado_em timestamptz not null default now(),
  constraint custos_itens_pedido_admin_custo_check check (custo_unitario >= 0)
);

alter table public.custos_itens_pedido_admin enable row level security;
revoke all on table public.custos_itens_pedido_admin from public, anon, authenticated;
grant select, insert, update, delete on table public.custos_itens_pedido_admin to service_role;

-- Preserva qualquer venda criada entre a migration anterior e esta correção.
insert into public.custos_itens_pedido_admin (item_pedido_id, produto_id, custo_unitario, criado_em)
select i.id, i.produto_id, i.custo_unitario, coalesce(i.created_at, now())
from public.itens_pedido i
where i.produto_id is not null and i.custo_unitario is not null
on conflict (item_pedido_id) do nothing;

update public.itens_pedido set custo_unitario = null where custo_unitario is not null;

create or replace function public.neutralizar_custo_item_pedido_exposto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.custo_unitario := null;
  return new;
end;
$$;

create or replace function public.registrar_custo_item_pedido_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.custos_itens_pedido_admin (item_pedido_id, produto_id, custo_unitario)
  select new.id, p.id, p.custo_unitario
  from public.produtos p
  where p.id = new.produto_id and p.custo_unitario is not null
  on conflict (item_pedido_id) do nothing;
  return null;
end;
$$;

drop trigger if exists trg_preencher_custo_unitario_item_pedido on public.itens_pedido;
drop trigger if exists trg_neutralizar_custo_item_pedido_exposto on public.itens_pedido;
create trigger trg_neutralizar_custo_item_pedido_exposto
before insert or update of custo_unitario on public.itens_pedido
for each row execute function public.neutralizar_custo_item_pedido_exposto();

drop trigger if exists trg_registrar_custo_item_pedido_admin on public.itens_pedido;
create trigger trg_registrar_custo_item_pedido_admin
after insert on public.itens_pedido
for each row execute function public.registrar_custo_item_pedido_admin();

create or replace function public.obter_lucro_produtos_admin(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  mes date, produto_id uuid, nome_produto text, quantidade bigint,
  receita_com_custo numeric, custo_mercadorias numeric, lucro_bruto numeric,
  margem_bruta numeric, receita_sem_custo numeric, itens_sem_custo bigint
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
    coalesce(sum(case when c.custo_unitario is not null then i.subtotal else 0 end), 0)::numeric,
    coalesce(sum(case when c.custo_unitario is not null
      then c.custo_unitario * coalesce(i.quantidade, 1) else 0 end), 0)::numeric,
    coalesce(sum(case when c.custo_unitario is not null
      then i.subtotal - c.custo_unitario * coalesce(i.quantidade, 1) else 0 end), 0)::numeric,
    case
      when coalesce(sum(case when c.custo_unitario is not null then i.subtotal else 0 end), 0) = 0 then 0
      else round(
        coalesce(sum(case when c.custo_unitario is not null
          then i.subtotal - c.custo_unitario * coalesce(i.quantidade, 1) else 0 end), 0)
        / sum(case when c.custo_unitario is not null then i.subtotal else 0 end) * 100,
        2
      )
    end::numeric,
    coalesce(sum(case when c.custo_unitario is null then i.subtotal else 0 end), 0)::numeric,
    coalesce(sum(case when c.custo_unitario is null then coalesce(i.quantidade, 1) else 0 end), 0)::bigint
  from public.itens_pedido i
  join public.pedidos p on p.id = i.pedido_id
  left join public.custos_itens_pedido_admin c on c.item_pedido_id = i.id
  where p.created_at >= p_inicio
    and p.created_at <= p_fim
    and coalesce(lower(p.status), '') not in ('cancelado', 'aguardando_pagamento', 'pendente')
    and coalesce(lower(p.pagamento_online_status), '') <> 'aguardando_pagamento'
  group by 1, 2, 3;
$$;

revoke all on function public.neutralizar_custo_item_pedido_exposto()
  from public, anon, authenticated;
revoke all on function public.registrar_custo_item_pedido_admin()
  from public, anon, authenticated;
revoke all on function public.obter_lucro_produtos_admin(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.obter_lucro_produtos_admin(timestamptz, timestamptz)
  to service_role;

