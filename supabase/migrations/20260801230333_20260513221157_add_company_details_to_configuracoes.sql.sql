/*
  # Expand configuracoes table with full company details

  Adds optional company fields: cnpj, razao_social, email, celular, bairro,
  cidade, estado, cep, inscricao_estadual, inscricao_municipal, responsavel, site.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'cnpj') THEN
    ALTER TABLE configuracoes ADD COLUMN cnpj text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'razao_social') THEN
    ALTER TABLE configuracoes ADD COLUMN razao_social text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'email') THEN
    ALTER TABLE configuracoes ADD COLUMN email text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'celular') THEN
    ALTER TABLE configuracoes ADD COLUMN celular text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'bairro') THEN
    ALTER TABLE configuracoes ADD COLUMN bairro text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'cidade') THEN
    ALTER TABLE configuracoes ADD COLUMN cidade text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'estado') THEN
    ALTER TABLE configuracoes ADD COLUMN estado text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'cep') THEN
    ALTER TABLE configuracoes ADD COLUMN cep text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'inscricao_estadual') THEN
    ALTER TABLE configuracoes ADD COLUMN inscricao_estadual text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'inscricao_municipal') THEN
    ALTER TABLE configuracoes ADD COLUMN inscricao_municipal text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'responsavel') THEN
    ALTER TABLE configuracoes ADD COLUMN responsavel text DEFAULT ''; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracoes' AND column_name = 'site') THEN
    ALTER TABLE configuracoes ADD COLUMN site text DEFAULT ''; END IF;
END $$;