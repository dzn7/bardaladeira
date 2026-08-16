


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."apagar_item_movimento_crediario"("p_movimento_id" "uuid", "p_item_indice" integer, "p_motivo" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_movimento public.crediario_movimentos%rowtype;
  v_item jsonb;
  v_item_valor numeric(12,2);
  v_itens_restantes jsonb;
  v_total_itens integer;
begin
  select *
  into v_movimento
  from public.crediario_movimentos
  where id = p_movimento_id
  for update;

  if v_movimento.id is null then
    raise exception 'Movimento do crediario nao encontrado';
  end if;

  if jsonb_typeof(coalesce(v_movimento.itens, '[]'::jsonb)) <> 'array' then
    return public.cancelar_movimento_crediario(p_movimento_id, p_motivo);
  end if;

  v_total_itens := jsonb_array_length(coalesce(v_movimento.itens, '[]'::jsonb));

  if p_item_indice is null or p_item_indice < 0 or p_item_indice >= v_total_itens then
    raise exception 'Item do crediario nao encontrado';
  end if;

  select item
  into v_item
  from jsonb_array_elements(v_movimento.itens) with ordinality as itens(item, ord)
  where ord = p_item_indice + 1;

  v_item_valor := coalesce(
    nullif(v_item->>'subtotal', '')::numeric,
    nullif(v_item->>'total_item_price', '')::numeric,
    nullif(v_item->>'totalItemPrice', '')::numeric,
    nullif(v_item->>'totalPrice', '')::numeric,
    (coalesce(nullif(v_item->>'preco', '')::numeric, nullif(v_item->>'basePrice', '')::numeric, 0)
      * greatest(coalesce(nullif(v_item->>'quantidade', '')::numeric, nullif(v_item->>'quantity', '')::numeric, 1), 1))
  );

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
  into v_itens_restantes
  from jsonb_array_elements(v_movimento.itens) with ordinality as itens(item, ord)
  where ord <> p_item_indice + 1;

  if jsonb_array_length(v_itens_restantes) = 0 then
    return public.cancelar_movimento_crediario(p_movimento_id, p_motivo);
  end if;

  update public.crediario_movimentos
  set
    itens = v_itens_restantes,
    valor = greatest(coalesce(valor, 0) - coalesce(v_item_valor, 0), 0),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'item_removido_em', timezone('utc'::text, now()),
      'item_removido', v_item,
      'motivo_remocao_item', coalesce(nullif(trim(p_motivo), ''), 'Item removido pelo painel')
    )
  where id = p_movimento_id;

  perform public.recalcular_crediario_conta(v_movimento.conta_id);
  return v_movimento.conta_id;
end;
$$;


