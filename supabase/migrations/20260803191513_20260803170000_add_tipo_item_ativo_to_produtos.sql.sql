/*
# Add tipo_item and ativo columns to produtos

1. Modified Tables
   - `produtos`
     - Add `tipo_item` (text, NOT NULL, DEFAULT 'produto') — identifies the record type.
       Allowed values: 'produto' (physical part/product with stock) and 'servico' (service with no stock).
     - Add `ativo` (boolean, NOT NULL, DEFAULT true) — whether the item is active and available for use.

2. Data Safety
   - Both columns are added with safe defaults so existing rows automatically become
     `tipo_item = 'produto'` and `ativo = true`. No existing data is changed or lost.
   - No tables or columns are dropped or renamed.

3. Security
   - No RLS policy changes. Existing policies on `produtos` continue to govern access.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'tipo_item'
  ) THEN
    ALTER TABLE public.produtos ADD COLUMN tipo_item text NOT NULL DEFAULT 'produto'
      CHECK (tipo_item IN ('produto', 'servico'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'ativo'
  ) THEN
    ALTER TABLE public.produtos ADD COLUMN ativo boolean NOT NULL DEFAULT true;
  END IF;
END $$;
