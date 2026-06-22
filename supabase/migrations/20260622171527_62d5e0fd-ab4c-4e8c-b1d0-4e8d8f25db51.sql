
CREATE TABLE public.materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade_disponivel INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa','Concluída')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.alocacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  data_alocacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alocacoes_obra ON public.alocacoes(obra_id);
CREATE INDEX idx_alocacoes_material ON public.alocacoes(material_id);
CREATE INDEX idx_materiais_categoria ON public.materiais(categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO anon, authenticated;
GRANT ALL ON public.materiais TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO anon, authenticated;
GRANT ALL ON public.obras TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alocacoes TO anon, authenticated;
GRANT ALL ON public.alocacoes TO service_role;

ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alocacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access materiais" ON public.materiais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access obras" ON public.obras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access alocacoes" ON public.alocacoes FOR ALL USING (true) WITH CHECK (true);

-- Função RPC para alocar material atomicamente
CREATE OR REPLACE FUNCTION public.alocar_material(
  p_obra_id UUID,
  p_material_id UUID,
  p_quantidade INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_disponivel INTEGER;
  v_alocacao_id UUID;
BEGIN
  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  SELECT quantidade_disponivel INTO v_disponivel
  FROM public.materiais WHERE id = p_material_id FOR UPDATE;

  IF v_disponivel IS NULL THEN
    RAISE EXCEPTION 'Material não encontrado';
  END IF;

  IF v_disponivel < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: %', v_disponivel;
  END IF;

  UPDATE public.materiais
    SET quantidade_disponivel = quantidade_disponivel - p_quantidade,
        updated_at = now()
    WHERE id = p_material_id;

  INSERT INTO public.alocacoes (obra_id, material_id, quantidade)
    VALUES (p_obra_id, p_material_id, p_quantidade)
    RETURNING id INTO v_alocacao_id;

  RETURN v_alocacao_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.alocar_material(UUID, UUID, INTEGER) TO anon, authenticated;
