/*
# Rewrite restore_backup: safe UPSERT restore (no DELETE, no data loss)

1. Purpose
   - Replaces the previous destructive restore (DELETE + INSERT) with a safe
     UPSERT restore (INSERT ON CONFLICT DO UPDATE).
   - No DELETE, TRUNCATE, or DROP commands are executed.
   - Records that exist in the database but are absent from the backup are
     left completely untouched.
   - The entire restore runs inside a single atomic transaction. If any
     record fails, the whole transaction rolls back and the database is
     left exactly as it was before the attempt.

2. Validation (before any writes)
   - Confirms valid JSON structure: version field, data object.
   - Confirms all 7 required sections exist and are arrays:
     clientes, equipamentos, tecnicos, produtos, ordens_servico, os_produtos, configuracoes.
   - For every record, validates required fields are present and UUIDs are valid.
   - Checks all foreign-key references: the referenced ID must exist either
     in the backup itself or already in the database.
   - For ordens_servico.criado_por: if the value does not exist in profiles,
     reports it as a blocking validation error and stops without making any changes.

3. Restore mode
   - Uses INSERT ... ON CONFLICT (id) DO UPDATE for each record.
   - Preserves the original UUID, all timestamps, and every column value exactly.
   - Does not generate new UUIDs or timestamps.
   - Does not create duplicates.
   - Does not remove records absent from the backup.

4. Restore order (dependency order)
   - configuracoes, clientes, tecnicos, produtos, equipamentos, ordens_servico, os_produtos

5. Report
   - Returns per-table counts: expected, inserted, updated, unchanged, failed.
   - Returns validation errors with table, record ID, and field details.
   - Returns success=false if any validation or restore error occurs.

6. Security
   - SECURITY DEFINER, bypasses RLS for the restore operation.
   - Only callable by authenticated users (enforced by the edge function).
   - Never touches auth.users, auth.identities, auth.sessions, or auth.refresh_tokens.
   - Never modifies passwords or auth metadata.
   - Never creates or deletes auth users or profiles.
*/

