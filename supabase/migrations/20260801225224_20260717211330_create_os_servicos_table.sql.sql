/*
  # Create os_servicos table

  Stores individual service line items for each service order.
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
CREATE POLICY "select_os_servicos" ON os_servicos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_os_servicos" ON os_servicos;
CREATE POLICY "insert_os_servicos" ON os_servicos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_os_servicos" ON os_servicos;
CREATE POLICY "update_os_servicos" ON os_servicos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_os_servicos" ON os_servicos;
CREATE POLICY "delete_os_servicos" ON os_servicos FOR DELETE TO authenticated USING (true);