-- O saldo continua sendo consumido por todos os canais, mas somente o site
-- rejeita a venda quando o produto esta configurado para bloquear ao zerar.
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
  v_origem text;
  v_estoque integer;
  v_bloquear boolean;
  v_nome text;
  v_consumir integer;
begin
  v_produto_antigo := case when tg_op in ('UPDATE', 'DELETE') then old.produto_id else null end;
  v_produto_novo := case when tg_op in ('INSERT', 'UPDATE') then new.produto_id else null end;
  v_pedido_antigo := case when tg_op in ('UPDATE', 'DELETE') then old.pedido_id else null end;
  v_pedido_novo := case when tg_op in ('INSERT', 'UPDATE') then new.pedido_id else null end;

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

  select p.status, p.origem
  into v_status, v_origem
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
  if v_bloquear and v_origem = 'site' and new.quantidade > v_estoque then
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
  v_origem text;
  v_estoque integer;
  v_bloquear boolean;
  v_nome text;
  v_consumir integer;
begin
  if old.status is not distinct from new.status
     or (old.status is distinct from 'cancelado' and new.status is distinct from 'cancelado') then
    return new;
  end if;

  v_origem := new.origem;

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

    if v_bloquear and v_origem = 'site' and v_item.quantidade > v_estoque then
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

comment on column public.produtos.bloquear_venda_sem_estoque is
  'Quando ativo, saldo zero exibe e bloqueia o produto no site; canais fisicos continuam vendendo.';
