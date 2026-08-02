/*
# Add data_revisao_futura column to ordens_servico

1. Changes
- Adds a new nullable `data_revisao_futura` (timestamptz) column to the `ordens_servico` table.
- This column stores the scheduled date for a future preventive maintenance review of the equipment.
- The column is nullable so existing service orders are unaffected.

2. Security
- No RLS policy changes needed — the column inherits the existing ordens_servico policies.

3. Notes
- Uses a DO $$ block to check information_schema so the migration is idempotent and safe to re-run.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ordens_servico' AND column_name = 'data_revisao_futura'
  ) THEN
    ALTER TABLE ordens_servico ADD COLUMN data_revisao_futura timestamptz;
  END IF;
END $$;
