INSERT INTO public.categorias_cardapio (nome, tipo, ativo, ordem)
VALUES
  ('Porções', 'produto', true, 1),
  ('Pratos', 'produto', true, 2),
  ('Carnes', 'produto', true, 3),
  ('Camarões e peixes', 'produto', true, 4)
ON CONFLICT (nome, tipo) DO UPDATE
SET
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = timezone('utc', now());

DELETE FROM public.produtos
WHERE nome IN (
  'Creme de galinha',
  'Espetinho simples',
  'Panelada',
  'Arrumadinho',
  'Batata frita – 200g',
  '6 mini pastéis',
  'Carne mista – 400g',
  'Carne de sol trinchada – 300g',
  'Camarão médio – 200g',
  'Camarão grande – 400g',
  'Peixe (tilápia ou tambaqui)',
  'Picanha nacional – 400g',
  'Picanha argentina – 400g'
);

INSERT INTO public.produtos (
  nome,
  descricao,
  preco,
  categoria,
  imagem_url,
  disponivel,
  destaque,
  ordem
)
VALUES
  ('Creme de galinha', NULL, 5.00, 'Porções', NULL, true, false, 1),
  ('Espetinho simples', 'Frango e porco. Acompanha farofa.', 12.00, 'Porções', NULL, true, false, 2),
  ('Panelada', 'Acompanha farofa e limão.', 20.00, 'Pratos', NULL, true, false, 3),
  ('Arrumadinho', 'Acompanha salada, farofa e arroz.', 22.00, 'Pratos', NULL, true, false, 4),
  ('Batata frita – 200g', NULL, 10.00, 'Porções', NULL, true, false, 5),
  ('6 mini pastéis', NULL, 8.00, 'Porções', NULL, true, false, 6),
  ('Carne mista – 400g', 'Carne e toscana. Acompanha farofa e batata frita.', 45.00, 'Carnes', NULL, true, false, 7),
  ('Carne de sol trinchada – 300g', 'Acompanha farofa, vinagrete e macaxeira.', 35.00, 'Carnes', NULL, true, false, 8),
  ('Camarão médio – 200g', 'Ao alho e óleo. Acompanha farofa e vinagrete.', 25.00, 'Camarões e peixes', NULL, true, false, 9),
  ('Camarão grande – 400g', 'Ao alho e óleo. Acompanha farofa e vinagrete.', 30.00, 'Camarões e peixes', NULL, true, false, 10),
  ('Peixe (tilápia ou tambaqui)', 'Acompanha arroz, farofa, vinagrete e batata frita.', 50.00, 'Camarões e peixes', NULL, true, false, 11),
  ('Picanha nacional – 400g', 'Acompanha arroz, farofa, vinagrete e macaxeira frita.', 80.00, 'Carnes', NULL, true, false, 12),
  ('Picanha argentina – 400g', 'Acompanha arroz, vinagrete e macaxeira frita.', 90.00, 'Carnes', NULL, true, false, 13);

INSERT INTO public.configuracoes_loja (chave, valor, tipo, descricao)
VALUES
  (
    'ordenacao_produtos_site',
    'manual',
    'string',
    'Ordenação do cardápio público.'
  ),
  (
    'ordem_categorias_produtos',
    '["Porções","Pratos","Carnes","Camarões e peixes"]',
    'json',
    'Ordem manual das categorias exibidas no cardápio público.'
  )
ON CONFLICT (chave) DO UPDATE
SET
  valor = EXCLUDED.valor,
  tipo = EXCLUDED.tipo,
  descricao = EXCLUDED.descricao,
  updated_at = timezone('utc', now());