ALTER FUNCTION "public"."apagar_item_movimento_crediario"("p_movimento_id" "uuid", "p_item_indice" integer, "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aplicar_configuracao_automatica_fila_impressao"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.origem in ('electron_manual', 'electron_reimpressao') then
    new.automatico := false;
  end if;

  if coalesce(new.automatico, true)
     and not public.fila_impressao_automatica_permitida(
       new.escopo,
       coalesce(new.criado_em, new.created_at, now())
     ) then
    return null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."aplicar_configuracao_automatica_fila_impressao"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_saldo_crediario_movimento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_crediario_conta(old.conta_id);
    return old;
  end if;

  perform public.recalcular_crediario_conta(new.conta_id);

  if tg_op = 'UPDATE' and old.conta_id is distinct from new.conta_id then
    perform public.recalcular_crediario_conta(old.conta_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_saldo_crediario_movimento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.usuarios_sistema
  SET senha_hash = encode(extensions.digest(p_nova_senha, 'sha256'), 'hex')
  WHERE id = p_usuario_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_updated_at_bairros"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."atualizar_updated_at_bairros"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_updated_at_categorias_cardapio"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    begin
      new.updated_at = timezone('utc'::text, now());
      return new;
    end;
    $$;


ALTER FUNCTION "public"."atualizar_updated_at_categorias_cardapio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_updated_at_combos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."atualizar_updated_at_combos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_clientes"("p_termo" "text", "p_limite" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "telefone" "text", "nome" "text", "endereco" "text", "bairro" "text", "total_pedidos" bigint, "ultimo_pedido_em" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    uc.id,
    uc.telefone,
    uc.nome,
    uc.endereco,
    uc.bairro,
    count(p.id) AS total_pedidos,
    uc.ultimo_pedido_em
  FROM public.usuarios_cliente uc
  LEFT JOIN public.pedidos p ON p.cliente_id = uc.id
    AND lower(coalesce(p.status, '')) <> 'cancelado'
  WHERE
    uc.nome ILIKE '%' || p_termo || '%'
    OR (
      regexp_replace(p_termo, '[^0-9]', '', 'g') <> ''
      AND uc.telefone ILIKE '%' || regexp_replace(p_termo, '[^0-9]', '', 'g') || '%'
    )
  GROUP BY uc.id, uc.telefone, uc.nome, uc.endereco, uc.bairro, uc.ultimo_pedido_em
  ORDER BY count(p.id) DESC, uc.ultimo_pedido_em DESC NULLS LAST
  LIMIT p_limite;
$$;


ALTER FUNCTION "public"."buscar_clientes"("p_termo" "text", "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancelar_movimento_crediario"("p_movimento_id" "uuid", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_conta_id uuid;
begin
  update public.crediario_movimentos
  set
    status = 'cancelado',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'cancelado_em', timezone('utc'::text, now()),
      'motivo_cancelamento', coalesce(nullif(trim(p_motivo), ''), 'Cancelado pelo painel')
    )
  where id = p_movimento_id
  returning conta_id into v_conta_id;

  if v_conta_id is null then
    raise exception 'Movimento do crediario nao encontrado';
  end if;

  perform public.recalcular_crediario_conta(v_conta_id);
  return v_conta_id;
end;
$$;


ALTER FUNCTION "public"."cancelar_movimento_crediario"("p_movimento_id" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carregar_painel_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_ator_id uuid;
begin
  select v.id
  into v_ator_id
  from public.verificar_senha_usuario(lower(trim(p_nome_usuario)), p_senha) v
  where v.papel = 'admin'
  limit 1;

  if v_ator_id is null or not exists (
    select 1 from public.usuarios_sistema
    where id = v_ator_id and ativo = true and papel = 'admin'
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'usuarios', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'nome', u.nome,
          'nome_usuario', u.nome_usuario,
          'papel', u.papel,
          'ativo', coalesce(u.ativo, true)
        )
        order by u.papel, u.nome
      )
      from public.usuarios_sistema u
      where u.papel in ('garcom', 'entregador')
    ), '[]'::jsonb),
    'papeis', jsonb_build_object(
      'garcom', coalesce((
        select permissoes from public.permissoes_papel where papel = 'garcom'
      ), '{}'::jsonb),
      'entregador', coalesce((
        select permissoes from public.permissoes_papel where papel = 'entregador'
      ), '{}'::jsonb)
    ),
    'usuariosConfig', coalesce((
      select jsonb_object_agg(pu.usuario_sistema_id::text, pu.permissoes)
      from public.permissoes_usuario pu
      join public.usuarios_sistema u on u.id = pu.usuario_sistema_id
      where u.papel in ('garcom', 'entregador')
    ), '{}'::jsonb),
    'manutencao', coalesce((
      select jsonb_object_agg(modulo_id, ativo)
      from public.manutencao_modulos
    ), '{}'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."carregar_painel_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."configurar_fila_impressao"("p_fila_ativa" boolean, "p_horario_inicio" "text", "p_horario_fim" "text", "p_imprimir_itens_editados" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_cancelados integer := 0;
begin
  if p_horario_inicio !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário inicial inválido.' using errcode = '22007';
  end if;

  if p_horario_fim !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário final inválido.' using errcode = '22007';
  end if;

  insert into public.configuracoes_loja (chave, valor, tipo, descricao, updated_at)
  values
    ('fila_impressao_automatica_ativa', p_fila_ativa::text, 'boolean', 'Permite criar eventos automáticos na fila de impressão.', now()),
    ('fila_impressao_horario_inicio', p_horario_inicio, 'time', 'Início da janela diária de impressão automática em America/Fortaleza.', now()),
    ('fila_impressao_horario_fim', p_horario_fim, 'time', 'Fim da janela diária de impressão automática; igual ao início significa 24 horas.', now()),
    ('impressao_itens_editados_ativa', p_imprimir_itens_editados::text, 'boolean', 'Imprime automaticamente itens adicionados durante a edição de um pedido.', now())
  on conflict (chave) do update
  set valor = excluded.valor,
      tipo = excluded.tipo,
      descricao = excluded.descricao,
      updated_at = excluded.updated_at;

  update public.fila_impressao
  set status = 'cancelado',
      processado_em = now(),
      erro_mensagem = 'Cancelado pela configuração da fila automática.',
      erro = null,
      updated_at = now()
  where status = 'pendente'
    and automatico = true
    and not public.fila_impressao_automatica_permitida(
      escopo,
      coalesce(criado_em, created_at, now())
    );

  get diagnostics v_cancelados = row_count;

  return jsonb_build_object('cancelados', v_cancelados);
end;
$_$;


ALTER FUNCTION "public"."configurar_fila_impressao"("p_fila_ativa" boolean, "p_horario_inicio" "text", "p_horario_fim" "text", "p_imprimir_itens_editados" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_whatsapp_order_draft"("p_draft_id" "uuid") RETURNS TABLE("id" "uuid", "numero_pedido" integer, "total" numeric, "created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_draft public.whatsapp_order_drafts%rowtype;
  v_numero integer;
  v_pedido_id uuid;
  v_total numeric;
begin
  select *
  into v_draft
  from public.whatsapp_order_drafts
  where public.whatsapp_order_drafts.id = p_draft_id
  for update;

  if not found then
    raise exception 'rascunho nao encontrado';
  end if;

  if v_draft.created_order_id is not null then
    return query
    select
      p.id,
      p.numero_pedido::integer,
      p.total::numeric,
      false
    from public.pedidos p
    where p.id = v_draft.created_order_id;
    return;
  end if;

  if jsonb_array_length(coalesce(v_draft.items, '[]'::jsonb)) = 0 then
    raise exception 'rascunho sem itens';
  end if;

  perform pg_advisory_xact_lock(hashtext('pedidos_numero_pedido'));

  select coalesce(max(p.numero_pedido), 0) + 1
  into v_numero
  from public.pedidos p;

  insert into public.pedidos (
    numero_pedido,
    nome_cliente,
    telefone,
    tipo_entrega,
    endereco_entrega,
    bairro,
    taxa_entrega,
    forma_pagamento,
    subtotal,
    total,
    subtotal_original,
    total_original,
    status,
    observacoes,
    origem,
    cliente_id
  )
  values (
    v_numero,
    coalesce(nullif(v_draft.customer_name, ''), 'Cliente WhatsApp'),
    v_draft.phone,
    coalesce(v_draft.delivery_type, 'entrega'),
    v_draft.address,
    v_draft.neighborhood,
    coalesce(v_draft.delivery_fee, 0),
    v_draft.payment_method,
    coalesce(v_draft.subtotal, 0),
    coalesce(v_draft.total, 0),
    coalesce(v_draft.subtotal, 0),
    coalesce(v_draft.total, 0),
    'pendente',
    v_draft.notes,
    'whatsapp_bot',
    v_draft.customer_id
  )
  returning public.pedidos.id, public.pedidos.total
  into v_pedido_id, v_total;

  insert into public.itens_pedido (
    pedido_id,
    produto_id,
    bebida_id,
    combo_id,
    nome_item,
    quantidade,
    preco_unitario,
    subtotal,
    observacoes,
    nome_produto,
    preco_total,
    subtotal_original,
    created_at
  )
  select
    v_pedido_id,
    case when item.origem = 'produto' then item.id else null end,
    case when item.origem = 'bebida' then item.id else null end,
    case when item.origem = 'combo' then item.id else null end,
    item.nome,
    greatest(coalesce(item.quantidade, 1), 1),
    coalesce(item.preco, 0),
    greatest(coalesce(item.quantidade, 1), 1) * coalesce(item.preco, 0),
    item.observacoes,
    item.nome,
    greatest(coalesce(item.quantidade, 1), 1) * coalesce(item.preco, 0),
    greatest(coalesce(item.quantidade, 1), 1) * coalesce(item.preco, 0),
    coalesce(item.added_at, now())
  from jsonb_to_recordset(v_draft.items) as item(
    id uuid,
    origem text,
    nome text,
    preco numeric,
    quantidade integer,
    observacoes text,
    added_at timestamptz
  );

  update public.whatsapp_order_drafts
  set status = 'confirmed',
      created_order_id = v_pedido_id,
      created_order_number = v_numero,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('confirmed_at', now())
  where public.whatsapp_order_drafts.id = p_draft_id;

  return query
  select v_pedido_id, v_numero, v_total, true;
end;
$$;


ALTER FUNCTION "public"."confirm_whatsapp_order_draft"("p_draft_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text" DEFAULT NULL::"text", "p_cor_avatar" character varying DEFAULT '#f97316'::character varying, "p_funcionario_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  novo_id UUID;
BEGIN
  INSERT INTO public.usuarios_sistema (nome, nome_usuario, senha_hash, papel, avatar_url, cor_avatar, funcionario_id)
  VALUES (
    TRIM(p_nome),
    LOWER(TRIM(p_nome_usuario)),
    encode(extensions.digest(p_senha, 'sha256'), 'hex'),
    p_papel,
    p_avatar_url,
    p_cor_avatar,
    p_funcionario_id
  )
  RETURNING usuarios_sistema.id INTO novo_id;
  
  RETURN novo_id;
END;
$$;


ALTER FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enviar_pedido_crediario"("p_pedido_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_conta_id uuid;
begin
  update public.pedidos
  set forma_pagamento = 'Crediário',
      updated_at = timezone('utc'::text, now())
  where id = p_pedido_id
  returning id into p_pedido_id;

  if p_pedido_id is null then
    raise exception 'Pedido nao encontrado';
  end if;

  select conta_id
  into v_conta_id
  from public.crediario_movimentos
  where pedido_id = p_pedido_id
    and origem = 'pedido'
    and tipo = 'consumo'
    and status = 'ativo'
  limit 1;

  return v_conta_id;
end;
$$;


ALTER FUNCTION "public"."enviar_pedido_crediario"("p_pedido_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) RETURNS TABLE("total_pedidos" bigint, "receita" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    count(*)::bigint AS total_pedidos,
    coalesce(sum(total), 0)::numeric AS receita
  FROM pedidos
  WHERE created_at >= p_inicio
    AND created_at <= p_fim
    AND status NOT IN ('cancelado', 'aguardando_pagamento');
$$;


ALTER FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) IS 'Agrega count e sum(total) de pedidos no periodo, excluindo cancelado e aguardando_pagamento. Usado pelo dashboard admin para evitar paginar todas as linhas.';



CREATE OR REPLACE FUNCTION "public"."exec_bot_sql"("p_sql" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  result jsonb;
begin
  execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (' || p_sql || ') t' into result;
  return result;
end;
$$;


ALTER FUNCTION "public"."exec_bot_sql"("p_sql" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fila_impressao_automatica_permitida"("p_escopo" "text", "p_instante" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_fila_ativa boolean := true;
  v_itens_editados_ativos boolean := true;
  v_inicio_texto text := '00:00';
  v_fim_texto text := '00:00';
  v_inicio time := time '00:00';
  v_fim time := time '00:00';
  v_hora_local time;
begin
  select
    coalesce(
      bool_or(lower(trim(valor)) in ('true', '1', 'sim', 'on'))
        filter (where chave = 'fila_impressao_automatica_ativa'),
      true
    ),
    coalesce(
      bool_or(lower(trim(valor)) in ('true', '1', 'sim', 'on'))
        filter (where chave = 'impressao_itens_editados_ativa'),
      true
    ),
    coalesce(max(valor) filter (where chave = 'fila_impressao_horario_inicio'), '00:00'),
    coalesce(max(valor) filter (where chave = 'fila_impressao_horario_fim'), '00:00')
  into v_fila_ativa, v_itens_editados_ativos, v_inicio_texto, v_fim_texto
  from public.configuracoes_loja
  where chave in (
    'fila_impressao_automatica_ativa',
    'impressao_itens_editados_ativa',
    'fila_impressao_horario_inicio',
    'fila_impressao_horario_fim'
  );

  if not v_fila_ativa then
    return false;
  end if;

  if coalesce(p_escopo, 'pedido_completo') = 'itens_novos'
     and not v_itens_editados_ativos then
    return false;
  end if;

  if v_inicio_texto ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_inicio := v_inicio_texto::time;
  end if;

  if v_fim_texto ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_fim := v_fim_texto::time;
  end if;

  if v_inicio = v_fim then
    return true;
  end if;

  v_hora_local := (coalesce(p_instante, now()) at time zone 'America/Fortaleza')::time;

  if v_inicio < v_fim then
    return v_hora_local >= v_inicio and v_hora_local < v_fim;
  end if;

  return v_hora_local >= v_inicio or v_hora_local < v_fim;
end;
$_$;


ALTER FUNCTION "public"."fila_impressao_automatica_permitida"("p_escopo" "text", "p_instante" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_atualizar_snapshot_itens_fila"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN UPDATE fila_impressao SET itens_snapshot = ( SELECT COALESCE(jsonb_agg( jsonb_build_object( 'nome_item', ip.nome_item, 'quantidade', ip.quantidade, 'preco_unitario', ip.preco_unitario, 'subtotal', ip.subtotal, 'observacoes', ip.observacoes, 'item_adicionais', COALESCE( ( SELECT jsonb_agg( jsonb_build_object( 'nome', ia.nome, 'preco', ia.preco, 'quantidade', COALESCE(ia.quantidade, 1) ) ) FROM item_adicionais ia WHERE ia.item_pedido_id = ip.id ), '[]'::jsonb ) ) ORDER BY ip.created_at ), '[]'::jsonb) FROM itens_pedido ip WHERE ip.pedido_id = NEW.pedido_id ) WHERE pedido_id = NEW.pedido_id AND status IN ('pendente', 'processando'); RETURN NEW; END; $$;


ALTER FUNCTION "public"."fn_atualizar_snapshot_itens_fila"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_electron_manter_preparando"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN IF NEW.origem = 'electron' AND OLD.status = 'preparando' AND NEW.status = 'confirmado' THEN NEW.status := 'preparando'; END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."fn_electron_manter_preparando"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_electron_status_preparando"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN IF NEW.status IS NULL OR NEW.status = 'pendente' THEN NEW.status := 'confirmado'; END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."fn_electron_status_preparando"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_fila_impressao_auto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN RETURN NEW; END; $$;


ALTER FUNCTION "public"."fn_fila_impressao_auto"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_fila_impressao_electron_confirmado"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN IF NEW.origem = 'electron' THEN IF NOT EXISTS (SELECT 1 FROM fila_impressao WHERE pedido_id = NEW.id AND tipo = 'cozinha' AND escopo = 'pedido_completo' AND origem = 'electron') THEN INSERT INTO fila_impressao (pedido_id, tipo, status, escopo, origem, hash_evento) VALUES (NEW.id, 'cozinha', 'pendente', 'pedido_completo', 'electron', NEW.id || ':cozinha:pedido_completo:electron'); END IF; END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."fn_fila_impressao_electron_confirmado"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_popular_snapshot_fila_impressao"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_pedido RECORD;
  v_itens JSONB;
BEGIN
  -- Só popula se os snapshots não foram fornecidos
  IF NEW.pedido_snapshot IS NOT NULL AND NEW.itens_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar dados do pedido
  SELECT
    p.id,
    p.numero_pedido,
    p.nome_cliente,
    p.tipo_entrega,
    p.telefone,
    p.mesa,
    p.comanda,
    p.endereco,
    p.bairro,
    p.referencia,
    p.observacoes,
    p.subtotal,
    p.taxa_entrega,
    p.taxa_servico,
    p.total,
    p.forma_pagamento,
    p.troco_para,
    p.pagamento_online,
    p.pagamento_online_status,
    p.created_at
  INTO v_pedido
  FROM pedidos p
  WHERE p.id = NEW.pedido_id;

  -- Se não encontrou o pedido, retorna sem popular
  IF v_pedido.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Popular pedido_snapshot se não foi fornecido
  IF NEW.pedido_snapshot IS NULL THEN
    NEW.pedido_snapshot := jsonb_build_object(
      'id', v_pedido.id,
      'numero_pedido', v_pedido.numero_pedido,
      'nome_cliente', v_pedido.nome_cliente,
      'tipo_entrega', v_pedido.tipo_entrega,
      'telefone', v_pedido.telefone,
      'mesa', v_pedido.mesa,
      'comanda', v_pedido.comanda,
      'endereco', COALESCE(v_pedido.endereco, v_pedido.referencia),
      'bairro', v_pedido.bairro,
      'observacoes', v_pedido.observacoes,
      'subtotal', v_pedido.subtotal,
      'taxa_entrega', v_pedido.taxa_entrega,
      'taxa_servico', v_pedido.taxa_servico,
      'total', v_pedido.total,
      'forma_pagamento', v_pedido.forma_pagamento,
      'troco_para', v_pedido.troco_para,
      'pagamento_online', v_pedido.pagamento_online,
      'pagamento_online_status', v_pedido.pagamento_online_status,
      'created_at', v_pedido.created_at
    );
  END IF;

  -- Popular itens_snapshot se não foi fornecido
  IF NEW.itens_snapshot IS NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'nome_item', ip.nome_item,
        'quantidade', ip.quantidade,
        'preco_unitario', ip.preco_unitario,
        'subtotal', ip.subtotal,
        'observacoes', ip.observacoes,
        'item_adicionais', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'nome', ia.nome,
                'preco', ia.preco,
                'quantidade', COALESCE(ia.quantidade, 1)
              )
            )
            FROM item_adicionais ia
            WHERE ia.item_pedido_id = ip.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY ip.created_at
    ), '[]'::jsonb)
    INTO v_itens
    FROM itens_pedido ip
    WHERE ip.pedido_id = NEW.pedido_id;

    NEW.itens_snapshot := v_itens;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_popular_snapshot_fila_impressao"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_produtividade_nome_generico"("p_nome" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $_$
  -- Expressão ÚNICA, sem CTE e sem `SET search_path` — as duas coisas impedem o
  -- planner de fazer inline da função. Medido em 3.000 pedidos: 88 ms com a
  -- cláusula SET contra 10 ms inline. A proteção contra search_path hijack é
  -- mantida qualificando cada função e o operador em pg_catalog.
  -- O `.{0,2}` cobre nome vazio ou de até duas letras; o resto do alternador
  -- cobre "só dígitos", "mesa 7", "casal da esquina…" e os rótulos soltos.
  select pg_catalog.lower(
    pg_catalog.translate(
      coalesce(pg_catalog.btrim(p_nome), ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )
  ) OPERATOR(pg_catalog.~) ('^([[:space:]]*.{0,2}'
    || '|[0-9]+'
    || '|(mesa|comanda|balcao|local|pdv|caixa|cliente|consumidor)[[:space:]]*[0-9]*'
    || '|(casal|mesa|comanda|balcao|cliente|consumidor|turista|visitante|pessoa)[[:space:]].*'
    || '|clientes|consumidor pdv|consumidor final|turistas?|visitantes?|sem nome'
    || '|nao inform(ado|ou)|teste|avulso|fregues|moc[ao]|rapaz|senhor(a)?|menin[ao]|nome|x+'
    || ')$')
$_$;


ALTER FUNCTION "public"."fn_produtividade_nome_generico"("p_nome" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_produtividade_nome_generico"("p_nome" "text") IS 'true quando o nome do cliente não identifica ninguém (vazio, "cliente", "mesa 7", só dígitos, 2 letras…).';



CREATE OR REPLACE FUNCTION "public"."fn_produtividade_pedidos_classificados"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("pedido_id" "uuid", "numero_pedido" integer, "garcom_id" "uuid", "nome_cliente" "text", "tipo_entrega" "text", "status" "text", "total" numeric, "criado_em" timestamp with time zone, "cancelado" boolean, "fechado" boolean, "nome_generico" boolean, "contato_ausente" boolean, "cadastro_completo" boolean)
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  select
    ped.id,
    ped.numero_pedido,
    ped.garcom_id,
    ped.nome_cliente::text,
    lower(coalesce(ped.tipo_entrega, ''))::text as tipo_entrega,
    lower(coalesce(ped.status, ''))::text as status,
    coalesce(ped.total, 0) as total,
    ped.created_at,
    lower(coalesce(ped.status, '')) = 'cancelado' as cancelado,
    lower(coalesce(ped.status, '')) = 'entregue' as fechado,
    aval.nome_generico,
    (
      aval.entrega_ou_retirada
      and (
        aval.digitos_telefone < 8
        or (
          lower(coalesce(ped.tipo_entrega, '')) = 'entrega'
          and nullif(trim(coalesce(ped.endereco, ped.endereco_entrega, '')), '') is null
        )
      )
    ) as contato_ausente,
    (not aval.nome_generico and aval.digitos_telefone >= 8) as cadastro_completo
  from pedidos ped
  -- LATERAL para avaliar nome e telefone uma única vez por linha (custam regex).
  cross join lateral (
    select
      fn_produtividade_nome_generico(ped.nome_cliente) as nome_generico,
      length(regexp_replace(coalesce(ped.telefone, '')::text, '\D', '', 'g')) as digitos_telefone,
      lower(coalesce(ped.tipo_entrega, '')) in ('retirada', 'entrega') as entrega_ou_retirada
  ) as aval
  where ped.garcom_id is not null
    and ped.created_at >= p_inicio
    and ped.created_at < p_fim
    and (p_garcom_id is null or ped.garcom_id = p_garcom_id)
$$;


ALTER FUNCTION "public"."fn_produtividade_pedidos_classificados"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_produtividade_pedidos_classificados"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid") IS 'Pedidos de garçom no período com as regras de boa prática já avaliadas. Fonte única usada pelas demais funções.';



CREATE OR REPLACE FUNCTION "public"."fn_produtividade_pesos"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'pontos_pedido_criado', 10,
    'pontos_pedido_fechado', 15,
    'pontos_item_adicionado', 2,
    'pontos_pedido_editado', 3,
    'bonus_cadastro_completo', 5,
    'penalidade_nome_generico', 8,
    'penalidade_contato_ausente', 5,
    'penalidade_pedido_cancelado', 0,
    'meta_pontos_dia', 150,
    'meta_pontos_semana', 900,
    'meta_pontos_mes', 3600
  ) || coalesce((select jsonb_object_agg(chave, valor) from produtividade_config), '{}'::jsonb)
$$;


ALTER FUNCTION "public"."fn_produtividade_pesos"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_produtividade_pesos"() IS 'Pesos e metas do módulo de produtividade, com os defaults do código aplicados sobre a tabela de config.';



CREATE OR REPLACE FUNCTION "public"."gerar_numero_pedido"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE proximo_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero_pedido), 0) + 1 INTO proximo_numero FROM pedidos;
  NEW.numero_pedido := proximo_numero;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."gerar_numero_pedido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_pedidos"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT count(*)::integer FROM pedidos;
$$;


ALTER FUNCTION "public"."get_total_pedidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."liberar_mesas_expiradas"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.mesas SET status = 'livre', nome_cliente = NULL, ocupada_em = NULL, liberar_em = NULL, pedido_id = NULL, observacoes = NULL, updated_at = now()
  WHERE status = 'ocupada' AND liberar_em IS NOT NULL AND liberar_em <= now();
END;
$$;


ALTER FUNCTION "public"."liberar_mesas_expiradas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limpar_dados_pedido_excluido"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.crediario_movimentos
  set status = 'cancelado',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelado_em', timezone('utc'::text, now()),
        'motivo_cancelamento', 'Pedido excluido',
        'pedido_excluido_id', old.id
      )
  where pedido_id = old.id
    and origem = 'pedido'
    and tipo = 'consumo'
    and status = 'ativo';

  delete from public.item_adicionais where item_pedido_id in (select id from public.itens_pedido where pedido_id = old.id);
  delete from public.itens_pedido where pedido_id = old.id;
  delete from public.movimentacoes_caixa where pedido_id = old.id;
  delete from public.entregas where pedido_id = old.id;
  delete from public.pagamentos_pedido where pedido_id = old.id;
  delete from public.fila_impressao where pedido_id = old.id;
  return old;
end;
$$;


ALTER FUNCTION "public"."limpar_dados_pedido_excluido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limpar_mesas_expiradas"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.mesas
  set status = 'livre',
      nome_cliente = null,
      ocupada_em = null,
      liberar_em = null,
      pedido_id = null,
      observacoes = null,
      updated_at = now()
  where status = 'ocupada'
    and (
      (liberar_em is not null and liberar_em <= now())
      or (liberar_em is null and ocupada_em is not null and ocupada_em < now() - interval '180 minutes')
    );
end;
$$;


ALTER FUNCTION "public"."limpar_mesas_expiradas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nome_cliente_cadastro_valido"("p_nome" "text", "p_tipo_entrega" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
  nome text;
  tipo text;
begin
  nome := public.normalizar_nome_cliente_cadastro(p_nome);
  tipo := lower(trim(coalesce(p_tipo_entrega, '')));

  if nome = '' then
    return false;
  end if;

  if nome !~ '[a-z]' then
    return false;
  end if;

  if nome ~ '^(mesa|comanda|local|parceiro|cliente|consumidor pdv)([[:space:]]+[0-9]+)?$' then
    return false;
  end if;

  if nome ~ '(^|[[:space:]])(no|na)[[:space:]]+marcelo($|[[:space:]])' then
    return false;
  end if;

  if tipo = 'local' and nome = 'marcelo' then
    return false;
  end if;

  return true;
end;
$_$;


ALTER FUNCTION "public"."nome_cliente_cadastro_valido"("p_nome" "text", "p_tipo_entrega" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_chave_crediario"("p_nome" "text", "p_telefone" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  nome_normalizado text;
  telefone_normalizado text;
begin
  nome_normalizado := lower(
    regexp_replace(
      translate(
        coalesce(nullif(trim(p_nome), ''), 'cliente'),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
      ),
      '[^a-z0-9]+',
      '_',
      'g'
    )
  );

  nome_normalizado := trim(both '_' from nome_normalizado);
  telefone_normalizado := public.normalizar_telefone_cliente(p_telefone);

  if telefone_normalizado is not null then
    return nome_normalizado || ':' || telefone_normalizado;
  end if;

  return nome_normalizado;
end;
$$;


ALTER FUNCTION "public"."normalizar_chave_crediario"("p_nome" "text", "p_telefone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_nome_cliente_cadastro"("p_nome" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  nome text;
begin
  nome := lower(trim(coalesce(p_nome, '')));
  nome := translate(nome, 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  nome := regexp_replace(nome, '[[:space:]]+', ' ', 'g');
  return nome;
end;
$$;


ALTER FUNCTION "public"."normalizar_nome_cliente_cadastro"("p_nome" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_telefone_cliente"("p_telefone" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  digitos text;
begin
  digitos := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');

  if digitos = '' then
    return null;
  end if;

  if digitos like '55%' and length(digitos) in (12, 13) then
    digitos := substr(digitos, 3);
  end if;

  if length(digitos) < 10 then
    return null;
  end if;

  if length(digitos) > 11 then
    digitos := right(digitos, 11);
  end if;

  return digitos;
end;
$$;


ALTER FUNCTION "public"."normalizar_telefone_cliente"("p_telefone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_controle_acesso"("p_usuario_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_papel varchar;
  v_permissoes_papel jsonb := '{}'::jsonb;
  v_permissoes_usuario jsonb := '{}'::jsonb;
  v_manutencao jsonb := '{}'::jsonb;
begin
  select papel
  into v_papel
  from public.usuarios_sistema
  where id = p_usuario_id
    and ativo = true
    and papel in ('garcom', 'entregador');

  if v_papel is null then
    return null;
  end if;

  select coalesce(permissoes, '{}'::jsonb)
  into v_permissoes_papel
  from public.permissoes_papel
  where papel = v_papel;

  select coalesce(permissoes, '{}'::jsonb)
  into v_permissoes_usuario
  from public.permissoes_usuario
  where usuario_sistema_id = p_usuario_id;

  select coalesce(jsonb_object_agg(modulo_id, ativo), '{}'::jsonb)
  into v_manutencao
  from public.manutencao_modulos;

  return jsonb_build_object(
    'papel', v_papel,
    'permissoesPapel', coalesce(v_permissoes_papel, '{}'::jsonb),
    'permissoesUsuario', coalesce(v_permissoes_usuario, '{}'::jsonb),
    'manutencao', coalesce(v_manutencao, '{}'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."obter_controle_acesso"("p_usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "numero_pedido" integer, "nome_cliente" "text", "telefone" "text", "status" "text", "tipo_entrega" "text", "forma_pagamento" "text", "total" numeric, "created_at" timestamp with time zone, "observacoes" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  telefone_normalizado text;
  limite_final integer;
begin
  telefone_normalizado := public.normalizar_telefone_cliente(p_telefone);

  if telefone_normalizado is null then
    return;
  end if;

  limite_final := greatest(1, least(coalesce(p_limite, 20), 100));

  return query
  select
    p.id,
    p.numero_pedido,
    p.nome_cliente::text,
    p.telefone::text,
    p.status::text,
    p.tipo_entrega::text,
    p.forma_pagamento::text,
    p.total,
    p.created_at,
    p.observacoes::text
  from public.pedidos p
  inner join public.usuarios_cliente uc on uc.id = p.cliente_id
  where uc.telefone = telefone_normalizado
  order by p.created_at desc
  limit limite_final;
end;
$$;


ALTER FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pedido_usa_crediario"("p_forma_pagamento" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select lower(coalesce(p_forma_pagamento, '')) like any(array['%credi%', '%fiado%', '%conta%']);
$$;


ALTER FUNCTION "public"."pedido_usa_crediario"("p_forma_pagamento" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preparar_cupom_para_persistencia"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.codigo IS NOT NULL THEN NEW.codigo := UPPER(TRIM(NEW.codigo)); END IF;
  NEW.updated_at := timezone('utc'::text, now());
  IF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN NEW.created_at := timezone('utc'::text, now()); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."preparar_cupom_para_persistencia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_automacao_caixa"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  cfg public.caixa_automacao_config%rowtype;
  caixa_aberto public.caixas%rowtype;
  timezone_name text;
  responsavel text;
  agora_local timestamp without time zone;
  dia_chave text;
  minuto_atual int;
  minuto_abertura int;
  minuto_fechamento int;
  dentro_janela boolean;
  janela_fechamento boolean;
  deve_abrir boolean;
  deve_fechar boolean;
  total_entradas numeric := 0;
  total_saidas numeric := 0;
  saldo_atual numeric := 0;
  valor_abertura numeric := 0;
  data_local_referencia_abertura timestamp without time zone;
  dia_referencia_abertura text;
  dia_ativo_abertura boolean;
  data_abertura_automatica timestamptz;
begin
  select *
  into cfg
  from public.caixa_automacao_config
  where singleton = true
  limit 1;

  if not found or not coalesce(cfg.ativo, false) then
    return;
  end if;

  timezone_name := coalesce(cfg.timezone, 'America/Sao_Paulo');
  responsavel := coalesce(nullif(trim(cfg.responsavel_padrao), ''), 'Sistema Automatico');
  valor_abertura := greatest(coalesce(cfg.valor_abertura_padrao, 0), 0);

  agora_local := timezone(timezone_name, now());
  dia_chave := to_char(agora_local, 'YYYY-MM-DD');

  minuto_atual := extract(hour from agora_local)::int * 60 + extract(minute from agora_local)::int;
  minuto_abertura := extract(hour from cfg.horario_abertura)::int * 60 + extract(minute from cfg.horario_abertura)::int;
  minuto_fechamento := extract(hour from cfg.horario_fechamento)::int * 60 + extract(minute from cfg.horario_fechamento)::int;

  if minuto_abertura = minuto_fechamento then
    dentro_janela := true;
  elsif minuto_abertura < minuto_fechamento then
    dentro_janela := minuto_atual >= minuto_abertura and minuto_atual < minuto_fechamento;
  else
    dentro_janela := minuto_atual >= minuto_abertura or minuto_atual < minuto_fechamento;
  end if;

  if minuto_abertura < minuto_fechamento then
    janela_fechamento := minuto_atual >= minuto_fechamento;
  else
    janela_fechamento := minuto_atual >= minuto_fechamento and minuto_atual < minuto_abertura;
  end if;

  data_local_referencia_abertura := date_trunc('day', agora_local);
  if minuto_abertura > minuto_fechamento and minuto_atual < minuto_fechamento then
    data_local_referencia_abertura := data_local_referencia_abertura - interval '1 day';
  end if;

  dia_referencia_abertura := to_char(data_local_referencia_abertura, 'YYYY-MM-DD');
  dia_ativo_abertura := extract(dow from data_local_referencia_abertura)::int = any(cfg.dias_ativos);

  select *
  into caixa_aberto
  from public.caixas
  where status = 'aberto'
  order by data_abertura desc, created_at desc, id desc
  limit 1;

  deve_abrir :=
    caixa_aberto.id is null
    and dia_ativo_abertura
    and dentro_janela
    and coalesce(cfg.ultimo_dia_abertura, '') <> dia_referencia_abertura;

  deve_fechar :=
    caixa_aberto.id is not null
    and janela_fechamento
    and coalesce(cfg.ultimo_dia_fechamento, '') <> dia_chave;

  if deve_abrir then
    data_abertura_automatica := (data_local_referencia_abertura + cfg.horario_abertura) at time zone timezone_name;

    insert into public.caixas (
      data_abertura,
      valor_abertura,
      responsavel_abertura,
      status,
      total_entradas,
      total_saidas,
      saldo_esperado
    )
    values (
      data_abertura_automatica,
      valor_abertura,
      responsavel,
      'aberto',
      0,
      0,
      valor_abertura
    )
    on conflict (status) where (status = 'aberto') do nothing;

    update public.caixa_automacao_config
    set
      ultimo_dia_abertura = dia_referencia_abertura,
      updated_at = timezone('utc'::text, now())
    where id = cfg.id;

    return;
  end if;

  if deve_fechar and caixa_aberto.id is not null then
    select
      coalesce(sum(case when tipo = 'entrada' then valor else 0 end), 0),
      coalesce(sum(case when tipo = 'saida' then valor else 0 end), 0)
    into total_entradas, total_saidas
    from public.movimentacoes_caixa
    where caixa_id = caixa_aberto.id;

    saldo_atual := coalesce(caixa_aberto.valor_abertura, 0) + total_entradas - total_saidas;

    update public.caixas
    set
      data_fechamento = now(),
      valor_fechamento = saldo_atual,
      total_entradas = total_entradas,
      total_saidas = total_saidas,
      saldo_esperado = saldo_atual,
      diferenca = 0,
      responsavel_fechamento = responsavel,
      observacoes = concat('Fechamento automatico (', timezone_name, ')'),
      status = 'fechado'
    where id = caixa_aberto.id
      and status = 'aberto';

    update public.caixa_automacao_config
    set
      ultimo_dia_fechamento = dia_chave,
      updated_at = timezone('utc'::text, now())
    where id = cfg.id;
  end if;
end;
$$;


ALTER FUNCTION "public"."processar_automacao_caixa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."produtividade_garcons"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) RETURNS TABLE("garcom_id" "uuid", "nome" "text", "nome_usuario" "text", "avatar_url" "text", "cor_avatar" "text", "ativo" boolean, "ultimo_acesso" timestamp with time zone, "pedidos_criados" integer, "pedidos_fechados" integer, "pedidos_cancelados" integer, "pedidos_abertos" integer, "itens_adicionados" integer, "edicoes" integer, "vendas" numeric, "ticket_medio" numeric, "ocorrencias_nome" integer, "ocorrencias_contato" integer, "cadastros_completos" integer, "pontos_positivos" numeric, "pontos_negativos" numeric, "pontos" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  classificados as (
    select * from fn_produtividade_pedidos_classificados(p_inicio, p_fim, null)
  ),
  por_pedido as (
    select
      c.garcom_id,
      count(*)::integer as pedidos_criados,
      count(*) filter (where c.fechado)::integer as pedidos_fechados,
      count(*) filter (where c.cancelado)::integer as pedidos_cancelados,
      count(*) filter (where not c.fechado and not c.cancelado)::integer as pedidos_abertos,
      coalesce(sum(c.total) filter (where not c.cancelado), 0) as vendas,
      count(*) filter (where c.nome_generico and not c.cancelado)::integer as ocorrencias_nome,
      count(*) filter (where c.contato_ausente and not c.cancelado)::integer as ocorrencias_contato,
      count(*) filter (where c.cadastro_completo and not c.cancelado)::integer as cadastros_completos
    from classificados c
    group by c.garcom_id
  ),
  por_atividade as (
    select
      a.garcom_id,
      count(*) filter (where a.tipo_acao = 'item_adicionado')::integer as itens_adicionados,
      -- Distinto por (dia operacional, pedido) — a mesma regra da série diária.
      -- Contar distinct só por pedido faria o total divergir da soma da série
      -- quando um pedido é editado em dois dias (mesa que atravessa as 03h).
      -- `pedido_id is not null` é obrigatório: em `count(distinct (dia, pedido_id))`
      -- o par não é nulo quando só o pedido é, e o evento órfão entraria na conta.
      count(distinct (
        ((a.created_at at time zone 'America/Sao_Paulo') - interval '3 hours')::date,
        a.pedido_id
      )) filter (
        where a.tipo_acao = 'pedido_modificado' and a.pedido_id is not null
      )::integer as edicoes
    from atividade_garcom a
    where a.created_at >= p_inicio
      and a.created_at < p_fim
    group by a.garcom_id
  ),
  consolidado as (
    select
      u.id as garcom_id,
      u.nome::text,
      u.nome_usuario::text,
      u.avatar_url,
      coalesce(u.cor_avatar, '#0296F9')::text as cor_avatar,
      coalesce(u.ativo, true) as ativo,
      u.ultimo_acesso,
      coalesce(pp.pedidos_criados, 0) as pedidos_criados,
      coalesce(pp.pedidos_fechados, 0) as pedidos_fechados,
      coalesce(pp.pedidos_cancelados, 0) as pedidos_cancelados,
      coalesce(pp.pedidos_abertos, 0) as pedidos_abertos,
      coalesce(pa.itens_adicionados, 0) as itens_adicionados,
      coalesce(pa.edicoes, 0) as edicoes,
      coalesce(pp.vendas, 0) as vendas,
      coalesce(pp.ocorrencias_nome, 0) as ocorrencias_nome,
      coalesce(pp.ocorrencias_contato, 0) as ocorrencias_contato,
      coalesce(pp.cadastros_completos, 0) as cadastros_completos
    from usuarios_sistema u
    left join por_pedido pp on pp.garcom_id = u.id
    left join por_atividade pa on pa.garcom_id = u.id
    where u.papel = 'garcom'
  )
  select
    c.garcom_id,
    c.nome,
    c.nome_usuario,
    c.avatar_url,
    c.cor_avatar,
    c.ativo,
    c.ultimo_acesso,
    c.pedidos_criados,
    c.pedidos_fechados,
    c.pedidos_cancelados,
    c.pedidos_abertos,
    c.itens_adicionados,
    c.edicoes,
    c.vendas,
    case
      when c.pedidos_criados - c.pedidos_cancelados > 0
        then round(c.vendas / (c.pedidos_criados - c.pedidos_cancelados), 2)
      else 0
    end as ticket_medio,
    c.ocorrencias_nome,
    c.ocorrencias_contato,
    c.cadastros_completos,
    positivos.valor as pontos_positivos,
    negativos.valor as pontos_negativos,
    positivos.valor - negativos.valor as pontos
  from consolidado c
  cross join pesos
  cross join lateral (
    select round(
      (c.pedidos_criados - c.pedidos_cancelados) * (pesos.p ->> 'pontos_pedido_criado')::numeric
      + c.pedidos_fechados * (pesos.p ->> 'pontos_pedido_fechado')::numeric
      + c.itens_adicionados * (pesos.p ->> 'pontos_item_adicionado')::numeric
      + c.edicoes * (pesos.p ->> 'pontos_pedido_editado')::numeric
      + c.cadastros_completos * (pesos.p ->> 'bonus_cadastro_completo')::numeric
    , 2) as valor
  ) as positivos
  cross join lateral (
    select round(
      c.ocorrencias_nome * (pesos.p ->> 'penalidade_nome_generico')::numeric
      + c.ocorrencias_contato * (pesos.p ->> 'penalidade_contato_ausente')::numeric
      + c.pedidos_cancelados * (pesos.p ->> 'penalidade_pedido_cancelado')::numeric
    , 2) as valor
  ) as negativos
$$;


ALTER FUNCTION "public"."produtividade_garcons"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."produtividade_garcons"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) IS 'Métricas e pontuação de cada garçom no período. Pedidos de qualquer status entram; cancelado não pontua criação.';



CREATE OR REPLACE FUNCTION "public"."produtividade_ler_config"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select fn_produtividade_pesos()
$$;


ALTER FUNCTION "public"."produtividade_ler_config"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."produtividade_ler_config"() IS 'Pesos e metas vigentes. A tabela produtividade_config não é acessível diretamente pelo anon.';



CREATE OR REPLACE FUNCTION "public"."produtividade_ocorrencias"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid" DEFAULT NULL::"uuid", "p_limite" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("pedido_id" "uuid", "numero_pedido" integer, "garcom_id" "uuid", "garcom_nome" "text", "nome_cliente" "text", "tipo_entrega" "text", "status" "text", "total" numeric, "criado_em" timestamp with time zone, "motivos" "text"[], "pontos_perdidos" numeric, "total_registros" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  problemas as (
    select
      c.*,
      array_remove(array[
        case when c.nome_generico then 'nome_generico' end,
        case when c.contato_ausente then 'contato_ausente' end
      ], null) as motivos
    from fn_produtividade_pedidos_classificados(p_inicio, p_fim, p_garcom_id) c
    where not c.cancelado
      and (c.nome_generico or c.contato_ausente)
      -- Mesmo recorte do ranking e da série: filtrar aqui (e não no join final)
      -- para o count(*) over () não contar quem está fora da lista.
      and exists (
        select 1 from usuarios_sistema u
        where u.id = c.garcom_id and u.papel = 'garcom'
      )
  ),
  contado as (
    select pr.*, count(*) over () as total_registros
    from problemas pr
  )
  select
    ct.pedido_id,
    ct.numero_pedido,
    ct.garcom_id,
    u.nome::text as garcom_nome,
    ct.nome_cliente,
    ct.tipo_entrega,
    ct.status,
    ct.total,
    ct.criado_em,
    ct.motivos,
    round(
      case when ct.nome_generico then (pesos.p ->> 'penalidade_nome_generico')::numeric else 0 end
      + case when ct.contato_ausente then (pesos.p ->> 'penalidade_contato_ausente')::numeric else 0 end
    , 2) as pontos_perdidos,
    ct.total_registros
  from contado ct
  cross join pesos
  left join usuarios_sistema u on u.id = ct.garcom_id
  order by ct.criado_em desc
  limit greatest(coalesce(p_limite, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;


ALTER FUNCTION "public"."produtividade_ocorrencias"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."produtividade_ocorrencias"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid", "p_limite" integer, "p_offset" integer) IS 'Pedidos que perderam pontos no período, com os motivos e o total descontado. Paginada; total_registros repete a contagem completa.';



CREATE OR REPLACE FUNCTION "public"."produtividade_salvar_config"("p_config" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_chave text;
  v_valor numeric;
  v_chaves_validas text[] := array[
    'pontos_pedido_criado', 'pontos_pedido_fechado', 'pontos_item_adicionado',
    'pontos_pedido_editado', 'bonus_cadastro_completo', 'penalidade_nome_generico',
    'penalidade_contato_ausente', 'penalidade_pedido_cancelado',
    'meta_pontos_dia', 'meta_pontos_semana', 'meta_pontos_mes'
  ];
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuração inválida';
  end if;

  for v_chave in select jsonb_object_keys(p_config) loop
    if not (v_chave = any (v_chaves_validas)) then
      raise exception 'Chave desconhecida: %', v_chave;
    end if;

    begin
      v_valor := (p_config ->> v_chave)::numeric;
    exception when others then
      raise exception 'Valor inválido para %', v_chave;
    end;

    if v_valor is null or v_valor < 0 or v_valor > 100000 then
      raise exception 'Valor fora do intervalo permitido para %', v_chave;
    end if;

    insert into produtividade_config (chave, valor, atualizado_em)
    values (v_chave, v_valor, now())
    on conflict (chave) do update
      set valor = excluded.valor,
          atualizado_em = excluded.atualizado_em;
  end loop;

  return fn_produtividade_pesos();
end;
$$;


ALTER FUNCTION "public"."produtividade_salvar_config"("p_config" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."produtividade_salvar_config"("p_config" "jsonb") IS 'Grava apenas as chaves conhecidas, com valor entre 0 e 100000. Retorna a configuração completa.';



CREATE OR REPLACE FUNCTION "public"."produtividade_serie_diaria"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) RETURNS TABLE("dia" "date", "garcom_id" "uuid", "pontos" numeric, "pedidos_criados" integer, "pedidos_fechados" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  classificados as (
    select
      ((c.criado_em at time zone 'America/Sao_Paulo') - interval '3 hours')::date as dia,
      c.*
    from fn_produtividade_pedidos_classificados(p_inicio, p_fim, null) c
  ),
  por_dia as (
    select
      c.dia,
      c.garcom_id,
      count(*) filter (where not c.cancelado)::integer as criados_validos,
      count(*)::integer as pedidos_criados,
      count(*) filter (where c.fechado)::integer as pedidos_fechados,
      count(*) filter (where c.cancelado)::integer as cancelados,
      count(*) filter (where c.nome_generico and not c.cancelado)::integer as ocorrencias_nome,
      count(*) filter (where c.contato_ausente and not c.cancelado)::integer as ocorrencias_contato,
      count(*) filter (where c.cadastro_completo and not c.cancelado)::integer as cadastros_completos
    from classificados c
    group by c.dia, c.garcom_id
  ),
  atividade_por_dia as (
    select
      ((a.created_at at time zone 'America/Sao_Paulo') - interval '3 hours')::date as dia,
      a.garcom_id,
      count(*) filter (where a.tipo_acao = 'item_adicionado')::integer as itens_adicionados,
      count(distinct a.pedido_id) filter (where a.tipo_acao = 'pedido_modificado')::integer as edicoes
    from atividade_garcom a
    where a.created_at >= p_inicio
      and a.created_at < p_fim
    group by 1, 2
  ),
  combinado as (
    select
      coalesce(d.dia, ad.dia) as dia,
      coalesce(d.garcom_id, ad.garcom_id) as garcom_id,
      coalesce(d.criados_validos, 0) as criados_validos,
      coalesce(d.pedidos_criados, 0) as pedidos_criados,
      coalesce(d.pedidos_fechados, 0) as pedidos_fechados,
      coalesce(d.cancelados, 0) as cancelados,
      coalesce(d.ocorrencias_nome, 0) as ocorrencias_nome,
      coalesce(d.ocorrencias_contato, 0) as ocorrencias_contato,
      coalesce(d.cadastros_completos, 0) as cadastros_completos,
      coalesce(ad.itens_adicionados, 0) as itens_adicionados,
      coalesce(ad.edicoes, 0) as edicoes
    from por_dia d
    full outer join atividade_por_dia ad
      on ad.dia = d.dia and ad.garcom_id = d.garcom_id
  )
  select
    k.dia,
    k.garcom_id,
    round(
      k.criados_validos * (pesos.p ->> 'pontos_pedido_criado')::numeric

      + k.pedidos_fechados * (pesos.p ->> 'pontos_pedido_fechado')::numeric
      + k.itens_adicionados * (pesos.p ->> 'pontos_item_adicionado')::numeric
      + k.edicoes * (pesos.p ->> 'pontos_pedido_editado')::numeric
      + k.cadastros_completos * (pesos.p ->> 'bonus_cadastro_completo')::numeric
      - k.ocorrencias_nome * (pesos.p ->> 'penalidade_nome_generico')::numeric
      - k.ocorrencias_contato * (pesos.p ->> 'penalidade_contato_ausente')::numeric
      - k.cancelados * (pesos.p ->> 'penalidade_pedido_cancelado')::numeric
    , 2) as pontos,
    k.pedidos_criados,
    k.pedidos_fechados
  from combinado k
  cross join pesos
  -- Mesmo recorte do ranking: só quem é garçom hoje, senão a série mostra um
  -- traço sem nome para usuários que mudaram de papel.
  join usuarios_sistema u on u.id = k.garcom_id and u.papel = 'garcom'
  order by k.dia, k.garcom_id
$$;


ALTER FUNCTION "public"."produtividade_serie_diaria"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."produtividade_serie_diaria"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) IS 'Pontos e pedidos por dia operacional (corte 03:00 America/Sao_Paulo) e por garçom.';



CREATE OR REPLACE FUNCTION "public"."proteger_retorno_fila_impressao_automatica"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.status = 'pendente'
     and old.status is distinct from 'pendente'
     and coalesce(new.automatico, true)
     and not public.fila_impressao_automatica_permitida(new.escopo, now()) then
    new.status := 'cancelado';
    new.processado_em := now();
    new.erro_mensagem := 'Cancelado pela configuração da fila automática.';
    new.erro := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_retorno_fila_impressao_automatica"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quitar_crediario"("p_conta_id" "uuid", "p_descricao" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_saldo numeric(12,2);
  v_movimento_id uuid;
begin
  select saldo_atual
  into v_saldo
  from public.crediario_contas
  where id = p_conta_id
  for update;

  if v_saldo is null then
    raise exception 'Conta de crediario nao encontrada';
  end if;

  if v_saldo > 0 then
    insert into public.crediario_movimentos (
      conta_id,
      tipo,
      status,
      valor,
      descricao,
      origem,
      realizado_em,
      criado_em,
      metadata
    ) values (
      p_conta_id,
      'pagamento',
      'ativo',
      v_saldo,
      coalesce(nullif(trim(p_descricao), ''), 'Quitacao do crediario'),
      'manual',
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      jsonb_build_object('tipo_pagamento', 'quitacao')
    )
    returning id into v_movimento_id;
  end if;

  update public.crediario_contas
  set status = 'quitado',
      quitado_em = coalesce(quitado_em, timezone('utc'::text, now()))
  where id = p_conta_id;

  -- Conclui os pedidos que estavam no fiado desta conta.
  -- Statement único: locks adquiridos de uma vez; por último na transação.
  update public.pedidos p
  set forma_pagamento = 'Concluído',
      updated_at = timezone('utc'::text, now())
  from public.crediario_movimentos m
  where m.conta_id = p_conta_id
    and m.pedido_id = p.id
    and m.origem = 'pedido'
    and m.tipo = 'consumo'
    and m.status = 'ativo'
    and public.pedido_usa_crediario(p.forma_pagamento);

  return v_movimento_id;
end;
$$;


ALTER FUNCTION "public"."quitar_crediario"("p_conta_id" "uuid", "p_descricao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quitar_crediario_ao_concluir_pedido"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_movimento public.crediario_movimentos%rowtype;
begin
  if lower(trim(coalesce(old.status, ''))) = 'entregue'
    or lower(trim(coalesce(new.status, ''))) <> 'entregue'
    or not public.pedido_usa_crediario(new.forma_pagamento) then
    return new;
  end if;

  select movimento.*
  into v_movimento
  from public.crediario_movimentos movimento
  where movimento.pedido_id = new.id
    and movimento.origem = 'pedido'
    and movimento.tipo = 'consumo'
    and movimento.status = 'ativo'
  for update;

  if v_movimento.id is null then
    raise exception 'Pedido em crediario sem consumo ativo vinculado';
  end if;

  if v_movimento.valor > 0 and not exists (
    select 1
    from public.crediario_movimentos pagamento
    where pagamento.conta_id = v_movimento.conta_id
      and pagamento.pedido_id = new.id
      and pagamento.tipo = 'pagamento'
      and pagamento.status = 'ativo'
      and pagamento.metadata->>'tipo_pagamento' = 'quitacao_pedido'
      and pagamento.metadata->>'movimento_consumo_id' = v_movimento.id::text
  ) then
    insert into public.crediario_movimentos (
      conta_id,
      pedido_id,
      tipo,
      status,
      valor,
      descricao,
      origem,
      realizado_em,
      criado_em,
      metadata
    ) values (
      v_movimento.conta_id,
      new.id,
      'pagamento',
      'ativo',
      v_movimento.valor,
      'Pedido #' || coalesce(new.numero_pedido::text, left(new.id::text, 8)) || ' quitado ao concluir',
      'pedido',
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      jsonb_build_object(
        'tipo_pagamento', 'quitacao_pedido',
        'movimento_consumo_id', v_movimento.id::text
      )
    );
  end if;

  new.forma_pagamento := 'Concluído';
  return new;
end;
$$;


ALTER FUNCTION "public"."quitar_crediario_ao_concluir_pedido"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalcular_crediario_conta"("p_conta_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_saldo numeric(12,2);
begin
  select coalesce(sum(
    case
      when tipo = 'consumo' and status = 'ativo' then valor
      when tipo in ('pagamento', 'estorno') and status = 'ativo' then -valor
      when tipo = 'ajuste' and status = 'ativo' then valor
      else 0
    end
  ), 0)::numeric(12,2)
  into v_saldo
  from public.crediario_movimentos
  where conta_id = p_conta_id;

  update public.crediario_contas
  set
    saldo_atual = v_saldo,
    status = case
      when status in ('bloqueado', 'arquivado') then status
      when v_saldo <= 0 then 'quitado'
      else 'aberto'
    end,
    quitado_em = case
      when v_saldo <= 0 then coalesce(quitado_em, timezone('utc'::text, now()))
      else null
    end,
    atualizado_em = timezone('utc'::text, now())
  where id = p_conta_id;
end;
$$;


ALTER FUNCTION "public"."recalcular_crediario_conta"("p_conta_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.registrar_pagamento_crediario(p_conta_id, p_valor, p_descricao, '{}'::jsonb);
$$;


ALTER FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_saldo numeric(12,2);
  v_movimento_id uuid;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;

  select conta.saldo_atual
  into v_saldo
  from public.crediario_contas conta
  where conta.id = p_conta_id
  for update;

  if v_saldo is null then
    raise exception 'Conta de crediario nao encontrada';
  end if;

  if v_saldo <= 0 then
    raise exception 'Conta de crediario nao possui saldo em aberto';
  end if;

  if p_valor > v_saldo then
    raise exception 'Pagamento maior que o saldo em aberto';
  end if;

  insert into public.crediario_movimentos (
    conta_id,
    tipo,
    status,
    valor,
    descricao,
    origem,
    realizado_em,
    criado_em,
    metadata
  ) values (
    p_conta_id,
    'pagamento',
    'ativo',
    p_valor,
    coalesce(nullif(trim(p_descricao), ''), 'Pagamento recebido'),
    'manual',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_movimento_id;

  if p_valor = v_saldo then
    update public.pedidos pedido
    set forma_pagamento = 'Concluído',
        updated_at = timezone('utc'::text, now())
    from public.crediario_movimentos movimento
    where movimento.conta_id = p_conta_id
      and movimento.pedido_id = pedido.id
      and movimento.origem = 'pedido'
      and movimento.tipo = 'consumo'
      and movimento.status = 'ativo'
      and public.pedido_usa_crediario(pedido.forma_pagamento);
  end if;

  return v_movimento_id;
end;
$$;


ALTER FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pagamento_item_crediario"("p_movimento_id" "uuid", "p_itens_pagos" "jsonb", "p_forma_pagamento" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_movimento public.crediario_movimentos%rowtype;
  v_forma text := lower(trim(coalesce(p_forma_pagamento, '')));
  v_solicitados jsonb;
  v_pendentes jsonb;
  v_item jsonb;
  v_item_id text;
  v_quantidade_original integer;
  v_quantidade_pagar integer;
  v_quantidade_restante integer;
  v_subtotal_original numeric(12,2);
  v_subtotal_pago numeric(12,2);
  v_subtotal_restante numeric(12,2);
  v_itens_restantes jsonb := '[]'::jsonb;
  v_itens_confirmados jsonb := '[]'::jsonb;
  v_valor_pago numeric(12,2) := 0;
  v_valor_restante numeric(12,2);
  v_pagamento_id uuid;
begin
  if v_forma not in ('pix', 'dinheiro', 'cartao') then
    raise exception 'Forma de pagamento invalida';
  end if;

  if jsonb_typeof(p_itens_pagos) <> 'array' or jsonb_array_length(p_itens_pagos) = 0 then
    raise exception 'Selecione ao menos uma unidade para pagamento';
  end if;

  select coalesce(jsonb_object_agg(item_id, quantidade), '{}'::jsonb)
  into v_solicitados
  from (
    select
      nullif(trim(item->>'id'), '') as item_id,
      sum(floor(coalesce(nullif(item->>'quantidade', '')::numeric, 0)))::integer as quantidade
    from jsonb_array_elements(p_itens_pagos) item
    group by nullif(trim(item->>'id'), '')
  ) solicitacoes;

  if exists (
    select 1
    from jsonb_each_text(v_solicitados) solicitacao(item_id, quantidade)
    where solicitacao.item_id is null or solicitacao.quantidade::integer <= 0
  ) then
    raise exception 'Itens de pagamento invalidos';
  end if;

  select *
  into v_movimento
  from public.crediario_movimentos
  where id = p_movimento_id
  for update;

  if v_movimento.id is null
    or v_movimento.tipo <> 'consumo'
    or v_movimento.origem <> 'pedido'
    or v_movimento.status <> 'ativo'
    or v_movimento.pedido_id is null then
    raise exception 'Item do crediario nao esta disponivel para pagamento';
  end if;

  if jsonb_typeof(v_movimento.itens) <> 'array' then
    raise exception 'Itens do crediario invalidos';
  end if;

  v_pendentes := v_solicitados;

  for v_item in select value from jsonb_array_elements(v_movimento.itens)
  loop
    v_item_id := nullif(trim(v_item->>'id'), '');
    v_quantidade_original := floor(coalesce(nullif(v_item->>'quantidade', '')::numeric, 0))::integer;
    v_quantidade_pagar := coalesce(nullif(v_pendentes->>v_item_id, '')::integer, 0);

    if v_item_id is null or v_quantidade_original <= 0 then
      raise exception 'Snapshot do crediario invalido';
    end if;

    if v_quantidade_pagar <= 0 then
      v_itens_restantes := v_itens_restantes || jsonb_build_array(v_item);
      continue;
    end if;

    v_quantidade_pagar := least(v_quantidade_pagar, v_quantidade_original);
    v_quantidade_restante := v_quantidade_original - v_quantidade_pagar;
    v_subtotal_original := coalesce(nullif(v_item->>'subtotal', '')::numeric, 0);
    v_subtotal_pago := round(v_subtotal_original * v_quantidade_pagar / v_quantidade_original, 2);
    v_subtotal_restante := v_subtotal_original - v_subtotal_pago;
    v_valor_pago := v_valor_pago + v_subtotal_pago;

    v_itens_confirmados := v_itens_confirmados || jsonb_build_array(
      jsonb_set(
        jsonb_set(v_item, '{quantidade}', to_jsonb(v_quantidade_pagar)),
        '{subtotal}', to_jsonb(v_subtotal_pago)
      )
    );

    if v_quantidade_restante > 0 then
      v_itens_restantes := v_itens_restantes || jsonb_build_array(
        jsonb_set(
          jsonb_set(v_item, '{quantidade}', to_jsonb(v_quantidade_restante)),
          '{subtotal}', to_jsonb(v_subtotal_restante)
        )
      );
    end if;

    v_pendentes := jsonb_set(v_pendentes, array[v_item_id], to_jsonb(greatest((v_pendentes->>v_item_id)::integer - v_quantidade_pagar, 0)));
  end loop;

  if exists (
    select 1 from jsonb_each_text(v_pendentes) pendente(item_id, quantidade)
    where pendente.quantidade::integer > 0
  ) then
    raise exception 'Quantidade solicitada nao esta mais no crediario';
  end if;

  if v_valor_pago <= 0 or v_valor_pago > v_movimento.valor then
    raise exception 'Valor de pagamento invalido para este consumo';
  end if;

  v_valor_restante := v_movimento.valor - v_valor_pago;

  update public.crediario_movimentos
  set itens = v_itens_restantes,
      valor = v_valor_restante,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ultimo_pagamento_item_em', timezone('utc'::text, now()))
  where id = v_movimento.id;

  insert into public.pagamentos_pedido (pedido_id, forma_pagamento, valor, itens_pagos)
  values (v_movimento.pedido_id, v_forma, v_valor_pago, v_itens_confirmados)
  returning id into v_pagamento_id;

  if v_valor_restante <= 0 then
    update public.pedidos
    set forma_pagamento = 'Concluído',
        updated_at = timezone('utc'::text, now())
    where id = v_movimento.pedido_id
      and public.pedido_usa_crediario(forma_pagamento);
  end if;

  return v_pagamento_id;
end;
$$;


ALTER FUNCTION "public"."registrar_pagamento_item_crediario"("p_movimento_id" "uuid", "p_itens_pagos" "jsonb", "p_forma_pagamento" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."salvar_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text", "p_tipo" character varying, "p_papel" character varying DEFAULT NULL::character varying, "p_usuario_id" "uuid" DEFAULT NULL::"uuid", "p_modulo_id" character varying DEFAULT NULL::character varying, "p_permissoes" "jsonb" DEFAULT NULL::"jsonb", "p_ativo" boolean DEFAULT NULL::boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_ator_id uuid;
  v_ator_nome varchar;
  v_papel_alvo varchar;
begin
  select v.id, v.nome_usuario
  into v_ator_id, v_ator_nome
  from public.verificar_senha_usuario(lower(trim(p_nome_usuario)), p_senha) v
  where v.papel = 'admin'
  limit 1;

  if v_ator_id is null or not exists (
    select 1 from public.usuarios_sistema
    where id = v_ator_id and ativo = true and papel = 'admin'
  ) then
    return false;
  end if;

  if p_tipo = 'papel' then
    if p_papel not in ('garcom', 'entregador')
      or p_permissoes is null
      or jsonb_typeof(p_permissoes) <> 'object' then
      return false;
    end if;

    insert into public.permissoes_papel (papel, permissoes, updated_at)
    values (p_papel, p_permissoes, now())
    on conflict (papel)
    do update set permissoes = excluded.permissoes, updated_at = excluded.updated_at;
    return true;
  end if;

  if p_tipo = 'usuario' then
    select papel
    into v_papel_alvo
    from public.usuarios_sistema
    where id = p_usuario_id
      and papel in ('garcom', 'entregador');

    if v_papel_alvo is null
      or p_permissoes is null
      or jsonb_typeof(p_permissoes) <> 'object' then
      return false;
    end if;

    insert into public.permissoes_usuario (usuario_sistema_id, permissoes, updated_at)
    values (p_usuario_id, p_permissoes, now())
    on conflict (usuario_sistema_id)
    do update set permissoes = excluded.permissoes, updated_at = excluded.updated_at;
    return true;
  end if;

  if p_tipo = 'manutencao' then
    if v_ator_nome <> 'dzn'
      or p_modulo_id not in ('garcom.pedidos', 'garcom.mesas', 'entregador.entregas')
      or p_ativo is null then
      return false;
    end if;

    insert into public.manutencao_modulos (modulo_id, ativo, updated_at)
    values (p_modulo_id, p_ativo, now())
    on conflict (modulo_id)
    do update set ativo = excluded.ativo, updated_at = excluded.updated_at;
    return true;
  end if;

  return false;
end;
$$;


ALTER FUNCTION "public"."salvar_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text", "p_tipo" character varying, "p_papel" character varying, "p_usuario_id" "uuid", "p_modulo_id" character varying, "p_permissoes" "jsonb", "p_ativo" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_itens_pedido_crediario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pedido_id uuid;
begin
  v_pedido_id := coalesce(new.pedido_id, old.pedido_id);

  update public.crediario_movimentos
  set itens = public.snapshot_itens_pedido_crediario(v_pedido_id)
  where pedido_id = v_pedido_id
    and origem = 'pedido'
    and tipo = 'consumo';

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sincronizar_itens_pedido_crediario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_pedido_crediario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_conta_id uuid;
  v_chave text;
  v_nome text;
  v_telefone text;
  v_movimento_id uuid;
begin
  if not public.pedido_usa_crediario(new.forma_pagamento) or lower(coalesce(new.status, '')) = 'cancelado' then
    update public.crediario_movimentos m
    set status = 'cancelado',
        metadata = coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object('status_pedido', new.status)
    where m.pedido_id = new.id
      and m.origem = 'pedido'
      and m.tipo = 'consumo'
      and m.status <> 'cancelado'
      and m.valor > 0
      and not exists (
        select 1
        from public.crediario_contas c
        where c.id = m.conta_id
          and c.status = 'quitado'
      )
      and not exists (
        select 1
        from public.crediario_movimentos pagamento
        where pagamento.conta_id = m.conta_id
          and pagamento.pedido_id = m.pedido_id
          and pagamento.tipo = 'pagamento'
          and pagamento.status = 'ativo'
          and pagamento.metadata->>'tipo_pagamento' = 'quitacao_pedido'
          and pagamento.metadata->>'movimento_consumo_id' = m.id::text
      );
    return new;
  end if;

  v_nome := coalesce(nullif(trim(new.nome_cliente), ''), 'Cliente');
  v_telefone := public.normalizar_telefone_cliente(new.telefone);
  v_chave := nullif(public.normalizar_chave_crediario(v_nome, v_telefone), '');

  if v_chave is null then
    v_chave := 'pedido:' || new.id::text;
  end if;

  if new.cliente_id is not null then
    select id
    into v_conta_id
    from public.crediario_contas
    where cliente_id = new.cliente_id
    order by criado_em asc
    limit 1;
  end if;

  if v_conta_id is null then
    select id
    into v_conta_id
    from public.crediario_contas
    where cliente_chave = v_chave
      and nullif(trim(coalesce(cliente_chave, '')), '') is not null
    limit 1;
  end if;

  if v_conta_id is null then
    insert into public.crediario_contas (
      cliente_id,
      cliente_nome,
      cliente_chave,
      telefone,
      status,
      origem,
      criado_em,
      atualizado_em
    ) values (
      new.cliente_id,
      v_nome,
      v_chave,
      v_telefone,
      'aberto',
      'pedido',
      coalesce(new.created_at, timezone('utc'::text, now())),
      timezone('utc'::text, now())
    )
    returning id into v_conta_id;
  else
    update public.crediario_contas
    set
      cliente_id = coalesce(public.crediario_contas.cliente_id, new.cliente_id),
      cliente_nome = v_nome,
      cliente_chave = coalesce(nullif(trim(public.crediario_contas.cliente_chave), ''), v_chave),
      telefone = coalesce(v_telefone, public.crediario_contas.telefone),
      status = case when public.crediario_contas.status in ('arquivado', 'quitado') then 'aberto' else public.crediario_contas.status end
    where id = v_conta_id;
  end if;

  select id
  into v_movimento_id
  from public.crediario_movimentos
  where pedido_id = new.id
    and origem = 'pedido'
    and tipo = 'consumo'
  limit 1;

  if v_movimento_id is null then
    insert into public.crediario_movimentos (
      conta_id,
      pedido_id,
      tipo,
      status,
      valor,
      descricao,
      itens,
      origem,
      realizado_em,
      criado_em,
      metadata
    ) values (
      v_conta_id,
      new.id,
      'consumo',
      'ativo',
      greatest(coalesce(new.total, 0), 0),
      'Pedido #' || coalesce(new.numero_pedido::text, left(new.id::text, 8)),
      public.snapshot_itens_pedido_crediario(new.id),
      'pedido',
      coalesce(new.created_at, timezone('utc'::text, now())),
      coalesce(new.created_at, timezone('utc'::text, now())),
      jsonb_build_object('status_pedido', new.status, 'forma_pagamento', new.forma_pagamento)
    );
  else
    update public.crediario_movimentos
    set
      conta_id = v_conta_id,
      status = 'ativo',
      valor = greatest(coalesce(new.total, 0), 0),
      descricao = 'Pedido #' || coalesce(new.numero_pedido::text, left(new.id::text, 8)),
      itens = public.snapshot_itens_pedido_crediario(new.id),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('status_pedido', new.status, 'forma_pagamento', new.forma_pagamento)
    where id = v_movimento_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sincronizar_pedido_crediario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_total_usos_cupom"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cupons SET total_usos = COALESCE(total_usos, 0) + 1, updated_at = timezone('utc'::text, now()) WHERE id = NEW.cupom_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.cupons SET total_usos = GREATEST(COALESCE(total_usos, 0) - 1, 0), updated_at = timezone('utc'::text, now()) WHERE id = OLD.cupom_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.cupom_id IS DISTINCT FROM OLD.cupom_id THEN
      UPDATE public.cupons SET total_usos = GREATEST(COALESCE(total_usos, 0) - 1, 0), updated_at = timezone('utc'::text, now()) WHERE id = OLD.cupom_id;
      UPDATE public.cupons SET total_usos = COALESCE(total_usos, 0) + 1, updated_at = timezone('utc'::text, now()) WHERE id = NEW.cupom_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sincronizar_total_usos_cupom"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_itens_pedido_crediario"("p_pedido_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'nome', coalesce(i.nome_item, i.nome_produto, 'Item'),
        'quantidade', coalesce(i.quantidade, 1),
        'preco_unitario', coalesce(i.preco_unitario, 0),
        'subtotal', coalesce(i.subtotal, i.preco_total, 0),
        'observacoes', i.observacoes,
        'created_at', i.created_at
      )
      order by i.created_at asc, i.id asc
    ),
    '[]'::jsonb
  )
  from public.itens_pedido i
  where i.pedido_id = p_pedido_id;
$$;


ALTER FUNCTION "public"."snapshot_itens_pedido_crediario"("p_pedido_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_item_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.nome_item IS NOT NULL AND NEW.nome_produto IS NULL THEN NEW.nome_produto := NEW.nome_item; END IF;
  IF NEW.nome_produto IS NOT NULL AND NEW.nome_item IS NULL THEN NEW.nome_item := NEW.nome_produto; END IF;
  IF NEW.subtotal IS NOT NULL AND NEW.preco_total IS NULL THEN NEW.preco_total := NEW.subtotal; END IF;
  IF NEW.preco_total IS NOT NULL AND NEW.subtotal IS NULL THEN NEW.subtotal := NEW.preco_total; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_item_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_pedido_caixa_em_tempo_real"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  caixa_aberto public.caixas%rowtype;
  categoria_nome text;
  categoria_id uuid;
  status_pedido text;
  forma_pagamento_pedido text;
  nome_cliente_pedido text;
begin
  status_pedido := lower(coalesce(new.status, ''));

  if status_pedido = 'cancelado' then
    delete from public.movimentacoes_caixa
    where pedido_id = new.id;
    return new;
  end if;

  select *
  into caixa_aberto
  from public.caixas
  where status = 'aberto'
  order by data_abertura desc, created_at desc, id desc
  limit 1;

  if caixa_aberto.id is null then
    return new;
  end if;

  if new.created_at < caixa_aberto.data_abertura then
    return new;
  end if;

  forma_pagamento_pedido := coalesce(new.forma_pagamento, 'Nao informado');
  nome_cliente_pedido := coalesce(nullif(trim(new.nome_cliente), ''), 'Cliente');

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

  select id
  into categoria_id
  from public.categorias_caixa
  where nome = categoria_nome
    and coalesce(ativo, true)
  order by ordem asc nulls last, created_at asc
  limit 1;

  if categoria_id is null then
    select id
    into categoria_id
    from public.categorias_caixa
    where nome = 'Vendas do Dia'
      and coalesce(ativo, true)
    order by ordem asc nulls last, created_at asc
    limit 1;
  end if;

  insert into public.movimentacoes_caixa (
    caixa_id,
    categoria_id,
    tipo,
    valor,
    descricao,
    forma_pagamento,
    pedido_id
  )
  values (
    caixa_aberto.id,
    categoria_id,
    'entrada',
    coalesce(new.total, 0),
    concat('Pedido de ', nome_cliente_pedido, ' - ', forma_pagamento_pedido),
    forma_pagamento_pedido,
    new.id
  )
  on conflict (pedido_id)
  do update set
    caixa_id = excluded.caixa_id,
    categoria_id = excluded.categoria_id,
    tipo = excluded.tipo,
    valor = excluded.valor,
    descricao = excluded.descricao,
    forma_pagamento = excluded.forma_pagamento;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_pedido_caixa_em_tempo_real"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_crediario_conta"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.atualizado_em := timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_crediario_conta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_usuarios_cliente_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_usuarios_cliente_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_whatsapp_conversations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_whatsapp_conversations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_whatsapp_customer_memory_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_whatsapp_customer_memory_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_whatsapp_order_drafts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_whatsapp_order_drafts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_mesas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_mesas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_notification_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW()); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") RETURNS TABLE("id" "uuid", "nome" character varying, "nome_usuario" character varying, "papel" character varying, "avatar_url" "text", "cor_avatar" character varying, "funcionario_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nome,
    u.nome_usuario,
    u.papel,
    u.avatar_url,
    u.cor_avatar,
    u.funcionario_id
  FROM public.usuarios_sistema u
  WHERE u.nome_usuario = LOWER(TRIM(p_nome_usuario))
    AND u.senha_hash = encode(extensions.digest(p_senha, 'sha256'), 'hex')
    AND u.ativo = true;
    
  UPDATE public.usuarios_sistema
  SET ultimo_acesso = NOW()
  WHERE usuarios_sistema.nome_usuario = LOWER(TRIM(p_nome_usuario))
    AND usuarios_sistema.senha_hash = encode(extensions.digest(p_senha, 'sha256'), 'hex')
    AND usuarios_sistema.ativo = true;
END;
$$;


ALTER FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vincular_pedido_usuario_cliente"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  telefone_normalizado text;
  nome_limpo text;
  nome_para_cadastro text;
  cliente_uuid uuid;
  data_pedido timestamptz;
begin
  telefone_normalizado := public.normalizar_telefone_cliente(new.telefone);

  if telefone_normalizado is null then
    new.cliente_id := null;
    return new;
  end if;

  nome_limpo := nullif(trim(coalesce(new.nome_cliente, '')), '');
  data_pedido := coalesce(new.created_at, timezone('utc'::text, now()));
  nome_para_cadastro := case
    when public.nome_cliente_cadastro_valido(nome_limpo, new.tipo_entrega) then nome_limpo
    else null
  end;

  insert into public.usuarios_cliente (
    telefone,
    nome,
    primeiro_pedido_em,
    ultimo_pedido_em
  ) values (
    telefone_normalizado,
    nome_para_cadastro,
    data_pedido,
    data_pedido
  )
  on conflict (telefone)
  do update set
    nome = case
      when nome_para_cadastro is not null then nome_para_cadastro
      else public.usuarios_cliente.nome
    end,
    primeiro_pedido_em = least(
      coalesce(public.usuarios_cliente.primeiro_pedido_em, excluded.primeiro_pedido_em),
      excluded.primeiro_pedido_em
    ),
    ultimo_pedido_em = greatest(
      coalesce(public.usuarios_cliente.ultimo_pedido_em, excluded.ultimo_pedido_em),
      excluded.ultimo_pedido_em
    ),
    updated_at = timezone('utc'::text, now())
  returning id into cliente_uuid;

  new.cliente_id := cliente_uuid;
  return new;
end;
$$;


ALTER FUNCTION "public"."vincular_pedido_usuario_cliente"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "preco" numeric(10,2) NOT NULL,
    "disponivel" boolean DEFAULT true,
    "categoria" character varying(100),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "imagem_url" "text"
);


ALTER TABLE "public"."adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_sidebar_config" (
    "usuario_sistema_id" "uuid" NOT NULL,
    "config" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_sidebar_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_sidebar_config" IS 'Preferências de sidebar do admin por usuário (ordem e visibilidade dos itens).';



CREATE TABLE IF NOT EXISTS "public"."anotacoes_painel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" character varying(255) NOT NULL,
    "conteudo" "text",
    "cor" character varying(50) DEFAULT 'amarelo'::character varying,
    "categoria" character varying(50) DEFAULT 'geral'::character varying,
    "prioridade" character varying(20) DEFAULT 'media'::character varying,
    "concluida" boolean DEFAULT false,
    "fixada" boolean DEFAULT false,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."anotacoes_painel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atividade_garcom" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "garcom_id" "uuid" NOT NULL,
    "tipo_acao" character varying NOT NULL,
    "pedido_id" "uuid",
    "item_pedido_id" "uuid",
    "descricao" "text",
    "dados_extra" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "atividade_garcom_tipo_acao_check" CHECK ((("tipo_acao")::"text" = ANY ((ARRAY['pedido_criado'::character varying, 'pedido_modificado'::character varying, 'item_adicionado'::character varying, 'status_alterado'::character varying])::"text"[])))
);


ALTER TABLE "public"."atividade_garcom" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bairros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(100) NOT NULL,
    "taxa_entrega" numeric(10,2) DEFAULT 3.00 NOT NULL,
    "ativo" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "entrega_gratis" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."bairros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bebidas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "descricao" "text",
    "preco" numeric(10,2) NOT NULL,
    "categoria" character varying(100) NOT NULL,
    "imagem_url" "text",
    "disponivel" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tamanho" character varying
);


ALTER TABLE "public"."bebidas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caixa_automacao_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "singleton" boolean DEFAULT true NOT NULL,
    "ativo" boolean DEFAULT false NOT NULL,
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "horario_abertura" time without time zone DEFAULT '10:00:00'::time without time zone NOT NULL,
    "horario_fechamento" time without time zone DEFAULT '23:00:00'::time without time zone NOT NULL,
    "dias_ativos" smallint[] DEFAULT ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint] NOT NULL,
    "responsavel_padrao" character varying,
    "valor_abertura_padrao" numeric DEFAULT 0 NOT NULL,
    "auto_sincronizar_pedidos" boolean DEFAULT true NOT NULL,
    "fechar_com_saldo_esperado" boolean DEFAULT true NOT NULL,
    "ultimo_dia_abertura" character varying,
    "ultimo_dia_fechamento" character varying,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "caixa_automacao_config_dias_ativos_validos" CHECK (("dias_ativos" <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint])),
    CONSTRAINT "caixa_automacao_config_valor_non_negative" CHECK (("valor_abertura_padrao" >= (0)::numeric))
);


ALTER TABLE "public"."caixa_automacao_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caixas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_abertura" timestamp with time zone NOT NULL,
    "data_fechamento" timestamp with time zone,
    "valor_abertura" numeric(10,2) DEFAULT 0,
    "valor_fechamento" numeric(10,2),
    "total_entradas" numeric(10,2) DEFAULT 0,
    "total_saidas" numeric(10,2) DEFAULT 0,
    "saldo_esperado" numeric(10,2) DEFAULT 0,
    "diferenca" numeric(10,2),
    "responsavel_abertura" character varying(255),
    "responsavel_fechamento" character varying(255),
    "observacoes" "text",
    "status" character varying(20) DEFAULT 'aberto'::character varying,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "fechamento_formas" "jsonb"
);


ALTER TABLE "public"."caixas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(100) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."categorias_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_caixa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(100) NOT NULL,
    "tipo" character varying(20) NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true,
    "cor" character varying(7),
    "icone" character varying(50),
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."categorias_caixa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_cardapio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "categorias_cardapio_tipo_check" CHECK (("tipo" = ANY (ARRAY['produto'::"text", 'bebida'::"text", 'combo'::"text"])))
);


ALTER TABLE "public"."categorias_cardapio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."combo_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "combo_id" "uuid" NOT NULL,
    "produto_id" "uuid",
    "bebida_id" "uuid",
    "quantidade" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."combo_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."combos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "descricao" "text",
    "preco" numeric(10,2) NOT NULL,
    "imagem_url" "text",
    "disponivel" boolean DEFAULT true,
    "ordem" integer DEFAULT 0,
    "destaque" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "preco_original" numeric(10,2) DEFAULT NULL::numeric,
    "desconto_percentual" integer
);


ALTER TABLE "public"."combos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_loja" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chave" character varying(100) NOT NULL,
    "valor" "text",
    "tipo" character varying(50) DEFAULT 'string'::character varying,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."configuracoes_loja" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crediario_contas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "cliente_nome" "text" NOT NULL,
    "cliente_chave" "text" NOT NULL,
    "telefone" "text",
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "saldo_atual" numeric(12,2) DEFAULT 0 NOT NULL,
    "limite_credito" numeric(12,2),
    "observacoes" "text",
    "origem" "text" DEFAULT 'manual'::"text" NOT NULL,
    "legado_id" "uuid",
    "legado_firebase_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "quitado_em" timestamp with time zone,
    CONSTRAINT "crediario_contas_limite_check" CHECK ((("limite_credito" IS NULL) OR ("limite_credito" >= (0)::numeric))),
    CONSTRAINT "crediario_contas_status_check" CHECK (("status" = ANY (ARRAY['aberto'::"text", 'quitado'::"text", 'bloqueado'::"text", 'arquivado'::"text"])))
);


ALTER TABLE "public"."crediario_contas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crediario_movimentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "pedido_id" "uuid",
    "tipo" "text" NOT NULL,
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "valor" numeric(12,2) NOT NULL,
    "descricao" "text",
    "itens" "jsonb",
    "origem" "text" DEFAULT 'manual'::"text" NOT NULL,
    "legado_id" "uuid",
    "legado_order_id" "uuid",
    "legado_firebase_id" "text",
    "realizado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "criado_por" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "crediario_movimentos_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "crediario_movimentos_tipo_check" CHECK (("tipo" = ANY (ARRAY['consumo'::"text", 'pagamento'::"text", 'ajuste'::"text", 'estorno'::"text"]))),
    CONSTRAINT "crediario_movimentos_valor_check" CHECK (("valor" >= (0)::numeric))
);


ALTER TABLE "public"."crediario_movimentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" character varying(50) NOT NULL,
    "nome" character varying(255) NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "tipo_desconto" character varying(20) DEFAULT 'percentual'::character varying NOT NULL,
    "valor_desconto" numeric(10,2) DEFAULT 0 NOT NULL,
    "pedido_minimo" numeric(10,2) DEFAULT 0 NOT NULL,
    "limite_desconto" numeric(10,2),
    "uso_maximo_total" integer,
    "uso_maximo_por_cliente" integer,
    "uso_unico" boolean DEFAULT false NOT NULL,
    "total_usos" integer DEFAULT 0 NOT NULL,
    "aplica_em" character varying(20) DEFAULT 'pedido'::character varying NOT NULL,
    "produto_id" "uuid",
    "combo_id" "uuid",
    "validade_inicio" timestamp with time zone,
    "validade_fim" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "cupons_aplica_em_ck" CHECK ((("aplica_em")::"text" = ANY (ARRAY[('pedido'::character varying)::"text", ('produto'::character varying)::"text", ('combo'::character varying)::"text"]))),
    CONSTRAINT "cupons_aplicacao_relacao_ck" CHECK ((((("aplica_em")::"text" = 'pedido'::"text") AND ("produto_id" IS NULL) AND ("combo_id" IS NULL)) OR ((("aplica_em")::"text" = 'produto'::"text") AND ("produto_id" IS NOT NULL) AND ("combo_id" IS NULL)) OR ((("aplica_em")::"text" = 'combo'::"text") AND ("combo_id" IS NOT NULL) AND ("produto_id" IS NULL)))),
    CONSTRAINT "cupons_limite_desconto_ck" CHECK ((("limite_desconto" IS NULL) OR ("limite_desconto" >= (0)::numeric))),
    CONSTRAINT "cupons_pedido_minimo_ck" CHECK (("pedido_minimo" >= (0)::numeric)),
    CONSTRAINT "cupons_tipo_desconto_ck" CHECK ((("tipo_desconto")::"text" = ANY (ARRAY[('percentual'::character varying)::"text", ('valor_fixo'::character varying)::"text", ('frete_gratis'::character varying)::"text"]))),
    CONSTRAINT "cupons_total_usos_ck" CHECK (("total_usos" >= 0)),
    CONSTRAINT "cupons_uso_maximo_por_cliente_ck" CHECK ((("uso_maximo_por_cliente" IS NULL) OR ("uso_maximo_por_cliente" > 0))),
    CONSTRAINT "cupons_uso_maximo_total_ck" CHECK ((("uso_maximo_total" IS NULL) OR ("uso_maximo_total" > 0))),
    CONSTRAINT "cupons_valor_desconto_ck" CHECK (("valor_desconto" >= (0)::numeric))
);


ALTER TABLE "public"."cupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cupons_usos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cupom_id" "uuid" NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "telefone_cliente" character varying(20),
    "valor_desconto" numeric(10,2) DEFAULT 0 NOT NULL,
    "valor_frete_descontado" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."cupons_usos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entregas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "entregador_id" "uuid",
    "status" character varying(50) DEFAULT 'pendente'::character varying,
    "endereco_entrega" "text",
    "bairro" character varying(100),
    "taxa_entrega" numeric(10,2) DEFAULT 0,
    "tempo_estimado" integer,
    "tempo_real" integer,
    "distancia_km" numeric(10,2),
    "observacoes" "text",
    "data_saida" timestamp with time zone,
    "data_entrega" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "excluida_repasse" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."entregas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fila_impressao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pendente'::character varying,
    "tentativas" integer DEFAULT 0,
    "erro" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tipo" character varying(20) DEFAULT 'cozinha'::character varying,
    "erro_mensagem" "text",
    "criado_em" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "processado_em" timestamp with time zone,
    "impresso_em" timestamp with time zone,
    "escopo" character varying(30) DEFAULT 'pedido_completo'::character varying NOT NULL,
    "itens_snapshot" "jsonb",
    "pedido_snapshot" "jsonb",
    "origem" character varying(60),
    "hash_evento" character varying(120),
    "automatico" boolean DEFAULT true NOT NULL,
    CONSTRAINT "fila_impressao_escopo_ck" CHECK ((("escopo")::"text" = ANY ((ARRAY['pedido_completo'::character varying, 'itens_novos'::character varying])::"text"[])))
);


ALTER TABLE "public"."fila_impressao" OWNER TO "postgres";


COMMENT ON COLUMN "public"."fila_impressao"."automatico" IS 'Distingue eventos automáticos, sujeitos à janela da fila, de impressões manuais.';



CREATE TABLE IF NOT EXISTS "public"."financas_diarias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_referencia" "date" NOT NULL,
    "nome_pessoa" "text" NOT NULL,
    "funcionario_id" "uuid",
    "valor" numeric(12,2) NOT NULL,
    "forma_pagamento" "text",
    "observacoes" "text",
    "movimentacao_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financas_diarias_nome_pessoa_check" CHECK (("char_length"(TRIM(BOTH FROM "nome_pessoa")) > 0)),
    CONSTRAINT "financas_diarias_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."financas_diarias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formas_pagamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" character varying NOT NULL,
    "nome" character varying NOT NULL,
    "descricao" "text",
    "tipo_taxa" character varying DEFAULT 'nenhuma'::character varying NOT NULL,
    "valor_taxa" numeric(10,2) DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "visivel_cliente" boolean DEFAULT true NOT NULL,
    "aceita_troco" boolean DEFAULT false NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "formas_pagamento_tipo_taxa_check" CHECK ((("tipo_taxa")::"text" = ANY ((ARRAY['nenhuma'::character varying, 'percentual'::character varying, 'fixa'::character varying])::"text"[]))),
    CONSTRAINT "formas_pagamento_valor_taxa_nao_negativo" CHECK (("valor_taxa" >= (0)::numeric))
);


ALTER TABLE "public"."formas_pagamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funcionarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "telefone" character varying(20),
    "tipo" character varying(50) NOT NULL,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "recebe_mensagem" boolean DEFAULT true,
    "cargo" character varying(100)
);


ALTER TABLE "public"."funcionarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_caixas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ano" integer NOT NULL,
    "caixa_id_original" "uuid" NOT NULL,
    "data_abertura" timestamp with time zone NOT NULL,
    "data_fechamento" timestamp with time zone,
    "valor_abertura" numeric(10,2) DEFAULT 0,
    "valor_fechamento" numeric(10,2),
    "total_entradas" numeric(10,2) DEFAULT 0,
    "total_saidas" numeric(10,2) DEFAULT 0,
    "saldo_esperado" numeric(10,2) DEFAULT 0,
    "diferenca" numeric(10,2),
    "responsavel_abertura" character varying(255),
    "responsavel_fechamento" character varying(255),
    "observacoes" "text",
    "status" character varying(20),
    "arquivado_em" timestamp with time zone DEFAULT "timezone"('America/Sao_Paulo'::"text", "now"())
);


ALTER TABLE "public"."historico_caixas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_entregas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ano" integer NOT NULL,
    "historico_pedido_id" "uuid",
    "entrega_id_original" "uuid",
    "entregador_nome" character varying(255),
    "status" character varying(50),
    "endereco_entrega" "text",
    "bairro" character varying(100),
    "taxa_entrega" numeric(10,2) DEFAULT 0,
    "tempo_estimado" integer,
    "tempo_real" integer,
    "distancia_km" numeric(10,2),
    "observacoes" "text",
    "data_saida" timestamp with time zone,
    "data_entrega" timestamp with time zone,
    "data_criacao" timestamp with time zone
);


