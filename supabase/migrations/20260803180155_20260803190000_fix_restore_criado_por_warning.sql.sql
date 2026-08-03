/*
# Fix restore_backup: treat missing criado_por as warning (set NULL) instead of blocking error

1. Problem
   - The previous version blocked the entire restore when criado_por referenced
     a non-existent profile.
   - This would prevent restoring all other data (clientes, equipamentos, etc.)
     even though the only issue is one missing auth user reference.

2. Fix
   - When criado_por references a profile that does not exist:
     - Set criado_por to NULL during the UPSERT (the column is nullable)
     - Add a warning to the report
     - Do NOT block the restore
   - This preserves all business data while respecting the FK constraint.
   - The original criado_por value is preserved in the backup file itself.

3. Security
   - Still never touches auth.users or profiles.
   - Still never creates or deletes auth users.
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

    v_clientes_ids      uuid[] := '{}';
    v_equipamentos_ids  uuid[] := '{}';
    v_tecnicos_ids      uuid[] := '{}';
    v_produtos_ids      uuid[] := '{}';
    v_ordens_ids        uuid[] := '{}';
    v_config_ids        uuid[] := '{}';

    v_db_clientes_ids   uuid[];
    v_db_equipamentos_ids uuid[];
    v_db_tecnicos_ids   uuid[];
    v_db_produtos_ids   uuid[];
    v_db_profiles_ids   uuid[];

    v_fk_uuid           uuid;
    v_fk_text           text;
    v_status_val        text;
    v_prioridade_val    text;
    v_criado_por_uuid   uuid;
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

    -- PHASE 0: Validate all sections exist and are arrays
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

    -- PHASE 1: Collect IDs from the backup
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

    -- Collect existing IDs from the database
    SELECT array_agg(id) INTO v_db_clientes_ids FROM clientes;
    SELECT array_agg(id) INTO v_db_equipamentos_ids FROM equipamentos;
    SELECT array_agg(id) INTO v_db_tecnicos_ids FROM tecnicos;
    SELECT array_agg(id) INTO v_db_produtos_ids FROM produtos;
    SELECT array_agg(id) INTO v_db_profiles_ids FROM profiles;

    -- PHASE 2: Validate every record (no writes)

    -- configuracoes
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

    -- clientes
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

    -- tecnicos
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

    -- produtos
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

    -- equipamentos
    FOR v_i IN 0..jsonb_array_length(v_data->'equipamentos')-1 LOOP
        v_record := v_data->'equipamentos'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        v_fk_uuid := NULLIF(v_record->>'cliente_id', '')::uuid;
        IF v_fk_uuid IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: campo "cliente_id" ausente (NOT NULL)');
        ELSIF NOT (v_fk_uuid = ANY(v_clientes_ids) OR v_fk_uuid = ANY(v_db_clientes_ids) OR EXISTS (SELECT 1 FROM clientes WHERE id = v_fk_uuid)) THEN
            v_fk_text := v_record->>'cliente_id';
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: cliente_id FK invalido: ' || v_fk_text || ' nao existe em clientes');
        END IF;
        IF v_record->>'tipo' IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'equipamentos[' || v_i || ']: campo "tipo" ausente (NOT NULL)');
        END IF;
    END LOOP;

    -- ordens_servico
    FOR v_i IN 0..jsonb_array_length(v_data->'ordens_servico')-1 LOOP
        v_record := v_data->'ordens_servico'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        -- cliente_id (NOT NULL FK)
        v_fk_uuid := NULLIF(v_record->>'cliente_id', '')::uuid;
        IF v_fk_uuid IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: campo "cliente_id" ausente (NOT NULL)');
        ELSIF NOT (v_fk_uuid = ANY(v_clientes_ids) OR v_fk_uuid = ANY(v_db_clientes_ids) OR EXISTS (SELECT 1 FROM clientes WHERE id = v_fk_uuid)) THEN
            v_fk_text := v_record->>'cliente_id';
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: cliente_id FK invalido: ' || v_fk_text || ' nao existe em clientes');
        END IF;
        -- equipamento_id (nullable FK)
        v_fk_uuid := NULLIF(v_record->>'equipamento_id', '')::uuid;
        IF v_fk_uuid IS NOT NULL THEN
            IF NOT (v_fk_uuid = ANY(v_equipamentos_ids) OR v_fk_uuid = ANY(v_db_equipamentos_ids) OR EXISTS (SELECT 1 FROM equipamentos WHERE id = v_fk_uuid)) THEN
                v_fk_text := v_record->>'equipamento_id';
                v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: equipamento_id FK invalido: ' || v_fk_text || ' nao existe em equipamentos');
            END IF;
        END IF;
        -- tecnico_id (nullable FK)
        v_fk_uuid := NULLIF(v_record->>'tecnico_id', '')::uuid;
        IF v_fk_uuid IS NOT NULL THEN
            IF NOT (v_fk_uuid = ANY(v_tecnicos_ids) OR v_fk_uuid = ANY(v_db_tecnicos_ids) OR EXISTS (SELECT 1 FROM tecnicos WHERE id = v_fk_uuid)) THEN
                v_fk_text := v_record->>'tecnico_id';
                v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: tecnico_id FK invalido: ' || v_fk_text || ' nao existe em tecnicos');
            END IF;
        END IF;
        -- criado_por (nullable FK -> profiles): if missing, warn and set NULL (not a blocking error)
        v_criado_por_uuid := NULLIF(v_record->>'criado_por', '')::uuid;
        IF v_criado_por_uuid IS NOT NULL THEN
            IF NOT (v_criado_por_uuid = ANY(v_db_profiles_ids) OR EXISTS (SELECT 1 FROM profiles WHERE id = v_criado_por_uuid)) THEN
                v_fk_text := v_record->>'criado_por';
                v_warnings := array_append(v_warnings,
                    'ordens_servico[' || v_i || '] (id=' || v_rec_id || '): criado_por ' || v_fk_text ||
                    ' nao existe em profiles - definido como NULL (usuario auth nao existe mais)');
            END IF;
        END IF;
        -- status CHECK
        v_status_val := v_record->>'status';
        IF v_status_val IS NOT NULL AND v_status_val NOT IN ('aberta','em_andamento','aguardando_peca','concluida','entregue') THEN
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: status invalido: ' || v_status_val);
        END IF;
        -- prioridade CHECK
        v_prioridade_val := v_record->>'prioridade';
        IF v_prioridade_val IS NOT NULL AND v_prioridade_val NOT IN ('baixa','normal','alta','urgente') THEN
            v_validation_errors := array_append(v_validation_errors, 'ordens_servico[' || v_i || ']: prioridade invalida: ' || v_prioridade_val);
        END IF;
    END LOOP;

    -- os_produtos
    FOR v_i IN 0..jsonb_array_length(v_data->'os_produtos')-1 LOOP
        v_record := v_data->'os_produtos'->v_i;
        v_rec_id := v_record->>'id';
        IF v_rec_id IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: campo "id" ausente');
        ELSIF v_rec_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: id UUID invalido: ' || v_rec_id);
        END IF;
        v_fk_uuid := NULLIF(v_record->>'ordem_servico_id', '')::uuid;
        IF v_fk_uuid IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: campo "ordem_servico_id" ausente (NOT NULL)');
        ELSIF NOT (v_fk_uuid = ANY(v_ordens_ids) OR EXISTS (SELECT 1 FROM ordens_servico WHERE id = v_fk_uuid)) THEN
            v_fk_text := v_record->>'ordem_servico_id';
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: ordem_servico_id FK invalido: ' || v_fk_text || ' nao existe em ordens_servico');
        END IF;
        v_fk_uuid := NULLIF(v_record->>'produto_id', '')::uuid;
        IF v_fk_uuid IS NULL THEN
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: campo "produto_id" ausente (NOT NULL)');
        ELSIF NOT (v_fk_uuid = ANY(v_produtos_ids) OR v_fk_uuid = ANY(v_db_produtos_ids) OR EXISTS (SELECT 1 FROM produtos WHERE id = v_fk_uuid)) THEN
            v_fk_text := v_record->>'produto_id';
            v_validation_errors := array_append(v_validation_errors, 'os_produtos[' || v_i || ']: produto_id FK invalido: ' || v_fk_text || ' nao existe em produtos');
        END IF;
    END LOOP;

    -- Abort if validation errors
    IF array_length(v_validation_errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Validacao falhou - nenhum dado foi alterado',
            'validation_errors', to_jsonb(v_validation_errors)
        );
    END IF;

    -- PHASE 3: UPSERT restore (no DELETE)

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
            IF v_err_msg = 't' THEN v_inserted := v_inserted + 1;
            ELSE v_updated := v_updated + 1; END IF;
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
            IF v_err_msg = 't' THEN v_inserted := v_inserted + 1;
            ELSE v_updated := v_updated + 1; END IF;
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
            IF v_err_msg = 't' THEN v_inserted := v_inserted + 1;
            ELSE v_updated := v_updated + 1; END IF;
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
            IF v_err_msg = 't' THEN v_inserted := v_inserted + 1;
            ELSE v_updated := v_updated + 1; END IF;
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
            IF v_err_msg = 't' THEN v_inserted := v_inserted + 1;
            ELSE v_updated := v_updated + 1; END IF;
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
        -- Resolve criado_por: if profile doesn't exist, use NULL
        v_criado_por_uuid := NULLIF(v_record->>'criado_por', '')::uuid;
        IF v_criado_por_uuid IS NOT NULL THEN
            IF NOT (v_criado_por_uuid = ANY(v_db_profiles_ids) OR EXISTS (SELECT 1 FROM profiles WHERE id = v_criado_por_uuid)) THEN
                v_criado_por_uuid := NULL;
            END IF;
        END IF;
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
                v_criado_por_uuid,
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
            IF v_err_msg = 't' THEN v_inserted := v_inserted + 1;
            ELSE v_updated := v_updated + 1; END IF;
        EXCEPTION WHEN others THEN
            v_failed := v_failed + 1;
            v_warnings := array_append(v_warnings, 'ordens_servico[' || v_i || ']: ' || SQLERRM);
        END;
    END LOOP;

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
                preco_total      = EXCLUDED.preco_total
            RETURNING (xmax = 0) AS is_insert INTO v_err_msg;
            IF v_err_msg = 't' THEN v_inserted := v_inserted + 1;
            ELSE v_updated := v_updated + 1; END IF;
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

    -- PHASE 4: Rollback if any failures
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
