-- Teste transacional. Execute após aplicar a migration; sempre termina em rollback.
begin;

do $$
declare
  v_produto uuid := gen_random_uuid();
  v_pedido uuid := gen_random_uuid();
  v_pedido_online uuid := gen_random_uuid();
  v_item_antigo uuid;
  v_item_novo uuid;
  v_movimento uuid;
  v_notificacao uuid;
  v_custo numeric;
  v_quantidade integer;
  v_total integer;
  v_nao_lidas integer;
  v_lucro numeric;
  v_receita_sem_custo numeric;
begin
  insert into public.produtos (
    id, nome, preco, categoria, custo_unitario,
    estoque_quantidade, estoque_minimo, bloquear_venda_sem_estoque
  ) values (
    v_produto, '__teste financeiro notificacoes__', 25, '__teste__', 10,
    2, 5, false
  );

  select count(*) into v_total
  from public.notificacoes_admin
  where chave_dedupe = 'estoque_baixo:' || v_produto::text and estado = 'ativa';
  if v_total <> 1 then
    raise exception 'estoque baixo deveria gerar exatamente uma ocorrência ativa';
  end if;

  update public.produtos set estoque_quantidade = 1 where id = v_produto;
  select count(*) into v_total
  from public.notificacoes_admin
  where chave_dedupe = 'estoque_baixo:' || v_produto::text and estado = 'ativa';
  if v_total <> 1 then
    raise exception 'condição contínua duplicou notificação';
  end if;

  update public.produtos set estoque_quantidade = 0 where id = v_produto;
  if not exists (
    select 1 from public.notificacoes_admin
    where chave_dedupe = 'estoque_baixo:' || v_produto::text and estado = 'resolvida'
  ) or not exists (
    select 1 from public.notificacoes_admin
    where chave_dedupe = 'estoque_esgotado:' || v_produto::text
      and estado = 'ativa' and prioridade = 'urgente'
  ) then
    raise exception 'troca de baixo para esgotado não resolveu/criou corretamente';
  end if;

  update public.produtos set estoque_quantidade = 10 where id = v_produto;
  if exists (
    select 1 from public.notificacoes_admin
    where entidade_id = v_produto and estado = 'ativa'
  ) then
    raise exception 'reposição não resolveu a ocorrência';
  end if;

  update public.produtos set estoque_quantidade = 2 where id = v_produto;
  select count(*) into v_total
  from public.notificacoes_admin
  where chave_dedupe = 'estoque_baixo:' || v_produto::text;
  if v_total <> 2 then
    raise exception 'reincidência deveria criar uma nova ocorrência';
  end if;

  select id into v_notificacao
  from public.notificacoes_admin
  where chave_dedupe = 'estoque_baixo:' || v_produto::text and estado = 'ativa';

  select r.total, r.nao_lidas into v_total, v_nao_lidas
  from public.resumo_notificacoes_admin('__teste__') r;
  if v_total < 1 or v_nao_lidas < 1 then
    raise exception 'badge não contou a ocorrência não lida';
  end if;

  insert into public.notificacoes_admin_leituras (
    notificacao_id, usuario_chave, apresentada_em, lida_em
  ) values (v_notificacao, '__teste__', now(), now());

  select r.nao_lidas into v_nao_lidas
  from public.resumo_notificacoes_admin('__teste__') r;
  if v_nao_lidas <> v_total - 1 then
    raise exception 'marcação de leitura não atualizou o resumo';
  end if;

  perform public.marcar_todas_notificacoes_admin_lidas('__teste__');
  select r.nao_lidas into v_nao_lidas
  from public.resumo_notificacoes_admin('__teste__') r;
  if v_nao_lidas <> 0 then
    raise exception 'marcar todas deixou % ocorrências não lidas', v_nao_lidas;
  end if;

  insert into public.notificacoes_admin_preferencias (usuario_chave, mostrar_modal_entrada)
  values ('__teste__', false);
  if not exists (
    select 1 from public.notificacoes_admin_preferencias
    where usuario_chave = '__teste__' and mostrar_modal_entrada = false
  ) then
    raise exception 'preferência do modal não persistiu';
  end if;

  insert into public.pedidos (
    id, numero_pedido, nome_cliente, tipo_entrega,
    subtotal, total, status, created_at
  ) values (
    v_pedido, 2147483000, '__teste__', 'retirada',
    42, 42, 'confirmado', now()
  );

  if not exists (
    select 1 from public.notificacoes_admin
    where chave_dedupe = 'pedido_novo:' || v_pedido::text
      and estado = 'ativa' and prioridade = 'normal'
  ) then
    raise exception 'pedido novo não gerou notificação normal';
  end if;

  insert into public.itens_pedido (
    pedido_id, produto_id, nome_item, quantidade,
    preco_unitario, subtotal, custo_unitario
  ) values (
    v_pedido, v_produto, '__teste__', 1,
    25, 25, 999
  ) returning id into v_item_antigo;
  select custo_unitario into v_custo
  from public.custos_itens_pedido_admin where item_pedido_id = v_item_antigo;
  if v_custo <> 10 then
    raise exception 'snapshot aceitou custo do cliente em vez do catálogo: %', v_custo;
  end if;

  update public.produtos set custo_unitario = 15 where id = v_produto;
  select custo_unitario into v_custo
  from public.custos_itens_pedido_admin where item_pedido_id = v_item_antigo;
  if v_custo <> 10 then
    raise exception 'mudança futura de custo corrompeu item histórico';
  end if;

  insert into public.itens_pedido (
    pedido_id, produto_id, nome_item, quantidade, preco_unitario, subtotal
  ) values (
    v_pedido, v_produto, '__teste__', 1, 17, 17
  ) returning id into v_item_novo;
  select custo_unitario into v_custo
  from public.custos_itens_pedido_admin where item_pedido_id = v_item_novo;
  if v_custo <> 15 then
    raise exception 'nova venda não recebeu custo vigente';
  end if;

  insert into public.pedidos (
    id, numero_pedido, nome_cliente, tipo_entrega, subtotal, total,
    status, pagamento_online, pagamento_online_status, created_at
  ) values (
    v_pedido_online, 2147483001, '__teste online__', 'retirada', 100, 100,
    'confirmado', true, 'aguardando_pagamento', now()
  );
  insert into public.itens_pedido (
    pedido_id, produto_id, nome_item, quantidade, preco_unitario, subtotal
  ) values (
    v_pedido_online, v_produto, '__teste online__', 1, 100, 100
  );

  select sum(l.lucro_bruto), sum(l.receita_sem_custo)
    into v_lucro, v_receita_sem_custo
  from public.obter_lucro_produtos_admin(now() - interval '1 hour', now() + interval '1 hour') l
  where l.produto_id = v_produto;
  if v_lucro <> 17 or v_receita_sem_custo <> 0 then
    raise exception 'lucro bruto incluiu pagamento pendente ou calculou errado: lucro %, sem custo %', v_lucro, v_receita_sem_custo;
  end if;

  update public.pedidos set status = 'preparando' where id = v_pedido;
  if exists (
    select 1 from public.notificacoes_admin
    where chave_dedupe = 'pedido_novo:' || v_pedido::text and estado = 'ativa'
  ) then
    raise exception 'pedido atendido não resolveu a notificação';
  end if;

  insert into public.movimentacoes_caixa (tipo, valor, descricao)
  values ('saida', 10.01, '__teste__') returning id into v_movimento;
  update public.movimentacoes_caixa set valor = 12.34 where id = v_movimento;
  if not exists (
    select 1 from public.movimentacoes_caixa
    where id = v_movimento and tipo = 'saida' and valor = 12.34
  ) then
    raise exception 'edição de despesa falhou';
  end if;
  delete from public.movimentacoes_caixa where id = v_movimento;
  if exists (select 1 from public.movimentacoes_caixa where id = v_movimento) then
    raise exception 'exclusão de despesa falhou';
  end if;

  if has_table_privilege('anon', 'public.notificacoes_admin', 'SELECT') then
    raise exception 'anon não pode ler notificações';
  end if;
  if has_table_privilege('anon', 'public.custos_itens_pedido_admin', 'SELECT') then
    raise exception 'anon não pode ler snapshots de custo';
  end if;
  if has_function_privilege(
    'anon',
    'public.obter_lucro_produtos_admin(timestamptz,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'anon não pode executar lucro';
  end if;
end;
$$;

rollback;
