import { supabase } from './supabase';
import { getDB, putManyLocal, addToSyncQueue, TableName } from './offlineDB';
import backupData from './backup_serviceos_2026-08-02.json';

const SEED_FLAG_KEY = 'seed_completed';

type TableOrder = TableName;

const SEED_ORDER: TableOrder[] = [
  'configuracoes',
  'clientes',
  'tecnicos',
  'produtos',
  'equipamentos',
  'ordens_servico',
  'os_produtos',
];

async function isSeedCompleted(): Promise<boolean> {
  const db = await getDB();
  const meta = await db.get('sync_metadata', SEED_FLAG_KEY);
  return meta?.last_sync === 'true';
}

async function markSeedCompleted(): Promise<void> {
  const db = await getDB();
  await db.put('sync_metadata', { table: SEED_FLAG_KEY, last_sync: 'true' });
}

async function upsertTable(table: TableOrder, rows: any[]): Promise<void> {
  if (!rows || rows.length === 0) return;

  await putManyLocal(table, rows);

  if (navigator.onLine) {
    try {
      const { error } = await supabase
        .from(table)
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.warn(`Seed upsert failed for ${table}, queuing for sync:`, error.message);
        for (const row of rows) {
          await addToSyncQueue(table, row, 'create');
        }
      }
    } catch (err) {
      console.warn(`Seed upsert threw for ${table}, queuing for sync:`, err);
      for (const row of rows) {
        await addToSyncQueue(table, row, 'create');
      }
    }
  } else {
    for (const row of rows) {
      await addToSyncQueue(table, row, 'create');
    }
  }
}

export async function seedFromBackup(): Promise<void> {
  if (await isSeedCompleted()) return;

  const data = (backupData as any).data;

  for (const table of SEED_ORDER) {
    const rows = data[table];
    if (rows && rows.length > 0) {
      await upsertTable(table, rows);
    }
  }

  await markSeedCompleted();
}

export function getBackupData(): Record<string, any[]> {
  return (backupData as any).data;
}
