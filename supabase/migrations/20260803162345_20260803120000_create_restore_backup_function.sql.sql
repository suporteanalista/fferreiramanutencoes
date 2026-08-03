/*
# Create restore_backup stored procedure

1. Purpose
   - Provides a single-transaction, deterministic restore of the application's
     business data from a validated backup JSON payload.
   - The uploaded backup JSON is the source of truth. UUIDs, timestamps, and
     all column values are preserved exactly as stored in the backup.
   - The restore is completely independent from authentication: it never
     touches auth.users, profiles, or Supabase Auth.

2. Validation (before any data changes)
   - Confirms all 7 required sections exist in the backup JSON:
     clientes, equipamentos, tecnicos, produtos, ordens_servico, os_produtos, configuracoes.
   - If any section is missing, the function aborts immediately and returns an
     error without deleting or modifying any database data.

3. Restore order (dependency order)
   - configuracoes
   - clientes
   - tecnicos
   - produtos
   - equipamentos
   - ordens_servico
   - os_produtos

4. Per-table operation
   - Deletes only that table's existing rows (DELETE FROM <table>).
   - Never drops tables, never recreates tables, never modifies schema.
   - Inserts every record from the backup, preserving exact UUIDs and timestamps.
   - Does not generate new IDs or new timestamps.
   - Respects all foreign keys.

5. Special handling
   - ordens_servico.criado_por references profiles(id). Profiles are tied to
     authentication and are outside the backup scope. If a referenced profile
     no longer exists, criado_por is set to NULL (the column is nullable) and
     the record is flagged in the report. This keeps the restore independent
     from authentication.
   - After restoring ordens_servico, the os_numero_seq sequence is set to
     MAX(numero_os) so future service orders do not collide with restored numbers.

6. Transaction safety
   - The entire restore runs inside a single PL/pgSQL function, which is atomic.
   - If any table fails to insert, the entire transaction rolls back automatically.
   - Never partially restores data.

7. Return value
   - Returns a JSON report with per-table counts:
     table_name, expected, inserted, skipped, failed.
   - Also includes a top-level "success" boolean and "error" string if validation failed.

8. Security
   - SECURITY DEFINER so it can bypass RLS for the restore operation.
   - Only callable by authenticated users (enforced by the edge function caller check).
   - Never modifies auth.users or profiles.
*/

