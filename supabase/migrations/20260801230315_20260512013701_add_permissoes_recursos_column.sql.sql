/*
  # Add granular permission control per resource

  1. Changes to `profiles` table
    - Add `permissoes_recursos` (jsonb) column for granular per-resource permissions
    - Update CHECK constraint on `permissao` to include 'operador'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'permissoes_recursos'
  ) THEN
    ALTER TABLE profiles ADD COLUMN permissoes_recursos jsonb DEFAULT '{
      "dashboard": {"ver": true},
      "ordens": {"ver": true, "criar": true, "editar": true, "excluir": true},
      "clientes": {"ver": true, "criar": true, "editar": true, "excluir": true},
      "equipamentos": {"ver": true, "criar": true, "editar": true, "excluir": true},
      "tecnicos": {"ver": true, "criar": true, "editar": true, "excluir": true},
      "produtos": {"ver": true, "criar": true, "editar": true, "excluir": true},
      "relatorios": {"ver": true}
    }'::jsonb;
  END IF;
END $$;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_permissao_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_permissao_check
  CHECK (permissao IN ('administrador', 'vendedor', 'operador', 'visualizador'));