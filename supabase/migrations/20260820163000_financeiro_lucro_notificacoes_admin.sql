-- Financeiro/Lucro e Central de Notificações do Admin.
-- Spec: specs/financeiro-lucro-notificacoes-admin.md

set search_path = pg_catalog, public, extensions;

-- ---------------------------------------------------------------------------
-- Lucro histórico: custo congelado no momento da venda.
-- ---------------------------------------------------------------------------

alter table public.itens_pedido
  add column if not exists custo_unitario numeric(12,2);

comment on column public.itens_pedido.custo_unitario is
  'Snapshot do custo do produto no INSERT. NULL significa custo histórico desconhecido.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'itens_pedido_custo_unitario_check'
      and conrelid = 'public.itens_pedido'::regclass
  ) then
    alter table public.itens_pedido
      add constraint itens_pedido_custo_unitario_check
      check (custo_unitario is null or custo_unitario >= 0);
  end if;
end;
$$;

create index if not exists itens_pedido_lucro_idx
  on public.itens_pedido (pedido_id, produto_id)
  include (quantidade, subtotal, custo_unitario, nome_item);

create or replace function public.preencher_custo_unitario_item_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- O cliente não escolhe o snapshot: o banco sempre deriva do catálogo.
  new.custo_unitario := null;
  if new.produto_id is not null then
    select p.custo_unitario
      into new.custo_unitario
      from public.produtos p
     where p.id = new.produto_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preencher_custo_unitario_item_pedido on public.itens_pedido;
create trigger trg_preencher_custo_unitario_item_pedido
before insert on public.itens_pedido
for each row execute function public.preencher_custo_unitario_item_pedido();

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
  group by 1, 2, 3;
$$;

revoke all on function public.preencher_custo_unitario_item_pedido()
  from public, anon, authenticated;
