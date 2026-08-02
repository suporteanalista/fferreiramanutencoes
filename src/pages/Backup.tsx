import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { Database, Upload, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { saveAs } from 'file-saver';

export default function Backup() {
  const [loading, setLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreData, setRestoreData] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    const [clientes, equipamentos, tecnicos, produtos, ordens, osProdutos, configuracoes] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('equipamentos').select('*'),
      supabase.from('tecnicos').select('*'),
      supabase.from('produtos').select('*'),
      supabase.from('ordens_servico').select('*'),
      supabase.from('os_produtos').select('*'),
      supabase.from('configuracoes').select('*'),
    ]);

    const backup = {
      version: '1.0',
      created_at: new Date().toISOString(),
      data: {
        clientes: clientes.data || [],
        equipamentos: equipamentos.data || [],
        tecnicos: tecnicos.data || [],
        produtos: produtos.data || [],
        ordens_servico: ordens.data || [],
        os_produtos: osProdutos.data || [],
        configuracoes: configuracoes.data || [],
      }
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    saveAs(blob, `backup_serviceos_${new Date().toISOString().split('T')[0]}.json`);
    showToast('Backup exportado com sucesso');
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !data.data) {
          showToast('Arquivo de backup invalido', 'error');
          setRestoreFile(null);
          return;
        }
        setRestoreData(data);
      } catch {
        showToast('Erro ao ler arquivo JSON', 'error');
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!restoreData) return;
    setLoading(true);
    setShowConfirm(false);

    const { data: bd } = restoreData;

    if (bd.clientes?.length) {
      for (const item of bd.clientes) {
        await supabase.from('clientes').upsert(item, { onConflict: 'id' });
      }
    }
    if (bd.equipamentos?.length) {
      for (const item of bd.equipamentos) {
        await supabase.from('equipamentos').upsert(item, { onConflict: 'id' });
      }
    }
    if (bd.tecnicos?.length) {
      for (const item of bd.tecnicos) {
        await supabase.from('tecnicos').upsert(item, { onConflict: 'id' });
      }
    }
    if (bd.produtos?.length) {
      for (const item of bd.produtos) {
        await supabase.from('produtos').upsert(item, { onConflict: 'id' });
      }
    }
    if (bd.ordens_servico?.length) {
      for (const item of bd.ordens_servico) {
        await supabase.from('ordens_servico').upsert(item, { onConflict: 'id' });
      }
    }
    if (bd.os_produtos?.length) {
      for (const item of bd.os_produtos) {
        await supabase.from('os_produtos').upsert(item, { onConflict: 'id' });
      }
    }
    if (bd.configuracoes?.length) {
      for (const item of bd.configuracoes) {
        await supabase.from('configuracoes').upsert(item, { onConflict: 'id' });
      }
    }

    showToast('Backup restaurado com sucesso');
    setLoading(false);
    setRestoreFile(null);
    setRestoreData(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Backup e Restauracao</h1>
        <p className="text-slate-400 text-sm mt-1">Exporte e importe seus dados em formato JSON</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Download className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Exportar Backup</h2>
              <p className="text-sm text-slate-400">Salve todos os dados em um arquivo JSON</p>
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Clientes e equipamentos
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Tecnicos e produtos
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Ordens de servico completas
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Configuracoes do sistema
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50"
          >
            <Database className="w-5 h-5" />
            {loading ? 'Exportando...' : 'Exportar Backup'}
          </button>
        </div>

        {/* Import */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Upload className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Restaurar Backup</h2>
              <p className="text-sm text-slate-400">Importe dados de um arquivo JSON</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block w-full cursor-pointer">
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-sky-500/50 transition-colors">
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{restoreFile ? restoreFile.name : 'Clique para selecionar o arquivo JSON'}</p>
                {restoreData && (
                  <p className="text-xs text-sky-400 mt-2">
                    Backup de {new Date(restoreData.created_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
              <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            </label>
          </div>

          {restoreData && !showConfirm && (
            <div className="bg-slate-700/30 rounded-lg p-4 mb-4 space-y-1.5">
              <p className="text-sm text-slate-300">Conteudo do backup:</p>
              <p className="text-xs text-slate-400">Clientes: {restoreData.data.clientes?.length || 0}</p>
              <p className="text-xs text-slate-400">Equipamentos: {restoreData.data.equipamentos?.length || 0}</p>
              <p className="text-xs text-slate-400">Tecnicos: {restoreData.data.tecnicos?.length || 0}</p>
              <p className="text-xs text-slate-400">Produtos: {restoreData.data.produtos?.length || 0}</p>
              <p className="text-xs text-slate-400">Ordens de Servico: {restoreData.data.ordens_servico?.length || 0}</p>
            </div>
          )}

          {showConfirm && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">Atencao!</span>
              </div>
              <p className="text-sm text-slate-300">Dados existentes com os mesmos IDs serao sobrescritos. Esta acao nao pode ser desfeita. Deseja continuar?</p>
              <div className="flex gap-3 mt-3">
                <button onClick={handleRestore} disabled={loading} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50">
                  {loading ? 'Restaurando...' : 'Sim, restaurar'}
                </button>
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-slate-300 text-sm hover:text-white">Cancelar</button>
              </div>
            </div>
          )}

          {restoreData && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-sky-500/10 border border-sky-500/30 text-sky-400 font-medium rounded-lg hover:bg-sky-500/20 transition-all disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              Restaurar Backup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
