/*
  # Fix security advisor warnings

  1. os_servicos RLS policies - replace permissive policies with role-based checks
  2. handle_new_user - set fixed search_path, revoke EXECUTE from anon/authenticated
*/

DROP POLICY IF EXISTS "select_os_servicos" ON os_servicos;
DROP POLICY IF EXISTS "insert_os_servicos" ON os_servicos;
DROP POLICY IF EXISTS "update_os_servicos" ON os_servicos;
DROP POLICY IF EXISTS "delete_os_servicos" ON os_servicos;

CREATE POLICY "select_os_servicos" ON os_servicos FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_os_servicos" ON os_servicos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

CREATE POLICY "update_os_servicos" ON os_servicos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

CREATE POLICY "delete_os_servicos" ON os_servicos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, permissao, permissoes_recursos)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'permissao', 'visualizador'),
    CASE
      WHEN NEW.raw_user_meta_data->'permissoes_recursos' IS NOT NULL
      THEN (NEW.raw_user_meta_data->'permissoes_recursos')::jsonb
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;