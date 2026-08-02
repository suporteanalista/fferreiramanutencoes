import { supabase } from './supabase';
import {
  TableName, putManyLocal, putLocal, deleteLocal,
  addToSyncQueue, getSyncQueue, removeSyncQueueItem,
  getLastSync, setLastSync, getSyncQueueCount
} from './offlineDB';

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
type SyncListener = (status: SyncStatus, pendingCount: number) => void;

const listeners: Set<SyncListener> = new Set();
let currentStatus: SyncStatus = navigator.onLine ? 'idle' : 'offline';
let syncInterval: ReturnType<typeof setInterval> | null = null;
let pendingCount = 0;

const TABLE_ORDER: TableName[] = ['configuracoes', 'clientes', 'tecnicos', 'produtos', 'equipamentos', 'ordens_servico', 'os_produtos', 'os_servicos'];

export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(currentStatus, pendingCount);
  return () => { listeners.delete(listener); };
}

function notifyListeners() {
  listeners.forEach(l => l(currentStatus, pendingCount));
}

function setStatus(status: SyncStatus) {
  currentStatus = status;
  notifyListeners();
}

async function updatePendingCount() {
  pendingCount = await getSyncQueueCount();
  notifyListeners();
}

export async function pushLocalChanges(): Promise<void> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      if (item.operation === 'create') {
        const { error } = await supabase.from(item.table).insert(item.data);
        if (error) {
          if (error.code === '23505') {
            await supabase.from(item.table).update(item.data).eq('id', item.data.id);
          } else {
            console.error(`Sync push error (${item.table}):`, error);
            continue;
          }
        }
      } else if (item.operation === 'update') {
        const { error } = await supabase.from(item.table).update(item.data).eq('id', item.data.id);
        if (error) {
          console.error(`Sync update error (${item.table}):`, error);
          continue;
        }
      } else if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.data.id);
        if (error && error.code !== 'PGRST116') {
          console.error(`Sync delete error (${item.table}):`, error);
          continue;
        }
      }
      await removeSyncQueueItem(item.id);
    } catch (err) {
      console.error('Sync push failed for item:', item, err);
    }
  }
  await updatePendingCount();
}

export async function pullRemoteChanges(): Promise<void> {
  for (const table of TABLE_ORDER) {
    try {
      const lastSync = await getLastSync(table);
      let query = supabase.from(table).select('*');

      if (lastSync && table !== 'configuracoes' && table !== 'os_produtos' && table !== 'os_servicos') {
        const timeField = (table === 'clientes' || table === 'produtos' || table === 'ordens_servico') ? 'atualizado_em' : 'criado_em';
        query = query.gte(timeField, lastSync);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`Pull error (${table}):`, error);
        continue;
      }

      if (data && data.length > 0) {
        await putManyLocal(table, data);
      }

      await setLastSync(table, new Date().toISOString());
    } catch (err) {
      console.error(`Pull failed for ${table}:`, err);
    }
  }
}

export async function fullSync(): Promise<void> {
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  setStatus('syncing');
  try {
    await pushLocalChanges();
    await pullRemoteChanges();
    setStatus('idle');
  } catch (err) {
    console.error('Full sync error:', err);
    setStatus('error');
  }
}

export async function initialSync(): Promise<void> {
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  setStatus('syncing');
  try {
    for (const table of TABLE_ORDER) {
      const { data } = await supabase.from(table).select('*');
      if (data && data.length > 0) {
        await putManyLocal(table, data);
      }
      await setLastSync(table, new Date().toISOString());
    }
    setStatus('idle');
  } catch (err) {
    console.error('Initial sync error:', err);
    setStatus('error');
  }
}

export function startPeriodicSync(intervalMs = 10000): void {
  if (syncInterval) return;
  syncInterval = setInterval(() => {
    if (navigator.onLine) fullSync();
  }, intervalMs);
}

export function stopPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export function initConnectivityListeners(): void {
  window.addEventListener('online', () => {
    fullSync();
  });

  window.addEventListener('offline', () => {
    setStatus('offline');
  });

  updatePendingCount();
}

export async function saveOffline(table: TableName, data: any, operation: 'create' | 'update'): Promise<void> {
  await putLocal(table, data);
  await addToSyncQueue({ table, operation, data });
  await updatePendingCount();

  if (navigator.onLine) {
    await pushLocalChanges();
  }
}

export async function deleteOffline(table: TableName, id: string): Promise<void> {
  await deleteLocal(table, id);
  await addToSyncQueue({ table, operation: 'delete', data: { id } });
  await updatePendingCount();

  if (navigator.onLine) {
    await pushLocalChanges();
  }
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function getPendingCount(): number {
  return pendingCount;
}
