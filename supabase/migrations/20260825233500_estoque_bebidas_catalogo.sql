-- Estende o estoque operacional aos dois tipos administrados em Produtos.
-- Bebidas existentes começam sem saldo/custo conhecido; nenhum backfill é inventado.

alter table public.bebidas
  add column if not exists preco_original numeric(12,2),
  add column if not exists desconto numeric(5,2),
  add column if not exists custo_unitario numeric(12,2),
  add column if not exists estoque_quantidade integer not null default 0,
  add column if not exists estoque_minimo integer not null default 5,
  add column if not exists bloquear_venda_sem_estoque boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'bebidas_preco_original_nao_negativo_ck'
      and conrelid = 'public.bebidas'::pg_catalog.regclass
  ) then
    alter table public.bebidas
      add constraint bebidas_preco_original_nao_negativo_ck
      check (preco_original is null or preco_original >= 0);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'bebidas_desconto_intervalo_ck'
      and conrelid = 'public.bebidas'::pg_catalog.regclass
  ) then
    alter table public.bebidas
      add constraint bebidas_desconto_intervalo_ck
      check (desconto is null or (desconto >= 0 and desconto <= 100));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'bebidas_custo_unitario_nao_negativo_ck'
      and conrelid = 'public.bebidas'::pg_catalog.regclass
  ) then
    alter table public.bebidas
      add constraint bebidas_custo_unitario_nao_negativo_ck
      check (custo_unitario is null or custo_unitario >= 0);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'bebidas_estoque_quantidade_nao_negativa_ck'
      and conrelid = 'public.bebidas'::pg_catalog.regclass
  ) then
    alter table public.bebidas
      add constraint bebidas_estoque_quantidade_nao_negativa_ck
      check (estoque_quantidade >= 0);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'bebidas_estoque_minimo_nao_negativo_ck'
      and conrelid = 'public.bebidas'::pg_catalog.regclass
  ) then
    alter table public.bebidas
      add constraint bebidas_estoque_minimo_nao_negativo_ck
      check (estoque_minimo >= 0);
  end if;
end
$$;

