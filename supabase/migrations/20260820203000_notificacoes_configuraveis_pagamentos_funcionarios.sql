-- Agenda mensal de pagamentos de funcionários e preferências por categoria.
-- Dados administrativos privados: somente service_role via route handlers.

set search_path = pg_catalog, public, extensions;

alter table public.notificacoes_admin
  drop constraint if exists notificacoes_admin_tipo_check,
  drop constraint if exists notificacoes_admin_entidade_check;

alter table public.notificacoes_admin
  add constraint notificacoes_admin_tipo_check check (
    tipo = any (array['estoque_esgotado', 'estoque_baixo', 'pedido_novo', 'pagamento_funcionario'])
  ),
  add constraint notificacoes_admin_entidade_check check (
    entidade_tipo = any (array['produto', 'pedido', 'funcionario'])
  );

alter table public.notificacoes_admin_preferencias
  add column if not exists notificar_estoque boolean not null default true,
  add column if not exists notificar_pedidos boolean not null default true,
  add column if not exists notificar_pagamentos_funcionarios boolean not null default true;

create table if not exists public.funcionarios_pagamento_config (
  funcionario_id uuid primary key references public.funcionarios(id) on delete cascade,
  dia_vencimento smallint not null,
  antecedencia_dias smallint not null default 3,
  valor_previsto numeric(12,2),
  ativo boolean not null default true,
  inicia_em date not null default date_trunc('month', current_date)::date,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  constraint funcionarios_pagamento_config_dia_check check (dia_vencimento between 1 and 31),
  constraint funcionarios_pagamento_config_antecedencia_check check (antecedencia_dias between 0 and 30),
  constraint funcionarios_pagamento_config_valor_check check (valor_previsto is null or valor_previsto >= 0),
  constraint funcionarios_pagamento_config_inicio_check check (inicia_em = date_trunc('month', inicia_em)::date)
);

create table if not exists public.funcionarios_pagamentos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete restrict,
  competencia date not null,
  vencimento date not null,
  pago_em timestamptz not null,
  valor numeric(12,2) not null,
  forma_pagamento text not null,
  categoria_id uuid references public.categorias_caixa(id) on delete set null,
  movimentacao_id uuid not null unique references public.movimentacoes_caixa(id) on delete restrict,
  observacoes text,
  criado_em timestamptz not null default now(),
  constraint funcionarios_pagamentos_competencia_check check (competencia = date_trunc('month', competencia)::date),
  constraint funcionarios_pagamentos_valor_check check (valor > 0),
  constraint funcionarios_pagamentos_forma_check check (char_length(btrim(forma_pagamento)) between 1 and 40),
  constraint funcionarios_pagamentos_observacoes_check check (observacoes is null or char_length(observacoes) <= 500),
  constraint funcionarios_pagamentos_funcionario_competencia_key unique (funcionario_id, competencia)
);

create index if not exists funcionarios_pagamentos_funcionario_pago_idx
  on public.funcionarios_pagamentos (funcionario_id, pago_em desc);
create index if not exists funcionarios_pagamentos_competencia_idx
  on public.funcionarios_pagamentos (competencia desc);

alter table public.funcionarios_pagamento_config enable row level security;
alter table public.funcionarios_pagamentos enable row level security;
revoke all on table public.funcionarios_pagamento_config from public, anon, authenticated;
revoke all on table public.funcionarios_pagamentos from public, anon, authenticated;
grant select, insert, update, delete on table public.funcionarios_pagamento_config to service_role;
grant select, insert, update, delete on table public.funcionarios_pagamentos to service_role;

