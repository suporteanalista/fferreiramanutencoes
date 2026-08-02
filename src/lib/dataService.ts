import { supabase } from './supabase';
import { TableName, getAllLocal, putManyLocal } from './offlineDB';
import { saveOffline, deleteOffline } from './syncEngine';
import { getBackupData } from './seedData';

export async function fetchAll(table: TableName, options?: { select?: string; order?: string; ascending?: boolean; filters?: Record<string, any> }): Promise<any[]> {
  if (navigator.onLine) {
    let query = supabase.from(table).select(options?.select || '*');
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    if (options?.order) {
      query = query.order(options.order, { ascending: options.ascending ?? true });
    }
    const { data, error } = await query;
    if (!error && data) {
      await putManyLocal(table, data);
      return data;
    }
  }

  const localData = await getAllLocal(table);
  if (options?.order) {
    const field = options.order;
    const asc = options.ascending ?? true;
    localData.sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });
  }
  if (options?.filters) {
    return localData.filter(item =>
      Object.entries(options.filters!).every(([key, value]) => item[key] === value)
    );
  }
  if (localData.length > 0) return localData;

  const backupRows = getBackupData()[table];
  if (backupRows && backupRows.length > 0) {
    return backupRows;
  }

  return [];
}

export async function fetchWithRelations(table: TableName, select: string, options?: { order?: string; ascending?: boolean; filters?: Record<string, any>; limit?: number }): Promise<any[]> {
  if (navigator.onLine) {
    let query = supabase.from(table).select(select);
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    if (options?.order) {
      query = query.order(options.order, { ascending: options.ascending ?? true });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    const { data } = await query;
    return data || [];
  }

  return getAllLocal(table);
}

export async function createRecord(table: TableName, data: any): Promise<{ data: any; error: string | null }> {
  const record = { ...data, id: data.id || crypto.randomUUID() };

  await saveOffline(table, record, 'create');

  return { data: record, error: null };
}

export async function updateRecord(table: TableName, id: string, data: any): Promise<{ error: string | null }> {
  const record = { ...data, id };

  await saveOffline(table, record, 'update');

  return { error: null };
}

export async function deleteRecord(table: TableName, id: string): Promise<{ error: string | null }> {
  await deleteOffline(table, id);
  return { error: null };
}
