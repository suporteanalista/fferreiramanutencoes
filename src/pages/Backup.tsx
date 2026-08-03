import { useState } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { Database, Upload, Download, AlertTriangle, CheckCircle, XCircle, Loader2, FileJson, Clock } from 'lucide-react';
import { saveAs } from 'file-saver';

const SYSTEM_VERSION = '2.0';
const DATABASE_VERSION = '20260803200000';

const TABLE_LIST = [
  'configuracoes',
  'profiles',
  'tipos_equipamento',
  'clientes',
  'tecnicos',
  'produtos',
  'equipamentos',
  'ordens_servico',
  'os_produtos',
  'os_servicos',
] as const;

const SECTION_LABELS: Record<string, string> = {
  configuracoes: 'Configuracoes',
  profiles: 'Usuarios',
  tipos_equipamento: 'Tipos de Equipamento',
  clientes: 'Clientes',
  tecnicos: 'Tecnicos',
  produtos: 'Produtos',
  equipamentos: 'Equipamentos',
  ordens_servico: 'Ordens de Servico',
  os_produtos: 'Itens de OS',
  os_servicos: 'Servicos de OS',
};

interface TableReport {
  table: string;
  expected: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface RestoreResult {
  success: boolean;
  error?: string;
  systemVersion?: string;
  tables?: TableReport[];
  totals?: {
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  validation_errors?: string[];
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function generateBackupFilename(): string {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `FFManutencoes_Backup_${date}_${time}.json`;
}

export default function Backup() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreData, setRestoreData] = useState<any>(null);
  const [validationError, setValidationError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreProgress, setRestoreProgress] = useState('');
  const { showToast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    setExportStatus('Lendo dados do banco...');

    try {
      const results: Record<string, any[]> = {};
      let totalRecords = 0;

      for (const table of TABLE_LIST) {
        setExportStatus(`Lendo ${SECTION_LABELS[table]}...`);
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          showToast(`Erro ao ler ${SECTION_LABELS[table]}: ${error.message}`, 'error');
          setLoading(false);
          setExportStatus('');
          return;
        }
        results[table] = data || [];
        totalRecords += (data || []).length;
      }

      setExportStatus('Montando arquivo de backup...');

      const backup = {
        systemVersion: SYSTEM_VERSION,
        backupDate: new Date().toISOString(),
        databaseVersion: DATABASE_VERSION,
        data: results,
      };

      setExportStatus('Validando exportacao...');
      const validationError = validateBackup(backup);
      if (validationError) {
        showToast(`Validacao falhou: ${validationError}`, 'error');
        setLoading(false);
        setExportStatus('');
        return;
      }

      setExportStatus('Gerando arquivo...');
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      saveAs(blob, generateBackupFilename());

      showToast(`Backup exportado com sucesso - ${totalRecords} registros`);
      setExportStatus('');
    } catch (err) {
      showToast(`Erro ao exportar: ${err instanceof Error ? err.message : 'erro desconhecido'}`, 'error');
      setExportStatus('');
    }

    setLoading(false);
  };

  const validateBackup = (data: any): string => {
    if (!data || typeof data !== 'object') {
      return 'Arquivo de backup invalido';
    }
    if (!data.systemVersion && !data.version) {
      return 'Arquivo de backup invalido: campo "systemVersion" ausente';
    }
    if (!data.backupDate && !data.created_at) {
      return 'Arquivo de backup invalido: campo "backupDate" ausente';
    }
    if (!data.data) {
      return 'Arquivo de backup invalido: secao "data" ausente';
    }
    for (const section of TABLE_LIST) {
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
        setValidationError('Erro ao ler arquivo JSON - arquivo corrompido ou formato invalido');
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
    setRestoreProgress('Enviando backup para o servidor...');

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/restore-backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(restoreData),
      });

      setRestoreProgress('Processando restauracao...');

      const result: RestoreResult = await response.json();

      if (!response.ok) {
        setRestoreResult(result);
        showToast(result.error || 'Erro ao restaurar backup', 'error');
        setRestoreProgress('');
        setLoading(false);
        return;
      }

      setRestoreResult(result);

