-- Histórico operacional/comercial de produto.
-- O estado corrente permanece em public.produtos; estes registros são audit trail.

create table if not exists public.produto_historico_eventos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos(id) on delete set null,
  produto_nome_snapshot text not null,
  tipo text not null,
  categoria text not null,
  ocorreu_em timestamptz not null default timezone('utc'::text, now()),
  actor_type text not null default 'sistema',
  actor_id uuid references public.usuarios_sistema(id) on delete set null,
  actor_name_snapshot text not null default 'Sistema',
  origem text not null,
  referencia_origem text,
  pedido_id uuid references public.pedidos(id) on delete set null,
  promocao_id uuid,
  antes jsonb not null default '{}'::jsonb,
  depois jsonb not null default '{}'::jsonb,
  metadados jsonb not null default '{}'::jsonb,
  constraint produto_historico_eventos_categoria_check check (
    categoria in ('alteracao', 'estoque', 'promocao', 'visibilidade', 'comercial')
  ),
  constraint produto_historico_eventos_dados_objeto_check check (
    jsonb_typeof(antes) = 'object'
    and jsonb_typeof(depois) = 'object'
    and jsonb_typeof(metadados) = 'object'
  )
);

create table if not exists public.produto_promocoes_historico (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos(id) on delete set null,
  produto_nome_snapshot text not null,
  iniciada_em timestamptz not null default timezone('utc'::text, now()),
  encerrada_em timestamptz,
  preco_normal numeric(12,2) not null,
  preco_promocional numeric(12,2) not null,
  desconto_percentual numeric(7,4) not null,
  constraint produto_promocoes_historico_preco_check check (
    preco_normal >= preco_promocional and preco_promocional >= 0
  ),
  constraint produto_promocoes_historico_periodo_check check (
    encerrada_em is null or encerrada_em >= iniciada_em
  )
);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.produto_historico_eventos'::regclass
      and conname = 'produto_historico_eventos_promocao_id_fkey'
  ) then
    alter table public.produto_historico_eventos
      add constraint produto_historico_eventos_promocao_id_fkey
      foreign key (promocao_id)
      references public.produto_promocoes_historico(id)
      on delete set null;
  end if;
end
$$;

alter table public.itens_pedido
  add column if not exists promocao_produto_historico_id uuid,
  add column if not exists preco_base_produto numeric(12,2),
  add column if not exists preco_promocional_produto numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.itens_pedido'::regclass
      and conname = 'itens_pedido_promocao_produto_historico_id_fkey'
  ) then
    alter table public.itens_pedido
      add constraint itens_pedido_promocao_produto_historico_id_fkey
      foreign key (promocao_produto_historico_id)
      references public.produto_promocoes_historico(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.itens_pedido'::regclass
      and conname = 'itens_pedido_snapshot_promocao_coerente_ck'
  ) then
    alter table public.itens_pedido
      add constraint itens_pedido_snapshot_promocao_coerente_ck
      check (
        (
          promocao_produto_historico_id is null
          and preco_base_produto is null
          and preco_promocional_produto is null
        )
        or (
          promocao_produto_historico_id is not null
          and preco_base_produto is not null
          and preco_promocional_produto is not null
          and preco_base_produto >= preco_promocional_produto
          and preco_promocional_produto >= 0
        )
      );
  end if;
end
$$;

create index if not exists idx_produto_historico_eventos_produto_cursor
  on public.produto_historico_eventos (produto_id, ocorreu_em desc, id desc);

create index if not exists idx_produto_historico_eventos_produto_categoria_cursor
  on public.produto_historico_eventos (produto_id, categoria, ocorreu_em desc, id desc);

create index if not exists idx_produto_promocoes_historico_produto_inicio
  on public.produto_promocoes_historico (produto_id, iniciada_em desc);

create index if not exists idx_itens_pedido_promocao_produto_historico
  on public.itens_pedido (promocao_produto_historico_id)
  where promocao_produto_historico_id is not null;

alter table public.produto_historico_eventos enable row level security;
alter table public.produto_promocoes_historico enable row level security;

revoke all on table public.produto_historico_eventos from anon, authenticated;
revoke all on table public.produto_promocoes_historico from anon, authenticated;
grant select on table public.produto_historico_eventos to service_role;
grant select on table public.produto_promocoes_historico to service_role;

