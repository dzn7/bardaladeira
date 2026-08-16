INSERT INTO public.categorias_cardapio (nome, tipo, ativo, ordem)
VALUES
  ('Águas', 'bebida', true, 5),
  ('Refrigerantes', 'bebida', true, 6),
  ('Alcoólicas', 'bebida', true, 7)
ON CONFLICT (nome, tipo) DO UPDATE
SET
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = timezone('utc', now());

DELETE FROM public.bebidas
WHERE nome IN (
  'Água de coco',
  'Água mineral',
  '51 Ice limão',
  'Cajuína',
  'Coca-Cola lata',
  'Coca-Cola 1L',
  'Guaraná Antarctica lata',
  'Guaraná Antarctica 1L',
  'Guaraná Antarctica 2L',
  'Cerveja Antarctica',
  'Cerveja Skol',
  'Cerveja Stella Artois'
);

INSERT INTO public.bebidas (
  nome,
  descricao,
  preco,
  categoria,
  imagem_url,
  disponivel,
  ordem,
  tamanho
)
VALUES
  ('Água de coco', NULL, 6.00, 'Águas', NULL, true, 1, NULL),
  ('Água mineral', NULL, 3.00, 'Águas', NULL, true, 2, NULL),
  ('51 Ice limão', NULL, 10.00, 'Alcoólicas', NULL, true, 3, NULL),
  ('Cajuína', NULL, 10.00, 'Refrigerantes', NULL, true, 4, NULL),
  ('Coca-Cola lata', NULL, 5.00, 'Refrigerantes', NULL, true, 5, 'Lata'),
  ('Coca-Cola 1L', NULL, 14.00, 'Refrigerantes', NULL, true, 6, '1L'),
  ('Guaraná Antarctica lata', NULL, 5.00, 'Refrigerantes', NULL, true, 7, 'Lata'),
  ('Guaraná Antarctica 1L', NULL, 7.00, 'Refrigerantes', NULL, true, 8, '1L'),
  ('Guaraná Antarctica 2L', NULL, 12.00, 'Refrigerantes', NULL, true, 9, '2L'),
  ('Cerveja Antarctica', NULL, 10.00, 'Alcoólicas', NULL, true, 10, NULL),
  ('Cerveja Skol', NULL, 10.00, 'Alcoólicas', NULL, true, 11, NULL),
  ('Cerveja Stella Artois', NULL, 12.00, 'Alcoólicas', NULL, true, 12, NULL);

INSERT INTO public.configuracoes_loja (chave, valor, tipo, descricao)
VALUES
  (
    'ordem_categorias_produtos',
    '["Porções","Pratos","Carnes","Camarões e peixes","Águas","Refrigerantes","Alcoólicas"]',
    'json',
    'Ordem manual das categorias exibidas no cardápio público.'
  )
ON CONFLICT (chave) DO UPDATE
SET
  valor = EXCLUDED.valor,
  tipo = EXCLUDED.tipo,
  descricao = EXCLUDED.descricao,
  updated_at = timezone('utc', now());
