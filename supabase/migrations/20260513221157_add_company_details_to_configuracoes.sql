/*
  # Expand configuracoes table with full company details

  1. Modified Tables
    - `configuracoes`
      - `cnpj` (text) - CNPJ da empresa
      - `razao_social` (text) - Razao social completa
      - `email` (text) - Email de contato
      - `celular` (text) - Celular/WhatsApp
      - `bairro` (text) - Bairro do endereco
      - `cidade` (text) - Cidade
      - `estado` (text) - UF do estado
      - `cep` (text) - CEP
      - `inscricao_estadual` (text) - Inscricao estadual
      - `inscricao_municipal` (text) - Inscricao municipal
      - `responsavel` (text) - Nome do responsavel
      - `site` (text) - Website da empresa

  2. Security
    - No changes to existing RLS policies (table already has proper policies)

  3. Notes
    - All new columns are optional (nullable) with empty string defaults
    - Existing data is preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'cnpj') THEN
    ALTER TABLE configuracoes ADD COLUMN cnpj text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'razao_social') THEN
    ALTER TABLE configuracoes ADD COLUMN razao_social text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'email') THEN
    ALTER TABLE configuracoes ADD COLUMN email text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'celular') THEN
    ALTER TABLE configuracoes ADD COLUMN celular text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'bairro') THEN
    ALTER TABLE configuracoes ADD COLUMN bairro text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'cidade') THEN
    ALTER TABLE configuracoes ADD COLUMN cidade text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'estado') THEN
    ALTER TABLE configuracoes ADD COLUMN estado text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'cep') THEN
    ALTER TABLE configuracoes ADD COLUMN cep text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'inscricao_estadual') THEN
    ALTER TABLE configuracoes ADD COLUMN inscricao_estadual text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'inscricao_municipal') THEN
    ALTER TABLE configuracoes ADD COLUMN inscricao_municipal text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'responsavel') THEN
    ALTER TABLE configuracoes ADD COLUMN responsavel text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'site') THEN
    ALTER TABLE configuracoes ADD COLUMN site text DEFAULT '';
  END IF;
END $$;
