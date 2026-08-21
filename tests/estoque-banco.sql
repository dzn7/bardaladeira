-- Executar somente em banco local/efemero depois da migration de estoque.
-- Toda a prova funcional roda em uma transacao e termina em ROLLBACK.
begin;

do $$
declare
  v_produto uuid := pg_catalog.gen_random_uuid();
  v_pedido uuid := pg_catalog.gen_random_uuid();
  v_item uuid;
  v_quantidade integer;
  v_consumida integer;
begin
  insert into public.produtos (
    id, nome, preco, categoria, estoque_quantidade, estoque_minimo,
    bloquear_venda_sem_estoque
  ) values (v_produto, 'Produto teste estoque', 10, 'Teste', 2, 1, true);

  insert into public.pedidos (
    id, numero_pedido, nome_cliente, tipo_entrega, subtotal, total, status
  ) values (v_pedido, 2147483000, 'Teste estoque', 'retirada', 20, 20, 'preparando');

  insert into public.itens_pedido (
    pedido_id, produto_id, nome_item, quantidade, preco_unitario, subtotal
  ) values (v_pedido, v_produto, 'Produto teste estoque', 2, 10, 20)
  returning id, estoque_quantidade_consumida into v_item, v_consumida;

  if v_consumida <> 2 then raise exception 'reserva inicial incorreta'; end if;
  select estoque_quantidade into v_quantidade from public.produtos where id = v_produto;
  if v_quantidade <> 0 then raise exception 'saldo apos reserva incorreto'; end if;

  begin
    insert into public.itens_pedido (
      pedido_id, produto_id, nome_item, quantidade, preco_unitario, subtotal
    ) values (v_pedido, v_produto, 'Deve falhar', 1, 10, 10);
    raise exception 'reserva acima do saldo deveria falhar';
  exception
    when sqlstate 'P0001' then
      if position('ESTOQUE_INSUFICIENTE' in sqlerrm) = 0 then raise; end if;
  end;

  delete from public.itens_pedido where id = v_item;
  select estoque_quantidade into v_quantidade from public.produtos where id = v_produto;
  if v_quantidade <> 2 then raise exception 'delete nao restaurou consumo exato'; end if;

  update public.produtos
  set bloquear_venda_sem_estoque = false
  where id = v_produto;
  insert into public.itens_pedido (
    pedido_id, produto_id, nome_item, quantidade, preco_unitario, subtotal
  ) values (v_pedido, v_produto, 'Consumo parcial', 3, 10, 30)
  returning id, estoque_quantidade_consumida into v_item, v_consumida;
  if v_consumida <> 2 then raise exception 'consumo parcial incorreto'; end if;

  update public.itens_pedido set quantidade = 1, subtotal = 10 where id = v_item;
  select estoque_quantidade_consumida into v_consumida
  from public.itens_pedido where id = v_item;
  select estoque_quantidade into v_quantidade from public.produtos where id = v_produto;
  if v_consumida <> 1 or v_quantidade <> 1 then
    raise exception 'update nao restaurou e reservou corretamente';
  end if;

  update public.pedidos set status = 'cancelado' where id = v_pedido;
  select estoque_quantidade into v_quantidade from public.produtos where id = v_produto;
  if v_quantidade <> 2 then raise exception 'cancelamento nao restaurou estoque'; end if;

  update public.pedidos set status = 'confirmado' where id = v_pedido;
  select estoque_quantidade into v_quantidade from public.produtos where id = v_produto;
  if v_quantidade <> 1 then raise exception 'reabertura nao reservou estoque'; end if;

  if public.ajustar_estoque_produto(v_produto, 2) <> 3 then
    raise exception 'rpc delta retornou valor incorreto';
  end if;
  if public.definir_estoque_produto(v_produto, 0) <> 0 then
    raise exception 'rpc absoluta nao preservou zero';
  end if;

  begin
    perform public.definir_estoque_produto(v_produto, -1);
    raise exception 'rpc absoluta deveria rejeitar negativo';
  exception when sqlstate '22023' then null;
  end;

  begin
    update public.produtos set estoque_quantidade = -1 where id = v_produto;
    raise exception 'constraint deveria rejeitar estoque negativo';
  exception when check_violation then null;
  end;

  begin
    update public.itens_pedido
    set estoque_quantidade_consumida = quantidade + 1
    where id = v_item;
    raise exception 'constraint deveria rejeitar consumo acima da quantidade';
  exception when check_violation then null;
  end;

  if not pg_catalog.has_function_privilege(
    'anon', 'public.ajustar_estoque_produto(uuid,integer)', 'EXECUTE'
  ) then
    raise exception 'ACL anon ausente na rpc delta';
  end if;
end
$$;

rollback;

-- Prova concorrente exige duas conexoes: ambas devem inserir contra o mesmo
-- produto bloqueado com saldo 1. A primeira confirma; a segunda espera o lock e
-- falha com ESTOQUE_INSUFICIENTE depois do commit da primeira. Nao automatizar
-- com extensoes como dblink/pg_background no schema de producao.
