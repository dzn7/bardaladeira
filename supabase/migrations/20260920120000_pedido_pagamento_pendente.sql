set search_path = pg_catalog, public, extensions;

alter table public.pedidos
  add column if not exists forma_pagamento_pendente_desde timestamptz;

alter table public.pedidos
  alter column forma_pagamento_pendente_desde set default now();

create index if not exists pedidos_pagamento_pendente_desde_idx
  on public.pedidos (forma_pagamento_pendente_desde)
  where forma_pagamento_pendente_desde is not null;

create or replace function public.preparar_forma_pagamento_pendente_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(new.forma_pagamento), '') is null then
    new.forma_pagamento := null;
    if tg_op = 'INSERT' or nullif(btrim(old.forma_pagamento), '') is not null then
      new.forma_pagamento_pendente_desde := coalesce(new.forma_pagamento_pendente_desde, now());
    end if;
  else
    new.forma_pagamento := nullif(btrim(new.forma_pagamento), '');
    new.forma_pagamento_pendente_desde := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preparar_forma_pagamento_pendente on public.pedidos;
create trigger trg_preparar_forma_pagamento_pendente
before insert or update of forma_pagamento on public.pedidos
for each row execute function public.preparar_forma_pagamento_pendente_pedido();

create or replace function public.sync_pedido_caixa_em_tempo_real()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caixa_aberto public.caixas%rowtype;
  categoria_nome text;
  categoria_id uuid;
  forma_pagamento_pedido text;
  nome_cliente_pedido text;
  pagamento_definido_depois boolean := false;
begin
  if lower(coalesce(new.status, '')) = 'cancelado' then
    delete from public.movimentacoes_caixa where pedido_id = new.id;
    return new;
  end if;

  forma_pagamento_pedido := nullif(btrim(new.forma_pagamento), '');
  if forma_pagamento_pedido is null then
    delete from public.movimentacoes_caixa where pedido_id = new.id;
    return new;
  end if;

  pagamento_definido_depois := tg_op = 'UPDATE'
    and nullif(btrim(old.forma_pagamento), '') is null;

  select * into caixa_aberto from public.caixas
  where status = 'aberto'
  order by data_abertura desc, created_at desc, id desc
  limit 1;
  if caixa_aberto.id is null then return new; end if;
  if new.created_at < caixa_aberto.data_abertura and not pagamento_definido_depois then return new; end if;

  nome_cliente_pedido := coalesce(nullif(btrim(new.nome_cliente), ''), 'Cliente');
  categoria_nome := case forma_pagamento_pedido
    when 'Dinheiro' then 'Pedido - Dinheiro'
    when 'Espécie' then 'Pedido - Dinheiro'
    when 'PIX' then 'Pedido - PIX'
    when 'Cartão de Débito' then 'Pedido - Cartão Débito'
    when 'Cartão Débito' then 'Pedido - Cartão Débito'
    when 'Cartão de Crédito' then 'Pedido - Cartão Crédito'
    when 'Cartão Crédito' then 'Pedido - Cartão Crédito'
    else 'Vendas do Dia'
  end;

  select id into categoria_id from public.categorias_caixa
  where nome = categoria_nome and coalesce(ativo, true)
  order by ordem asc nulls last, created_at asc limit 1;
  if categoria_id is null then
    select id into categoria_id from public.categorias_caixa
    where nome = 'Vendas do Dia' and coalesce(ativo, true)
    order by ordem asc nulls last, created_at asc limit 1;
  end if;

  insert into public.movimentacoes_caixa (caixa_id, categoria_id, tipo, valor, descricao, forma_pagamento, pedido_id)
  values (caixa_aberto.id, categoria_id, 'entrada', coalesce(new.total, 0), concat('Pedido de ', nome_cliente_pedido, ' - ', forma_pagamento_pedido), forma_pagamento_pedido, new.id)
  on conflict (pedido_id) do update set
    caixa_id = excluded.caixa_id, categoria_id = excluded.categoria_id, tipo = excluded.tipo,
    valor = excluded.valor, descricao = excluded.descricao, forma_pagamento = excluded.forma_pagamento;
  return new;
end;
$$;