ALTER TABLE "public"."historico_entregas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_item_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ano" integer NOT NULL,
    "historico_item_id" "uuid",
    "adicional_nome" character varying(255) NOT NULL,
    "preco" numeric(10,2) NOT NULL,
    "quantidade" integer DEFAULT 1
);


ALTER TABLE "public"."historico_item_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_itens_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ano" integer NOT NULL,
    "historico_pedido_id" "uuid",
    "nome_item" character varying(255) NOT NULL,
    "quantidade" integer DEFAULT 1,
    "preco_unitario" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "observacoes" "text"
);


ALTER TABLE "public"."historico_itens_pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_movimentacoes_caixa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ano" integer NOT NULL,
    "movimentacao_id_original" "uuid",
    "caixa_id_original" "uuid",
    "categoria_nome" character varying(100),
    "funcionario_nome" character varying(255),
    "tipo" character varying(50) NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "descricao" "text",
    "forma_pagamento" character varying(50),
    "pedido_id_original" "uuid",
    "data_movimentacao" timestamp with time zone NOT NULL,
    "arquivado_em" timestamp with time zone DEFAULT "timezone"('America/Sao_Paulo'::"text", "now"())
);


ALTER TABLE "public"."historico_movimentacoes_caixa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ano" integer NOT NULL,
    "pedido_id_original" "uuid" NOT NULL,
    "numero_pedido" integer,
    "nome_cliente" character varying(255),
    "telefone" character varying(20),
    "tipo_entrega" character varying(50),
    "endereco_entrega" "text",
    "bairro" character varying(100),
    "taxa_entrega" numeric(10,2) DEFAULT 0,
    "forma_pagamento" character varying(50),
    "subtotal" numeric(10,2),
    "total" numeric(10,2),
    "status" character varying(50),
    "observacoes" "text",
    "data_pedido" timestamp with time zone,
    "arquivado_em" timestamp with time zone DEFAULT "timezone"('America/Sao_Paulo'::"text", "now"())
);


