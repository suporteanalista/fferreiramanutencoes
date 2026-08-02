import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { putLocal, deleteLocal, TableName } from '../lib/offlineDB';

const REALTIME_TABLES: TableName[] = ['clientes', 'equipamentos', 'tecnicos', 'produtos', 'ordens_servico', 'os_produtos'];

export function useRealtimeSync(onDataChange: () => void) {
  useEffect(() => {
    if (!navigator.onLine) return;

    const channels = REALTIME_TABLES.map(table => {
      return supabase
        .channel(`realtime-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, async (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            await putLocal(table, newRecord);
          } else if (eventType === 'DELETE' && oldRecord?.id) {
            await deleteLocal(table, oldRecord.id);
          }

          onDataChange();
        })
        .subscribe();
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [onDataChange]);
}