      if (result.success) {
        const totals = result.totals;
        if (totals && totals.errors === 0) {
          showToast(`Backup restaurado - ${totals.inserted} inseridos, ${totals.updated} atualizados, ${totals.skipped} ignorados`);
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
    setRestoreProgress('');
    setLoading(false);
  };

  const resetRestore = () => {
    setRestoreFile(null);
    setRestoreData(null);
    setValidationError('');
    setShowConfirm(false);
    setRestoreResult(null);
    setRestoreProgress('');
  };

  const totalBackupRecords = restoreData
    ? TABLE_LIST.reduce((acc, s) => acc + (restoreData.data[s]?.length || 0), 0)
    : 0;

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
              <p className="text-sm text-slate-400">Salva todos os dados em um arquivo JSON</p>
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Clientes, equipamentos e tecnicos
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Produtos e tipos de equipamento
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Ordens de servico completas
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Configuracoes e usuarios
            </div>
          </div>

          {exportStatus && (
            <div className="bg-slate-700/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-sm text-slate-300">{exportStatus}</span>
            </div>
          )}

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
              <p className="text-sm text-slate-400">Importa dados de um arquivo JSON (preserva IDs)</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block w-full cursor-pointer">
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${validationError ? 'border-red-500/50' : 'border-slate-600 hover:border-sky-500/50'}`}>
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{restoreFile ? restoreFile.name : 'Clique para selecionar o arquivo JSON'}</p>
                {restoreData && (
                  <p className="text-xs text-sky-400 mt-2 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    Backup de {new Date(restoreData.backupDate || restoreData.created_at).toLocaleString('pt-BR')}
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

          {/* Preview before restore */}
          {restoreData && !validationError && !showConfirm && !restoreResult && (
            <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <FileJson className="w-4 h-4 text-sky-400" />
                <p className="text-sm text-slate-300 font-medium">Preview do Backup</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Versao do sistema</span>
                  <span className="text-slate-300">{restoreData.systemVersion || restoreData.version}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Data do backup</span>
                  <span className="text-slate-300">{new Date(restoreData.backupDate || restoreData.created_at).toLocaleString('pt-BR')}</span>
                </div>
                {restoreData.databaseVersion && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Versao do banco</span>
                    <span className="text-slate-300">{restoreData.databaseVersion}</span>
                  </div>
                )}
                <div className="border-t border-slate-600/50 my-2"></div>
                {TABLE_LIST.map((section) => (
                  <div key={section} className="flex justify-between text-xs">
                    <span className="text-slate-400">{SECTION_LABELS[section]}</span>
                    <span className="text-slate-300">{restoreData.data[section]?.length || 0} registros</span>
                  </div>
                ))}
                <div className="border-t border-slate-600/50 my-2"></div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">Total</span>
                  <span className="text-sky-400">{totalBackupRecords} registros</span>
                </div>
              </div>
            </div>
          )}

          {showConfirm && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">Confirmacao necessaria</span>
              </div>
              <p className="text-sm text-slate-300 font-medium mb-2">
                Restoring will replace existing data.<br />
                Create a backup before continuing.
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Serao processados {totalBackupRecords} registros. Registros existentes serao atualizados, novos serao inseridos. IDs e relacionamentos serao preservados.
              </p>
              <div className="flex gap-3">
                <button onClick={handleRestore} disabled={loading} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Restaurando...' : 'Sim, restaurar'}
                </button>
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-slate-300 text-sm hover:text-white">Cancelar</button>
              </div>
            </div>
          )}

          {restoreProgress && (
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3 mb-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
              <span className="text-sm text-sky-300">{restoreProgress}</span>
            </div>
          )}

          {restoreData && !validationError && !showConfirm && !restoreResult && !loading && (
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

                {/* Validation errors */}
                {restoreResult.validation_errors && restoreResult.validation_errors.length > 0 && (
                  <div className="mb-3 space-y-1">
                    <p className="text-xs text-red-400 font-medium">Erros de validacao ({restoreResult.validation_errors.length}):</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {restoreResult.validation_errors.slice(0, 20).map((err, i) => (
                        <p key={i} className="text-xs text-red-300/80 pl-3 border-l-2 border-red-500/30">{err}</p>
                      ))}
                      {restoreResult.validation_errors.length > 20 && (
                        <p className="text-xs text-slate-400 pl-3">... e mais {restoreResult.validation_errors.length - 20} erros</p>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Nenhum dado foi alterado para os registros com erro.</p>
                  </div>
                )}

                {/* Totals summary */}
                {restoreResult.totals && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-emerald-400">{restoreResult.totals.inserted}</p>
                      <p className="text-xs text-slate-400">Inseridos</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-sky-400">{restoreResult.totals.updated}</p>
                      <p className="text-xs text-slate-400">Atualizados</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-slate-300">{restoreResult.totals.skipped}</p>
                      <p className="text-xs text-slate-400">Ignorados</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <p className={`text-lg font-bold ${restoreResult.totals.errors > 0 ? 'text-red-400' : 'text-slate-300'}`}>{restoreResult.totals.errors}</p>
                      <p className="text-xs text-slate-400">Erros</p>
                    </div>
                  </div>
                )}

                {/* Per-table report */}
                {restoreResult.tables && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 gap-2 text-xs font-medium text-slate-400 px-2">
                      <span>Tabela</span>
                      <span className="text-right">Esperado</span>
                      <span className="text-right">Inserido</span>
                      <span className="text-right">Atualizado</span>
                      <span className="text-right">Ignorado</span>
                      <span className="text-center">Erros</span>
                    </div>
                    {restoreResult.tables.map((t) => {
                      const hasErrors = t.errors > 0;
                      return (
                        <div key={t.table} className="grid grid-cols-6 gap-2 text-xs text-slate-300 px-2 py-1.5 bg-slate-800/40 rounded">
                          <span className="font-medium">{SECTION_LABELS[t.table] || t.table}</span>
                          <span className="text-right">{t.expected}</span>
                          <span className="text-right text-emerald-400/80">{t.inserted}</span>
                          <span className="text-right text-sky-400/80">{t.updated}</span>
                          <span className="text-right text-slate-400">{t.skipped}</span>
                          <span className={`text-center ${hasErrors ? 'text-red-400 font-medium' : 'text-slate-300'}`}>
                            {t.errors}
                          </span>
                        </div>
                      );
                    })}
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