revoke all on function public.obter_lucro_produtos_admin(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.obter_lucro_produtos_admin(timestamptz, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Central de Notificações.
-- ---------------------------------------------------------------------------

create table if not exists public.notificacoes_admin (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  prioridade text not null,
  titulo text not null,
  mensagem text not null,
  entidade_tipo text not null,
  entidade_id uuid not null,
  dados jsonb not null default '{}'::jsonb,
  estado text not null default 'ativa',
  chave_dedupe text not null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  constraint notificacoes_admin_tipo_check
    check (tipo in ('estoque_esgotado', 'estoque_baixo', 'pedido_novo')),
  constraint notificacoes_admin_prioridade_check
    check (prioridade in ('urgente', 'normal')),
  constraint notificacoes_admin_entidade_check
    check (entidade_tipo in ('produto', 'pedido')),
  constraint notificacoes_admin_estado_check
    check (estado in ('ativa', 'resolvida')),
  constraint notificacoes_admin_resolucao_check
    check ((estado = 'resolvida') = (resolvida_em is not null))
);

create unique index if not exists notificacoes_admin_dedupe_ativa_uidx
  on public.notificacoes_admin (chave_dedupe)
  where estado = 'ativa';

create index if not exists notificacoes_admin_ativas_prioridade_idx
  on public.notificacoes_admin (prioridade, criada_em desc)
  include (id)
  where estado = 'ativa';

create index if not exists notificacoes_admin_entidade_ativa_idx
  on public.notificacoes_admin (entidade_tipo, entidade_id)
  where estado = 'ativa';

create table if not exists public.notificacoes_admin_leituras (
  notificacao_id uuid not null references public.notificacoes_admin(id) on delete cascade,
  usuario_chave text not null,
  apresentada_em timestamptz,
  lida_em timestamptz,
  silenciada_em timestamptz,
  atualizada_em timestamptz not null default now(),
  primary key (notificacao_id, usuario_chave),
  constraint notificacoes_admin_leituras_usuario_check
    check (char_length(btrim(usuario_chave)) between 1 and 120)
);

create index if not exists notificacoes_admin_leituras_usuario_idx
  on public.notificacoes_admin_leituras (usuario_chave, notificacao_id);

create table if not exists public.notificacoes_admin_preferencias (
  usuario_chave text primary key,
  mostrar_modal_entrada boolean not null default true,
  atualizada_em timestamptz not null default now(),
  constraint notificacoes_admin_preferencias_usuario_check
    check (char_length(btrim(usuario_chave)) between 1 and 120)
);

alter table public.notificacoes_admin enable row level security;
alter table public.notificacoes_admin_leituras enable row level security;
alter table public.notificacoes_admin_preferencias enable row level security;

revoke all on table public.notificacoes_admin from public, anon, authenticated;
revoke all on table public.notificacoes_admin_leituras from public, anon, authenticated;
revoke all on table public.notificacoes_admin_preferencias from public, anon, authenticated;
grant select, insert, update, delete on table public.notificacoes_admin to service_role;
grant select, insert, update, delete on table public.notificacoes_admin_leituras to service_role;
grant select, insert, update, delete on table public.notificacoes_admin_preferencias to service_role;

create or replace function public.descrever_estoque_notificacao_admin(
  p_quantidade integer,
  p_minimo integer,
  p_nome text
)
returns table (tipo text, prioridade text, titulo text, mensagem text)
language sql
immutable
set search_path = ''
as $$
  select
    case when coalesce(p_quantidade, 0) <= 0 then 'estoque_esgotado' else 'estoque_baixo' end,
    'urgente',
    case when coalesce(p_quantidade, 0) <= 0 then 'Produto esgotado' else 'Estoque baixo' end,
    case
      when coalesce(p_quantidade, 0) <= 0 then coalesce(p_nome, 'Produto') || ' está sem estoque.'
      else coalesce(p_nome, 'Produto') || ' possui apenas ' || p_quantidade
        || case when p_quantidade = 1 then ' unidade.' else ' unidades.' end
    end
  where coalesce(p_quantidade, 0) <= 0
     or coalesce(p_quantidade, 0) <= coalesce(p_minimo, 0);
$$;

create or replace function public.descrever_pedido_notificacao_admin(
  p_status text,
  p_numero integer,
  p_cliente text
)
returns table (tipo text, prioridade text, titulo text, mensagem text)
language sql
immutable
set search_path = ''
as $$
  select
    'pedido_novo',
    'normal',
    'Pedido novo',
    'Pedido #' || coalesce(p_numero::text, '—') || ' de '
      || coalesce(nullif(btrim(p_cliente), ''), 'cliente não identificado')
      || ' aguarda atendimento.'
  where lower(coalesce(p_status, '')) in ('pendente', 'confirmado');
$$;

create or replace function public.sincronizar_notificacao_estoque_admin(p_produto_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notificacoes_admin n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'produto'
     and n.entidade_id = p_produto_id
     and not exists (
       select 1
       from public.produtos p
       cross join lateral public.descrever_estoque_notificacao_admin(
         p.estoque_quantidade, p.estoque_minimo, p.nome
       ) d
       where p.id = p_produto_id and d.tipo = n.tipo
     );

  insert into public.notificacoes_admin as alvo (
    tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, dados, chave_dedupe
  )
  select
    d.tipo, d.prioridade, d.titulo, d.mensagem, 'produto', p.id,
    jsonb_build_object('quantidade', p.estoque_quantidade, 'minimo', p.estoque_minimo),
    d.tipo || ':' || p.id::text
  from public.produtos p
  cross join lateral public.descrever_estoque_notificacao_admin(
    p.estoque_quantidade, p.estoque_minimo, p.nome
  ) d
  where p.id = p_produto_id
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    prioridade = excluded.prioridade,
    titulo = excluded.titulo,
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.mensagem is distinct from excluded.mensagem
     or alvo.dados is distinct from excluded.dados;
end;
$$;

create or replace function public.sincronizar_notificacao_pedido_admin(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notificacoes_admin n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'pedido'
     and n.entidade_id = p_pedido_id
     and not exists (
       select 1 from public.pedidos p
       where p.id = p_pedido_id
         and lower(coalesce(p.status, '')) in ('pendente', 'confirmado')
     );

  insert into public.notificacoes_admin as alvo (
    tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, dados, chave_dedupe
  )
  select
    d.tipo, d.prioridade, d.titulo, d.mensagem, 'pedido', p.id,
    jsonb_build_object('numero_pedido', p.numero_pedido),
    d.tipo || ':' || p.id::text
  from public.pedidos p
  cross join lateral public.descrever_pedido_notificacao_admin(
    p.status, p.numero_pedido, p.nome_cliente
  ) d
  where p.id = p_pedido_id
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    titulo = excluded.titulo,
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.mensagem is distinct from excluded.mensagem
     or alvo.dados is distinct from excluded.dados;
end;
$$;

create or replace function public.reconciliar_notificacoes_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notificacoes_admin n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'produto'
     and not exists (
       select 1
       from public.produtos p
       cross join lateral public.descrever_estoque_notificacao_admin(
         p.estoque_quantidade, p.estoque_minimo, p.nome
       ) d
       where p.id = n.entidade_id and d.tipo = n.tipo
     );

  insert into public.notificacoes_admin as alvo (
    tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, dados, chave_dedupe
  )
  select
    d.tipo, d.prioridade, d.titulo, d.mensagem, 'produto', p.id,
    jsonb_build_object('quantidade', p.estoque_quantidade, 'minimo', p.estoque_minimo),
    d.tipo || ':' || p.id::text
  from public.produtos p
  cross join lateral public.descrever_estoque_notificacao_admin(
    p.estoque_quantidade, p.estoque_minimo, p.nome
  ) d
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.mensagem is distinct from excluded.mensagem
     or alvo.dados is distinct from excluded.dados;

  -- Pedidos só são criados pelo trigger a partir desta migration. Aqui apenas
  -- resolvemos ocorrências existentes para não gerar backlog histórico.
  update public.notificacoes_admin n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'pedido'
     and not exists (
       select 1 from public.pedidos p
       where p.id = n.entidade_id
         and lower(coalesce(p.status, '')) in ('pendente', 'confirmado')
     );
end;
$$;

create or replace function public.resumo_notificacoes_admin(p_usuario_chave text)
returns table (
  urgentes integer,
  urgentes_nao_lidas integer,
  normais integer,
  nao_lidas integer,
  total integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where n.prioridade = 'urgente')::int,
    count(*) filter (where n.prioridade = 'urgente' and l.lida_em is null)::int,
    count(*) filter (where n.prioridade = 'normal')::int,
    count(*) filter (where l.lida_em is null)::int,
    count(*)::int
  from public.notificacoes_admin n
  left join public.notificacoes_admin_leituras l
    on l.notificacao_id = n.id and l.usuario_chave = p_usuario_chave
  where n.estado = 'ativa' and l.silenciada_em is null;
$$;

create or replace function public.listar_notificacoes_admin(
  p_usuario_chave text,
  p_limite integer default 20,
  p_incluir_historico boolean default false
)
returns table (
  id uuid,
  tipo text,
  prioridade text,
  titulo text,
  mensagem text,
  entidade_tipo text,
  entidade_id uuid,
  dados jsonb,
  estado text,
  criada_em timestamptz,
  resolvida_em timestamptz,
  apresentada_em timestamptz,
  lida_em timestamptz,
  silenciada_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id, n.tipo, n.prioridade, n.titulo, n.mensagem,
    n.entidade_tipo, n.entidade_id, n.dados, n.estado,
    n.criada_em, n.resolvida_em,
    l.apresentada_em, l.lida_em, l.silenciada_em
  from public.notificacoes_admin n
  left join public.notificacoes_admin_leituras l
    on l.notificacao_id = n.id and l.usuario_chave = p_usuario_chave
  where (n.estado = 'ativa' and l.silenciada_em is null)
     or p_incluir_historico
  order by
    (n.estado = 'ativa' and l.silenciada_em is null) desc,
    (n.prioridade = 'urgente') desc,
    n.criada_em desc
  limit greatest(1, least(coalesce(p_limite, 20), 50));
$$;

create or replace function public.trigger_notificacoes_produto_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.notificacoes_admin
       set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
     where estado = 'ativa' and entidade_tipo = 'produto' and entidade_id = old.id;
    return null;
  end if;
  perform public.sincronizar_notificacao_estoque_admin(new.id);
  return null;
end;
$$;

create or replace function public.trigger_notificacoes_pedido_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.notificacoes_admin
       set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
     where estado = 'ativa' and entidade_tipo = 'pedido' and entidade_id = old.id;
    return null;
  end if;
  perform public.sincronizar_notificacao_pedido_admin(new.id);
  return null;
end;
$$;

drop trigger if exists trg_notificacoes_produto_admin on public.produtos;
create trigger trg_notificacoes_produto_admin
after insert or delete or update of estoque_quantidade, estoque_minimo, nome
on public.produtos
for each row execute function public.trigger_notificacoes_produto_admin();

drop trigger if exists trg_notificacoes_pedido_admin on public.pedidos;
create trigger trg_notificacoes_pedido_admin
after insert or delete or update of status
on public.pedidos
for each row execute function public.trigger_notificacoes_pedido_admin();

revoke all on function public.descrever_estoque_notificacao_admin(integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.descrever_pedido_notificacao_admin(text, integer, text)
  from public, anon, authenticated;
revoke all on function public.sincronizar_notificacao_estoque_admin(uuid)
  from public, anon, authenticated;
revoke all on function public.sincronizar_notificacao_pedido_admin(uuid)
  from public, anon, authenticated;
revoke all on function public.reconciliar_notificacoes_admin()
  from public, anon, authenticated;
revoke all on function public.resumo_notificacoes_admin(text)
  from public, anon, authenticated;
revoke all on function public.listar_notificacoes_admin(text, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.trigger_notificacoes_produto_admin()
  from public, anon, authenticated;
revoke all on function public.trigger_notificacoes_pedido_admin()
  from public, anon, authenticated;

grant execute on function public.reconciliar_notificacoes_admin() to service_role;
grant execute on function public.resumo_notificacoes_admin(text) to service_role;
grant execute on function public.listar_notificacoes_admin(text, integer, boolean) to service_role;

select public.reconciliar_notificacoes_admin();