ALTER TABLE "public"."historico_pedidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_pedido_id" "uuid" NOT NULL,
    "adicional_id" "uuid",
    "nome" character varying(255) NOT NULL,
    "preco" numeric(10,2) NOT NULL,
    "quantidade" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."item_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "produto_id" "uuid",
    "bebida_id" "uuid",
    "combo_id" "uuid",
    "nome_item" character varying(255) NOT NULL,
    "quantidade" integer DEFAULT 1,
    "preco_unitario" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "nome_produto" character varying(255),
    "preco_total" numeric,
    "adicionado_por_garcom_id" "uuid",
    "subtotal_original" numeric,
    "desconto_manual" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "itens_pedido_desconto_manual_check" CHECK ((COALESCE("desconto_manual", (0)::numeric) >= (0)::numeric))
);


ALTER TABLE "public"."itens_pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manutencao_modulos" (
    "modulo_id" character varying(80) NOT NULL,
    "ativo" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."manutencao_modulos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" integer NOT NULL,
    "status" character varying(50) DEFAULT 'livre'::character varying,
    "nome_cliente" character varying(255),
    "ocupada_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "capacidade" integer DEFAULT 4,
    "tempo_limite_minutos" integer DEFAULT 90,
    "liberar_em" timestamp with time zone,
    "pedido_id" "uuid",
    "observacoes" "text",
    "tipo" character varying(20) DEFAULT 'mesa'::character varying NOT NULL,
    "codigo_qr" "text" NOT NULL,
    "identificador" "text",
    "qr_ativo" boolean DEFAULT true,
    CONSTRAINT "mesas_tipo_check" CHECK ((("tipo")::"text" = ANY ((ARRAY['mesa'::character varying, 'comanda'::character varying, 'local_externo'::character varying])::"text"[])))
);


