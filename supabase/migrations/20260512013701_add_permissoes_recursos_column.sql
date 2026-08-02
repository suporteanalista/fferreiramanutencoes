/*
  # Add granular permission control per resource

  1. Changes to `profiles` table
    - Add `permissoes_recursos` (jsonb) column for granular per-resource permissions
    - Stores an object with resource keys (clientes, equipamentos, tecnicos, produtos, ordens, relatorios)
    - Each resource has actions: ver (view), criar (create), editar (edit), excluir (delete)
    - Default value gives full access (used for administrador/operador defaults)
    - Update CHECK constraint on `permissao` to include 'operador' alongside 'vendedor'

  2. Security
    - Existing RLS policies remain in place
    - The permissoes_recursos column is protected by existing profile update policies

  3. Notes
    - Administrador always has full access regardless of this column
    - Visualizador always has read-only regardless of this column
    - Operador (formerly vendedor) uses this column for granular control
    - Keeping 'vendedor' as valid value for backwards compatibility
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

-- Update the CHECK constraint to also accept 'operador'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_permissao_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_permissao_check
  CHECK (permissao IN ('administrador', 'vendedor', 'operador', 'visualizador'));
