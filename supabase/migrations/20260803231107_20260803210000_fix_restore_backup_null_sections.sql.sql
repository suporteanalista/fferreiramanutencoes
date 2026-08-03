/*
# Fix restore_backup: treat NULL sections as empty arrays

## Summary
Updates the validation phase so that a missing (NULL) section is treated as an empty array
rather than a validation error. This handles backups where empty tables produce NULL
instead of [] (e.g., jsonb_agg on zero rows returns NULL).

## Security
- No schema changes, no RLS changes
- Function is idempotent (CREATE OR REPLACE)
*/
CREATE OR REPLACE FUNCTION public.restore_backup(backup_json jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data             jsonb;
  v_tables           text[] := ARRAY[
    'configuracoes', 'profiles', 'tipos_equipamento', 'clientes',
    'tecnicos', 'produtos', 'equipamentos', 'ordens_servico',
    'os_produtos', 'os_servicos'
  ];
  v_table            text;
  v_records          jsonb;
  v_record           jsonb;
  v_i                int;
  v_col              text;
  v_data_type        text;
  v_col_list         text;
  v_type_list        text;
  v_update_list      text;
  v_sql              text;
  v_was_insert       boolean;
  v_inserted         int;
  v_updated          int;
  v_skipped          int;
  v_failed           int;
  v_err_msg          text;
  v_report           jsonb[] := '{}';
  v_total_inserted   int := 0;
  v_total_updated    int := 0;
  v_total_skipped    int := 0;
  v_total_failed     int := 0;
  v_section_errors   text[] := '{}';
  v_record_errors    text[] := '{}';
  v_system_version   text;
BEGIN
  v_data := backup_json -> 'data';

  IF v_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Backup JSON nao contem a secao "data"'
    );
  END IF;

  v_system_version := COALESCE(backup_json ->> 'systemVersion', backup_json ->> 'version');
  IF v_system_version IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Backup JSON nao contem o campo "systemVersion" ou "version"'
    );
  END IF;

  -- PHASE 1: Validate all required sections exist.
  -- A NULL section (from jsonb_agg on empty table) is treated as empty array, not an error.
  -- A non-array section (e.g. an object) IS an error.
  FOREACH v_table IN ARRAY v_tables LOOP
    IF v_data -> v_table IS NULL THEN
      -- Treat as empty array - normalize to '[]'
      v_data := jsonb_set(v_data, ARRAY[v_table], '[]'::jsonb);
    ELSIF jsonb_typeof(v_data -> v_table) != 'array' THEN
      v_section_errors := array_append(v_section_errors, 'Secao "' || v_table || '" deve ser uma lista de registros');
    END IF;
  END LOOP;

  IF array_length(v_section_errors, 1) IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Validacao falhou - secoes obrigatorias ausentes ou invalidas',
      'validation_errors', to_jsonb(v_section_errors)
    );
  END IF;

  -- PHASE 2: Process each table in dependency order
  FOREACH v_table IN ARRAY v_tables LOOP
    v_records := v_data -> v_table;
    v_inserted := 0;
    v_updated := 0;
    v_skipped := 0;
    v_failed := 0;

    IF jsonb_array_length(v_records) = 0 THEN
      v_report := array_append(v_report, jsonb_build_object(
        'table', v_table,
        'expected', 0,
        'inserted', 0,
        'updated', 0,
        'skipped', 0,
        'errors', 0
      ));
      CONTINUE;
    END IF;

    -- Build column list, type list, and update list from information_schema
    v_col_list := '';
    v_type_list := '';
    v_update_list := '';

    FOR v_col, v_data_type IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table
      ORDER BY ordinal_position
    LOOP
      IF v_col_list != '' THEN
        v_col_list := v_col_list || ', ';
        v_type_list := v_type_list || ', ';
        v_update_list := v_update_list || ', ';
      END IF;
      v_col_list := v_col_list || quote_ident(v_col);
      v_type_list := v_type_list || quote_ident(v_col) || ' ' || v_data_type;
      v_update_list := v_update_list || quote_ident(v_col) || ' = EXCLUDED.' || quote_ident(v_col);
    END LOOP;

    -- Process each record
    FOR v_i IN 0..jsonb_array_length(v_records) - 1 LOOP
      v_record := v_records -> v_i;

      -- Special case: profiles must have a matching auth.users entry
      IF v_table = 'profiles' AND NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = (v_record ->> 'id')::uuid
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      BEGIN
        v_sql := format(
          'INSERT INTO %s (%s) SELECT %s FROM jsonb_to_record($1) AS x(%s) ON CONFLICT (id) DO UPDATE SET %s RETURNING (xmax = 0) AS was_insert',
          quote_ident(v_table), v_col_list, v_col_list, v_type_list, v_update_list
        );
        EXECUTE v_sql INTO v_was_insert USING v_record;

        IF v_was_insert THEN
          v_inserted := v_inserted + 1;
        ELSE
          v_updated := v_updated + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed + 1;
        GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
        v_record_errors := array_append(v_record_errors, v_table || '[' || v_i || ']: ' || v_err_msg);
      END;
    END LOOP;

    v_report := array_append(v_report, jsonb_build_object(
      'table', v_table,
      'expected', jsonb_array_length(v_records),
      'inserted', v_inserted,
      'updated', v_updated,
      'skipped', v_skipped,
      'errors', v_failed
    ));

    v_total_inserted := v_total_inserted + v_inserted;
    v_total_updated := v_total_updated + v_updated;
    v_total_skipped := v_total_skipped + v_skipped;
    v_total_failed := v_total_failed + v_failed;
  END LOOP;

  -- PHASE 3: Return the final report
  RETURN jsonb_build_object(
    'success', v_total_failed = 0,
    'systemVersion', v_system_version,
    'tables', to_jsonb(v_report),
    'totals', jsonb_build_object(
      'inserted', v_total_inserted,
      'updated', v_total_updated,
      'skipped', v_total_skipped,
      'errors', v_total_failed
    ),
    'validation_errors', to_jsonb(v_record_errors)
  );
END;
$function$;