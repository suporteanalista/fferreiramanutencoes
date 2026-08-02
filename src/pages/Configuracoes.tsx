import { useEffect, useState } from 'react';
import { useToast } from '../components/ui/Toast';
import { useOfflineData } from '../hooks/useOfflineData';
import { Save, Building2, Phone, MapPin, FileText } from 'lucide-react';
import { Configuracao } from '../types';

export default function Configuracoes() {
  const { data: configs, create, update } = useOfflineData<Configuracao>({ table: 'configuracoes' });
  const [config, setConfig] = useState<Partial<Configuracao>>({
    nome_empresa: '', razao_social: '', cnpj: '', logo_url: '',
    telefone: '', celular: '', email: '', endereco: '',
    bairro: '', cidade: '', estado: '', cep: '',
    inscricao_estadual: '', inscricao_municipal: '', responsavel: '', site: '',
  });
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (configs.length > 0) setConfig(configs[0]);
  }, [configs]);

  const handleSave = async () => {
    setLoading(true);
    const payload = { ...config, atualizado_em: new Date().toISOString() };
    if (config.id) {
      await update(config.id, payload);
    } else {
      await create(payload);
    }
    showToast('Configuracoes salvas');
    setLoading(false);
  };

  const set = (field: keyof Configuracao, value: string) => setConfig({ ...config, [field]: value });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuracoes</h1>
          <p className="text-slate-400 text-sm mt-1">Dados da empresa e personalizacao do sistema</p>
        </div>
        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20">
          <Save className="w-4 h-4" />
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Identificacao */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Identificacao da Empresa</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome Fantasia</label>
            <input type="text" value={config.nome_empresa || ''} onChange={(e) => set('nome_empresa', e.target.value)} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Razao Social</label>
            <input type="text" value={config.razao_social || ''} onChange={(e) => set('razao_social', e.target.value)} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">CNPJ</label>
            <input type="text" value={config.cnpj || ''} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Responsavel</label>
            <input type="text" value={config.responsavel || ''} onChange={(e) => set('responsavel', e.target.value)} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
          </div>
        </div>
      </div>

      {/* Contato */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <Phone className="w-4 h-4 text-sky-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Contato</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Telefone Fixo</label>
            <input type="text" value={config.telefone || ''} onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 0000-0000" className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Celular / WhatsApp</label>
            <input type="text" value={config.celular || ''} onChange={(e) => set('celular', e.target.value)} placeholder="(00) 00000-0000" className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input type="email" value={config.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="contato@empresa.com" className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Website</label>
            <input type="url" value={config.site || ''} onChange={(e) => set('site', e.target.value)} placeholder="https://www.empresa.com" className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">URL da Logo (para relatorios)</label>
            <input type="url" value={config.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://..." className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
        </div>
      </div>

      {/* Endereco */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Endereco</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Logradouro</label>
            <input type="text" value={config.endereco || ''} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, numero" className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Bairro</label>
            <input type="text" value={config.bairro || ''} onChange={(e) => set('bairro', e.target.value)} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Cidade</label>
            <input type="text" value={config.cidade || ''} onChange={(e) => set('cidade', e.target.value)} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Estado</label>
            <input type="text" value={config.estado || ''} onChange={(e) => set('estado', e.target.value)} placeholder="UF" maxLength={2} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">CEP</label>
            <input type="text" value={config.cep || ''} onChange={(e) => set('cep', e.target.value)} placeholder="00000-000" className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-slate-500" />
          </div>
        </div>
      </div>

      {/* Fiscal */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-slate-500/10 border border-slate-500/30 flex items-center justify-center">
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Dados Fiscais</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Inscricao Estadual</label>
            <input type="text" value={config.inscricao_estadual || ''} onChange={(e) => set('inscricao_estadual', e.target.value)} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Inscricao Municipal</label>
            <input type="text" value={config.inscricao_municipal || ''} onChange={(e) => set('inscricao_municipal', e.target.value)} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
          </div>
        </div>
      </div>

      {/* Save button at bottom */}
      <div className="flex justify-end pb-4">
        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20">
          <Save className="w-4 h-4" />
          {loading ? 'Salvando...' : 'Salvar Configuracoes'}
        </button>
      </div>
    </div>
  );
}
