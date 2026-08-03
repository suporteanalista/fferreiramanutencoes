import { useState } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { Database, Upload, Download, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { saveAs } from 'file-saver';

const REQUIRED_SECTIONS = [
  'clientes',
  'equipamentos',
  'tecnicos',
  'produtos',
  'ordens_servico',
  'os_produtos',
  'configuracoes',
] as const;

interface TableReport {
  table: string;
  expected: number;
  inserted: number;
  skipped: number;
  failed: number;
}

interface RestoreResult {
  success: boolean;
  error?: string;
  tables?: TableReport[];
  warnings?: string[];
}

export default function Backup() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreData, setRestoreData] = useState<any>(null);
  const [validationError, setValidationError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
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

  const validateBackup = (data: any): string => {
    if (!data || typeof data !== 'object') {
      return 'Arquivo de backup invalido';
    }
    if (!data.version || !data.data) {
      return 'Arquivo de backup invalido: formato incorreto';
    }
    for (const section of REQUIRED_SECTIONS) {
      if (!data.data[section]) {
        return `Secao obrigatoria ausente no backup: ${section}`;
      }
      if (!Array.isArray(data.data[section])) {
        return `Secao "${section}" deve ser uma lista de registros`;
      }
    }
    return '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreResult(null);
    setValidationError('');
    setRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const error = validateBackup(data);
        if (error) {
          setValidationError(error);
          setRestoreData(null);
          showToast(error, 'error');
          return;
        }
        setRestoreData(data);
      } catch {
        setValidationError('Erro ao ler arquivo JSON');
        setRestoreData(null);
        showToast('Erro ao ler arquivo JSON', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!restoreData || !session) return;
    setLoading(true);
    setShowConfirm(false);
    setRestoreResult(null);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/restore-backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(restoreData),
      });

      const result: RestoreResult = await response.json();

      if (!response.ok) {
        setRestoreResult({ success: false, error: result.error || 'Erro ao restaurar backup' });
        showToast(result.error || 'Erro ao restaurar backup', 'error');
        setLoading(false);
        return;
      }

      setRestoreResult(result);

      if (result.success) {
        const allMatch = result.tables?.every(
          (t) => t.expected === t.inserted && t.failed === 0
        );
        if (allMatch) {
          showToast('Backup restaurado com sucesso - todos os registros conferem');
        } else {
          showToast('Backup restaurado com divergencias - verifique o relatorio', 'error');
        }
      } else {
        showToast(result.error || 'Erro ao restaurar backup', 'error');
      }
    } catch {
      setRestoreResult({ success: false, error: 'Erro de conexao com o servidor' });
      showToast('Erro de conexao com o servidor', 'error');
    }
    setLoading(false);
  };

  const resetRestore = () => {
    setRestoreFile(null);
    setRestoreData(null);
    setValidationError('');
    setShowConfirm(false);
    setRestoreResult(null);
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
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${validationError ? 'border-red-500/50' : 'border-slate-600 hover:border-sky-500/50'}`}>
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

          {validationError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400 font-medium">Validacao falhou</p>
                <p className="text-xs text-red-300/80 mt-1">{validationError}</p>
                <p className="text-xs text-slate-400 mt-1">Nenhum dado foi alterado. Corrija o arquivo e tente novamente.</p>
              </div>
            </div>
          )}

          {restoreData && !validationError && !showConfirm && !restoreResult && (
            <div className="bg-slate-700/30 rounded-lg p-4 mb-4 space-y-1.5">
              <p className="text-sm text-slate-300">Conteudo do backup:</p>
              {REQUIRED_SECTIONS.map((section) => (
                <p key={section} className="text-xs text-slate-400">
                  {section}: {restoreData.data[section]?.length || 0} registros
                </p>
              ))}
            </div>
          )}

          {showConfirm && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">Atencao!</span>
              </div>
              <p className="text-sm text-slate-300">Todos os dados atuais serao substituidos pelos dados do backup. Esta acao nao pode ser desfeita. Deseja continuar?</p>
              <div className="flex gap-3 mt-3">
                <button onClick={handleRestore} disabled={loading} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Restaurando...' : 'Sim, restaurar'}
                </button>
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-slate-300 text-sm hover:text-white">Cancelar</button>
              </div>
            </div>
          )}

          {restoreData && !validationError && !showConfirm && !restoreResult && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-sky-500/10 border border-sky-500/30 text-sky-400 font-medium rounded-lg hover:bg-sky-500/20 transition-all disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              Restaurar Backup
            </button>
          )}

          {restoreResult && (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 border ${restoreResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {restoreResult.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${restoreResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {restoreResult.success ? 'Restauracao concluida' : 'Restauracao falhou'}
                  </span>
                </div>

                {restoreResult.error && (
                  <p className="text-xs text-red-300/80 mb-3">{restoreResult.error}</p>
                )}

                {restoreResult.tables && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-5 gap-2 text-xs font-medium text-slate-400 px-2">
                      <span>Tabela</span>
                      <span className="text-right">Esperado</span>
                      <span className="text-right">Inserido</span>
                      <span className="text-right">Falhas</span>
                      <span className="text-center">Status</span>
                    </div>
                    {restoreResult.tables.map((t) => {
                      const match = t.expected === t.inserted && t.failed === 0;
                      return (
                        <div key={t.table} className="grid grid-cols-5 gap-2 text-xs text-slate-300 px-2 py-1.5 bg-slate-800/40 rounded">
                          <span className="font-medium">{t.table}</span>
                          <span className="text-right">{t.expected}</span>
                          <span className="text-right">{t.inserted}</span>
                          <span className="text-right">{t.failed}</span>
                          <span className="text-center">
                            {match ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400 inline" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 inline" />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {restoreResult.warnings && restoreResult.warnings.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {restoreResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400/80">{w}</p>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={resetRestore}
                className="w-full px-4 py-2 text-slate-300 text-sm hover:text-white border border-slate-700 rounded-lg hover:bg-slate-700/30 transition-all"
              >
                Restaurar outro arquivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
