
-- ============ FORNECEDORES ============
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  tempo_entrega_dias INTEGER NOT NULL DEFAULT 3 CHECK (tempo_entrega_dias >= 0),
  endereco TEXT,
  cnpj TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Inativo')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users full access fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MATERIAIS: novas colunas ============
ALTER TABLE public.materiais
  ADD COLUMN fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (preco_unitario >= 0);

-- ============ PEDIDOS DE COMPRA ============
CREATE SEQUENCE IF NOT EXISTS public.pedidos_compra_numero_seq START 1;

CREATE TABLE public.pedidos_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL UNIQUE DEFAULT nextval('public.pedidos_compra_numero_seq'),
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Confirmado','Em Trânsito','Entregue')),
  data_pedido TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_entrega_prevista DATE,
  frete NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (frete >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  observacoes TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entregue_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra TO authenticated;
GRANT ALL ON public.pedidos_compra TO service_role;
GRANT USAGE ON SEQUENCE public.pedidos_compra_numero_seq TO authenticated, service_role;
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users full access pedidos" ON public.pedidos_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_pedidos_compra_updated BEFORE UPDATE ON public.pedidos_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pedidos_compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(12,2) NOT NULL CHECK (preco_unitario >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra_itens TO authenticated;
GRANT ALL ON public.pedidos_compra_itens TO service_role;
ALTER TABLE public.pedidos_compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users full access pedidos_itens" ON public.pedidos_compra_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_pedidos_itens_pedido ON public.pedidos_compra_itens(pedido_id);

-- ============ FUNÇÃO: entregar pedido ============
CREATE OR REPLACE FUNCTION public.entregar_pedido(p_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_item RECORD;
BEGIN
  SELECT status INTO v_status FROM public.pedidos_compra WHERE id = p_pedido_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_status = 'Entregue' THEN RAISE EXCEPTION 'Pedido já entregue'; END IF;

  FOR v_item IN SELECT * FROM public.pedidos_compra_itens WHERE pedido_id = p_pedido_id LOOP
    UPDATE public.materiais
      SET quantidade_disponivel = quantidade_disponivel + v_item.quantidade,
          updated_at = now()
      WHERE id = v_item.material_id;
    INSERT INTO public.movimentacoes (material_id, tipo, quantidade, usuario_id, observacao)
      VALUES (v_item.material_id, 'entrada', v_item.quantidade, auth.uid(),
              'Entrada por pedido de compra');
  END LOOP;

  UPDATE public.pedidos_compra
    SET status = 'Entregue', entregue_em = now(), updated_at = now()
    WHERE id = p_pedido_id;
END;
$$;
