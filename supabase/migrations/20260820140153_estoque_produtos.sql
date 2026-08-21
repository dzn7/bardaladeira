-- Estoque operacional de produtos finais vendaveis.
-- A escrita publica preexistente foi mantida por decisao explicita de produto.
-- As RPCs abaixo sao SECURITY INVOKER e portanto NAO tornam essa superficie segura.

alter table public.produtos
  add column if not exists custo_unitario numeric(12,2),
  add column if not exists estoque_quantidade integer not null default 0,
  add column if not exists estoque_minimo integer not null default 5,
  add column if not exists bloquear_venda_sem_estoque boolean not null default false;

update public.produtos set estoque_quantidade = 0 where estoque_quantidade is null;
update public.produtos set estoque_minimo = 5 where estoque_minimo is null;
update public.produtos
set bloquear_venda_sem_estoque = false
where bloquear_venda_sem_estoque is null;

alter table public.produtos
  alter column estoque_quantidade set default 0,
  alter column estoque_quantidade set not null,
  alter column estoque_minimo set default 5,
  alter column estoque_minimo set not null,
  alter column bloquear_venda_sem_estoque set default false,
  alter column bloquear_venda_sem_estoque set not null;

alter table public.itens_pedido
  add column if not exists estoque_quantidade_consumida integer not null default 0;

update public.itens_pedido
set estoque_quantidade_consumida = 0
where estoque_quantidade_consumida is null;

alter table public.itens_pedido
  alter column estoque_quantidade_consumida set default 0,
  alter column estoque_quantidade_consumida set not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'produtos_custo_unitario_nao_negativo_ck'
      and conrelid = 'public.produtos'::pg_catalog.regclass
  ) then
    alter table public.produtos
      add constraint produtos_custo_unitario_nao_negativo_ck
      check (custo_unitario is null or custo_unitario >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'produtos_estoque_quantidade_nao_negativa_ck'
      and conrelid = 'public.produtos'::pg_catalog.regclass
  ) then
    alter table public.produtos
      add constraint produtos_estoque_quantidade_nao_negativa_ck
      check (estoque_quantidade >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'produtos_estoque_minimo_nao_negativo_ck'
      and conrelid = 'public.produtos'::pg_catalog.regclass
  ) then
    alter table public.produtos
      add constraint produtos_estoque_minimo_nao_negativo_ck
      check (estoque_minimo >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'itens_pedido_estoque_consumido_coerente_ck'
      and conrelid = 'public.itens_pedido'::pg_catalog.regclass
  ) then
    alter table public.itens_pedido
      add constraint itens_pedido_estoque_consumido_coerente_ck
      check (
        estoque_quantidade_consumida >= 0
        and (
          (quantidade is null and estoque_quantidade_consumida = 0)
          or (quantidade is not null and estoque_quantidade_consumida <= quantidade)
        )
      );
  end if;
end
$$;

