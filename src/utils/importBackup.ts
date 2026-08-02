import { supabase } from '../lib/supabase';
import backupData from '../backup.json';

const IMPORT_FLAG_KEY = 'backup_imported';

const TABLE_ORDER = [
  'configuracoes',
  'clientes',
  'tecnicos',
  'produtos',
  'equipamentos',
  'ordens_servico',
  'os_produtos',
] as const;

type TableName = (typeof TABLE_ORDER)[number];

async function isImportCompleted(): Promise<boolean> {
  return localStorage.getItem(IMPORT_FLAG_KEY) === 'true';
}

async function markImportCompleted(): Promise<void> {
  localStorage.setItem(IMPORT_FLAG_KEY, 'true');
}

async function upsertTable(table: TableName, rows: Record<string, unknown>[]): Promise<void> {
  if (!rows || rows.length === 0) {
    console.log(`[importBackup] ${table}: sem registros, pulando.`);
    return;
  }

  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error(`[importBackup] ${table}: falha ao enviar ${rows.length} registros - ${error.message}`);
  } else {
    console.log(`[importBackup] ${table}: ${rows.length} registros enviados com sucesso.`);
  }
}

export async function importBackupOnce(): Promise<void> {
  if (await isImportCompleted()) {
    console.log('[importBackup] Importação já realizada anteriormente, pulando.');
    return;
  }

  const data = (backupData as { data: Record<string, Record<string, unknown>[]> }).data;

  if (!data) {
    console.warn('[importBackup] Arquivo de backup não contém dados.');
    return;
  }

  console.log('[importBackup] Iniciando importação do backup local...');

  let totalRegistros = 0;
  let tabelasImportadas = 0;

  for (const table of TABLE_ORDER) {
    const rows = data[table];
    if (rows && rows.length > 0) {
      await upsertTable(table, rows);
      totalRegistros += rows.length;
      tabelasImportadas++;
    } else {
      console.log(`[importBackup] ${table}: sem registros, pulando.`);
    }
  }

  await markImportCompleted();

  console.log(
    `[importBackup] Concluído: ${tabelasImportadas} tabelas processadas, ${totalRegistros} registros no total.`
  );
}