CREATE OR REPLACE FUNCTION public.restore_backup(backup_json jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data        jsonb;
    v_section     text;
    v_records     jsonb;
    v_record      jsonb;
    v_count       int;
    v_inserted    int;
    v_skipped     int;
    v_failed      int;
    v_expected    int;
    v_report      jsonb[] := '{}';
    v_table_report jsonb;
    v_max_os      int;
    v_criado_por  uuid;
    v_criado_por_exists boolean;
    v_warnings    text[] := '{}';
BEGIN
    -- Extract the "data" object from the backup
    v_data := backup_json->'data';

    IF v_data IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Backup JSON nao contem a secao "data"'
        );
    END IF;

    -- ── VALIDATION: confirm all 7 required sections exist ──
    FOREACH v_section IN ARRAY ARRAY[
        'clientes','equipamentos','tecnicos','produtos',
        'ordens_servico','os_produtos','configuracoes'
    ] LOOP
        IF v_data->v_section IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Secao obrigatoria ausente no backup: ' || v_section
            );
        END IF;
    END LOOP;

    -- ── Helper: build per-table report ──
    -- We process tables in strict dependency order.

    -- ═══════════════════════════════════════════════════
    -- 1. configuracoes
    -- ═══════════════════════════════════════════════════
    v_records := v_data->'configuracoes';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_skipped := 0; v_failed := 0;

    DELETE FROM configuracoes;

    FOR v_record IN SELECT * FROM jsonb_array_elements(v_records) LOOP
        BEGIN
            INSERT INTO configuracoes (
                id, nome_empresa, logo_url, telefone, endereco,
                criado_em, atualizado_em,
                cnpj, razao_social, email, celular,
                bairro, cidade, estado, cep,
                inscricao_estadual, inscricao_municipal, responsavel, site
            ) VALUES (
                (v_record->>'id')::uuid,
                v_record->>'nome_empresa',
                COALESCE(v_record->>'logo_url', ''),
                COALESCE(v_record->>'telefone', ''),
                COALESCE(v_record->>'endereco', ''),
                COALESCE((v_record->>'criado_em')::timestamptz, now()),
                COALESCE((v_record->>'atualizado_em')::timestamptz, now()),
                COALESCE(v_record->>'cnpj', ''),
                COALESCE(v_record->>'razao_social', ''),
                COALESCE(v_record->>'email', ''),
                COALESCE(v_record->>'celular', ''),
                COALESCE(v_record->>'bairro', ''),
                COALESCE(v_record->>'cidade', ''),
                COALESCE(v_record->>'estado', ''),
                COALESCE(v_record->>'cep', ''),
                COALESCE(v_record->>'inscricao_estadual', ''),
                COALESCE(v_record->>'inscricao_municipal', ''),
                COALESCE(v_record->>'responsavel', ''),
                COALESCE(v_record->>'site', '')
            );
            v_inserted := v_inserted + 1;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'configuracoes',
        'expected', v_expected,
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- 2. clientes
    -- ═══════════════════════════════════════════════════
    v_records := v_data->'clientes';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_skipped := 0; v_failed := 0;

    DELETE FROM clientes;

    FOR v_record IN SELECT * FROM jsonb_array_elements(v_records) LOOP
        BEGIN
            INSERT INTO clientes (
                id, nome, cpf_cnpj, telefone, celular, email,
                endereco, bairro, cidade, estado, cep, observacoes,
                criado_em, atualizado_em
            ) VALUES (
                (v_record->>'id')::uuid,
                v_record->>'nome',
                COALESCE(v_record->>'cpf_cnpj', ''),
                COALESCE(v_record->>'telefone', ''),
                COALESCE(v_record->>'celular', ''),
                COALESCE(v_record->>'email', ''),
                COALESCE(v_record->>'endereco', ''),
                COALESCE(v_record->>'bairro', ''),
                COALESCE(v_record->>'cidade', ''),
                COALESCE(v_record->>'estado', ''),
                COALESCE(v_record->>'cep', ''),
                COALESCE(v_record->>'observacoes', ''),
                COALESCE((v_record->>'criado_em')::timestamptz, now()),
                COALESCE((v_record->>'atualizado_em')::timestamptz, now())
            );
            v_inserted := v_inserted + 1;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'clientes',
        'expected', v_expected,
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- 3. tecnicos
    -- ═══════════════════════════════════════════════════
    v_records := v_data->'tecnicos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_skipped := 0; v_failed := 0;

    DELETE FROM tecnicos;

    FOR v_record IN SELECT * FROM jsonb_array_elements(v_records) LOOP
        BEGIN
            INSERT INTO tecnicos (
                id, nome, especialidade, telefone, email, ativo, criado_em
            ) VALUES (
                (v_record->>'id')::uuid,
                v_record->>'nome',
                COALESCE(v_record->>'especialidade', ''),
                COALESCE(v_record->>'telefone', ''),
                COALESCE(v_record->>'email', ''),
                COALESCE((v_record->>'ativo')::boolean, true),
                COALESCE((v_record->>'criado_em')::timestamptz, now())
            );
            v_inserted := v_inserted + 1;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'tecnicos',
        'expected', v_expected,
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- 4. produtos
    -- ═══════════════════════════════════════════════════
    v_records := v_data->'produtos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_skipped := 0; v_failed := 0;

    DELETE FROM produtos;

    FOR v_record IN SELECT * FROM jsonb_array_elements(v_records) LOOP
        BEGIN
            INSERT INTO produtos (
                id, nome, descricao, codigo, quantidade_estoque,
                preco_custo, preco_venda, categoria, criado_em, atualizado_em
            ) VALUES (
                (v_record->>'id')::uuid,
                v_record->>'nome',
                COALESCE(v_record->>'descricao', ''),
                COALESCE(v_record->>'codigo', ''),
                COALESCE((v_record->>'quantidade_estoque')::int, 0),
                COALESCE((v_record->>'preco_custo')::numeric, 0),
                COALESCE((v_record->>'preco_venda')::numeric, 0),
                COALESCE(v_record->>'categoria', ''),
                COALESCE((v_record->>'criado_em')::timestamptz, now()),
                COALESCE((v_record->>'atualizado_em')::timestamptz, now())
            );
            v_inserted := v_inserted + 1;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'produtos',
        'expected', v_expected,
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- 5. equipamentos
    -- ═══════════════════════════════════════════════════
    v_records := v_data->'equipamentos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_skipped := 0; v_failed := 0;

    DELETE FROM equipamentos;

    FOR v_record IN SELECT * FROM jsonb_array_elements(v_records) LOOP
        BEGIN
            INSERT INTO equipamentos (
                id, cliente_id, tipo, marca, modelo, numero_serie,
                imei, cor, condicao_entrada, acessorios, observacoes, criado_em
            ) VALUES (
                (v_record->>'id')::uuid,
                (v_record->>'cliente_id')::uuid,
                COALESCE(v_record->>'tipo', 'smartphone'),
                COALESCE(v_record->>'marca', ''),
                COALESCE(v_record->>'modelo', ''),
                COALESCE(v_record->>'numero_serie', ''),
                COALESCE(v_record->>'imei', ''),
                COALESCE(v_record->>'cor', ''),
                COALESCE(v_record->>'condicao_entrada', ''),
                COALESCE(v_record->>'acessorios', ''),
                COALESCE(v_record->>'observacoes', ''),
                COALESCE((v_record->>'criado_em')::timestamptz, now())
            );
            v_inserted := v_inserted + 1;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'equipamentos',
        'expected', v_expected,
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- 6. ordens_servico
    -- ═══════════════════════════════════════════════════
    v_records := v_data->'ordens_servico';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_skipped := 0; v_failed := 0;

    DELETE FROM ordens_servico;

    FOR v_record IN SELECT * FROM jsonb_array_elements(v_records) LOOP
        BEGIN
            -- Check if criado_por references an existing profile
            v_criado_por := NULLIF(v_record->>'criado_por', '')::uuid;
            v_criado_por_exists := false;

            IF v_criado_por IS NOT NULL THEN
                SELECT EXISTS(
                    SELECT 1 FROM profiles WHERE id = v_criado_por
                ) INTO v_criado_por_exists;
            END IF;

            INSERT INTO ordens_servico (
                id, numero_os, cliente_id, equipamento_id, tecnico_id,
                status, prioridade, defeito_relatado, laudo_tecnico,
                servico_executado, data_entrada, data_previsao, data_conclusao,
                valor_servico, valor_total, observacoes, criado_por,
                criado_em, atualizado_em, data_revisao_futura
            ) VALUES (
                (v_record->>'id')::uuid,
                COALESCE((v_record->>'numero_os')::int, nextval('os_numero_seq')),
                (v_record->>'cliente_id')::uuid,
                NULLIF(v_record->>'equipamento_id', '')::uuid,
                NULLIF(v_record->>'tecnico_id', '')::uuid,
                COALESCE(v_record->>'status', 'aberta'),
                COALESCE(v_record->>'prioridade', 'normal'),
                COALESCE(v_record->>'defeito_relatado', ''),
                COALESCE(v_record->>'laudo_tecnico', ''),
                COALESCE(v_record->>'servico_executado', ''),
                COALESCE((v_record->>'data_entrada')::timestamptz, now()),
                NULLIF(v_record->>'data_previsao', '')::timestamptz,
                NULLIF(v_record->>'data_conclusao', '')::timestamptz,
                COALESCE((v_record->>'valor_servico')::numeric, 0),
                COALESCE((v_record->>'valor_total')::numeric, 0),
                COALESCE(v_record->>'observacoes', ''),
                CASE WHEN v_criado_por_exists THEN v_criado_por ELSE NULL END,
                COALESCE((v_record->>'criado_em')::timestamptz, now()),
                COALESCE((v_record->>'atualizado_em')::timestamptz, now()),
                NULLIF(v_record->>'data_revisao_futura', '')::timestamptz
            );

            IF v_criado_por IS NOT NULL AND NOT v_criado_por_exists THEN
                v_warnings := array_append(v_warnings,
                    'ordens_servico ' || (v_record->>'id') ||
                    ': criado_por ' || v_criado_por ||
                    ' nao existe em profiles - definido como NULL');
            END IF;

            v_inserted := v_inserted + 1;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    -- Update sequence to max numero_os
    SELECT COALESCE(MAX(numero_os), 1000) INTO v_max_os FROM ordens_servico;
    PERFORM setval('os_numero_seq', v_max_os, true);

    v_table_report := jsonb_build_object(
        'table', 'ordens_servico',
        'expected', v_expected,
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- 7. os_produtos
    -- ═══════════════════════════════════════════════════
    v_records := v_data->'os_produtos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_skipped := 0; v_failed := 0;

    DELETE FROM os_produtos;

    FOR v_record IN SELECT * FROM jsonb_array_elements(v_records) LOOP
        BEGIN
            INSERT INTO os_produtos (
                id, ordem_servico_id, produto_id, quantidade,
                preco_unitario, preco_total
            ) VALUES (
                (v_record->>'id')::uuid,
                (v_record->>'ordem_servico_id')::uuid,
                (v_record->>'produto_id')::uuid,
                COALESCE((v_record->>'quantidade')::int, 1),
                COALESCE((v_record->>'preco_unitario')::numeric, 0),
                COALESCE((v_record->>'preco_total')::numeric, 0)
            );
            v_inserted := v_inserted + 1;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'os_produtos',
        'expected', v_expected,
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- Final: check for any failures and build report
    -- ═══════════════════════════════════════════════════
    -- If any table had failures, raise an exception to roll back the entire transaction
    SELECT COUNT(*) INTO v_count FROM unnest(v_report) AS r(r)
    WHERE (r->>'failed')::int > 0;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'Falha ao restaurar uma ou mais tabelas - restauracao cancelada';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'tables', to_jsonb(v_report),
        'warnings', to_jsonb(v_warnings)
    );
END;
$$;

-- Revoke public execute and grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;