create or replace function public.bloquear_mutacao_produto_historico_eventos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'HISTORICO_PRODUTO_APPEND_ONLY';
end
$$;

create or replace function public.proteger_episodio_promocao_produto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'EPISODIO_PROMOCAO_IMUTAVEL';
  end if;

  if old.encerrada_em is not null
     or new.produto_id is distinct from old.produto_id
     or new.produto_nome_snapshot is distinct from old.produto_nome_snapshot
     or new.iniciada_em is distinct from old.iniciada_em
     or new.preco_normal is distinct from old.preco_normal
     or new.preco_promocional is distinct from old.preco_promocional
     or new.desconto_percentual is distinct from old.desconto_percentual
     or new.encerrada_em is null
     or new.encerrada_em < old.iniciada_em then
    raise exception using errcode = '55000', message = 'EPISODIO_PROMOCAO_IMUTAVEL';
  end if;

  return new;
end
$$;

drop trigger if exists trg_bloquear_mutacao_produto_historico_eventos
  on public.produto_historico_eventos;
create trigger trg_bloquear_mutacao_produto_historico_eventos
before update or delete on public.produto_historico_eventos
for each row execute function public.bloquear_mutacao_produto_historico_eventos();

drop trigger if exists trg_proteger_episodio_promocao_produto
  on public.produto_promocoes_historico;
create trigger trg_proteger_episodio_promocao_produto
before update or delete on public.produto_promocoes_historico
for each row execute function public.proteger_episodio_promocao_produto();

