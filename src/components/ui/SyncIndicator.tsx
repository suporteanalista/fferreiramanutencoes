import { useState, useEffect } from 'react';
import { onSyncStatusChange, fullSync } from '../../lib/syncEngine';
import { Wifi, WifiOff, RefreshCw, CloudOff, Check } from 'lucide-react';

export default function SyncIndicator() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'offline' | 'error'>('idle');
  const [pending, setPending] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const unsubscribe = onSyncStatusChange((s, count) => {
      setStatus(s);
      setPending(count);
    });
    return unsubscribe;
  }, []);

  const statusConfig = {
    idle: { color: 'bg-emerald-500', icon: Check, label: 'Sincronizado', pulse: false },
    syncing: { color: 'bg-amber-500', icon: RefreshCw, label: 'Sincronizando...', pulse: true },
    offline: { color: 'bg-red-500', icon: WifiOff, label: 'Offline', pulse: false },
    error: { color: 'bg-red-500', icon: CloudOff, label: 'Erro de sincronizacao', pulse: false },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-all"
      >
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
        </div>
        <Icon className={`w-4 h-4 text-slate-400 ${status === 'syncing' ? 'animate-spin' : ''}`} />
        {pending > 0 && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
            {pending}
          </span>
        )}
      </button>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${config.color}`} />
                <span className="text-sm font-medium text-white">{config.label}</span>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Conexao</span>
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  {navigator.onLine ? <><Wifi className="w-3 h-3 text-emerald-400" /> Online</> : <><WifiOff className="w-3 h-3 text-red-400" /> Offline</>}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Pendencias</span>
                <span className={`text-xs font-medium ${pending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {pending > 0 ? `${pending} operacao(oes)` : 'Nenhuma'}
                </span>
              </div>
              {navigator.onLine && (
                <button
                  onClick={() => { fullSync(); setShowPanel(false); }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-500/20 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Sincronizar agora
                </button>
              )}
              {!navigator.onLine && (
                <p className="text-xs text-slate-500 text-center py-1">
                  Os dados serao sincronizados automaticamente quando a conexao for restabelecida.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
