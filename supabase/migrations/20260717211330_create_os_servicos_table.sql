/*
# Create os_servicos table

Creates a table to store individual service line items for each service order,
allowing multiple services to be listed per OS with individual pricing.

1. New Tables
  - `os_servicos` - Individual service line items for each OS
    - `id` (uuid, primary key)
    - `ordem_servico_id` (uuid, FK -> ordens_servico)
    - `descricao` (text, not null) - Description of the service performed
    - `quantidade` (integer, default 1) - Quantity/hours
    - `preco_unitario` (numeric, default 0) - Unit price
    - `preco_total` (numeric, default 0) - Total price (qty * unit)

2. Security
  - Enable RLS on `os_servicos`
  - Allow all CRUD for authenticated users (same pattern as os_produtos)

3. Notes
  - Mirrors the structure of `os_produtos` for consistency
  - The existing `servico_executado` text field on `ordens_servico` is kept as a general notes field
  - The existing `valor_servico` field on `ordens_servico` will store the sum of service line totals
*/

CREATE TABLE IF NOT EXISTS os_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  preco_total numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_os_servicos_ordem ON os_servicos(ordem_servico_id);

ALTER TABLE os_servicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_os_servicos" ON os_servicos;
CREATE POLICY "select_os_servicos" ON os_servicos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_os_servicos" ON os_servicos;
CREATE POLICY "insert_os_servicos" ON os_servicos FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_os_servicos" ON os_servicos;
CREATE POLICY "update_os_servicos" ON os_servicos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_os_servicos" ON os_servicos;
CREATE POLICY "delete_os_servicos" ON os_servicos FOR DELETE
  TO authenticated USING (true);