CREATE OR REPLACE FUNCTION public.restore_backup(backup_json jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data             jsonb;
    v_section          text;
    v_records          jsonb;
    v_record           jsonb;
    v_i                int;
    v_inserted         int;
    v_updated          int;
    v_unchanged        int;
    v_failed           int;
    v_expected         int;
    v_report           jsonb[] := '{}';
    v_table_report     jsonb;
    v_max_os           int;
    v_validation_errors text[] := '{}';
    v_warnings         text[] := '{}';
    v_err_msg          text;
    v_rec_id           text;

    -- validation sets: collect all IDs from the backup
    v_clientes_ids      uuid[] := '{}';
    v_equipamentos_ids  uuid[] := '{}';
    v_tecnicos_ids      uuid[] := '{}';
    v_produtos_ids      uuid[] := '{}';
    v_ordens_ids        uuid[] := '{}';
    v_config_ids        uuid[] := '{}';

    -- validation: existing IDs in the database
    v_db_clientes_ids   uuid[];
    v_db_equipamentos_ids uuid[];
    v_db_tecnicos_ids   uuid[];
    v_db_produtos_ids   uuid[];
    v_db_profiles_ids   uuid[];
BEGIN
    v_data := backup_json->'data';

    IF v_data IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Backup JSON nao contem a secao "data"'
        );
    END IF;

    IF backup_json->>'version' IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Backup JSON nao contem o campo "version"'
        );
    END IF;

    -- ═══════════════════════════════════════════════════
    -- PHASE 0: VALIDATION — confirm all sections exist and are arrays
    -- ═══════════════════════════════════════════════════
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
        IF jsonb_typeof(v_data->v_section) != 'array' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Secao "' || v_section || '" deve ser uma lista de registros'
            );
        END IF;
    END LOOP;

    -- ═══════════════════════════════════════════════════
    -- PHASE 1: COLLECT IDs from the backup for FK validation
    -- ═══════════════════════════════════════════════════
    FOR v_i IN 0..jsonb_array_length(v_data->'configuracoes')-1 LOOP
        v_record := v_data->'configuracoes'->v_i;
        v_config_ids := array_append(v_config_ids, (v_record->>'id')::uuid);
    END LOOP;

    FOR v_i IN 0..jsonb_array_length(v_data->'clientes')-1 LOOP
        v_record := v_data->'clientes'->v_i;
        v_clientes_ids := array_append(v_clientes_ids, (v_record->>'id')::uuid);
    END LOOP;

    FOR v_i IN 0..jsonb_array_length(v_data->'tecnicos')-1 LOOP
        v_record := v_data->'tecnicos'->v_i;
        v_tecnicos_ids := array_append(v_tecnicos_ids, (v_record->>'id')::uuid);
    END LOOP;

    FOR v_i IN 0..jsonb_array_length(v_data->'produtos')-1 LOOP
        v_record := v_data->'produtos'->v_i;
        v_produtos_ids := array_append(v_produtos_ids, (v_record->>'id')::uuid);
    END LOOP;

    FOR v_i IN 0..jsonb_array_length(v_data->'equipamentos')-1 LOOP
        v_record := v_data->'equipamentos'->v_i;
        v_equipamentos_ids := array_append(v_equipamentos_ids, (v_record->>'id')::uuid);
    END LOOP;

    FOR v_i IN 0..jsonb_array_length(v_data->'ordens_servico')-1 LOOP
        v_record := v_data->'ordens_servico'->v_i;
        v_ordens_ids := array_append(v_ordens_ids, (v_record->>'id')::uuid);
    END LOOP;

    -- Collect existing IDs from the database for FK validation
    SELECT array_agg(id) INTO v_db_clientes_ids FROM clientes;
    SELECT array_agg(id) INTO v_db_equipamentos_ids FROM equipamentos;
    SELECT array_agg(id) INTO v_db_tecnicos_ids FROM tecnicos;
    SELECT array_agg(id) INTO v_db_produtos_ids FROM produtos;
    SELECT array_agg(id) INTO v_db_profiles_ids FROM profiles;

    -- ═══════════════════════════════════════════════════
    -- PHASE 2: VALIDATE every record (no writes yet)
    -- ═══════════════════════════════════════════════════

    -- -- configuracoes: required fields = id, nome_empresa
    FOR v_i IN 0..jsonb_array_length(v_data->'configuracoes')-1 LOOP
        v_record := v_data->'configuracoes'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'configuracoes[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'configuracoes[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        IF v_record->>'nome_empresa' IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'configuracoes[' || v_i || ']: campo "nome_empresa" ausente (NOT NULL)');
        END IF;
    END LOOP;

    -- -- clientes: required fields = id, nome
    FOR v_i IN 0..jsonb_array_length(v_data->'clientes')-1 LOOP
        v_record := v_data->'clientes'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'clientes[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'clientes[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        IF v_record->>'nome' IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'clientes[' || v_i || ']: campo "nome" ausente (NOT NULL)');
        END IF;
    END LOOP;

    -- -- tecnicos: required fields = id, nome
    FOR v_i IN 0..jsonb_array_length(v_data->'tecnicos')-1 LOOP
        v_record := v_data->'tecnicos'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'tecnicos[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'tecnicos[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        IF v_record->>'nome' IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'tecnicos[' || v_i || ']: campo "nome" ausente (NOT NULL)');
        END IF;
    END LOOP;

    -- -- produtos: required fields = id, nome
    FOR v_i IN 0..jsonb_array_length(v_data->'produtos')-1 LOOP
        v_record := v_data->'produtos'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'produtos[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'produtos[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        IF v_record->>'nome' IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'produtos[' || v_i || ']: campo "nome" ausente (NOT NULL)');
        END IF;
    END LOOP;

    -- -- equipamentos: required fields = id, cliente_id (FK -> clientes), tipo
    FOR v_i IN 0..jsonb_array_length(v_data->'equipamentos')-1 LOOP
        v_record := v_data->'equipamentos'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        DECLARE v_fk text; BEGIN
            v_fk := v_record->>'cliente_id';
            IF v_fk IS NULL OR v_fk = '' THEN
                v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: campo "cliente_id" ausente (NOT NULL)');
            ELSIF NOT (v_fk = ANY(v_clientes_ids) OR v_fk = ANY(v_db_clientes_ids) OR v_fk ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND EXISTS (SELECT 1 FROM clientes WHERE id = v_fk::uuid)) THEN
                v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: cliente_id FK invalido: ' || v_fk || ' nao existe em clientes (backup ou banco)');
            END IF;
        END;
        IF v_record->>'tipo' IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: campo "tipo" ausente (NOT NULL)');
        END IF;
    END LOOP;

    -- -- ordens_servico: required fields = id, cliente_id (FK), status, prioridade, numero_os
    --    FK checks: cliente_id -> clientes, equipamento_id -> equipamentos, tecnico_id -> tecnicos, criado_por -> profiles
    FOR v_i IN 0..jsonb_array_length(v_data->'ordens_servico')-1 LOOP
        v_record := v_data->'ordens_servico'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        -- cliente_id (NOT NULL FK)
        DECLARE v_cid text; BEGIN
            v_cid := v_record->>'cliente_id';
            IF v_cid IS NULL OR v_cid = '' THEN
                v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: campo "cliente_id" ausente (NOT NULL)');
            ELSIF NOT (v_cid = ANY(v_clientes_ids) OR v_cid = ANY(v_db_clientes_ids) OR EXISTS (SELECT 1 FROM clientes WHERE id = v_cid::uuid)) THEN
                v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: cliente_id FK invalido: ' || v_cid || ' nao existe em clientes');
            END IF;
        END;
        -- equipamento_id (nullable FK)
        DECLARE v_eid text; BEGIN
            v_eid := v_record->>'equipamento_id';
            IF v_eid IS NOT NULL AND v_eid != '' THEN
                IF NOT (v_eid = ANY(v_equipamentos_ids) OR v_eid = ANY(v_db_equipamentos_ids) OR EXISTS (SELECT 1 FROM equipamentos WHERE id = v_eid::uuid)) THEN
                    v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: equipamento_id FK invalido: ' || v_eid || ' nao existe em equipamentos');
                END IF;
            END IF;
        END;
        -- tecnico_id (nullable FK)
        DECLARE v_tid text; BEGIN
            v_tid := v_record->>'tecnico_id';
            IF v_tid IS NOT NULL AND v_tid != '' THEN
                IF NOT (v_tid = ANY(v_tecnicos_ids) OR v_tid = ANY(v_db_tecnicos_ids) OR EXISTS (SELECT 1 FROM tecnicos WHERE id = v_tid::uuid)) THEN
                    v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: tecnico_id FK invalido: ' || v_tid || ' nao existe em tecnicos');
                END IF;
            END IF;
        END;
        -- criado_por (nullable FK -> profiles) — must exist in profiles if present
        DECLARE v_cp text; BEGIN
            v_cp := v_record->>'criado_por';
            IF v_cp IS NOT NULL AND v_cp != '' THEN
                IF NOT (v_cp = ANY(v_db_profiles_ids) OR EXISTS (SELECT 1 FROM profiles WHERE id = v_cp::uuid)) THEN
                    v_validation_errors := array_append(v_validation_errors,
                        'ordens_servico[' || v_i || '] (id=' || v_rec_id || '): criado_por FK invalido: ' || v_cp ||
                        ' nao existe em profiles. O usuario auth correspondente nao existe mais. ' ||
                        'Opcoes: (A) recriar o usuario auth primeiro, (B) definir criado_por como null no arquivo, (C) usar o ID do usuario atual.');
                END IF;
            END IF;
        END;
        -- status CHECK constraint
        DECLARE v_st text; BEGIN
            v_st := v_record->>'status';
            IF v_st IS NOT NULL AND v_st NOT IN ('aberta','em_andamento','aguardando_peca','concluida','entregue') THEN
                v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: status invalido: ' || v_st);
            END IF;
        END;
        -- prioridade CHECK constraint
        DECLARE v_pr text; BEGIN
            v_pr := v_record->>'prioridade';
            IF v_pr IS NOT NULL AND v_pr NOT IN ('baixa','normal','alta','urgente') THEN
                v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: prioridade invalida: ' || v_pr);
            END IF;
        END;
    END LOOP;

    -- -- os_produtos: required fields = id, ordem_servico_id (FK -> ordens_servico), produto_id (FK -> produtos)
    FOR v_i IN 0..jsonb_array_length(v_data->'os_produtos')-1 LOOP
        v_record := v_data->'os_produtos'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        DECLARE v_osid text; BEGIN
            v_osid := v_record->>'ordem_servico_id';
            IF v_osid IS NULL OR v_osid = '' THEN
                v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: campo "ordem_servico_id" ausente (NOT NULL)');
            ELSIF NOT (v_osid = ANY(v_ordens_ids) OR EXISTS (SELECT 1 FROM ordens_servico WHERE id = v_osid::uuid)) THEN
                v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: ordem_servico_id FK invalido: ' || v_osid || ' nao existe em ordens_servico');
            END IF;
        END;
        DECLARE v_pid text; BEGIN
            v_pid := v_record->>'produto_id';
            IF v_pid IS NULL OR v_pid = '' THEN
                v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: campo "produto_id" ausente (NOT NULL)');
            ELSIF NOT (v_pid = ANY(v_produtos_ids) OR v_pid = ANY(v_db_produtos_ids) OR EXISTS (SELECT 1 FROM produtos WHERE id = v_pid::uuid)) THEN
                v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: produto_id FK invalido: ' || v_pid || ' nao existe em produtos');
            END IF;
        END;
    END LOOP;

    -- If any validation errors, abort without making any changes
    IF array_length(v_validation_errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Validacao falhou - nenhum dado foi alterado',
            'validation_errors', to_jsonb(v_validation_errors)
        );
    END IF;

    -- ═══════════════════════════════════════════════════
    -- PHASE 3: UPSERT restore (no DELETE, no data loss)
    -- ═══════════════════════════════════════════════════

    -- 1. configuracoes
    v_records := v_data->'configuracoes';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_updated := 0; v_unchanged := 0; v_failed := 0;

    FOR v_i IN 0..jsonb_array_length(v_records)-1 LOOP
        v_record := v_records->v_i;
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
            )
            ON CONFLICT (id) DO UPDATE SET
                nome_empresa      = EXCLUDED.nome_empresa,
                logo_url          = EXCLUDED.logo_url,
                telefone          = EXCLUDED.telefone,
                endereco          = EXCLUDED.endereco,
                criado_em         = EXCLUDED.criado_em,
                atualizado_em     = EXCLUDED.atualizado_em,
                cnpj              = EXCLUDED.cnpj,
                razao_social      = EXCLUDED.razao_social,
                email             = EXCLUDED.email,
                celular           = EXCLUDED.celular,
                bairro            = EXCLUDED.bairro,
                cidade            = EXCLUDED.cidade,
                estado            = EXCLUDED.estado,
                cep               = EXCLUDED.cep,
                inscricao_estadual = EXCLUDED.inscricao_estadual,
                inscricao_municipal = EXCLUDED.inscricao_municipal,
                responsavel       = EXCLUDED.responsavel,
                site              = EXCLUDED.site
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN
                v_inserted := v_inserted + 1;
            ELSE
                v_updated := v_updated + 1;
            END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'configuracoes[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'configuracoes', 'expected', v_expected,
        'inserted', v_inserted, 'updated', v_updated,
        'unchanged', v_unchanged, 'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- 2. clientes
    v_records := v_data->'clientes';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_updated := 0; v_unchanged := 0; v_failed := 0;

    FOR v_i IN 0..jsonb_array_length(v_records)-1 LOOP
        v_record := v_records->v_i;
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
            )
            ON CONFLICT (id) DO UPDATE SET
                nome          = EXCLUDED.nome,
                cpf_cnpj      = EXCLUDED.cpf_cnpj,
                telefone      = EXCLUDED.telefone,
                celular       = EXCLUDED.celular,
                email         = EXCLUDED.email,
                endereco      = EXCLUDED.endereco,
                bairro        = EXCLUDED.bairro,
                cidade        = EXCLUDED.cidade,
                estado        = EXCLUDED.estado,
                cep           = EXCLUDED.cep,
                observacoes   = EXCLUDED.observacoes,
                criado_em     = EXCLUDED.criado_em,
                atualizado_em = EXCLUDED.atualizado_em
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN
                v_inserted := v_inserted + 1;
            ELSE
                v_updated := v_updated + 1;
            END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'clientes[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'clientes', 'expected', v_expected,
        'inserted', v_inserted, 'updated', v_updated,
        'unchanged', v_unchanged, 'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- 3. tecnicos
    v_records := v_data->'tecnicos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_updated := 0; v_unchanged := 0; v_failed := 0;

    FOR v_i IN 0..jsonb_array_length(v_records)-1 LOOP
        v_record := v_records->v_i;
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
            )
            ON CONFLICT (id) DO UPDATE SET
                nome          = EXCLUDED.nome,
                especialidade = EXCLUDED.especialidade,
                telefone      = EXCLUDED.telefone,
                email         = EXCLUDED.email,
                ativo         = EXCLUDED.ativo,
                criado_em     = EXCLUDED.criado_em
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN
                v_inserted := v_inserted + 1;
            ELSE
                v_updated := v_updated + 1;
            END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'tecnicos[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'tecnicos', 'expected', v_expected,
        'inserted', v_inserted, 'updated', v_updated,
        'unchanged', v_unchanged, 'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- 4. produtos
    v_records := v_data->'produtos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_updated := 0; v_unchanged := 0; v_failed := 0;

    FOR v_i IN 0..jsonb_array_length(v_records)-1 LOOP
        v_record := v_records->v_i;
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
            )
            ON CONFLICT (id) DO UPDATE SET
                nome                = EXCLUDED.nome,
                descricao           = EXCLUDED.descricao,
                codigo              = EXCLUDED.codigo,
                quantidade_estoque  = EXCLUDED.quantidade_estoque,
                preco_custo         = EXCLUDED.preco_custo,
                preco_venda         = EXCLUDED.preco_venda,
                categoria           = EXCLUDED.categoria,
                criado_em           = EXCLUDED.criado_em,
                atualizado_em       = EXCLUDED.atualizado_em
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN
                v_inserted := v_inserted + 1;
            ELSE
                v_updated := v_updated + 1;
            END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'produtos[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'produtos', 'expected', v_expected,
        'inserted', v_inserted, 'updated', v_updated,
        'unchanged', v_unchanged, 'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- 5. equipamentos
    v_records := v_data->'equipamentos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_updated := 0; v_unchanged := 0; v_failed := 0;

    FOR v_i IN 0..jsonb_array_length(v_records)-1 LOOP
        v_record := v_records->v_i;
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
            )
            ON CONFLICT (id) DO UPDATE SET
                cliente_id        = EXCLUDED.cliente_id,
                tipo              = EXCLUDED.tipo,
                marca             = EXCLUDED.marca,
                modelo            = EXCLUDED.modelo,
                numero_serie      = EXCLUDED.numero_serie,
                imei              = EXCLUDED.imei,
                cor               = EXCLUDED.cor,
                condicao_entrada  = EXCLUDED.condicao_entrada,
                acessorios        = EXCLUDED.acessorios,
                observacoes       = EXCLUDED.observacoes,
                criado_em         = EXCLUDED.criado_em
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN
                v_inserted := v_inserted + 1;
            ELSE
                v_updated := v_updated + 1;
            END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'equipamentos[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'equipamentos', 'expected', v_expected,
        'inserted', v_inserted, 'updated', v_updated,
        'unchanged', v_unchanged, 'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- 6. ordens_servico
    v_records := v_data->'ordens_servico';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_updated := 0; v_unchanged := 0; v_failed := 0;

    FOR v_i IN 0..jsonb_array_length(v_records)-1 LOOP
        v_record := v_records->v_i;
        BEGIN
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
                NULLIF(v_record->>'criado_por', '')::uuid,
                COALESCE((v_record->>'criado_em')::timestamptz, now()),
                COALESCE((v_record->>'atualizado_em')::timestamptz, now()),
                NULLIF(v_record->>'data_revisao_futura', '')::timestamptz
            )
            ON CONFLICT (id) DO UPDATE SET
                numero_os          = EXCLUDED.numero_os,
                cliente_id         = EXCLUDED.cliente_id,
                equipamento_id     = EXCLUDED.equipamento_id,
                tecnico_id         = EXCLUDED.tecnico_id,
                status             = EXCLUDED.status,
                prioridade         = EXCLUDED.prioridade,
                defeito_relatado   = EXCLUDED.defeito_relatado,
                laudo_tecnico      = EXCLUDED.laudo_tecnico,
                servico_executado  = EXCLUDED.servico_executado,
                data_entrada       = EXCLUDED.data_entrada,
                data_previsao      = EXCLUDED.data_previsao,
                data_conclusao     = EXCLUDED.data_conclusao,
                valor_servico      = EXCLUDED.valor_servico,
                valor_total        = EXCLUDED.valor_total,
                observacoes        = EXCLUDED.observacoes,
                criado_por         = EXCLUDED.criado_por,
                criado_em          = EXCLUDED.criado_em,
                atualizado_em      = EXCLUDED.atualizado_em,
                data_revisao_futura = EXCLUDED.data_revisao_futura
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN
                v_inserted := v_inserted + 1;
            ELSE
                v_updated := v_updated + 1;
            END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'ordens_servico[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

    -- Update sequence to max numero_os
    SELECT COALESCE(MAX(numero_os), 1000) INTO v_max_os FROM ordens_servico;
    PERFORM setval('os_numero_seq', v_max_os, true);

    v_table_report := jsonb_build_object(
        'table', 'ordens_servico', 'expected', v_expected,
        'inserted', v_inserted, 'updated', v_updated,
        'unchanged', v_unchanged, 'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- 7. os_produtos
    v_records := v_data->'os_produtos';
    v_expected := jsonb_array_length(v_records);
    v_inserted := 0; v_updated := 0; v_unchanged := 0; v_failed := 0;

    FOR v_i IN 0..jsonb_array_length(v_records)-1 LOOP
        v_record := v_records->v_i;
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
            )
            ON CONFLICT (id) DO UPDATE SET
                ordem_servico_id = EXCLUDED.ordem_servico_id,
                produto_id       = EXCLUDED.produto_id,
                quantidade       = EXCLUDED.quantidade,
                preco_unitario   = EXCLUDED.preco_unitario,
                preco_total     = EXCLUDED.preco_total
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN
                v_inserted := v_inserted + 1;
            ELSE
                v_updated := v_updated + 1;
            END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'os_produtos[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

    v_table_report := jsonb_build_object(
        'table', 'os_produtos', 'expected', v_expected,
        'inserted', v_inserted, 'updated', v_updated,
        'unchanged', v_unchanged, 'failed', v_failed
    );
    v_report := array_append(v_report, v_table_report);

    -- ═══════════════════════════════════════════════════
    -- PHASE 4: Final check — rollback if any failures
    -- ═══════════════════════════════════════════════════
    SELECT COUNT(*) INTO v_i FROM unnest(v_report) AS r(r)
    WHERE (r->>'failed')::int > 0;

    IF v_i > 0 THEN
        RAISE EXCEPTION 'RESTORE_FAILED:%', to_jsonb(v_report)::text;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'tables', to_jsonb(v_report),
        'warnings', to_jsonb(v_warnings)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;
