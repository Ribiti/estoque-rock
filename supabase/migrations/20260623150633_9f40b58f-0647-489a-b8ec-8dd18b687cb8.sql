
CREATE TYPE public.movimentacao_tipo AS ENUM ('entrada', 'saida_obra', 'retorno_obra', 'ajuste');

CREATE TABLE public.movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  tipo public.movimentacao_tipo NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  observacao TEXT,
  usuario_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_movimentacoes_material ON public.movimentacoes(material_id);
CREATE INDEX idx_movimentacoes_obra ON public.movimentacoes(obra_id);
CREATE INDEX idx_movimentacoes_created_at ON public.movimentacoes(created_at DESC);

GRANT SELECT, INSERT ON public.movimentacoes TO authenticated;
GRANT ALL ON public.movimentacoes TO service_role;

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view movimentacoes" ON public.movimentacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert movimentacoes" ON public.movimentacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Update alocar_material to also log movement
CREATE OR REPLACE FUNCTION public.alocar_material(p_obra_id uuid, p_material_id uuid, p_quantidade integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.movimentacoes (material_id, obra_id, tipo, quantidade, usuario_id, observacao)
    VALUES (p_material_id, p_obra_id, 'saida_obra', p_quantidade, auth.uid(), 'Envio para obra');

  RETURN v_alocacao_id;
END;
$function$;
