
-- Remove políticas permissivas existentes
DROP POLICY IF EXISTS "Public access materiais" ON public.materiais;
DROP POLICY IF EXISTS "Public access obras" ON public.obras;
DROP POLICY IF EXISTS "Public access alocacoes" ON public.alocacoes;

-- Revoga acesso anônimo
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.materiais FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.obras FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.alocacoes FROM anon;

-- Garante grant para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alocacoes TO authenticated;

-- Políticas restritas a usuários autenticados
CREATE POLICY "Authenticated can view materiais" ON public.materiais
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert materiais" ON public.materiais
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update materiais" ON public.materiais
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete materiais" ON public.materiais
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view obras" ON public.obras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert obras" ON public.obras
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update obras" ON public.obras
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete obras" ON public.obras
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view alocacoes" ON public.alocacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert alocacoes" ON public.alocacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update alocacoes" ON public.alocacoes
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete alocacoes" ON public.alocacoes
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