create or replace function public.ajustar_estoque_bebida(
  p_bebida_id uuid,
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
  if p_bebida_id is null or p_delta is null then
    raise exception using errcode = '22023', message = 'BEBIDA_E_DELTA_OBRIGATORIOS';
  end if;

  update public.bebidas
  set estoque_quantidade = estoque_quantidade + p_delta
  where id = p_bebida_id
    and estoque_quantidade + p_delta >= 0
  returning estoque_quantidade into v_quantidade;

  if v_quantidade is null then
    if exists (select 1 from public.bebidas where id = p_bebida_id) then
      raise exception using errcode = '22023', message = 'ESTOQUE_NEGATIVO';
    end if;
    raise exception using errcode = 'P0002', message = 'BEBIDA_NAO_ENCONTRADA';
  end if;

  return v_quantidade;
end
$$;

create or replace function public.definir_estoque_bebida(
  p_bebida_id uuid,
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
  if p_bebida_id is null or p_quantidade is null then
    raise exception using errcode = '22023', message = 'BEBIDA_E_QUANTIDADE_OBRIGATORIOS';
  end if;
  if p_quantidade < 0 then
    raise exception using errcode = '22023', message = 'ESTOQUE_NEGATIVO';
  end if;

  update public.bebidas
  set estoque_quantidade = p_quantidade
  where id = p_bebida_id
  returning estoque_quantidade into v_quantidade;

  if v_quantidade is null then
    raise exception using errcode = 'P0002', message = 'BEBIDA_NAO_ENCONTRADA';
  end if;
  return v_quantidade;
end
$$;

revoke all on function public.ajustar_estoque_bebida(uuid, integer) from public;
revoke all on function public.definir_estoque_bebida(uuid, integer) from public;
grant execute on function public.ajustar_estoque_bebida(uuid, integer)
  to anon, authenticated, service_role;
grant execute on function public.definir_estoque_bebida(uuid, integer)
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
  v_bebida_antiga uuid;
  v_bebida_nova uuid;
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
  v_bebida_antiga := case when tg_op in ('UPDATE', 'DELETE') then old.bebida_id else null end;
  v_bebida_nova := case when tg_op in ('INSERT', 'UPDATE') then new.bebida_id else null end;
  v_pedido_antigo := case when tg_op in ('UPDATE', 'DELETE') then old.pedido_id else null end;
  v_pedido_novo := case when tg_op in ('INSERT', 'UPDATE') then new.pedido_id else null end;

  perform 1
  from public.pedidos p
  where p.id in (select pg_catalog.unnest(array[v_pedido_antigo, v_pedido_novo]::uuid[]))
  order by p.id
  for key share;

  perform 1
  from public.produtos p
  where p.id in (select pg_catalog.unnest(array[v_produto_antigo, v_produto_novo]::uuid[]))
  order by p.id
  for update;

  perform 1
  from public.bebidas p
  where p.id in (select pg_catalog.unnest(array[v_bebida_antiga, v_bebida_nova]::uuid[]))
  order by p.id
  for update;

  if v_produto_antigo is not null and coalesce(old.estoque_quantidade_consumida, 0) > 0 then
    perform pg_catalog.set_config(
      'app.produto_historico_contexto',
      pg_catalog.jsonb_build_object(
        'origem', 'restauracao_item_pedido',
        'referencia', pg_catalog.format('item:%s:restauracao', old.id),
        'pedido_id', old.pedido_id,
        'item_pedido_id', old.id
      )::text,
      true
    );
    update public.produtos
    set estoque_quantidade = estoque_quantidade + old.estoque_quantidade_consumida
    where id = v_produto_antigo;
    perform pg_catalog.set_config('app.produto_historico_contexto', '{}'::text, true);
  elsif v_bebida_antiga is not null and coalesce(old.estoque_quantidade_consumida, 0) > 0 then
    update public.bebidas
    set estoque_quantidade = estoque_quantidade + old.estoque_quantidade_consumida
    where id = v_bebida_antiga;
  end if;

  if tg_op = 'DELETE' then return old; end if;

  new.estoque_quantidade_consumida := 0;
  if v_produto_novo is null and v_bebida_nova is null then return new; end if;
  if new.quantidade is null or new.quantidade < 0 then
    raise exception using errcode = '22023', message = 'QUANTIDADE_ITEM_INVALIDA';
  end if;

  select p.status, p.origem into v_status, v_origem
  from public.pedidos p where p.id = new.pedido_id;
  if v_status = 'cancelado' or new.quantidade = 0 then return new; end if;

  if v_produto_novo is not null then
    select p.estoque_quantidade, p.bloquear_venda_sem_estoque, p.nome
    into v_estoque, v_bloquear, v_nome
    from public.produtos p where p.id = v_produto_novo;
  else
    select b.estoque_quantidade, b.bloquear_venda_sem_estoque, b.nome
    into v_estoque, v_bloquear, v_nome
    from public.bebidas b where b.id = v_bebida_nova;
  end if;

  if not found then
    raise exception using errcode = '23503', message = 'ITEM_CATALOGO_NAO_ENCONTRADO';
  end if;
  if v_bloquear and v_origem = 'site' and new.quantidade > v_estoque then
    raise exception using
      errcode = 'P0001',
      message = pg_catalog.format(
        'ESTOQUE_INSUFICIENTE:%s:%s:%s',
        coalesce(v_produto_novo, v_bebida_nova),
        v_nome,
        v_estoque
      );
  end if;

  v_consumir := least(v_estoque, new.quantidade);
  if v_produto_novo is not null then
    perform pg_catalog.set_config(
      'app.produto_historico_contexto',
      pg_catalog.jsonb_build_object(
        'origem', 'reserva_pedido',
        'referencia', pg_catalog.format('item:%s:reserva', new.id),
        'pedido_id', new.pedido_id,
        'item_pedido_id', new.id
      )::text,
      true
    );
    update public.produtos
    set estoque_quantidade = estoque_quantidade - v_consumir
    where id = v_produto_novo;
    perform pg_catalog.set_config('app.produto_historico_contexto', '{}'::text, true);
  else
    update public.bebidas
    set estoque_quantidade = estoque_quantidade - v_consumir
    where id = v_bebida_nova;
  end if;

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
    select distinct ip.produto_id from public.itens_pedido ip
    where ip.pedido_id = new.id and ip.produto_id is not null
  )
  order by p.id
  for update;

  perform 1
  from public.bebidas p
  where p.id in (
    select distinct ip.bebida_id from public.itens_pedido ip
    where ip.pedido_id = new.id and ip.bebida_id is not null
  )
  order by p.id
  for update;

  if new.status = 'cancelado' then
    perform pg_catalog.set_config(
      'app.produto_historico_contexto',
      pg_catalog.jsonb_build_object(
        'origem', 'cancelamento_pedido',
        'referencia', pg_catalog.format('pedido:%s:cancelamento', new.id),
        'pedido_id', new.id
      )::text,
      true
    );
    update public.produtos p
    set estoque_quantidade = p.estoque_quantidade + consumos.quantidade
    from (
      select ip.produto_id, sum(ip.estoque_quantidade_consumida)::integer as quantidade
      from public.itens_pedido ip
      where ip.pedido_id = new.id and ip.produto_id is not null
      group by ip.produto_id
    ) consumos
    where p.id = consumos.produto_id and consumos.quantidade > 0;
    perform pg_catalog.set_config('app.produto_historico_contexto', '{}'::text, true);

    update public.bebidas b
    set estoque_quantidade = b.estoque_quantidade + consumos.quantidade
    from (
      select ip.bebida_id, sum(ip.estoque_quantidade_consumida)::integer as quantidade
      from public.itens_pedido ip
      where ip.pedido_id = new.id and ip.bebida_id is not null
      group by ip.bebida_id
    ) consumos
    where b.id = consumos.bebida_id and consumos.quantidade > 0;

    update public.itens_pedido
    set estoque_quantidade_consumida = 0
    where pedido_id = new.id and estoque_quantidade_consumida <> 0;
    return new;
  end if;

  for v_item in
    select ip.id, ip.produto_id, ip.bebida_id, ip.quantidade
    from public.itens_pedido ip
    where ip.pedido_id = new.id
      and (ip.produto_id is not null or ip.bebida_id is not null)
    order by coalesce(ip.produto_id, ip.bebida_id), ip.id
  loop
    if v_item.quantidade is null or v_item.quantidade < 0 then
      raise exception using errcode = '22023', message = 'QUANTIDADE_ITEM_INVALIDA';
    end if;

    if v_item.produto_id is not null then
      select p.estoque_quantidade, p.bloquear_venda_sem_estoque, p.nome
      into v_estoque, v_bloquear, v_nome
      from public.produtos p where p.id = v_item.produto_id;
    else
      select b.estoque_quantidade, b.bloquear_venda_sem_estoque, b.nome
      into v_estoque, v_bloquear, v_nome
      from public.bebidas b where b.id = v_item.bebida_id;
    end if;

    if v_bloquear and v_origem = 'site' and v_item.quantidade > v_estoque then
      raise exception using
        errcode = 'P0001',
        message = pg_catalog.format(
          'ESTOQUE_INSUFICIENTE:%s:%s:%s',
          coalesce(v_item.produto_id, v_item.bebida_id),
          v_nome,
          v_estoque
        );
    end if;

    v_consumir := least(v_estoque, v_item.quantidade);
    if v_item.produto_id is not null then
      perform pg_catalog.set_config(
        'app.produto_historico_contexto',
        pg_catalog.jsonb_build_object(
          'origem', 'reabertura_pedido',
          'referencia', pg_catalog.format('item:%s:reabertura', v_item.id),
          'pedido_id', new.id,
          'item_pedido_id', v_item.id
        )::text,
        true
      );
      update public.produtos
      set estoque_quantidade = estoque_quantidade - v_consumir
      where id = v_item.produto_id;
      perform pg_catalog.set_config('app.produto_historico_contexto', '{}'::text, true);
    else
      update public.bebidas
      set estoque_quantidade = estoque_quantidade - v_consumir
      where id = v_item.bebida_id;
    end if;

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
before insert or delete or update of produto_id, bebida_id, pedido_id, quantidade
on public.itens_pedido
for each row execute function public.sincronizar_estoque_item_pedido();

comment on column public.bebidas.custo_unitario is
  'Custo administrativo opcional da bebida; nao pertence ao catalogo publico.';
comment on function public.ajustar_estoque_bebida(uuid, integer) is
  'Ajuste atomico SECURITY INVOKER para bebida; segue a superficie administrativa legada.';
comment on function public.definir_estoque_bebida(uuid, integer) is
  'Definicao atomica SECURITY INVOKER para bebida; segue a superficie administrativa legada.';