ALTER TABLE "public"."mesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimentacoes_caixa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caixa_id" "uuid",
    "categoria_id" "uuid",
    "funcionario_id" "uuid",
    "pedido_id" "uuid",
    "tipo" character varying(50) NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "descricao" "text",
    "forma_pagamento" character varying(50),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."movimentacoes_caixa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "notifications_enabled" boolean DEFAULT true,
    "push_enabled" boolean DEFAULT true,
    "sound_enabled" boolean DEFAULT true,
    "new_order_notifications" boolean DEFAULT true,
    "status_change_notifications" boolean DEFAULT true
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_entregadores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entregador_id" "uuid" NOT NULL,
    "data_referencia" "date" NOT NULL,
    "total_devido" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_entregas" integer DEFAULT 0 NOT NULL,
    "valor_pago" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    "metodo_pagamento" character varying(50),
    "observacoes" "text",
    "data_pagamento" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pagamentos_entregadores_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pendente'::character varying, 'parcial'::character varying, 'pago'::character varying, 'acumulado'::character varying])::"text"[])))
);


ALTER TABLE "public"."pagamentos_entregadores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_online" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "provedor" character varying DEFAULT 'mercado_pago'::character varying NOT NULL,
    "external_reference" character varying NOT NULL,
    "mercado_pago_payment_id" character varying,
    "status" character varying DEFAULT 'pendente'::character varying NOT NULL,
    "status_detalhe" "text",
    "valor" numeric NOT NULL,
    "qr_code" "text",
    "qr_code_base64" "text",
    "qr_code_ticket_url" "text",
    "payload_criacao" "jsonb",
    "payload_atualizacao" "jsonb",
    "ultima_verificacao_em" timestamp with time zone,
    "pago_em" timestamp with time zone,
    "expira_em" timestamp with time zone,
    "aprovado_processado" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "pagamentos_online_valor_check" CHECK (("valor" >= (0)::numeric))
);


ALTER TABLE "public"."pagamentos_online" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "forma_pagamento" character varying(50) NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "troco_para" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "troco" numeric,
    "bandeira" character varying,
    "nsu" character varying,
    "itens_pagos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."pagamentos_pedido" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pagamentos_pedido"."itens_pagos" IS 'Itens cobertos por este pagamento (jsonb array). Formato igual ao snapshot_itens_pedido_crediario.';