create or replace function public.ajustar_estoque_produto(
  p_produto_id uuid,
  p_delta integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quantidade integer;
begin
  if p_produto_id is null or p_delta is null then
    raise exception using errcode = '22023', message = 'PRODUTO_E_DELTA_OBRIGATORIOS';
  end if;

  update public.produtos
  set estoque_quantidade = estoque_quantidade + p_delta
  where id = p_produto_id
    and estoque_quantidade + p_delta >= 0
  returning estoque_quantidade into v_quantidade;

  if v_quantidade is null then
    if exists (select 1 from public.produtos where id = p_produto_id) then
      raise exception using errcode = '22023', message = 'ESTOQUE_NEGATIVO';
    end if;
    raise exception using errcode = 'P0002', message = 'PRODUTO_NAO_ENCONTRADO';
  end if;

  return v_quantidade;
end
$$;

create or replace function public.definir_estoque_produto(
  p_produto_id uuid,
  p_quantidade integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quantidade integer;
begin
  if p_produto_id is null or p_quantidade is null then
    raise exception using errcode = '22023', message = 'PRODUTO_E_QUANTIDADE_OBRIGATORIOS';
  end if;
  if p_quantidade < 0 then
    raise exception using errcode = '22023', message = 'ESTOQUE_NEGATIVO';
  end if;

  update public.produtos
  set estoque_quantidade = p_quantidade
  where id = p_produto_id
  returning estoque_quantidade into v_quantidade;

  if v_quantidade is null then
    raise exception using errcode = 'P0002', message = 'PRODUTO_NAO_ENCONTRADO';
  end if;
  return v_quantidade;
end
$$;

revoke all on function public.ajustar_estoque_produto(uuid, integer) from public;
revoke all on function public.definir_estoque_produto(uuid, integer) from public;
grant execute on function public.ajustar_estoque_produto(uuid, integer)
  to anon, authenticated, service_role;
grant execute on function public.definir_estoque_produto(uuid, integer)
  to anon, authenticated, service_role;

create or replace function public.sincronizar_estoque_item_pedido()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_produto_antigo uuid;
  v_produto_novo uuid;
  v_pedido_antigo uuid;
  v_pedido_novo uuid;
  v_status text;
  v_estoque integer;
  v_bloquear boolean;
  v_nome text;
  v_consumir integer;
begin
  v_produto_antigo := case when tg_op in ('UPDATE', 'DELETE') then old.produto_id else null end;
  v_produto_novo := case when tg_op in ('INSERT', 'UPDATE') then new.produto_id else null end;
  v_pedido_antigo := case when tg_op in ('UPDATE', 'DELETE') then old.pedido_id else null end;
  v_pedido_novo := case when tg_op in ('INSERT', 'UPDATE') then new.pedido_id else null end;

  -- Pedido antes de produto: a mesma ordem usada pela reconciliacao de status.
  perform 1
  from public.pedidos p
  where p.id in (
    select pg_catalog.unnest(array[v_pedido_antigo, v_pedido_novo]::uuid[])
  )
  order by p.id
  for key share;

  perform 1
  from public.produtos p
  where p.id in (
    select pg_catalog.unnest(array[v_produto_antigo, v_produto_novo]::uuid[])
  )
  order by p.id
  for update;

  if v_produto_antigo is not null
     and coalesce(old.estoque_quantidade_consumida, 0) > 0 then
    update public.produtos
    set estoque_quantidade = estoque_quantidade + old.estoque_quantidade_consumida
    where id = v_produto_antigo;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  new.estoque_quantidade_consumida := 0;
  if v_produto_novo is null then
    return new;
  end if;
  if new.quantidade is null or new.quantidade < 0 then
    raise exception using errcode = '22023', message = 'QUANTIDADE_ITEM_INVALIDA';
  end if;

  select p.status into v_status
  from public.pedidos p
  where p.id = new.pedido_id;

  if v_status = 'cancelado' or new.quantidade = 0 then
    return new;
  end if;

  select p.estoque_quantidade, p.bloquear_venda_sem_estoque, p.nome
  into v_estoque, v_bloquear, v_nome
  from public.produtos p
  where p.id = v_produto_novo;

  if not found then
    raise exception using errcode = '23503', message = 'PRODUTO_NAO_ENCONTRADO';
  end if;
  if v_bloquear and new.quantidade > v_estoque then
    raise exception using
      errcode = 'P0001',
      message = pg_catalog.format(
        'ESTOQUE_INSUFICIENTE:%s:%s:%s',
        v_produto_novo,
        v_nome,
        v_estoque
      );
  end if;

  v_consumir := least(v_estoque, new.quantidade);
  update public.produtos
  set estoque_quantidade = estoque_quantidade - v_consumir
  where id = v_produto_novo;
  new.estoque_quantidade_consumida := v_consumir;
  return new;
end
$$;

create or replace function public.reconciliar_estoque_status_pedido()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item record;
  v_estoque integer;
  v_bloquear boolean;
  v_nome text;
  v_consumir integer;
begin
  if old.status is not distinct from new.status
     or (old.status is distinct from 'cancelado' and new.status is distinct from 'cancelado') then
    return new;
  end if;

  perform 1
  from public.produtos p
  where p.id in (
    select distinct ip.produto_id
    from public.itens_pedido ip
    where ip.pedido_id = new.id and ip.produto_id is not null
  )
  order by p.id
  for update;

  if new.status = 'cancelado' then
    update public.produtos p
    set estoque_quantidade = p.estoque_quantidade + consumos.quantidade
    from (
      select ip.produto_id, sum(ip.estoque_quantidade_consumida)::integer as quantidade
      from public.itens_pedido ip
      where ip.pedido_id = new.id and ip.produto_id is not null
      group by ip.produto_id
    ) consumos
    where p.id = consumos.produto_id and consumos.quantidade > 0;

    update public.itens_pedido
    set estoque_quantidade_consumida = 0
    where pedido_id = new.id and estoque_quantidade_consumida <> 0;
    return new;
  end if;

  for v_item in
    select ip.id, ip.produto_id, ip.quantidade
    from public.itens_pedido ip
    where ip.pedido_id = new.id and ip.produto_id is not null
    order by ip.produto_id, ip.id
  loop
    if v_item.quantidade is null or v_item.quantidade < 0 then
      raise exception using errcode = '22023', message = 'QUANTIDADE_ITEM_INVALIDA';
    end if;

    select p.estoque_quantidade, p.bloquear_venda_sem_estoque, p.nome
    into v_estoque, v_bloquear, v_nome
    from public.produtos p
    where p.id = v_item.produto_id;

    if v_bloquear and v_item.quantidade > v_estoque then
      raise exception using
        errcode = 'P0001',
        message = pg_catalog.format(
          'ESTOQUE_INSUFICIENTE:%s:%s:%s',
          v_item.produto_id,
          v_nome,
          v_estoque
        );
    end if;

    v_consumir := least(v_estoque, v_item.quantidade);
    update public.produtos
    set estoque_quantidade = estoque_quantidade - v_consumir
    where id = v_item.produto_id;
    update public.itens_pedido
    set estoque_quantidade_consumida = v_consumir
    where id = v_item.id;
  end loop;

  return new;
end
$$;

revoke all on function public.sincronizar_estoque_item_pedido() from public;
revoke all on function public.reconciliar_estoque_status_pedido() from public;
grant execute on function public.sincronizar_estoque_item_pedido() to service_role;
grant execute on function public.reconciliar_estoque_status_pedido() to service_role;

drop trigger if exists trg_sincronizar_estoque_item_pedido on public.itens_pedido;
create trigger trg_sincronizar_estoque_item_pedido
before insert or delete or update of produto_id, pedido_id, quantidade
on public.itens_pedido
for each row execute function public.sincronizar_estoque_item_pedido();

drop trigger if exists trg_reconciliar_estoque_status_pedido on public.pedidos;
create trigger trg_reconciliar_estoque_status_pedido
after update of status on public.pedidos
for each row execute function public.reconciliar_estoque_status_pedido();

comment on column public.produtos.custo_unitario is
  'Custo administrativo opcional do produto final; nao pertence ao catalogo publico.';
comment on column public.itens_pedido.estoque_quantidade_consumida is
  'Quantidade realmente reservada do produto; usada para restauracao exata.';
comment on function public.ajustar_estoque_produto(uuid, integer) is
  'Ajuste atomico SECURITY INVOKER. Executavel por anon por decisao explicita; nao e fronteira de seguranca.';
comment on function public.definir_estoque_produto(uuid, integer) is
  'Definicao atomica SECURITY INVOKER. Executavel por anon por decisao explicita; nao e fronteira de seguranca.';