create or replace function public.registrar_evento_produto_historico(
  p_produto_id uuid,
  p_produto_nome_snapshot text,
  p_tipo text,
  p_categoria text,
  p_antes jsonb,
  p_depois jsonb,
  p_metadados jsonb default '{}'::jsonb,
  p_promocao_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento_id uuid;
  v_pedido_id uuid;
begin
  begin
    v_pedido_id := nullif(p_metadados ->> 'pedido_id', '')::uuid;
  exception when invalid_text_representation then
    v_pedido_id := null;
  end;

  insert into public.produto_historico_eventos (
    produto_id,
    produto_nome_snapshot,
    tipo,
    categoria,
    actor_type,
    actor_name_snapshot,
    origem,
    referencia_origem,
    pedido_id,
    promocao_id,
    antes,
    depois,
    metadados
  ) values (
    p_produto_id,
    p_produto_nome_snapshot,
    p_tipo,
    p_categoria,
    'sistema',
    'Sistema',
    coalesce(nullif(p_metadados ->> 'origem', ''), 'banco_direto'),
    nullif(p_metadados ->> 'referencia', ''),
    v_pedido_id,
    p_promocao_id,
    coalesce(p_antes, '{}'::jsonb),
    coalesce(p_depois, '{}'::jsonb),
    coalesce(p_metadados, '{}'::jsonb)
  ) returning id into v_evento_id;

  return v_evento_id;
end
$$;

create or replace function public.registrar_historico_produto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contexto_texto text;
  v_contexto jsonb := '{}'::jsonb;
  v_antes jsonb := '{}'::jsonb;
  v_depois jsonb := '{}'::jsonb;
  v_metadados jsonb := '{}'::jsonb;
  v_tipo text;
  v_categoria text;
  v_promocao_antiga boolean := false;
  v_promocao_nova boolean := false;
  v_promocao_id uuid;
  v_promocao_anterior_id uuid;
  v_delta_estoque integer;
  v_agora timestamptz := timezone('utc'::text, now());
begin
  v_contexto_texto := pg_catalog.current_setting('app.produto_historico_contexto', true);
  if v_contexto_texto is not null and v_contexto_texto <> '' then
    begin
      v_contexto := v_contexto_texto::jsonb;
    exception when others then
      v_contexto := '{}'::jsonb;
    end;
  end if;

  if tg_op = 'INSERT' then
    v_promocao_nova := coalesce(new.preco_original > new.preco, false);
    v_depois := jsonb_build_object(
      'nome', new.nome,
      'descricao', new.descricao,
      'categoria', new.categoria,
      'imagem_url', new.imagem_url,
      'preco', new.preco,
      'preco_original', new.preco_original,
      'desconto', new.desconto,
      'disponivel', new.disponivel,
      'custo_unitario', new.custo_unitario,
      'estoque_quantidade', new.estoque_quantidade,
      'estoque_minimo', new.estoque_minimo,
      'bloquear_venda_sem_estoque', new.bloquear_venda_sem_estoque
    );

    if v_promocao_nova then
      insert into public.produto_promocoes_historico (
        produto_id,
        produto_nome_snapshot,
        iniciada_em,
        preco_normal,
        preco_promocional,
        desconto_percentual
      ) values (
        new.id,
        new.nome,
        v_agora,
        new.preco_original,
        new.preco,
        coalesce(new.desconto, round((1 - new.preco / nullif(new.preco_original, 0)) * 100, 4))
      ) returning id into v_promocao_id;
    end if;

    perform public.registrar_evento_produto_historico(
      new.id,
      new.nome,
      'produto_criado',
      'alteracao',
      v_antes,
      v_depois,
      v_contexto,
      v_promocao_id
    );

    if v_promocao_nova then
      perform public.registrar_evento_produto_historico(
        new.id,
        new.nome,
        'promocao_iniciada',
        'promocao',
        '{}'::jsonb,
        jsonb_build_object(
          'preco_normal', new.preco_original,
          'preco_promocional', new.preco,
          'desconto', new.desconto
        ),
        v_contexto || jsonb_build_object('origem', 'catalogo'),
        v_promocao_id
      );
    end if;

    return new;
  end if;

  if old.nome is not distinct from new.nome
     and old.descricao is not distinct from new.descricao
     and old.categoria is not distinct from new.categoria
     and old.imagem_url is not distinct from new.imagem_url
     and old.preco is not distinct from new.preco
     and old.preco_original is not distinct from new.preco_original
     and old.desconto is not distinct from new.desconto
     and old.disponivel is not distinct from new.disponivel
     and old.custo_unitario is not distinct from new.custo_unitario
     and old.estoque_quantidade is not distinct from new.estoque_quantidade
     and old.estoque_minimo is not distinct from new.estoque_minimo
     and old.bloquear_venda_sem_estoque is not distinct from new.bloquear_venda_sem_estoque then
    return new;
  end if;

  if old.nome is distinct from new.nome then
    v_antes := v_antes || jsonb_build_object('nome', old.nome);
    v_depois := v_depois || jsonb_build_object('nome', new.nome);
  end if;
  if old.descricao is distinct from new.descricao then
    v_antes := v_antes || jsonb_build_object('descricao', old.descricao);
    v_depois := v_depois || jsonb_build_object('descricao', new.descricao);
  end if;
  if old.categoria is distinct from new.categoria then
    v_antes := v_antes || jsonb_build_object('categoria', old.categoria);
    v_depois := v_depois || jsonb_build_object('categoria', new.categoria);
  end if;
  if old.imagem_url is distinct from new.imagem_url then
    v_antes := v_antes || jsonb_build_object('imagem_url', old.imagem_url);
    v_depois := v_depois || jsonb_build_object('imagem_url', new.imagem_url);
  end if;
  if old.disponivel is distinct from new.disponivel then
    v_antes := v_antes || jsonb_build_object('disponivel', old.disponivel);
    v_depois := v_depois || jsonb_build_object('disponivel', new.disponivel);
  end if;
  if old.custo_unitario is distinct from new.custo_unitario then
    v_antes := v_antes || jsonb_build_object('custo_unitario', old.custo_unitario);
    v_depois := v_depois || jsonb_build_object('custo_unitario', new.custo_unitario);
  end if;
  if old.estoque_minimo is distinct from new.estoque_minimo then
    v_antes := v_antes || jsonb_build_object('estoque_minimo', old.estoque_minimo);
    v_depois := v_depois || jsonb_build_object('estoque_minimo', new.estoque_minimo);
  end if;
  if old.bloquear_venda_sem_estoque is distinct from new.bloquear_venda_sem_estoque then
    v_antes := v_antes || jsonb_build_object('bloquear_venda_sem_estoque', old.bloquear_venda_sem_estoque);
    v_depois := v_depois || jsonb_build_object('bloquear_venda_sem_estoque', new.bloquear_venda_sem_estoque);
  end if;
  if old.preco is distinct from new.preco
     or old.preco_original is distinct from new.preco_original
     or old.desconto is distinct from new.desconto then
    v_antes := v_antes || jsonb_build_object(
      'preco', old.preco,
      'preco_original', old.preco_original,
      'desconto', old.desconto
    );
    v_depois := v_depois || jsonb_build_object(
      'preco', new.preco,
      'preco_original', new.preco_original,
      'desconto', new.desconto
    );
  end if;
  if old.estoque_quantidade is distinct from new.estoque_quantidade then
    v_delta_estoque := new.estoque_quantidade - old.estoque_quantidade;
    v_antes := v_antes || jsonb_build_object('estoque_quantidade', old.estoque_quantidade);
    v_depois := v_depois || jsonb_build_object('estoque_quantidade', new.estoque_quantidade);
    v_metadados := v_metadados || jsonb_build_object('delta_estoque', v_delta_estoque);
  end if;

  v_metadados := v_contexto || v_metadados;
  v_promocao_antiga := coalesce(old.preco_original > old.preco, false);
  v_promocao_nova := coalesce(new.preco_original > new.preco, false);

  if v_promocao_antiga and (
    not v_promocao_nova
    or old.preco is distinct from new.preco
    or old.preco_original is distinct from new.preco_original
    or old.desconto is distinct from new.desconto
  ) then
    select id into v_promocao_anterior_id
    from public.produto_promocoes_historico
    where produto_id = new.id and encerrada_em is null
    order by iniciada_em desc, id desc
    limit 1
    for update;

    if v_promocao_anterior_id is not null then
      update public.produto_promocoes_historico
      set encerrada_em = v_agora
      where id = v_promocao_anterior_id;
    end if;
  end if;

  if v_promocao_nova and (
    not v_promocao_antiga
    or old.preco is distinct from new.preco
    or old.preco_original is distinct from new.preco_original
    or old.desconto is distinct from new.desconto
  ) then
    insert into public.produto_promocoes_historico (
      produto_id,
      produto_nome_snapshot,
      iniciada_em,
      preco_normal,
      preco_promocional,
      desconto_percentual
    ) values (
      new.id,
      new.nome,
      v_agora,
      new.preco_original,
      new.preco,
      coalesce(new.desconto, round((1 - new.preco / nullif(new.preco_original, 0)) * 100, 4))
    ) returning id into v_promocao_id;
  else
    v_promocao_id := v_promocao_anterior_id;
  end if;

  if not v_promocao_antiga and v_promocao_nova then
    v_tipo := 'promocao_iniciada';
    v_categoria := 'promocao';
  elsif v_promocao_antiga and not v_promocao_nova then
    v_tipo := 'promocao_encerrada';
    v_categoria := 'promocao';
    v_promocao_id := v_promocao_anterior_id;
  elsif v_promocao_antiga and v_promocao_nova and v_promocao_id is not null then
    v_tipo := 'promocao_alterada';
    v_categoria := 'promocao';
    v_metadados := v_metadados || jsonb_build_object('promocao_anterior_id', v_promocao_anterior_id);
  elsif old.disponivel is distinct from new.disponivel then
    v_tipo := case when new.disponivel then 'produto_publicado' else 'produto_ocultado' end;
    v_categoria := 'visibilidade';
  elsif old.estoque_quantidade is distinct from new.estoque_quantidade then
    v_categoria := 'estoque';
    v_tipo := case
      when old.estoque_quantidade > 0 and new.estoque_quantidade = 0 then 'estoque_esgotado'
      when old.estoque_quantidade = 0 and new.estoque_quantidade > 0 then 'estoque_recuperado'
      when coalesce(v_metadados ->> 'origem', '') in ('reserva_pedido', 'reabertura_pedido') then 'estoque_reservado_pedido'
      when coalesce(v_metadados ->> 'origem', '') in ('cancelamento_pedido', 'restauracao_item_pedido') then 'estoque_restaurado_pedido'
      else 'estoque_ajustado'
    end;
  elsif old.estoque_minimo is distinct from new.estoque_minimo
     and old.nome is not distinct from new.nome
     and old.descricao is not distinct from new.descricao
     and old.categoria is not distinct from new.categoria
     and old.imagem_url is not distinct from new.imagem_url
     and old.custo_unitario is not distinct from new.custo_unitario
     and old.bloquear_venda_sem_estoque is not distinct from new.bloquear_venda_sem_estoque then
    v_tipo := 'estoque_minimo_alterado';
    v_categoria := 'alteracao';
  elsif old.bloquear_venda_sem_estoque is distinct from new.bloquear_venda_sem_estoque
     and old.nome is not distinct from new.nome
     and old.descricao is not distinct from new.descricao
     and old.categoria is not distinct from new.categoria
     and old.imagem_url is not distinct from new.imagem_url
     and old.custo_unitario is not distinct from new.custo_unitario
     and old.estoque_minimo is not distinct from new.estoque_minimo then
    v_tipo := 'controle_estoque_alterado';
    v_categoria := 'alteracao';
  elsif old.preco is distinct from new.preco
     or old.preco_original is distinct from new.preco_original
     or old.desconto is distinct from new.desconto then
    v_tipo := 'preco_alterado';
    v_categoria := 'alteracao';
  else
    v_tipo := 'produto_atualizado';
    v_categoria := 'alteracao';
  end if;

  perform public.registrar_evento_produto_historico(
    new.id,
    new.nome,
    v_tipo,
    v_categoria,
    v_antes,
    v_depois,
    v_metadados,
    v_promocao_id
  );

  return new;
end
$$;

create or replace function public.snapshot_promocao_item_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promocao public.produto_promocoes_historico%rowtype;
begin
  if new.produto_id is null then
    return new;
  end if;

  select * into v_promocao
  from public.produto_promocoes_historico
  where produto_id = new.produto_id and encerrada_em is null
  order by iniciada_em desc, id desc
  limit 1;

  if found and new.preco_unitario = v_promocao.preco_promocional then
    new.promocao_produto_historico_id := v_promocao.id;
    new.preco_base_produto := v_promocao.preco_normal;
    new.preco_promocional_produto := v_promocao.preco_promocional;
  else
    new.promocao_produto_historico_id := null;
    new.preco_base_produto := null;
    new.preco_promocional_produto := null;
  end if;

  return new;
end
$$;

drop trigger if exists trg_registrar_historico_produto on public.produtos;
create trigger trg_registrar_historico_produto
after insert or update on public.produtos
for each row execute function public.registrar_historico_produto();

drop trigger if exists trg_snapshot_promocao_item_pedido on public.itens_pedido;
create trigger trg_snapshot_promocao_item_pedido
before insert on public.itens_pedido
for each row execute function public.snapshot_promocao_item_pedido();

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

  perform pg_catalog.set_config(
    'app.produto_historico_contexto',
    pg_catalog.jsonb_build_object('origem', 'ajuste_estoque', 'referencia', 'rpc:ajustar_estoque_produto')::text,
    true
  );
  update public.produtos
  set estoque_quantidade = estoque_quantidade + p_delta
  where id = p_produto_id
    and estoque_quantidade + p_delta >= 0
  returning estoque_quantidade into v_quantidade;
  perform pg_catalog.set_config('app.produto_historico_contexto', '{}'::text, true);

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

  perform pg_catalog.set_config(
    'app.produto_historico_contexto',
    pg_catalog.jsonb_build_object('origem', 'ajuste_estoque', 'referencia', 'rpc:definir_estoque_produto')::text,
    true
  );
  update public.produtos
  set estoque_quantidade = p_quantidade
  where id = p_produto_id
  returning estoque_quantidade into v_quantidade;
  perform pg_catalog.set_config('app.produto_historico_contexto', '{}'::text, true);

  if v_quantidade is null then
    raise exception using errcode = 'P0002', message = 'PRODUTO_NAO_ENCONTRADO';
  end if;
  return v_quantidade;
end
$$;

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
    update public.itens_pedido
    set estoque_quantidade_consumida = v_consumir
    where id = v_item.id;
  end loop;

  return new;
end
$$;

create or replace function public.listar_historico_produto(
  p_produto_id uuid,
  p_categoria text default null,
  p_ocorreu_antes timestamptz default null,
  p_id_antes uuid default null,
  p_limite integer default 25
)
returns table (
  id uuid,
  tipo text,
  categoria text,
  ocorreu_em timestamptz,
  actor_type text,
  actor_name_snapshot text,
  origem text,
  referencia_origem text,
  pedido_id uuid,
  pedido_numero integer,
  promocao_id uuid,
  antes jsonb,
  depois jsonb,
  metadados jsonb
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    e.id,
    e.tipo,
    e.categoria,
    e.ocorreu_em,
    e.actor_type,
    e.actor_name_snapshot,
    e.origem,
    e.referencia_origem,
    e.pedido_id,
    p.numero_pedido,
    e.promocao_id,
    e.antes,
    e.depois,
    e.metadados
  from public.produto_historico_eventos e
  left join public.pedidos p on p.id = e.pedido_id
  where e.produto_id = p_produto_id
    and (
      p_categoria is null
      or p_categoria = 'tudo'
      or e.categoria = p_categoria
      or (p_categoria = 'comercial' and e.pedido_id is not null)
    )
    and (
      p_ocorreu_antes is null
      or (e.ocorreu_em, e.id) < (p_ocorreu_antes, p_id_antes)
    )
  order by e.ocorreu_em desc, e.id desc
  limit least(greatest(coalesce(p_limite, 25), 1), 50)
$$;

create or replace function public.obter_inteligencia_produto(
  p_produto_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  with vendas as (
    select
      ip.pedido_id,
      ip.quantidade,
      ip.subtotal,
      ip.promocao_produto_historico_id,
      ip.preco_base_produto,
      ip.preco_promocional_produto,
      p.created_at
    from public.itens_pedido ip
    join public.pedidos p on p.id = ip.pedido_id
    where ip.produto_id = p_produto_id
      and p.created_at >= p_inicio
      and p.created_at <= p_fim
      and coalesce(p.status, '') not in ('cancelado', 'aguardando_pagamento', 'pendente')
      and coalesce(p.pagamento_online_status, 'nao_aplicavel') <> 'aguardando_pagamento'
  ),
  estoque_periodo as (
    select e.*
    from public.produto_historico_eventos e
    where e.produto_id = p_produto_id
      and e.ocorreu_em >= p_inicio
      and e.ocorreu_em <= p_fim
      and e.categoria = 'estoque'
  ),
  estado_estoque as (
    select
      e.ocorreu_em,
      (e.depois ->> 'estoque_quantidade')::integer as quantidade,
      lag((e.depois ->> 'estoque_quantidade')::integer) over (order by e.ocorreu_em, e.id) as anterior
    from public.produto_historico_eventos e
    where e.produto_id = p_produto_id
      and e.ocorreu_em <= p_fim
      and e.depois ? 'estoque_quantidade'
  ),
  episodios_esgotado as (
    select
      z.ocorreu_em as inicio,
      coalesce((
        select min(r.ocorreu_em)
        from estado_estoque r
        where r.ocorreu_em > z.ocorreu_em and r.quantidade > 0
      ), p_fim) as fim
    from estado_estoque z
    where z.quantidade = 0 and z.anterior > 0
  ),
  estado_visibilidade as (
    select
      e.ocorreu_em,
      (e.depois ->> 'disponivel')::boolean as disponivel,
      lag((e.depois ->> 'disponivel')::boolean) over (order by e.ocorreu_em, e.id) as anterior
    from public.produto_historico_eventos e
    where e.produto_id = p_produto_id
      and e.ocorreu_em <= p_fim
      and e.depois ? 'disponivel'
  ),
  episodios_oculto as (
    select
      z.ocorreu_em as inicio,
      coalesce((
        select min(r.ocorreu_em)
        from estado_visibilidade r
        where r.ocorreu_em > z.ocorreu_em and r.disponivel
      ), p_fim) as fim
    from estado_visibilidade z
    where z.disponivel is false and z.anterior is true
  ),
  promocoes as (
    select
      pp.id,
      pp.iniciada_em,
      pp.encerrada_em,
      pp.preco_normal,
      pp.preco_promocional,
      pp.desconto_percentual,
      count(distinct v.pedido_id) filter (where v.promocao_produto_historico_id = pp.id) as pedidos,
      coalesce(sum(v.quantidade) filter (where v.promocao_produto_historico_id = pp.id), 0) as unidades,
      coalesce(sum(v.subtotal) filter (where v.promocao_produto_historico_id = pp.id), 0) as faturamento,
      coalesce(sum(
        v.quantidade * (v.preco_base_produto - v.preco_promocional_produto)
      ) filter (where v.promocao_produto_historico_id = pp.id), 0) as desconto_concedido
    from public.produto_promocoes_historico pp
    left join vendas v on v.promocao_produto_historico_id = pp.id
    where pp.produto_id = p_produto_id
      and pp.iniciada_em <= p_fim
      and coalesce(pp.encerrada_em, p_fim) >= p_inicio
    group by pp.id
    order by pp.iniciada_em desc
  )
  select jsonb_build_object(
    'unidades_vendidas', coalesce((select sum(quantidade) from vendas), 0),
    'pedidos', coalesce((select count(distinct pedido_id) from vendas), 0),
    'faturamento', coalesce((select sum(subtotal) from vendas), 0),
    'ticket_medio_produto', coalesce(
      (select sum(subtotal) / nullif(count(distinct pedido_id), 0) from vendas), 0
    ),
    'preco_medio_realizado', coalesce(
      (select sum(subtotal) / nullif(sum(quantidade), 0) from vendas), 0
    ),
    'desconto_promocional', coalesce(
      (select sum(quantidade * (preco_base_produto - preco_promocional_produto)) from vendas where promocao_produto_historico_id is not null), 0
    ),
    'entradas_estoque', coalesce((
      select sum(greatest((metadados ->> 'delta_estoque')::integer, 0)) from estoque_periodo
    ), 0),
    'saidas_estoque', coalesce((
      select sum(abs(least((metadados ->> 'delta_estoque')::integer, 0))) from estoque_periodo
    ), 0),
    'ajustes_manuais', coalesce((
      select count(*) from estoque_periodo where origem = 'ajuste_estoque'
    ), 0),
    'unidades_reservadas', coalesce((
      select sum(abs((metadados ->> 'delta_estoque')::integer)
      ) from estoque_periodo where origem in ('reserva_pedido', 'reabertura_pedido')
    ), 0),
    'unidades_restauradas', coalesce((
      select sum((metadados ->> 'delta_estoque')::integer
      ) from estoque_periodo where origem in ('cancelamento_pedido', 'restauracao_item_pedido')
    ), 0),
    'vezes_esgotado', coalesce((select count(*) from episodios_esgotado), 0),
    'segundos_esgotado', coalesce((
      select sum(extract(epoch from least(fim, p_fim) - greatest(inicio, p_inicio)))
      from episodios_esgotado
      where fim > p_inicio and inicio < p_fim
    ), 0),
    'vezes_oculto', coalesce((select count(*) from episodios_oculto), 0),
    'segundos_oculto', coalesce((
      select sum(extract(epoch from least(fim, p_fim) - greatest(inicio, p_inicio)))
      from episodios_oculto
      where fim > p_inicio and inicio < p_fim
    ), 0),
    'ultima_alteracao_em', (select max(ocorreu_em) from public.produto_historico_eventos where produto_id = p_produto_id),
    'ultima_venda_em', (select max(created_at) from vendas),
    'precos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ocorreu_em', e.ocorreu_em,
        'preco', e.depois -> 'preco',
        'preco_original', e.depois -> 'preco_original',
        'tipo', e.tipo
      ) order by e.ocorreu_em)
      from public.produto_historico_eventos e
      where e.produto_id = p_produto_id
        and e.ocorreu_em <= p_fim
        and e.depois ? 'preco'
    ), '[]'::jsonb),
    'promocoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'iniciada_em', iniciada_em,
        'encerrada_em', encerrada_em,
        'preco_normal', preco_normal,
        'preco_promocional', preco_promocional,
        'desconto_percentual', desconto_percentual,
        'pedidos', pedidos,
        'unidades', unidades,
        'faturamento', faturamento,
        'desconto_concedido', desconto_concedido
      ) order by iniciada_em desc)
      from promocoes
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.bloquear_mutacao_produto_historico_eventos() from public;
revoke all on function public.proteger_episodio_promocao_produto() from public;
revoke all on function public.registrar_evento_produto_historico(uuid, text, text, text, jsonb, jsonb, jsonb, uuid) from public;
revoke all on function public.registrar_historico_produto() from public;
revoke all on function public.snapshot_promocao_item_pedido() from public;
revoke all on function public.listar_historico_produto(uuid, text, timestamptz, uuid, integer) from public;
revoke all on function public.obter_inteligencia_produto(uuid, timestamptz, timestamptz) from public;
grant execute on function public.listar_historico_produto(uuid, text, timestamptz, uuid, integer) to service_role;
grant execute on function public.obter_inteligencia_produto(uuid, timestamptz, timestamptz) to service_role;

comment on table public.produto_historico_eventos is
  'Audit trail append-only de produto. Disponível a partir da migration 20260822155525.';
comment on table public.produto_promocoes_historico is
  'Episódios promocionais imutáveis, com encerramento único e métricas por snapshot.';
comment on column public.itens_pedido.promocao_produto_historico_id is
  'Episódio promocional aplicado à venda; nunca derivado do preço atual do catálogo.';