CREATE TABLE IF NOT EXISTS "public"."pedidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_pedido" integer NOT NULL,
    "nome_cliente" character varying(255) NOT NULL,
    "telefone" character varying(20),
    "tipo_entrega" character varying(50) NOT NULL,
    "endereco_entrega" "text",
    "bairro" character varying(100),
    "taxa_entrega" numeric(10,2) DEFAULT 0,
    "forma_pagamento" character varying(50),
    "troco_para" numeric(10,2),
    "subtotal" numeric(10,2) NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "status" character varying(50) DEFAULT 'pendente'::character varying,
    "observacoes" "text",
    "mesa_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "endereco" "text",
    "complemento" "text",
    "referencia" "text",
    "mesa" integer,
    "cupom_id" "uuid",
    "cupom_codigo" character varying(50),
    "tipo_desconto_cupom" character varying(20),
    "desconto_cupom" numeric(10,2) DEFAULT 0,
    "desconto_frete" numeric(10,2) DEFAULT 0,
    "comanda" integer,
    "taxa_servico" numeric(10,2) DEFAULT 0 NOT NULL,
    "pagamento_online" boolean DEFAULT false NOT NULL,
    "pagamento_online_status" character varying DEFAULT 'nao_aplicavel'::character varying NOT NULL,
    "pagamento_online_pago_em" timestamp with time zone,
    "pagamento_online_gateway" character varying,
    "pagamento_online_referencia" character varying,
    "taxa_pagamento" numeric(10,2) DEFAULT 0 NOT NULL,
    "origem" "text",
    "garcom_id" "uuid",
    "subtotal_original" numeric,
    "total_original" numeric,
    "desconto_itens_total" numeric DEFAULT 0 NOT NULL,
    "desconto_manual" numeric DEFAULT 0 NOT NULL,
    "cliente_id" "uuid",
    CONSTRAINT "pedidos_desconto_cupom_nao_negativo" CHECK ((COALESCE("desconto_cupom", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "pedidos_desconto_frete_nao_negativo" CHECK ((COALESCE("desconto_frete", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "pedidos_desconto_itens_total_check" CHECK ((COALESCE("desconto_itens_total", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "pedidos_desconto_manual_check" CHECK ((COALESCE("desconto_manual", (0)::numeric) >= (0)::numeric)),
    CONSTRAINT "pedidos_mesa_comanda_exclusiva" CHECK ((NOT (("mesa" IS NOT NULL) AND ("comanda" IS NOT NULL)))),
    CONSTRAINT "pedidos_pagamento_online_status_check" CHECK ((("pagamento_online_status")::"text" = ANY ((ARRAY['nao_aplicavel'::character varying, 'aguardando_pagamento'::character varying, 'pago'::character varying, 'rejeitado'::character varying, 'cancelado'::character varying, 'expirado'::character varying, 'em_analise'::character varying])::"text"[]))),
    CONSTRAINT "pedidos_taxa_pagamento_nao_negativa" CHECK (("taxa_pagamento" >= (0)::numeric)),
    CONSTRAINT "pedidos_taxa_pagamento_non_negative" CHECK (("taxa_pagamento" >= (0)::numeric)),
    CONSTRAINT "pedidos_taxa_servico_nao_negativa" CHECK (("taxa_servico" >= (0)::numeric))
);


ALTER TABLE "public"."pedidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissoes_papel" (
    "papel" character varying(20) NOT NULL,
    "permissoes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "permissoes_papel_json_check" CHECK (("jsonb_typeof"("permissoes") = 'object'::"text")),
    CONSTRAINT "permissoes_papel_papel_check" CHECK ((("papel")::"text" = ANY ((ARRAY['garcom'::character varying, 'entregador'::character varying])::"text"[])))
);


ALTER TABLE "public"."permissoes_papel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissoes_usuario" (
    "usuario_sistema_id" "uuid" NOT NULL,
    "permissoes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "permissoes_usuario_json_check" CHECK (("jsonb_typeof"("permissoes") = 'object'::"text"))
);


ALTER TABLE "public"."permissoes_usuario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtividade_config" (
    "chave" "text" NOT NULL,
    "valor" numeric NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."produtividade_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."produtividade_config" IS 'Pesos de pontuação e metas do módulo de produtividade dos garçons. Penalidades são positivas e subtraídas no cálculo.';



CREATE TABLE IF NOT EXISTS "public"."produto_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "adicional_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."produto_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "descricao" "text",
    "preco" numeric(10,2) NOT NULL,
    "categoria" character varying(100) NOT NULL,
    "imagem_url" "text",
    "disponivel" boolean DEFAULT true,
    "destaque" boolean DEFAULT false,
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "preco_original" numeric,
    "desconto" numeric
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resumo_anual" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ano" integer NOT NULL,
    "total_pedidos" integer DEFAULT 0,
    "total_pedidos_entrega" integer DEFAULT 0,
    "total_pedidos_retirada" integer DEFAULT 0,
    "total_pedidos_local" integer DEFAULT 0,
    "receita_total" numeric(10,2) DEFAULT 0,
    "receita_entregas" numeric(10,2) DEFAULT 0,
    "receita_retiradas" numeric(10,2) DEFAULT 0,
    "receita_local" numeric(10,2) DEFAULT 0,
    "ticket_medio" numeric(10,2) DEFAULT 0,
    "total_entregas_realizadas" integer DEFAULT 0,
    "total_taxas_entrega" numeric(10,2) DEFAULT 0,
    "produto_mais_vendido" character varying(255),
    "produto_mais_vendido_qtd" integer DEFAULT 0,
    "mes_mais_lucrativo" integer,
    "mes_mais_lucrativo_valor" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "total_movimentacoes_caixa" integer DEFAULT 0,
    "total_entradas_caixa" numeric DEFAULT 0,
    "total_saidas_caixa" numeric DEFAULT 0,
    "data_arquivamento" timestamp with time zone DEFAULT "timezone"('America/Sao_Paulo'::"text", "now"()),
    "dados_completos" boolean DEFAULT false
);


ALTER TABLE "public"."resumo_anual" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telefone" "text" NOT NULL,
    "nome" "text",
    "primeiro_pedido_em" timestamp with time zone,
    "ultimo_pedido_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "endereco" "text",
    "bairro" "text",
    "complemento" "text"
);


ALTER TABLE "public"."usuarios_cliente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_sistema" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" character varying(255) NOT NULL,
    "nome_usuario" character varying(100) NOT NULL,
    "senha_hash" "text" NOT NULL,
    "papel" character varying(20) NOT NULL,
    "avatar_url" "text",
    "cor_avatar" character varying(7) DEFAULT '#f97316'::character varying,
    "ativo" boolean DEFAULT true,
    "funcionario_id" "uuid",
    "ultimo_acesso" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "usuarios_sistema_papel_check" CHECK ((("papel")::"text" = ANY ((ARRAY['admin'::character varying, 'garcom'::character varying, 'entregador'::character varying])::"text"[])))
);


ALTER TABLE "public"."usuarios_sistema" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_crediario_contas_resumo" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "cliente_id",
    NULL::"text" AS "cliente_nome",
    NULL::"text" AS "telefone",
    NULL::"text" AS "status",
    NULL::numeric(12,2) AS "saldo_atual",
    NULL::numeric(12,2) AS "limite_credito",
    NULL::"text" AS "observacoes",
    NULL::"text" AS "origem",
    NULL::"uuid" AS "legado_id",
    NULL::timestamp with time zone AS "criado_em",
    NULL::timestamp with time zone AS "atualizado_em",
    NULL::timestamp with time zone AS "quitado_em",
    NULL::integer AS "total_movimentos",
    NULL::integer AS "total_consumos",
    NULL::integer AS "total_pagamentos",
    NULL::timestamp with time zone AS "ultimo_movimento_em",
    NULL::numeric(12,2) AS "total_consumos_valor",
    NULL::numeric(12,2) AS "total_pagamentos_valor";


ALTER VIEW "public"."vw_crediario_contas_resumo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_usuarios_cliente_metricas" AS
 SELECT "uc"."id",
    "uc"."telefone",
    "uc"."nome",
    "uc"."endereco",
    "uc"."bairro",
    "uc"."primeiro_pedido_em",
    "uc"."ultimo_pedido_em",
    "uc"."created_at",
    "uc"."updated_at",
    ("count"("p"."id"))::integer AS "total_pedidos",
    ("count"(*) FILTER (WHERE ("lower"((COALESCE("p"."status", ''::character varying))::"text") <> 'cancelado'::"text")))::integer AS "total_pedidos_validos",
    (COALESCE("sum"(
        CASE
            WHEN ("lower"((COALESCE("p"."status", ''::character varying))::"text") <> 'cancelado'::"text") THEN "p"."total"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "total_vendas",
    (COALESCE("avg"(
        CASE
            WHEN ("lower"((COALESCE("p"."status", ''::character varying))::"text") <> 'cancelado'::"text") THEN "p"."total"
            ELSE NULL::numeric
        END), (0)::numeric))::numeric(12,2) AS "ticket_medio",
    "max"("p"."created_at") AS "ultimo_pedido_data"
   FROM ("public"."usuarios_cliente" "uc"
     LEFT JOIN "public"."pedidos" "p" ON (("p"."cliente_id" = "uc"."id")))
  GROUP BY "uc"."id", "uc"."telefone", "uc"."nome", "uc"."endereco", "uc"."bairro", "uc"."primeiro_pedido_em", "uc"."ultimo_pedido_em", "uc"."created_at", "uc"."updated_at";


ALTER VIEW "public"."vw_usuarios_cliente_metricas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "name" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    CONSTRAINT "whatsapp_conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'paused'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."whatsapp_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_customer_memory" (
    "phone" "text" NOT NULL,
    "customer_id" "uuid",
    "display_name" "text",
    "preferred_name" "text",
    "frequent_neighborhood" "text",
    "preferred_order_type" "text",
    "preferred_payment" "text",
    "favorite_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_order_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "facts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stats" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'bot'::"text" NOT NULL,
    "last_seen_at" timestamp with time zone,
    "last_order_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_customer_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "provider_message_id" "text",
    "direction" "text" NOT NULL,
    "event_type" "text",
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "raw_payload" "jsonb",
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."whatsapp_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_order_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "conversation_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "customer_id" "uuid",
    "customer_name" "text",
    "delivery_type" "text",
    "neighborhood" "text",
    "delivery_fee" numeric DEFAULT 0 NOT NULL,
    "address" "text",
    "payment_method" "text",
    "notes" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pending_options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pending_query" "text",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_order_id" "uuid",
    "created_order_number" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:25:00'::interval) NOT NULL,
    CONSTRAINT "whatsapp_order_drafts_items_array_check" CHECK (("jsonb_typeof"("items") = 'array'::"text")),
    CONSTRAINT "whatsapp_order_drafts_pending_array_check" CHECK (("jsonb_typeof"("pending_options") = 'array'::"text")),
    CONSTRAINT "whatsapp_order_drafts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'awaiting_item_choice'::"text", 'awaiting_delivery'::"text", 'awaiting_payment'::"text", 'awaiting_confirmation'::"text", 'confirmed'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."whatsapp_order_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_order_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "event_type" "text" DEFAULT 'notificacao'::"text" NOT NULL,
    CONSTRAINT "whatsapp_order_notifications_channel_check" CHECK (("channel" = ANY (ARRAY['cliente'::"text", 'loja'::"text", 'entregador'::"text"]))),
    CONSTRAINT "whatsapp_order_notifications_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'skipped'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."whatsapp_order_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "body" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    CONSTRAINT "whatsapp_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."whatsapp_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_product_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "origem" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "prioridade" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_product_aliases_origem_check" CHECK (("origem" = ANY (ARRAY['produto'::"text", 'bebida'::"text", 'combo'::"text"])))
);


ALTER TABLE "public"."whatsapp_product_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_product_lookup_misses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text",
    "conversation_id" "uuid",
    "query" "text" NOT NULL,
    "original_text" "text",
    "source" "text" DEFAULT 'bot'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "resolved_alias_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_product_lookup_misses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_session" (
    "id" "text" NOT NULL,
    "session_id" "text" DEFAULT 'main'::"text",
    "data_key" "text" NOT NULL,
    "data_value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."whatsapp_session" OWNER TO "postgres";


ALTER TABLE ONLY "public"."adicionais"
    ADD CONSTRAINT "adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_sidebar_config"
    ADD CONSTRAINT "admin_sidebar_config_pkey" PRIMARY KEY ("usuario_sistema_id");



ALTER TABLE ONLY "public"."anotacoes_painel"
    ADD CONSTRAINT "anotacoes_painel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atividade_garcom"
    ADD CONSTRAINT "atividade_garcom_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bairros"
    ADD CONSTRAINT "bairros_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."bairros"
    ADD CONSTRAINT "bairros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bebidas"
    ADD CONSTRAINT "bebidas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caixa_automacao_config"
    ADD CONSTRAINT "caixa_automacao_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caixa_automacao_config"
    ADD CONSTRAINT "caixa_automacao_config_singleton_unique" UNIQUE ("singleton");



ALTER TABLE ONLY "public"."caixas"
    ADD CONSTRAINT "caixas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_adicionais"
    ADD CONSTRAINT "categorias_adicionais_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."categorias_adicionais"
    ADD CONSTRAINT "categorias_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_caixa"
    ADD CONSTRAINT "categorias_caixa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_cardapio"
    ADD CONSTRAINT "categorias_cardapio_nome_tipo_key" UNIQUE ("nome", "tipo");



ALTER TABLE ONLY "public"."categorias_cardapio"
    ADD CONSTRAINT "categorias_cardapio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."combos"
    ADD CONSTRAINT "combos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_loja"
    ADD CONSTRAINT "configuracoes_loja_chave_key" UNIQUE ("chave");



ALTER TABLE ONLY "public"."configuracoes_loja"
    ADD CONSTRAINT "configuracoes_loja_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_cliente_chave_key" UNIQUE ("cliente_chave");



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_legado_id_key" UNIQUE ("legado_id");



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_legado_id_key" UNIQUE ("legado_id");



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_pedido_unico_ck" UNIQUE ("pedido_id");



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entregas"
    ADD CONSTRAINT "entregas_pedido_id_unique" UNIQUE ("pedido_id");



ALTER TABLE ONLY "public"."entregas"
    ADD CONSTRAINT "entregas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fila_impressao"
    ADD CONSTRAINT "fila_impressao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financas_diarias"
    ADD CONSTRAINT "financas_diarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formas_pagamento"
    ADD CONSTRAINT "formas_pagamento_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."formas_pagamento"
    ADD CONSTRAINT "formas_pagamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funcionarios"
    ADD CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_caixas"
    ADD CONSTRAINT "historico_caixas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_entregas"
    ADD CONSTRAINT "historico_entregas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_item_adicionais"
    ADD CONSTRAINT "historico_item_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_itens_pedido"
    ADD CONSTRAINT "historico_itens_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_movimentacoes_caixa"
    ADD CONSTRAINT "historico_movimentacoes_caixa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_pedidos"
    ADD CONSTRAINT "historico_pedidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_adicionais"
    ADD CONSTRAINT "item_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manutencao_modulos"
    ADD CONSTRAINT "manutencao_modulos_pkey" PRIMARY KEY ("modulo_id");



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."pagamentos_entregadores"
    ADD CONSTRAINT "pagamentos_entregadores_entregador_id_data_referencia_key" UNIQUE ("entregador_id", "data_referencia");



ALTER TABLE ONLY "public"."pagamentos_entregadores"
    ADD CONSTRAINT "pagamentos_entregadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos_online"
    ADD CONSTRAINT "pagamentos_online_external_reference_key" UNIQUE ("external_reference");



ALTER TABLE ONLY "public"."pagamentos_online"
    ADD CONSTRAINT "pagamentos_online_mercado_pago_payment_id_key" UNIQUE ("mercado_pago_payment_id");



ALTER TABLE ONLY "public"."pagamentos_online"
    ADD CONSTRAINT "pagamentos_online_pedido_id_key" UNIQUE ("pedido_id");



ALTER TABLE ONLY "public"."pagamentos_online"
    ADD CONSTRAINT "pagamentos_online_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos_pedido"
    ADD CONSTRAINT "pagamentos_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissoes_papel"
    ADD CONSTRAINT "permissoes_papel_pkey" PRIMARY KEY ("papel");



ALTER TABLE ONLY "public"."permissoes_usuario"
    ADD CONSTRAINT "permissoes_usuario_pkey" PRIMARY KEY ("usuario_sistema_id");



ALTER TABLE ONLY "public"."produtividade_config"
    ADD CONSTRAINT "produtividade_config_pkey" PRIMARY KEY ("chave");



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_produto_id_adicional_id_key" UNIQUE ("produto_id", "adicional_id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resumo_anual"
    ADD CONSTRAINT "resumo_anual_ano_key" UNIQUE ("ano");



ALTER TABLE ONLY "public"."resumo_anual"
    ADD CONSTRAINT "resumo_anual_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_cliente"
    ADD CONSTRAINT "usuarios_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_nome_usuario_key" UNIQUE ("nome_usuario");



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_conversations"
    ADD CONSTRAINT "whatsapp_conversations_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."whatsapp_conversations"
    ADD CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_customer_memory"
    ADD CONSTRAINT "whatsapp_customer_memory_pkey" PRIMARY KEY ("phone");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_provider_message_id_key" UNIQUE ("provider_message_id");



ALTER TABLE ONLY "public"."whatsapp_order_drafts"
    ADD CONSTRAINT "whatsapp_order_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_order_notifications"
    ADD CONSTRAINT "whatsapp_order_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_outbox"
    ADD CONSTRAINT "whatsapp_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_product_aliases"
    ADD CONSTRAINT "whatsapp_product_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_product_lookup_misses"
    ADD CONSTRAINT "whatsapp_product_lookup_misses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_session"
    ADD CONSTRAINT "whatsapp_session_pkey" PRIMARY KEY ("id");



CREATE INDEX "financas_diarias_data_referencia_idx" ON "public"."financas_diarias" USING "btree" ("data_referencia");



CREATE INDEX "financas_diarias_funcionario_id_idx" ON "public"."financas_diarias" USING "btree" ("funcionario_id") WHERE ("funcionario_id" IS NOT NULL);



CREATE INDEX "financas_diarias_movimentacao_id_idx" ON "public"."financas_diarias" USING "btree" ("movimentacao_id");



CREATE INDEX "idx_adicionais_categoria" ON "public"."adicionais" USING "btree" ("categoria");



CREATE INDEX "idx_adicionais_disponivel" ON "public"."adicionais" USING "btree" ("disponivel");



CREATE INDEX "idx_anotacoes_painel_categoria" ON "public"."anotacoes_painel" USING "btree" ("categoria");



CREATE INDEX "idx_anotacoes_painel_concluida" ON "public"."anotacoes_painel" USING "btree" ("concluida");



CREATE INDEX "idx_anotacoes_painel_created_at" ON "public"."anotacoes_painel" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_anotacoes_painel_prioridade" ON "public"."anotacoes_painel" USING "btree" ("prioridade");



CREATE INDEX "idx_atividade_garcom_created_at" ON "public"."atividade_garcom" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_atividade_garcom_garcom_id" ON "public"."atividade_garcom" USING "btree" ("garcom_id");



CREATE INDEX "idx_atividade_garcom_item_pedido_id" ON "public"."atividade_garcom" USING "btree" ("item_pedido_id");



CREATE INDEX "idx_atividade_garcom_pedido_id" ON "public"."atividade_garcom" USING "btree" ("pedido_id") WHERE ("pedido_id" IS NOT NULL);



CREATE INDEX "idx_atividade_garcom_tipo" ON "public"."atividade_garcom" USING "btree" ("tipo_acao");



CREATE INDEX "idx_bebidas_categoria" ON "public"."bebidas" USING "btree" ("categoria");



CREATE INDEX "idx_bebidas_disponivel" ON "public"."bebidas" USING "btree" ("disponivel");



CREATE INDEX "idx_caixas_data" ON "public"."caixas" USING "btree" ("data_abertura");



CREATE INDEX "idx_caixas_status" ON "public"."caixas" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_caixas_um_aberto" ON "public"."caixas" USING "btree" ("status") WHERE (("status")::"text" = 'aberto'::"text");



CREATE INDEX "idx_categorias_adicionais_nome" ON "public"."categorias_adicionais" USING "btree" ("nome");



CREATE INDEX "idx_categorias_cardapio_ativo_ordem" ON "public"."categorias_cardapio" USING "btree" ("ativo", "ordem", "nome");



CREATE INDEX "idx_combo_itens_bebida_id" ON "public"."combo_itens" USING "btree" ("bebida_id");



CREATE INDEX "idx_combo_itens_combo_id" ON "public"."combo_itens" USING "btree" ("combo_id");



CREATE INDEX "idx_combo_itens_produto_id" ON "public"."combo_itens" USING "btree" ("produto_id");



CREATE INDEX "idx_configuracoes_loja_chave" ON "public"."configuracoes_loja" USING "btree" ("chave");



CREATE INDEX "idx_crediario_contas_cliente_id" ON "public"."crediario_contas" USING "btree" ("cliente_id") WHERE ("cliente_id" IS NOT NULL);



CREATE INDEX "idx_crediario_contas_cliente_nome" ON "public"."crediario_contas" USING "gin" ("to_tsvector"('"portuguese"'::"regconfig", "cliente_nome"));



CREATE INDEX "idx_crediario_contas_status_saldo" ON "public"."crediario_contas" USING "btree" ("status", "saldo_atual" DESC, "atualizado_em" DESC);



CREATE INDEX "idx_crediario_movimentos_conta_data" ON "public"."crediario_movimentos" USING "btree" ("conta_id", "realizado_em" DESC);



CREATE INDEX "idx_crediario_movimentos_pedido" ON "public"."crediario_movimentos" USING "btree" ("pedido_id") WHERE ("pedido_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_crediario_movimentos_pedido_consumo" ON "public"."crediario_movimentos" USING "btree" ("pedido_id") WHERE (("pedido_id" IS NOT NULL) AND ("tipo" = 'consumo'::"text") AND ("origem" = 'pedido'::"text"));



CREATE INDEX "idx_cupons_aplica_em" ON "public"."cupons" USING "btree" ("aplica_em");



CREATE INDEX "idx_cupons_ativo" ON "public"."cupons" USING "btree" ("ativo");



CREATE UNIQUE INDEX "idx_cupons_codigo_unico" ON "public"."cupons" USING "btree" ("codigo");



CREATE INDEX "idx_cupons_combo_id" ON "public"."cupons" USING "btree" ("combo_id");



CREATE INDEX "idx_cupons_produto_id" ON "public"."cupons" USING "btree" ("produto_id");



CREATE INDEX "idx_cupons_usos_created_at" ON "public"."cupons_usos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cupons_usos_cupom_id" ON "public"."cupons_usos" USING "btree" ("cupom_id");



CREATE INDEX "idx_cupons_usos_telefone" ON "public"."cupons_usos" USING "btree" ("telefone_cliente");



CREATE INDEX "idx_cupons_validade_fim" ON "public"."cupons" USING "btree" ("validade_fim");



CREATE INDEX "idx_entregas_created_at_id" ON "public"."entregas" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "idx_entregas_entregador_id" ON "public"."entregas" USING "btree" ("entregador_id");



CREATE INDEX "idx_entregas_excluida_repasse" ON "public"."entregas" USING "btree" ("excluida_repasse") WHERE ("excluida_repasse" = true);



CREATE INDEX "idx_entregas_pedido_id" ON "public"."entregas" USING "btree" ("pedido_id");



CREATE INDEX "idx_entregas_status" ON "public"."entregas" USING "btree" ("status");



CREATE INDEX "idx_entregas_status_created_at_id" ON "public"."entregas" USING "btree" ("status", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_fila_impressao_automaticos_pendentes" ON "public"."fila_impressao" USING "btree" ("criado_em") WHERE ((("status")::"text" = 'pendente'::"text") AND ("automatico" = true));



CREATE INDEX "idx_fila_impressao_criado_em" ON "public"."fila_impressao" USING "btree" ("criado_em");



CREATE INDEX "idx_fila_impressao_pedido_tipo_status" ON "public"."fila_impressao" USING "btree" ("pedido_id", "tipo", "status");



CREATE INDEX "idx_fila_impressao_pendentes_criado_em" ON "public"."fila_impressao" USING "btree" ("criado_em") WHERE (("status")::"text" = 'pendente'::"text");



CREATE INDEX "idx_fila_impressao_status" ON "public"."fila_impressao" USING "btree" ("status");



CREATE INDEX "idx_fila_impressao_status_criado_em" ON "public"."fila_impressao" USING "btree" ("status", "criado_em");



CREATE INDEX "idx_formas_pagamento_ativo_visivel_ordem" ON "public"."formas_pagamento" USING "btree" ("ativo", "visivel_cliente", "ordem");



CREATE INDEX "idx_formas_pagamento_ordem" ON "public"."formas_pagamento" USING "btree" ("ordem", "nome");



CREATE INDEX "idx_historico_caixas_ano" ON "public"."historico_caixas" USING "btree" ("ano");



CREATE INDEX "idx_historico_entregas_ano" ON "public"."historico_entregas" USING "btree" ("ano");



CREATE INDEX "idx_historico_entregas_historico_pedido_id" ON "public"."historico_entregas" USING "btree" ("historico_pedido_id");



CREATE INDEX "idx_historico_item_adicionais_historico_item_id" ON "public"."historico_item_adicionais" USING "btree" ("historico_item_id");



CREATE INDEX "idx_historico_itens_ano" ON "public"."historico_itens_pedido" USING "btree" ("ano");



CREATE INDEX "idx_historico_itens_pedido_historico_pedido_id" ON "public"."historico_itens_pedido" USING "btree" ("historico_pedido_id");



CREATE INDEX "idx_historico_movimentacoes_ano" ON "public"."historico_movimentacoes_caixa" USING "btree" ("ano");



CREATE INDEX "idx_historico_pedidos_ano" ON "public"."historico_pedidos" USING "btree" ("ano");



CREATE INDEX "idx_item_adicionais_adicional_id" ON "public"."item_adicionais" USING "btree" ("adicional_id");



CREATE INDEX "idx_item_adicionais_item_pedido_id" ON "public"."item_adicionais" USING "btree" ("item_pedido_id");



CREATE INDEX "idx_itens_pedido_bebida_id" ON "public"."itens_pedido" USING "btree" ("bebida_id");



CREATE INDEX "idx_itens_pedido_combo_id" ON "public"."itens_pedido" USING "btree" ("combo_id");



CREATE INDEX "idx_itens_pedido_garcom_id" ON "public"."itens_pedido" USING "btree" ("adicionado_por_garcom_id") WHERE ("adicionado_por_garcom_id" IS NOT NULL);



CREATE INDEX "idx_itens_pedido_pedido_id" ON "public"."itens_pedido" USING "btree" ("pedido_id");



CREATE INDEX "idx_itens_pedido_produto_id" ON "public"."itens_pedido" USING "btree" ("produto_id");



CREATE UNIQUE INDEX "idx_mesas_codigo_qr_unique" ON "public"."mesas" USING "btree" ("codigo_qr");



CREATE INDEX "idx_mesas_numero" ON "public"."mesas" USING "btree" ("numero");



CREATE INDEX "idx_mesas_pedido_id" ON "public"."mesas" USING "btree" ("pedido_id");



CREATE INDEX "idx_mesas_status" ON "public"."mesas" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_mesas_tipo_numero_unique" ON "public"."mesas" USING "btree" ("tipo", "numero");



CREATE INDEX "idx_mesas_tipo_status" ON "public"."mesas" USING "btree" ("tipo", "status");



CREATE INDEX "idx_mesas_tipo_status_pedido" ON "public"."mesas" USING "btree" ("tipo", "status", "pedido_id");



CREATE INDEX "idx_movimentacoes_caixa_caixa_created" ON "public"."movimentacoes_caixa" USING "btree" ("caixa_id", "created_at" DESC);



CREATE INDEX "idx_movimentacoes_caixa_caixa_id" ON "public"."movimentacoes_caixa" USING "btree" ("caixa_id");



CREATE INDEX "idx_movimentacoes_caixa_categoria_id" ON "public"."movimentacoes_caixa" USING "btree" ("categoria_id");



CREATE INDEX "idx_movimentacoes_caixa_funcionario_id" ON "public"."movimentacoes_caixa" USING "btree" ("funcionario_id");



CREATE UNIQUE INDEX "idx_movimentacoes_caixa_pedido_unico" ON "public"."movimentacoes_caixa" USING "btree" ("pedido_id");



CREATE INDEX "idx_movimentacoes_caixa_tipo" ON "public"."movimentacoes_caixa" USING "btree" ("tipo");



CREATE INDEX "idx_notification_preferences_user_id" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_pagamentos_entregadores_data" ON "public"."pagamentos_entregadores" USING "btree" ("data_referencia" DESC);



CREATE INDEX "idx_pagamentos_entregadores_data_id" ON "public"."pagamentos_entregadores" USING "btree" ("data_referencia" DESC, "id" DESC);



CREATE INDEX "idx_pagamentos_entregadores_entregador" ON "public"."pagamentos_entregadores" USING "btree" ("entregador_id");



CREATE INDEX "idx_pagamentos_entregadores_status" ON "public"."pagamentos_entregadores" USING "btree" ("status");



CREATE INDEX "idx_pagamentos_entregadores_status_data" ON "public"."pagamentos_entregadores" USING "btree" ("status", "data_referencia" DESC);



CREATE INDEX "idx_pagamentos_online_mercado_pago_payment_id" ON "public"."pagamentos_online" USING "btree" ("mercado_pago_payment_id") WHERE ("mercado_pago_payment_id" IS NOT NULL);



CREATE INDEX "idx_pagamentos_online_status" ON "public"."pagamentos_online" USING "btree" ("status");



CREATE INDEX "idx_pagamentos_pedido_pedido_id" ON "public"."pagamentos_pedido" USING "btree" ("pedido_id");



CREATE INDEX "idx_pedidos_cliente_id" ON "public"."pedidos" USING "btree" ("cliente_id");



CREATE INDEX "idx_pedidos_comanda" ON "public"."pedidos" USING "btree" ("comanda");



CREATE INDEX "idx_pedidos_created_at" ON "public"."pedidos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pedidos_created_at_id" ON "public"."pedidos" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "idx_pedidos_cupom_codigo" ON "public"."pedidos" USING "btree" ("cupom_codigo");



CREATE INDEX "idx_pedidos_cupom_id" ON "public"."pedidos" USING "btree" ("cupom_id");



CREATE INDEX "idx_pedidos_garcom_id" ON "public"."pedidos" USING "btree" ("garcom_id") WHERE ("garcom_id" IS NOT NULL);



CREATE INDEX "idx_pedidos_mesa_comanda" ON "public"."pedidos" USING "btree" ("mesa", "comanda");



CREATE INDEX "idx_pedidos_mesa_id" ON "public"."pedidos" USING "btree" ("mesa_id");



CREATE INDEX "idx_pedidos_nome_cliente_trgm" ON "public"."pedidos" USING "gin" ("nome_cliente" "public"."gin_trgm_ops");



CREATE INDEX "idx_pedidos_notifier_updated_at" ON "public"."pedidos" USING "btree" ("updated_at" DESC, "id" DESC) WHERE ((NULLIF("regexp_replace"((COALESCE("telefone", ''::character varying))::"text", '\D'::"text", ''::"text", 'g'::"text"), ''::"text") IS NOT NULL) AND ("lower"((COALESCE("status", ''::character varying))::"text") = ANY (ARRAY['pendente'::"text", 'confirmado'::"text", 'confirmada'::"text", 'recebido'::"text", 'recebida'::"text", 'saiu_para_entrega'::"text", 'em_rota'::"text", 'cancelado'::"text", 'cancelada'::"text"])));



CREATE INDEX "idx_pedidos_pagamento_online_flag_status" ON "public"."pedidos" USING "btree" ("pagamento_online", "status");



CREATE INDEX "idx_pedidos_pagamento_online_status" ON "public"."pedidos" USING "btree" ("pagamento_online_status");



CREATE INDEX "idx_pedidos_status" ON "public"."pedidos" USING "btree" ("status");



CREATE INDEX "idx_pedidos_status_created_at_id" ON "public"."pedidos" USING "btree" ("status", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_pedidos_telefone_digits_created_at" ON "public"."pedidos" USING "btree" ("regexp_replace"((COALESCE("telefone", ''::character varying))::"text", '\D'::"text", ''::"text", 'g'::"text"), "created_at" DESC);



CREATE INDEX "idx_pedidos_telefone_trgm" ON "public"."pedidos" USING "gin" ("telefone" "public"."gin_trgm_ops");



CREATE INDEX "idx_pedidos_tipo_created_at_id" ON "public"."pedidos" USING "btree" ("tipo_entrega", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_produto_adicionais_produto" ON "public"."produto_adicionais" USING "btree" ("produto_id");



CREATE INDEX "idx_produtos_categoria" ON "public"."produtos" USING "btree" ("categoria");



CREATE INDEX "idx_produtos_disponivel" ON "public"."produtos" USING "btree" ("disponivel");



CREATE INDEX "idx_usuarios_cliente_nome" ON "public"."usuarios_cliente" USING "btree" ("nome");



CREATE UNIQUE INDEX "idx_usuarios_cliente_telefone" ON "public"."usuarios_cliente" USING "btree" ("telefone");



CREATE INDEX "idx_usuarios_cliente_telefone_digits_ultimo_pedido" ON "public"."usuarios_cliente" USING "btree" ("regexp_replace"(COALESCE("telefone", ''::"text"), '\D'::"text", ''::"text", 'g'::"text"), "ultimo_pedido_em" DESC);



CREATE INDEX "idx_usuarios_sistema_ativo" ON "public"."usuarios_sistema" USING "btree" ("ativo");



CREATE INDEX "idx_usuarios_sistema_nome_usuario" ON "public"."usuarios_sistema" USING "btree" ("nome_usuario");



CREATE INDEX "idx_usuarios_sistema_papel" ON "public"."usuarios_sistema" USING "btree" ("papel");



CREATE INDEX "idx_whatsapp_conversations_last_message" ON "public"."whatsapp_conversations" USING "btree" ("last_message_at" DESC NULLS LAST);



CREATE INDEX "idx_whatsapp_customer_memory_last_seen" ON "public"."whatsapp_customer_memory" USING "btree" ("last_seen_at" DESC NULLS LAST);



CREATE INDEX "idx_whatsapp_customer_memory_neighborhood" ON "public"."whatsapp_customer_memory" USING "btree" ("frequent_neighborhood") WHERE ("frequent_neighborhood" IS NOT NULL);



CREATE INDEX "idx_whatsapp_messages_conversation_created" ON "public"."whatsapp_messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_whatsapp_order_drafts_conversation" ON "public"."whatsapp_order_drafts" USING "btree" ("conversation_id", "updated_at" DESC) WHERE ("conversation_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_order_drafts_expires_at" ON "public"."whatsapp_order_drafts" USING "btree" ("expires_at") WHERE ("status" = ANY (ARRAY['open'::"text", 'awaiting_item_choice'::"text", 'awaiting_delivery'::"text", 'awaiting_payment'::"text", 'awaiting_confirmation'::"text"]));



CREATE INDEX "idx_whatsapp_order_drafts_phone_open" ON "public"."whatsapp_order_drafts" USING "btree" ("phone", "updated_at" DESC) WHERE ("status" = ANY (ARRAY['open'::"text", 'awaiting_item_choice'::"text", 'awaiting_delivery'::"text", 'awaiting_payment'::"text", 'awaiting_confirmation'::"text"]));



CREATE INDEX "idx_whatsapp_order_notifications_event" ON "public"."whatsapp_order_notifications" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_whatsapp_order_notifications_pedido" ON "public"."whatsapp_order_notifications" USING "btree" ("pedido_id");



CREATE INDEX "idx_whatsapp_order_notifications_status" ON "public"."whatsapp_order_notifications" USING "btree" ("status", "created_at");



CREATE INDEX "idx_whatsapp_outbox_pending" ON "public"."whatsapp_outbox" USING "btree" ("status", "next_attempt_at", "created_at");



CREATE INDEX "idx_whatsapp_product_aliases_alias" ON "public"."whatsapp_product_aliases" USING "btree" ("lower"("alias")) WHERE ("ativo" = true);



CREATE INDEX "idx_whatsapp_product_lookup_misses_created_at" ON "public"."whatsapp_product_lookup_misses" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_whatsapp_product_lookup_misses_query" ON "public"."whatsapp_product_lookup_misses" USING "btree" ("lower"("query"), "created_at" DESC);



CREATE UNIQUE INDEX "uq_fila_impressao_hash_ativo" ON "public"."fila_impressao" USING "btree" ("hash_evento") WHERE (("hash_evento" IS NOT NULL) AND (("status")::"text" = ANY ((ARRAY['pendente'::character varying, 'processando'::character varying])::"text"[])));



CREATE UNIQUE INDEX "uq_pagamentos_pedido_pix_online" ON "public"."pagamentos_pedido" USING "btree" ("pedido_id", "forma_pagamento") WHERE ("lower"(("forma_pagamento")::"text") = 'pix_online'::"text");



CREATE UNIQUE INDEX "uq_whatsapp_product_aliases_item_alias" ON "public"."whatsapp_product_aliases" USING "btree" ("origem", "item_id", "lower"("alias"));



CREATE UNIQUE INDEX "whatsapp_order_notifications_event_unique" ON "public"."whatsapp_order_notifications" USING "btree" ("pedido_id", "channel", "phone", "event_type");



CREATE OR REPLACE VIEW "public"."vw_crediario_contas_resumo" AS
 SELECT "c"."id",
    "c"."cliente_id",
    "c"."cliente_nome",
    "c"."telefone",
    "c"."status",
    "c"."saldo_atual",
    "c"."limite_credito",
    "c"."observacoes",
    "c"."origem",
    "c"."legado_id",
    "c"."criado_em",
    "c"."atualizado_em",
    "c"."quitado_em",
    (COALESCE("count"("m"."id") FILTER (WHERE ("m"."status" = 'ativo'::"text")), (0)::bigint))::integer AS "total_movimentos",
    (COALESCE("count"("m"."id") FILTER (WHERE (("m"."tipo" = 'consumo'::"text") AND ("m"."status" = 'ativo'::"text"))), (0)::bigint))::integer AS "total_consumos",
    (COALESCE("count"("m"."id") FILTER (WHERE (("m"."tipo" = 'pagamento'::"text") AND ("m"."status" = 'ativo'::"text"))), (0)::bigint))::integer AS "total_pagamentos",
    "max"("m"."realizado_em") AS "ultimo_movimento_em",
    (COALESCE("sum"("m"."valor") FILTER (WHERE (("m"."tipo" = 'consumo'::"text") AND ("m"."status" = 'ativo'::"text"))), (0)::numeric))::numeric(12,2) AS "total_consumos_valor",
    (COALESCE("sum"("m"."valor") FILTER (WHERE (("m"."tipo" = 'pagamento'::"text") AND ("m"."status" = 'ativo'::"text"))), (0)::numeric))::numeric(12,2) AS "total_pagamentos_valor"
   FROM ("public"."crediario_contas" "c"
     LEFT JOIN "public"."crediario_movimentos" "m" ON (("m"."conta_id" = "c"."id")))
  GROUP BY "c"."id";



CREATE OR REPLACE TRIGGER "atualizar_categorias_cardapio_updated_at" BEFORE UPDATE ON "public"."categorias_cardapio" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_updated_at_categorias_cardapio"();



CREATE OR REPLACE TRIGGER "trg_aplicar_configuracao_automatica_fila_impressao" BEFORE INSERT ON "public"."fila_impressao" FOR EACH ROW EXECUTE FUNCTION "public"."aplicar_configuracao_automatica_fila_impressao"();



CREATE OR REPLACE TRIGGER "trg_atualizar_snapshot_itens" AFTER INSERT ON "public"."itens_pedido" FOR EACH ROW EXECUTE FUNCTION "public"."fn_atualizar_snapshot_itens_fila"();



CREATE OR REPLACE TRIGGER "trg_electron_manter_preparando" BEFORE UPDATE ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_electron_manter_preparando"();



CREATE OR REPLACE TRIGGER "trg_electron_status" BEFORE INSERT ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_electron_status_preparando"();



CREATE OR REPLACE TRIGGER "trg_fila_impressao_auto" AFTER INSERT ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fila_impressao_auto"();



CREATE OR REPLACE TRIGGER "trg_fila_impressao_electron_confirmado" AFTER UPDATE ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fila_impressao_electron_confirmado"();



CREATE OR REPLACE TRIGGER "trg_popular_snapshot_fila_impressao" BEFORE INSERT ON "public"."fila_impressao" FOR EACH ROW EXECUTE FUNCTION "public"."fn_popular_snapshot_fila_impressao"();



CREATE OR REPLACE TRIGGER "trg_proteger_retorno_fila_impressao_automatica" BEFORE UPDATE OF "status" ON "public"."fila_impressao" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_retorno_fila_impressao_automatica"();



CREATE OR REPLACE TRIGGER "trg_whatsapp_conversations_updated_at" BEFORE UPDATE ON "public"."whatsapp_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."touch_whatsapp_conversations_updated_at"();



CREATE OR REPLACE TRIGGER "trg_whatsapp_customer_memory_updated_at" BEFORE UPDATE ON "public"."whatsapp_customer_memory" FOR EACH ROW EXECUTE FUNCTION "public"."touch_whatsapp_customer_memory_updated_at"();



CREATE OR REPLACE TRIGGER "trg_whatsapp_order_drafts_updated_at" BEFORE UPDATE ON "public"."whatsapp_order_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_whatsapp_order_drafts_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_atualizar_saldo_crediario_movimento" AFTER INSERT OR DELETE OR UPDATE ON "public"."crediario_movimentos" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_saldo_crediario_movimento"();



CREATE OR REPLACE TRIGGER "trigger_atualizar_updated_at_bairros" BEFORE UPDATE ON "public"."bairros" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_updated_at_bairros"();



CREATE OR REPLACE TRIGGER "trigger_combos_updated_at" BEFORE UPDATE ON "public"."combos" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_updated_at_combos"();



CREATE OR REPLACE TRIGGER "trigger_gerar_numero_pedido" BEFORE INSERT ON "public"."pedidos" FOR EACH ROW WHEN (("new"."numero_pedido" IS NULL)) EXECUTE FUNCTION "public"."gerar_numero_pedido"();



CREATE OR REPLACE TRIGGER "trigger_limpar_dados_pedido" BEFORE DELETE ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."limpar_dados_pedido_excluido"();



CREATE OR REPLACE TRIGGER "trigger_preparar_cupom_para_persistencia" BEFORE INSERT OR UPDATE ON "public"."cupons" FOR EACH ROW EXECUTE FUNCTION "public"."preparar_cupom_para_persistencia"();



CREATE OR REPLACE TRIGGER "trigger_quitar_crediario_ao_concluir" BEFORE UPDATE OF "status" ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."quitar_crediario_ao_concluir_pedido"();



CREATE OR REPLACE TRIGGER "trigger_sincronizar_itens_pedido_crediario" AFTER INSERT OR DELETE OR UPDATE ON "public"."itens_pedido" FOR EACH ROW EXECUTE FUNCTION "public"."sincronizar_itens_pedido_crediario"();



CREATE OR REPLACE TRIGGER "trigger_sincronizar_pedido_crediario" AFTER INSERT OR UPDATE OF "forma_pagamento", "total", "status", "nome_cliente", "telefone", "cliente_id" ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."sincronizar_pedido_crediario"();



CREATE OR REPLACE TRIGGER "trigger_sincronizar_total_usos_cupom" AFTER INSERT OR DELETE OR UPDATE ON "public"."cupons_usos" FOR EACH ROW EXECUTE FUNCTION "public"."sincronizar_total_usos_cupom"();



CREATE OR REPLACE TRIGGER "trigger_sync_item_columns" BEFORE INSERT ON "public"."itens_pedido" FOR EACH ROW EXECUTE FUNCTION "public"."sync_item_columns"();



CREATE OR REPLACE TRIGGER "trigger_sync_item_columns_update" BEFORE UPDATE ON "public"."itens_pedido" FOR EACH ROW EXECUTE FUNCTION "public"."sync_item_columns"();



CREATE OR REPLACE TRIGGER "trigger_sync_pedidos_caixa_rt" AFTER INSERT OR UPDATE OF "status", "total", "forma_pagamento", "nome_cliente" ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."sync_pedido_caixa_em_tempo_real"();



CREATE OR REPLACE TRIGGER "trigger_touch_crediario_conta" BEFORE UPDATE ON "public"."crediario_contas" FOR EACH ROW EXECUTE FUNCTION "public"."touch_crediario_conta"();



CREATE OR REPLACE TRIGGER "trigger_touch_usuarios_cliente_updated_at" BEFORE UPDATE ON "public"."usuarios_cliente" FOR EACH ROW EXECUTE FUNCTION "public"."touch_usuarios_cliente_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_mesas_updated_at" BEFORE UPDATE ON "public"."mesas" FOR EACH ROW EXECUTE FUNCTION "public"."update_mesas_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_usuarios_sistema_updated_at" BEFORE UPDATE ON "public"."usuarios_sistema" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_vincular_pedido_usuario_cliente" BEFORE INSERT OR UPDATE OF "telefone", "nome_cliente" ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."vincular_pedido_usuario_cliente"();



CREATE OR REPLACE TRIGGER "update_adicionais_updated_at" BEFORE UPDATE ON "public"."adicionais" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bebidas_updated_at" BEFORE UPDATE ON "public"."bebidas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_caixa_automacao_config_updated_at" BEFORE UPDATE ON "public"."caixa_automacao_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_categorias_adicionais_updated_at" BEFORE UPDATE ON "public"."categorias_adicionais" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_formas_pagamento_updated_at" BEFORE UPDATE ON "public"."formas_pagamento" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pagamentos_online_updated_at" BEFORE UPDATE ON "public"."pagamentos_online" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pedidos_updated_at" BEFORE UPDATE ON "public"."pedidos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_produtos_updated_at" BEFORE UPDATE ON "public"."produtos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."adicionais"
    ADD CONSTRAINT "adicionais_categoria_fkey" FOREIGN KEY ("categoria") REFERENCES "public"."categorias_adicionais"("nome") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_sidebar_config"
    ADD CONSTRAINT "admin_sidebar_config_usuario_sistema_id_fkey" FOREIGN KEY ("usuario_sistema_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atividade_garcom"
    ADD CONSTRAINT "atividade_garcom_garcom_id_fkey" FOREIGN KEY ("garcom_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atividade_garcom"
    ADD CONSTRAINT "atividade_garcom_item_pedido_id_fkey" FOREIGN KEY ("item_pedido_id") REFERENCES "public"."itens_pedido"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."atividade_garcom"
    ADD CONSTRAINT "atividade_garcom_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_bebida_id_fkey" FOREIGN KEY ("bebida_id") REFERENCES "public"."bebidas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."combo_itens"
    ADD CONSTRAINT "combo_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crediario_contas"
    ADD CONSTRAINT "crediario_contas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."usuarios_cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."crediario_contas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crediario_movimentos"
    ADD CONSTRAINT "crediario_movimentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cupons"
    ADD CONSTRAINT "cupons_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_cupom_id_fkey" FOREIGN KEY ("cupom_id") REFERENCES "public"."cupons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cupons_usos"
    ADD CONSTRAINT "cupons_usos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entregas"
    ADD CONSTRAINT "entregas_entregador_id_fkey" FOREIGN KEY ("entregador_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entregas"
    ADD CONSTRAINT "entregas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fila_impressao"
    ADD CONSTRAINT "fila_impressao_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financas_diarias"
    ADD CONSTRAINT "financas_diarias_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financas_diarias"
    ADD CONSTRAINT "financas_diarias_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "public"."movimentacoes_caixa"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_entregas"
    ADD CONSTRAINT "historico_entregas_historico_pedido_id_fkey" FOREIGN KEY ("historico_pedido_id") REFERENCES "public"."historico_pedidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historico_item_adicionais"
    ADD CONSTRAINT "historico_item_adicionais_historico_item_id_fkey" FOREIGN KEY ("historico_item_id") REFERENCES "public"."historico_itens_pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_itens_pedido"
    ADD CONSTRAINT "historico_itens_pedido_historico_pedido_id_fkey" FOREIGN KEY ("historico_pedido_id") REFERENCES "public"."historico_pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_adicionais"
    ADD CONSTRAINT "item_adicionais_adicional_id_fkey" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionais"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."item_adicionais"
    ADD CONSTRAINT "item_adicionais_item_pedido_id_fkey" FOREIGN KEY ("item_pedido_id") REFERENCES "public"."itens_pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_adicionado_por_garcom_id_fkey" FOREIGN KEY ("adicionado_por_garcom_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_bebida_id_fkey" FOREIGN KEY ("bebida_id") REFERENCES "public"."bebidas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_caixa_id_fkey" FOREIGN KEY ("caixa_id") REFERENCES "public"."caixas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_caixa"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pagamentos_entregadores"
    ADD CONSTRAINT "pagamentos_entregadores_entregador_id_fkey" FOREIGN KEY ("entregador_id") REFERENCES "public"."funcionarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos_online"
    ADD CONSTRAINT "pagamentos_online_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos_pedido"
    ADD CONSTRAINT "pagamentos_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."usuarios_cliente"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_cupom_id_fkey" FOREIGN KEY ("cupom_id") REFERENCES "public"."cupons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_garcom_id_fkey" FOREIGN KEY ("garcom_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedidos"
    ADD CONSTRAINT "pedidos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permissoes_usuario"
    ADD CONSTRAINT "permissoes_usuario_usuario_sistema_id_fkey" FOREIGN KEY ("usuario_sistema_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_adicional_id_fkey" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produto_adicionais"
    ADD CONSTRAINT "produto_adicionais_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_order_drafts"
    ADD CONSTRAINT "whatsapp_order_drafts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_order_notifications"
    ADD CONSTRAINT "whatsapp_order_notifications_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE CASCADE;



ALTER TABLE "public"."manutencao_modulos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissoes_papel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissoes_usuario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "produto_adicionais_select" ON "public"."produto_adicionais" FOR SELECT USING (true);



CREATE POLICY "service_role_all_whatsapp_conversations" ON "public"."whatsapp_conversations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_whatsapp_customer_memory" ON "public"."whatsapp_customer_memory" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_whatsapp_messages" ON "public"."whatsapp_messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_whatsapp_order_drafts" ON "public"."whatsapp_order_drafts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_whatsapp_order_notifications" ON "public"."whatsapp_order_notifications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_whatsapp_outbox" ON "public"."whatsapp_outbox" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_whatsapp_product_aliases" ON "public"."whatsapp_product_aliases" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "usuarios_sistema_delete" ON "public"."usuarios_sistema" FOR DELETE USING (true);



CREATE POLICY "usuarios_sistema_insert" ON "public"."usuarios_sistema" FOR INSERT WITH CHECK (true);



CREATE POLICY "usuarios_sistema_select" ON "public"."usuarios_sistema" FOR SELECT USING (true);



CREATE POLICY "usuarios_sistema_update" ON "public"."usuarios_sistema" FOR UPDATE USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."adicionais";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."anotacoes_painel";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."atividade_garcom";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bairros";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bebidas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."caixa_automacao_config";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."caixas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."categorias_adicionais";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."categorias_caixa";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."categorias_cardapio";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."combo_itens";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."combos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."configuracoes_loja";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."crediario_contas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."crediario_movimentos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."cupons";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."cupons_usos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."entregas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fila_impressao";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."formas_pagamento";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."funcionarios";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."item_adicionais";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."itens_pedido";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mesas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."movimentacoes_caixa";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notification_preferences";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pagamentos_entregadores";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pagamentos_online";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pagamentos_pedido";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pedidos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."produto_adicionais";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."produtos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."usuarios_cliente";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."usuarios_sistema";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."apagar_item_movimento_crediario"("p_movimento_id" "uuid", "p_item_indice" integer, "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apagar_item_movimento_crediario"("p_movimento_id" "uuid", "p_item_indice" integer, "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apagar_item_movimento_crediario"("p_movimento_id" "uuid", "p_item_indice" integer, "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."aplicar_configuracao_automatica_fila_impressao"() TO "anon";
GRANT ALL ON FUNCTION "public"."aplicar_configuracao_automatica_fila_impressao"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."aplicar_configuracao_automatica_fila_impressao"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_saldo_crediario_movimento"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_saldo_crediario_movimento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_saldo_crediario_movimento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_senha_usuario"("p_usuario_id" "uuid", "p_nova_senha" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_updated_at_bairros"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_updated_at_bairros"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_updated_at_bairros"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_updated_at_categorias_cardapio"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_updated_at_categorias_cardapio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_updated_at_categorias_cardapio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_updated_at_combos"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_updated_at_combos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_updated_at_combos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."buscar_clientes"("p_termo" "text", "p_limite" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."buscar_clientes"("p_termo" "text", "p_limite" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."buscar_clientes"("p_termo" "text", "p_limite" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cancelar_movimento_crediario"("p_movimento_id" "uuid", "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancelar_movimento_crediario"("p_movimento_id" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancelar_movimento_crediario"("p_movimento_id" "uuid", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."carregar_painel_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."carregar_painel_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."carregar_painel_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."carregar_painel_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."configurar_fila_impressao"("p_fila_ativa" boolean, "p_horario_inicio" "text", "p_horario_fim" "text", "p_imprimir_itens_editados" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."configurar_fila_impressao"("p_fila_ativa" boolean, "p_horario_inicio" "text", "p_horario_fim" "text", "p_imprimir_itens_editados" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."configurar_fila_impressao"("p_fila_ativa" boolean, "p_horario_inicio" "text", "p_horario_fim" "text", "p_imprimir_itens_editados" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."configurar_fila_impressao"("p_fila_ativa" boolean, "p_horario_inicio" "text", "p_horario_fim" "text", "p_imprimir_itens_editados" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_whatsapp_order_draft"("p_draft_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_whatsapp_order_draft"("p_draft_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_whatsapp_order_draft"("p_draft_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_usuario_sistema"("p_nome" character varying, "p_nome_usuario" character varying, "p_senha" "text", "p_papel" character varying, "p_avatar_url" "text", "p_cor_avatar" character varying, "p_funcionario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enviar_pedido_crediario"("p_pedido_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."enviar_pedido_crediario"("p_pedido_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enviar_pedido_crediario"("p_pedido_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."estatisticas_pedidos_periodo"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."exec_bot_sql"("p_sql" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."exec_bot_sql"("p_sql" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fila_impressao_automatica_permitida"("p_escopo" "text", "p_instante" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fila_impressao_automatica_permitida"("p_escopo" "text", "p_instante" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fila_impressao_automatica_permitida"("p_escopo" "text", "p_instante" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_atualizar_snapshot_itens_fila"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_atualizar_snapshot_itens_fila"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_atualizar_snapshot_itens_fila"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_electron_manter_preparando"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_electron_manter_preparando"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_electron_manter_preparando"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_electron_status_preparando"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_electron_status_preparando"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_electron_status_preparando"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_fila_impressao_auto"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_fila_impressao_auto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_fila_impressao_auto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_fila_impressao_electron_confirmado"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_fila_impressao_electron_confirmado"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_fila_impressao_electron_confirmado"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_popular_snapshot_fila_impressao"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_popular_snapshot_fila_impressao"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_popular_snapshot_fila_impressao"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_produtividade_nome_generico"("p_nome" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_produtividade_nome_generico"("p_nome" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_produtividade_pedidos_classificados"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_produtividade_pedidos_classificados"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_produtividade_pesos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_produtividade_pesos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gerar_numero_pedido"() TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_numero_pedido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_numero_pedido"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_pedidos"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_pedidos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_pedidos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."liberar_mesas_expiradas"() TO "anon";
GRANT ALL ON FUNCTION "public"."liberar_mesas_expiradas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."liberar_mesas_expiradas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."limpar_dados_pedido_excluido"() TO "anon";
GRANT ALL ON FUNCTION "public"."limpar_dados_pedido_excluido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."limpar_dados_pedido_excluido"() TO "service_role";



GRANT ALL ON FUNCTION "public"."limpar_mesas_expiradas"() TO "anon";
GRANT ALL ON FUNCTION "public"."limpar_mesas_expiradas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."limpar_mesas_expiradas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."nome_cliente_cadastro_valido"("p_nome" "text", "p_tipo_entrega" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."nome_cliente_cadastro_valido"("p_nome" "text", "p_tipo_entrega" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nome_cliente_cadastro_valido"("p_nome" "text", "p_tipo_entrega" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalizar_chave_crediario"("p_nome" "text", "p_telefone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalizar_chave_crediario"("p_nome" "text", "p_telefone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_chave_crediario"("p_nome" "text", "p_telefone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalizar_nome_cliente_cadastro"("p_nome" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalizar_nome_cliente_cadastro"("p_nome" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_nome_cliente_cadastro"("p_nome" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalizar_telefone_cliente"("p_telefone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalizar_telefone_cliente"("p_telefone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_telefone_cliente"("p_telefone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_controle_acesso"("p_usuario_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_controle_acesso"("p_usuario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."obter_controle_acesso"("p_usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_controle_acesso"("p_usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_pedidos_cliente_por_telefone"("p_telefone" "text", "p_limite" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pedido_usa_crediario"("p_forma_pagamento" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pedido_usa_crediario"("p_forma_pagamento" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pedido_usa_crediario"("p_forma_pagamento" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."preparar_cupom_para_persistencia"() TO "anon";
GRANT ALL ON FUNCTION "public"."preparar_cupom_para_persistencia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."preparar_cupom_para_persistencia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_automacao_caixa"() TO "anon";
GRANT ALL ON FUNCTION "public"."processar_automacao_caixa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_automacao_caixa"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."produtividade_garcons"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."produtividade_garcons"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."produtividade_garcons"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."produtividade_garcons"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."produtividade_ler_config"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."produtividade_ler_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."produtividade_ler_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."produtividade_ler_config"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."produtividade_ocorrencias"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."produtividade_ocorrencias"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."produtividade_ocorrencias"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid", "p_limite" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."produtividade_ocorrencias"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_garcom_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."produtividade_salvar_config"("p_config" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."produtividade_salvar_config"("p_config" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."produtividade_salvar_config"("p_config" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."produtividade_salvar_config"("p_config" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."produtividade_serie_diaria"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."produtividade_serie_diaria"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."produtividade_serie_diaria"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."produtividade_serie_diaria"("p_inicio" timestamp with time zone, "p_fim" timestamp with time zone) TO "authenticated";



GRANT ALL ON FUNCTION "public"."proteger_retorno_fila_impressao_automatica"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_retorno_fila_impressao_automatica"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_retorno_fila_impressao_automatica"() TO "service_role";



GRANT ALL ON FUNCTION "public"."quitar_crediario"("p_conta_id" "uuid", "p_descricao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."quitar_crediario"("p_conta_id" "uuid", "p_descricao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."quitar_crediario"("p_conta_id" "uuid", "p_descricao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."quitar_crediario_ao_concluir_pedido"() TO "anon";
GRANT ALL ON FUNCTION "public"."quitar_crediario_ao_concluir_pedido"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."quitar_crediario_ao_concluir_pedido"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalcular_crediario_conta"("p_conta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalcular_crediario_conta"("p_conta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalcular_crediario_conta"("p_conta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_crediario"("p_conta_id" "uuid", "p_valor" numeric, "p_descricao" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_pagamento_item_crediario"("p_movimento_id" "uuid", "p_itens_pagos" "jsonb", "p_forma_pagamento" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_item_crediario"("p_movimento_id" "uuid", "p_itens_pagos" "jsonb", "p_forma_pagamento" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pagamento_item_crediario"("p_movimento_id" "uuid", "p_itens_pagos" "jsonb", "p_forma_pagamento" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."salvar_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text", "p_tipo" character varying, "p_papel" character varying, "p_usuario_id" "uuid", "p_modulo_id" character varying, "p_permissoes" "jsonb", "p_ativo" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."salvar_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text", "p_tipo" character varying, "p_papel" character varying, "p_usuario_id" "uuid", "p_modulo_id" character varying, "p_permissoes" "jsonb", "p_ativo" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."salvar_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text", "p_tipo" character varying, "p_papel" character varying, "p_usuario_id" "uuid", "p_modulo_id" character varying, "p_permissoes" "jsonb", "p_ativo" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."salvar_controle_acesso"("p_nome_usuario" character varying, "p_senha" "text", "p_tipo" character varying, "p_papel" character varying, "p_usuario_id" "uuid", "p_modulo_id" character varying, "p_permissoes" "jsonb", "p_ativo" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sincronizar_itens_pedido_crediario"() TO "anon";
GRANT ALL ON FUNCTION "public"."sincronizar_itens_pedido_crediario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sincronizar_itens_pedido_crediario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sincronizar_pedido_crediario"() TO "anon";
GRANT ALL ON FUNCTION "public"."sincronizar_pedido_crediario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sincronizar_pedido_crediario"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sincronizar_total_usos_cupom"() TO "anon";
GRANT ALL ON FUNCTION "public"."sincronizar_total_usos_cupom"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sincronizar_total_usos_cupom"() TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_itens_pedido_crediario"("p_pedido_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_itens_pedido_crediario"("p_pedido_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_itens_pedido_crediario"("p_pedido_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_item_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_item_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_item_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_pedido_caixa_em_tempo_real"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_pedido_caixa_em_tempo_real"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_pedido_caixa_em_tempo_real"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_crediario_conta"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_crediario_conta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_crediario_conta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_usuarios_cliente_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_usuarios_cliente_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_usuarios_cliente_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_whatsapp_conversations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_whatsapp_conversations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_whatsapp_conversations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_whatsapp_customer_memory_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_whatsapp_customer_memory_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_whatsapp_customer_memory_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_whatsapp_order_drafts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_whatsapp_order_drafts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_whatsapp_order_drafts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_mesas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_mesas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_mesas_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_senha_usuario"("p_nome_usuario" character varying, "p_senha" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vincular_pedido_usuario_cliente"() TO "anon";
GRANT ALL ON FUNCTION "public"."vincular_pedido_usuario_cliente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."vincular_pedido_usuario_cliente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."adicionais" TO "anon";
GRANT ALL ON TABLE "public"."adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."admin_sidebar_config" TO "anon";
GRANT ALL ON TABLE "public"."admin_sidebar_config" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_sidebar_config" TO "service_role";



GRANT ALL ON TABLE "public"."anotacoes_painel" TO "anon";
GRANT ALL ON TABLE "public"."anotacoes_painel" TO "authenticated";
GRANT ALL ON TABLE "public"."anotacoes_painel" TO "service_role";



GRANT ALL ON TABLE "public"."atividade_garcom" TO "anon";
GRANT ALL ON TABLE "public"."atividade_garcom" TO "authenticated";
GRANT ALL ON TABLE "public"."atividade_garcom" TO "service_role";



GRANT ALL ON TABLE "public"."bairros" TO "anon";
GRANT ALL ON TABLE "public"."bairros" TO "authenticated";
GRANT ALL ON TABLE "public"."bairros" TO "service_role";



GRANT ALL ON TABLE "public"."bebidas" TO "anon";
GRANT ALL ON TABLE "public"."bebidas" TO "authenticated";
GRANT ALL ON TABLE "public"."bebidas" TO "service_role";



GRANT ALL ON TABLE "public"."caixa_automacao_config" TO "anon";
GRANT ALL ON TABLE "public"."caixa_automacao_config" TO "authenticated";
GRANT ALL ON TABLE "public"."caixa_automacao_config" TO "service_role";



GRANT ALL ON TABLE "public"."caixas" TO "anon";
GRANT ALL ON TABLE "public"."caixas" TO "authenticated";
GRANT ALL ON TABLE "public"."caixas" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."categorias_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_caixa" TO "anon";
GRANT ALL ON TABLE "public"."categorias_caixa" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_caixa" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_cardapio" TO "anon";
GRANT ALL ON TABLE "public"."categorias_cardapio" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_cardapio" TO "service_role";



GRANT ALL ON TABLE "public"."combo_itens" TO "anon";
GRANT ALL ON TABLE "public"."combo_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."combo_itens" TO "service_role";



GRANT ALL ON TABLE "public"."combos" TO "anon";
GRANT ALL ON TABLE "public"."combos" TO "authenticated";
GRANT ALL ON TABLE "public"."combos" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_loja" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_loja" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_loja" TO "service_role";



GRANT ALL ON TABLE "public"."crediario_contas" TO "anon";
GRANT ALL ON TABLE "public"."crediario_contas" TO "authenticated";
GRANT ALL ON TABLE "public"."crediario_contas" TO "service_role";



GRANT ALL ON TABLE "public"."crediario_movimentos" TO "anon";
GRANT ALL ON TABLE "public"."crediario_movimentos" TO "authenticated";
GRANT ALL ON TABLE "public"."crediario_movimentos" TO "service_role";



GRANT ALL ON TABLE "public"."cupons" TO "anon";
GRANT ALL ON TABLE "public"."cupons" TO "authenticated";
GRANT ALL ON TABLE "public"."cupons" TO "service_role";



GRANT ALL ON TABLE "public"."cupons_usos" TO "anon";
GRANT ALL ON TABLE "public"."cupons_usos" TO "authenticated";
GRANT ALL ON TABLE "public"."cupons_usos" TO "service_role";



GRANT ALL ON TABLE "public"."entregas" TO "anon";
GRANT ALL ON TABLE "public"."entregas" TO "authenticated";
GRANT ALL ON TABLE "public"."entregas" TO "service_role";



GRANT ALL ON TABLE "public"."fila_impressao" TO "anon";
GRANT ALL ON TABLE "public"."fila_impressao" TO "authenticated";
GRANT ALL ON TABLE "public"."fila_impressao" TO "service_role";



GRANT ALL ON TABLE "public"."financas_diarias" TO "anon";
GRANT ALL ON TABLE "public"."financas_diarias" TO "authenticated";
GRANT ALL ON TABLE "public"."financas_diarias" TO "service_role";



GRANT ALL ON TABLE "public"."formas_pagamento" TO "anon";
GRANT ALL ON TABLE "public"."formas_pagamento" TO "authenticated";
GRANT ALL ON TABLE "public"."formas_pagamento" TO "service_role";



GRANT ALL ON TABLE "public"."funcionarios" TO "anon";
GRANT ALL ON TABLE "public"."funcionarios" TO "authenticated";
GRANT ALL ON TABLE "public"."funcionarios" TO "service_role";



GRANT ALL ON TABLE "public"."historico_caixas" TO "anon";
GRANT ALL ON TABLE "public"."historico_caixas" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_caixas" TO "service_role";



GRANT ALL ON TABLE "public"."historico_entregas" TO "anon";
GRANT ALL ON TABLE "public"."historico_entregas" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_entregas" TO "service_role";



GRANT ALL ON TABLE "public"."historico_item_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."historico_item_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_item_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."historico_itens_pedido" TO "anon";
GRANT ALL ON TABLE "public"."historico_itens_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_itens_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."historico_movimentacoes_caixa" TO "anon";
GRANT ALL ON TABLE "public"."historico_movimentacoes_caixa" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_movimentacoes_caixa" TO "service_role";



GRANT ALL ON TABLE "public"."historico_pedidos" TO "anon";
GRANT ALL ON TABLE "public"."historico_pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_pedidos" TO "service_role";



GRANT ALL ON TABLE "public"."item_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."item_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."item_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."itens_pedido" TO "anon";
GRANT ALL ON TABLE "public"."itens_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."manutencao_modulos" TO "service_role";



GRANT ALL ON TABLE "public"."mesas" TO "anon";
GRANT ALL ON TABLE "public"."mesas" TO "authenticated";
GRANT ALL ON TABLE "public"."mesas" TO "service_role";



GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "anon";
GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "authenticated";
GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_entregadores" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_entregadores" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_entregadores" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_online" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_online" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_online" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_pedido" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos" TO "anon";
GRANT ALL ON TABLE "public"."pedidos" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos" TO "service_role";



GRANT ALL ON TABLE "public"."permissoes_papel" TO "service_role";



GRANT ALL ON TABLE "public"."permissoes_usuario" TO "service_role";



GRANT ALL ON TABLE "public"."produtividade_config" TO "service_role";



GRANT ALL ON TABLE "public"."produto_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."produto_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."produto_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "anon";
GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."resumo_anual" TO "anon";
GRANT ALL ON TABLE "public"."resumo_anual" TO "authenticated";
GRANT ALL ON TABLE "public"."resumo_anual" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_cliente" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_sistema" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_sistema" TO "service_role";



GRANT ALL ON TABLE "public"."vw_crediario_contas_resumo" TO "anon";
GRANT ALL ON TABLE "public"."vw_crediario_contas_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_crediario_contas_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."vw_usuarios_cliente_metricas" TO "anon";
GRANT ALL ON TABLE "public"."vw_usuarios_cliente_metricas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_usuarios_cliente_metricas" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_conversations" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_customer_memory" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_customer_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_customer_memory" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_messages" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_order_drafts" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_order_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_order_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_order_notifications" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_order_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_order_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_outbox" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_product_aliases" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_product_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_product_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_product_lookup_misses" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_product_lookup_misses" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_product_lookup_misses" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_session" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_session" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_session" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































