import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

interface SyncMeta {
  table: string;
  last_sync: string;
}

interface ServiceOSDB extends DBSchema {
  clientes: { key: string; value: any; indexes: { 'by-updated': string } };
  equipamentos: { key: string; value: any; indexes: { 'by-updated': string } };
  tecnicos: { key: string; value: any; indexes: { 'by-updated': string } };
  produtos: { key: string; value: any; indexes: { 'by-updated': string } };
  ordens_servico: { key: string; value: any; indexes: { 'by-updated': string } };
  os_produtos: { key: string; value: any; indexes: { 'by-os': string } };
  os_servicos: { key: string; value: any; indexes: { 'by-os': string } };
  configuracoes: { key: string; value: any };
  sync_queue: { key: string; value: SyncQueueItem; indexes: { 'by-timestamp': string } };
  sync_metadata: { key: string; value: SyncMeta };
}

const DB_NAME = 'serviceos-offline';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<ServiceOSDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<ServiceOSDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ServiceOSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const clientes = db.createObjectStore('clientes', { keyPath: 'id' });
      clientes.createIndex('by-updated', 'atualizado_em');

      const equipamentos = db.createObjectStore('equipamentos', { keyPath: 'id' });
      equipamentos.createIndex('by-updated', 'criado_em');

      const tecnicos = db.createObjectStore('tecnicos', { keyPath: 'id' });
      tecnicos.createIndex('by-updated', 'criado_em');

      const produtos = db.createObjectStore('produtos', { keyPath: 'id' });
      produtos.createIndex('by-updated', 'atualizado_em');

      const ordens = db.createObjectStore('ordens_servico', { keyPath: 'id' });
      ordens.createIndex('by-updated', 'atualizado_em');

      const osProdutos = db.createObjectStore('os_produtos', { keyPath: 'id' });
      osProdutos.createIndex('by-os', 'ordem_servico_id');

      if (!db.objectStoreNames.contains('os_servicos')) {
        const osServicos = db.createObjectStore('os_servicos', { keyPath: 'id' });
        osServicos.createIndex('by-os', 'ordem_servico_id');
      }

      db.createObjectStore('configuracoes', { keyPath: 'id' });

      const syncQueue = db.createObjectStore('sync_queue', { keyPath: 'id' });
      syncQueue.createIndex('by-timestamp', 'timestamp');

      db.createObjectStore('sync_metadata', { keyPath: 'table' });
    },
  });

  return dbInstance;
}

export type TableName = 'clientes' | 'equipamentos' | 'tecnicos' | 'produtos' | 'ordens_servico' | 'os_produtos' | 'os_servicos' | 'configuracoes';

export async function getAllLocal(table: TableName): Promise<any[]> {
  const db = await getDB();
  return db.getAll(table);
}

export async function getLocalById(table: TableName, id: string): Promise<any | undefined> {
  const db = await getDB();
  return db.get(table, id);
}

export async function putLocal(table: TableName, data: any): Promise<void> {
  const db = await getDB();
  await db.put(table, data);
}

export async function putManyLocal(table: TableName, items: any[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(table, 'readwrite');
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function deleteLocal(table: TableName, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(table, id);
}

export async function clearTable(table: TableName): Promise<void> {
  const db = await getDB();
  await db.clear(table);
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDB();
  const entry: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  await db.put('sync_queue', entry);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync_queue', 'by-timestamp');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('sync_queue');
}

export async function getLastSync(table: string): Promise<string | null> {
  const db = await getDB();
  const meta = await db.get('sync_metadata', table);
  return meta?.last_sync || null;
}

export async function setLastSync(table: string, timestamp: string): Promise<void> {
  const db = await getDB();
  await db.put('sync_metadata', { table, last_sync: timestamp });
}
