/*
  # Create tipos_equipamento table

  1. New Tables
    - `tipos_equipamento` - equipment type catalog
  2. Security
    - RLS enabled, authenticated CRUD
  3. Seed Data
    - Pre-populate with default types
*/

CREATE TABLE IF NOT EXISTS tipos_equipamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE tipos_equipamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read tipos_equipamento" ON tipos_equipamento;
CREATE POLICY "Authenticated users can read tipos_equipamento"
  ON tipos_equipamento FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert tipos_equipamento" ON tipos_equipamento;
CREATE POLICY "Authenticated users can insert tipos_equipamento"
  ON tipos_equipamento FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update tipos_equipamento" ON tipos_equipamento;
CREATE POLICY "Authenticated users can update tipos_equipamento"
  ON tipos_equipamento FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete tipos_equipamento" ON tipos_equipamento;
CREATE POLICY "Authenticated users can delete tipos_equipamento"
  ON tipos_equipamento FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO tipos_equipamento (nome) VALUES
  ('smartphone'),
  ('tablet'),
  ('notebook'),
  ('desktop'),
  ('impressora'),
  ('monitor'),
  ('outros')
ON CONFLICT (nome) DO NOTHING;