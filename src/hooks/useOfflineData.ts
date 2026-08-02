import { useState, useEffect, useCallback } from 'react';
import { fetchAll, createRecord, updateRecord, deleteRecord } from '../lib/dataService';
import { TableName } from '../lib/offlineDB';
import { onSyncStatusChange } from '../lib/syncEngine';

interface UseOfflineDataOptions {
  table: TableName;
  order?: string;
  ascending?: boolean;
  filters?: Record<string, any>;
}

export function useOfflineData<T = any>(options: UseOfflineDataOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAll(options.table, {
      order: options.order,
      ascending: options.ascending,
      filters: options.filters,
    });
    setData(result as T[]);
    setLoading(false);
  }, [options.table, options.order, options.ascending, JSON.stringify(options.filters)]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = onSyncStatusChange((status, count) => {
      setSyncing(status === 'syncing');
      setPendingCount(count);
      if (status === 'idle') {
        load();
      }
    });
    return unsubscribe;
  }, [load]);

  const create = async (record: Partial<T>) => {
    const newRecord = { ...record, id: (record as any).id || crypto.randomUUID() };
    setData(prev => [newRecord as T, ...prev]);
    await createRecord(options.table, newRecord);
    return newRecord;
  };

  const update = async (id: string, record: Partial<T>) => {
    setData(prev => prev.map(item => (item as any).id === id ? { ...item, ...record } : item));
    await updateRecord(options.table, id, record);
  };

  const remove = async (id: string) => {
    setData(prev => prev.filter(item => (item as any).id !== id));
    await deleteRecord(options.table, id);
  };

  return { data, loading, syncing, pendingCount, reload: load, create, update, remove };
}
