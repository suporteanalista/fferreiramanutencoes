import { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { useOfflineData } from '../hooks/useOfflineData';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import Modal from '../components/ui/Modal';
import { Tecnico } from '../types';
import { Plus, Search, CreditCard as Edit2, Trash2, UserCog, Phone, Mail } from 'lucide-react';

const emptyTecnico: Partial<Tecnico> = { nome: '', especialidade: '', telefone: '', email: '', ativo: true };

export default function Tecnicos() {
  const { data: tecnicos, reload, create, update, remove } = useOfflineData<Tecnico>({ table: 'tecnicos', order: 'nome', ascending: true });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Tecnico>>(emptyTecnico);
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('tecnicos', 'criar');
  const canEditTecnico = hasPermission('tecnicos', 'editar');
  const canDelete = hasPermission('tecnicos', 'excluir');
  const { showToast } = useToast();

  useRealtimeSync(useCallback(() => { reload(); }, [reload]));

  const handleSave = async () => {
    setLoading(true);
    if (editing.id) {
      await update(editing.id, editing);
      showToast('Tecnico atualizado');
    } else {
      await create({ ...editing, criado_em: new Date().toISOString() });
      showToast('Tecnico cadastrado');
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este tecnico?')) return;
    await remove(id);
    showToast('Tecnico excluido');
  };

  const filtered = tecnicos.filter(t =>
    t.nome?.toLowerCase().includes(search.toLowerCase()) ||
    t.especialidade?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tecnicos</h1>
          <p className="text-slate-400 text-sm mt-1">{tecnicos.length} tecnico(s)</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditing(emptyTecnico); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4" /> Novo Tecnico
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="text" placeholder="Buscar por nome ou especialidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tecnico) => (
          <div key={tecnico.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-teal-500/30 transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <UserCog className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{tecnico.nome}</h3>
                  {tecnico.especialidade && <p className="text-xs text-slate-400">{tecnico.especialidade}</p>}
                </div>
              </div>
              {(canEditTecnico || canDelete) && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEditTecnico && <button onClick={() => { setEditing(tecnico); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>}
                  {canDelete && <button onClick={() => handleDelete(tecnico.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {tecnico.telefone && <div className="flex items-center gap-2 text-sm text-slate-300"><Phone className="w-3.5 h-3.5 text-slate-500" /> {tecnico.telefone}</div>}
              {tecnico.email && <div className="flex items-center gap-2 text-sm text-slate-300"><Mail className="w-3.5 h-3.5 text-slate-500" /> {tecnico.email}</div>}
            </div>
            <div className="mt-3">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tecnico.ativo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {tecnico.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-500">Nenhum tecnico encontrado</div>}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Tecnico' : 'Novo Tecnico'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input type="text" value={editing.nome || ''} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidade</label>
            <input type="text" value={editing.especialidade || ''} onChange={(e) => setEditing({ ...editing, especialidade: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Ex: Smartphones, Notebooks, Impressoras" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefone</label>
            <input type="text" value={editing.telefone || ''} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input type="email" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={editing.ativo ?? true} onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
            <span className="text-sm text-slate-300">Ativo</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={loading || !editing.nome} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
