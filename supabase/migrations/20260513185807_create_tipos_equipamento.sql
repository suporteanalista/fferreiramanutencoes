/*
  # Create tipos_equipamento table

  1. New Tables
    - `tipos_equipamento`
      - `id` (uuid, primary key)
      - `nome` (text, unique, not null) - the equipment type name
      - `criado_em` (timestamptz) - creation timestamp

  2. Security
    - Enable RLS on `tipos_equipamento` table
    - Add policy for authenticated users to read all types
    - Add policy for authenticated users to insert new types
    - Add policy for authenticated users to update types
    - Add policy for authenticated users to delete types

  3. Seed Data
    - Pre-populate with existing default types: smartphone, tablet, notebook, desktop, impressora, monitor, outros
*/

CREATE TABLE IF NOT EXISTS tipos_equipamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE tipos_equipamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tipos_equipamento"
  ON tipos_equipamento
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tipos_equipamento"
  ON tipos_equipamento
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tipos_equipamento"
  ON tipos_equipamento
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete tipos_equipamento"
  ON tipos_equipamento
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

INSERT INTO tipos_equipamento (nome) VALUES
  ('smartphone'),
  ('tablet'),
  ('notebook'),
  ('desktop'),
  ('impressora'),
  ('monitor'),
  ('outros')
ON CONFLICT (nome) DO NOTHING;