create or replace function public.vencimento_pagamento_funcionario_admin(
  p_competencia date,
  p_dia_vencimento integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select least(
    date_trunc('month', p_competencia)::date + greatest(1, least(p_dia_vencimento, 31)) - 1,
    (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date
  );
$$;

create or replace function public.sincronizar_notificacoes_pagamento_funcionario_admin(p_funcionario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notificacoes_admin n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.tipo = 'pagamento_funcionario'
     and n.estado = 'ativa'
     and n.entidade_id = p_funcionario_id
     and not exists (
       select 1
       from public.funcionarios_pagamento_config c
       join public.funcionarios f on f.id = c.funcionario_id and f.ativo is true
       cross join lateral (
         select (n.dados ->> 'competencia')::date as competencia
       ) nc
       where c.funcionario_id = p_funcionario_id
         and c.ativo is true
         and nc.competencia >= c.inicia_em
         and nc.competencia <= date_trunc('month', current_date)::date
         and current_date >= public.vencimento_pagamento_funcionario_admin(nc.competencia, c.dia_vencimento) - c.antecedencia_dias
         and not exists (
           select 1 from public.funcionarios_pagamentos p
           where p.funcionario_id = c.funcionario_id and p.competencia = nc.competencia
         )
     );

  insert into public.notificacoes_admin as alvo (
    tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, dados, chave_dedupe
  )
  select
    'pagamento_funcionario',
    'urgente',
    case when current_date > ciclo.vencimento then 'Pagamento atrasado' else 'Pagamento próximo' end,
    case
      when current_date > ciclo.vencimento then
        'O pagamento de ' || f.nome || ' está atrasado há ' || (current_date - ciclo.vencimento)
        || case when current_date - ciclo.vencimento = 1 then ' dia.' else ' dias.' end
      when current_date = ciclo.vencimento then 'O pagamento de ' || f.nome || ' vence hoje.'
      else 'O pagamento de ' || f.nome || ' vence em ' || (ciclo.vencimento - current_date)
        || case when ciclo.vencimento - current_date = 1 then ' dia.' else ' dias.' end
    end,
    'funcionario',
    f.id,
    jsonb_build_object(
      'competencia', to_char(ciclo.competencia, 'YYYY-MM-DD'),
      'vencimento', to_char(ciclo.vencimento, 'YYYY-MM-DD'),
      'valor_previsto', c.valor_previsto
    ),
    'pagamento_funcionario:' || f.id::text || ':' || to_char(ciclo.competencia, 'YYYY-MM')
  from public.funcionarios_pagamento_config c
  join public.funcionarios f on f.id = c.funcionario_id and f.ativo is true
  cross join lateral (
    select
      serie::date as competencia,
      public.vencimento_pagamento_funcionario_admin(serie::date, c.dia_vencimento) as vencimento
    from generate_series(c.inicia_em, date_trunc('month', current_date)::date, interval '1 month') serie
  ) ciclo
  where c.funcionario_id = p_funcionario_id
    and c.ativo is true
    and current_date >= ciclo.vencimento - c.antecedencia_dias
    and not exists (
      select 1 from public.funcionarios_pagamentos p
      where p.funcionario_id = c.funcionario_id and p.competencia = ciclo.competencia
    )
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    prioridade = excluded.prioridade,
    titulo = excluded.titulo,
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.titulo is distinct from excluded.titulo
     or alvo.mensagem is distinct from excluded.mensagem
     or alvo.dados is distinct from excluded.dados;
end;
$$;

create or replace function public.reconciliar_notificacoes_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_funcionario_id uuid;
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
  do update set mensagem = excluded.mensagem, dados = excluded.dados, atualizada_em = now()
  where alvo.mensagem is distinct from excluded.mensagem or alvo.dados is distinct from excluded.dados;

  update public.notificacoes_admin n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'pedido'
     and not exists (
       select 1 from public.pedidos p
       where p.id = n.entidade_id and lower(coalesce(p.status, '')) in ('pendente', 'confirmado')
     );

  update public.notificacoes_admin n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.tipo = 'pagamento_funcionario'
     and n.estado = 'ativa'
     and not exists (
       select 1
       from public.funcionarios_pagamento_config c
       join public.funcionarios f on f.id = c.funcionario_id and f.ativo is true
       where c.funcionario_id = n.entidade_id and c.ativo is true
     );

  for v_funcionario_id in
    select c.funcionario_id from public.funcionarios_pagamento_config c
  loop
    perform public.sincronizar_notificacoes_pagamento_funcionario_admin(v_funcionario_id);
  end loop;
end;
$$;

create or replace function public.resumo_notificacoes_admin(p_usuario_chave text)
returns table (urgentes integer, urgentes_nao_lidas integer, normais integer, nao_lidas integer, total integer)
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
  left join public.notificacoes_admin_preferencias pref on pref.usuario_chave = p_usuario_chave
  where n.estado = 'ativa'
    and l.silenciada_em is null
    and case
      when n.tipo in ('estoque_baixo', 'estoque_esgotado') then coalesce(pref.notificar_estoque, true)
      when n.tipo = 'pedido_novo' then coalesce(pref.notificar_pedidos, true)
      when n.tipo = 'pagamento_funcionario' then coalesce(pref.notificar_pagamentos_funcionarios, true)
      else true
    end;
$$;

drop function if exists public.listar_notificacoes_admin(text, integer, boolean);
create function public.listar_notificacoes_admin(
  p_usuario_chave text,
  p_limite integer default 20,
  p_incluir_historico boolean default false
)
returns table (
  id uuid, tipo text, prioridade text, titulo text, mensagem text, entidade_tipo text, entidade_id uuid,
  dados jsonb, estado text, criada_em timestamptz, resolvida_em timestamptz,
  apresentada_em timestamptz, lida_em timestamptz, silenciada_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id, n.tipo, n.prioridade, n.titulo, n.mensagem, n.entidade_tipo, n.entidade_id,
    n.dados, n.estado, n.criada_em, n.resolvida_em, l.apresentada_em, l.lida_em, l.silenciada_em
  from public.notificacoes_admin n
  left join public.notificacoes_admin_leituras l
    on l.notificacao_id = n.id and l.usuario_chave = p_usuario_chave
  left join public.notificacoes_admin_preferencias pref on pref.usuario_chave = p_usuario_chave
  where ((n.estado = 'ativa' and l.silenciada_em is null) or p_incluir_historico)
    and case
      when n.tipo in ('estoque_baixo', 'estoque_esgotado') then coalesce(pref.notificar_estoque, true)
      when n.tipo = 'pedido_novo' then coalesce(pref.notificar_pedidos, true)
      when n.tipo = 'pagamento_funcionario' then coalesce(pref.notificar_pagamentos_funcionarios, true)
      else true
    end
  order by (n.estado = 'ativa' and l.silenciada_em is null) desc,
    (n.prioridade = 'urgente') desc, n.criada_em desc
  limit greatest(1, least(coalesce(p_limite, 20), 50));
$$;

create or replace function public.marcar_todas_notificacoes_admin_lidas(p_usuario_chave text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_total integer;
begin
  insert into public.notificacoes_admin_leituras as leitura (
    notificacao_id, usuario_chave, apresentada_em, lida_em, atualizada_em
  )
  select n.id, p_usuario_chave, v_agora, v_agora, v_agora
  from public.notificacoes_admin n
  left join public.notificacoes_admin_leituras existente
    on existente.notificacao_id = n.id and existente.usuario_chave = p_usuario_chave
  left join public.notificacoes_admin_preferencias pref on pref.usuario_chave = p_usuario_chave
  where n.estado = 'ativa' and existente.silenciada_em is null and existente.lida_em is null
    and case
      when n.tipo in ('estoque_baixo', 'estoque_esgotado') then coalesce(pref.notificar_estoque, true)
      when n.tipo = 'pedido_novo' then coalesce(pref.notificar_pedidos, true)
      when n.tipo = 'pagamento_funcionario' then coalesce(pref.notificar_pagamentos_funcionarios, true)
      else true
    end
  on conflict (notificacao_id, usuario_chave)
  do update set apresentada_em = coalesce(leitura.apresentada_em, excluded.apresentada_em),
    lida_em = excluded.lida_em, atualizada_em = excluded.atualizada_em;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

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
  v_config public.funcionarios_pagamento_config%rowtype;
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

  select c into v_config
  from public.funcionarios_pagamento_config c
  join public.funcionarios f on f.id = c.funcionario_id
  where c.funcionario_id = p_funcionario_id and c.ativo is true and f.ativo is true
  for update of c;
  if not found then raise exception 'Agenda de pagamento ativa não encontrada.'; end if;
  select f.nome into v_nome from public.funcionarios f where f.id = p_funcionario_id;
  if v_competencia < v_config.inicia_em or v_competencia > date_trunc('month', current_date)::date then
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
    public.vencimento_pagamento_funcionario_admin(v_competencia, v_config.dia_vencimento),
    p_pago_em, round(p_valor, 2), btrim(p_forma_pagamento), p_categoria_id,
    v_movimentacao_id, nullif(btrim(p_observacoes), '')
  ) returning id into v_pagamento_id;

  perform public.sincronizar_notificacoes_pagamento_funcionario_admin(p_funcionario_id);
  return query select v_pagamento_id, v_movimentacao_id;
end;
$$;

create or replace function public.trigger_pagamento_funcionario_notificacoes_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sincronizar_notificacoes_pagamento_funcionario_admin(
    case when tg_op = 'DELETE' then old.funcionario_id else new.funcionario_id end
  );
  return null;
end;
$$;

drop trigger if exists trg_pagamento_config_notificacoes_admin on public.funcionarios_pagamento_config;
create trigger trg_pagamento_config_notificacoes_admin
after insert or update or delete on public.funcionarios_pagamento_config
for each row execute function public.trigger_pagamento_funcionario_notificacoes_admin();

drop trigger if exists trg_pagamento_registro_notificacoes_admin on public.funcionarios_pagamentos;
create trigger trg_pagamento_registro_notificacoes_admin
after insert or update or delete on public.funcionarios_pagamentos
for each row execute function public.trigger_pagamento_funcionario_notificacoes_admin();

create or replace function public.trigger_funcionario_notificacoes_pagamento_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sincronizar_notificacoes_pagamento_funcionario_admin(
    case when tg_op = 'DELETE' then old.id else new.id end
  );
  return null;
end;
$$;

drop trigger if exists trg_funcionario_notificacoes_pagamento_admin on public.funcionarios;
create trigger trg_funcionario_notificacoes_pagamento_admin
after delete or update of nome, ativo on public.funcionarios
for each row execute function public.trigger_funcionario_notificacoes_pagamento_admin();

revoke all on function public.vencimento_pagamento_funcionario_admin(date, integer) from public, anon, authenticated;
revoke all on function public.sincronizar_notificacoes_pagamento_funcionario_admin(uuid) from public, anon, authenticated;
revoke all on function public.reconciliar_notificacoes_admin() from public, anon, authenticated;
revoke all on function public.resumo_notificacoes_admin(text) from public, anon, authenticated;
revoke all on function public.listar_notificacoes_admin(text, integer, boolean) from public, anon, authenticated;
revoke all on function public.marcar_todas_notificacoes_admin_lidas(text) from public, anon, authenticated;
revoke all on function public.registrar_pagamento_funcionario_admin(uuid, date, timestamptz, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function public.trigger_pagamento_funcionario_notificacoes_admin() from public, anon, authenticated;
revoke all on function public.trigger_funcionario_notificacoes_pagamento_admin() from public, anon, authenticated;

grant execute on function public.vencimento_pagamento_funcionario_admin(date, integer) to service_role;
grant execute on function public.sincronizar_notificacoes_pagamento_funcionario_admin(uuid) to service_role;
grant execute on function public.reconciliar_notificacoes_admin() to service_role;
grant execute on function public.resumo_notificacoes_admin(text) to service_role;
grant execute on function public.listar_notificacoes_admin(text, integer, boolean) to service_role;
grant execute on function public.marcar_todas_notificacoes_admin_lidas(text) to service_role;
grant execute on function public.registrar_pagamento_funcionario_admin(uuid, date, timestamptz, numeric, text, uuid, text) to service_role;

select public.reconciliar_notificacoes_admin();
