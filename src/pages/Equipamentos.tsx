import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { useOfflineData } from '../hooks/useOfflineData';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import Modal from '../components/ui/Modal';
import { Equipamento } from '../types';
import { Plus, Search, CreditCard as Edit2, Trash2, Smartphone, Laptop, Printer, Monitor as MonitorIcon, Pencil, X } from 'lucide-react';

const tipoIcons: Record<string, any> = {
  smartphone: Smartphone, tablet: Smartphone, notebook: Laptop,
  desktop: MonitorIcon, impressora: Printer, monitor: MonitorIcon, outros: MonitorIcon
};

const emptyEquipamento: Partial<Equipamento> = {
  cliente_id: '', tipo: '', marca: '', modelo: '', numero_serie: '',
  imei: '', cor: '', condicao_entrada: '', acessorios: '', observacoes: ''
};

interface TipoEquipamento {
  id: string;
  nome: string;
}

export default function Equipamentos() {
  const { data: equipamentos, reload, create, update, remove } = useOfflineData<Equipamento>({ table: 'equipamentos', order: 'criado_em', ascending: false });
  const { data: clientes } = useOfflineData<{ id: string; nome: string }>({ table: 'clientes', order: 'nome', ascending: true });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Equipamento>>(emptyEquipamento);
  const [loading, setLoading] = useState(false);
  const [tipos, setTipos] = useState<TipoEquipamento[]>([]);
  const [tipoModalOpen, setTipoModalOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<Partial<TipoEquipamento>>({});
  const [tipoLoading, setTipoLoading] = useState(false);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('equipamentos', 'criar');
  const canEditEquip = hasPermission('equipamentos', 'editar');
  const canDelete = hasPermission('equipamentos', 'excluir');
  const { showToast } = useToast();

  useRealtimeSync(useCallback(() => { reload(); }, [reload]));

  useEffect(() => { loadTipos(); }, []);

  const loadTipos = async () => {
    const { data } = await supabase.from('tipos_equipamento').select('id, nome').order('nome');
    setTipos(data || []);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = { ...editing };
    delete payload.cliente;

    if (editing.id) {
      await update(editing.id, payload);
      showToast('Equipamento atualizado');
    } else {
      await create({ ...payload, criado_em: new Date().toISOString() });
      showToast('Equipamento cadastrado');
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este equipamento?')) return;
    await remove(id);
    showToast('Equipamento excluido');
  };

  const openTipoNew = () => {
    setEditingTipo({ nome: '' });
    setTipoModalOpen(true);
  };

  const openTipoEdit = () => {
    const tipo = tipos.find(t => t.nome === editing.tipo);
    if (tipo) {
      setEditingTipo(tipo);
      setTipoModalOpen(true);
    }
  };

  const handleTipoSave = async () => {
    if (!editingTipo.nome?.trim()) return;
    setTipoLoading(true);
    if (editingTipo.id) {
      const oldNome = tipos.find(t => t.id === editingTipo.id)?.nome;
      await supabase.from('tipos_equipamento').update({ nome: editingTipo.nome.trim().toLowerCase() }).eq('id', editingTipo.id);
      if (oldNome && oldNome !== editingTipo.nome.trim().toLowerCase()) {
        await supabase.from('equipamentos').update({ tipo: editingTipo.nome.trim().toLowerCase() }).eq('tipo', oldNome);
        reload();
      }
      showToast('Tipo atualizado');
    } else {
      await supabase.from('tipos_equipamento').insert({ nome: editingTipo.nome.trim().toLowerCase() });
      showToast('Tipo cadastrado');
    }
    setTipoLoading(false);
    setTipoModalOpen(false);
    loadTipos();
  };

  const handleTipoDelete = async () => {
    if (!editing.tipo) return;
    const tipo = tipos.find(t => t.nome === editing.tipo);
    if (!tipo) return;
    if (!confirm(`Excluir o tipo "${tipo.nome}"? Equipamentos com este tipo nao serao afetados.`)) return;
    await supabase.from('tipos_equipamento').delete().eq('id', tipo.id);
    setEditing({ ...editing, tipo: '' });
    showToast('Tipo excluido');
    loadTipos();
  };

  const getClienteNome = (clienteId: string) => {
    const c = clientes.find(cl => cl.id === clienteId);
    return c?.nome || '-';
  };

  const filtered = equipamentos.filter(e =>
    e.marca?.toLowerCase().includes(search.toLowerCase()) ||
    e.modelo?.toLowerCase().includes(search.toLowerCase()) ||
    getClienteNome(e.cliente_id).toLowerCase().includes(search.toLowerCase()) ||
    e.numero_serie?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipamentos</h1>
          <p className="text-slate-400 text-sm mt-1">{equipamentos.length} equipamento(s)</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditing(emptyEquipamento); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4" /> Novo Equipamento
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="text" placeholder="Buscar por marca, modelo, cliente ou serie..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((eq) => {
          const Icon = tipoIcons[eq.tipo] || MonitorIcon;
          return (
            <div key={eq.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-sky-500/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{eq.marca} {eq.modelo}</h3>
                    <p className="text-xs text-slate-400 capitalize">{eq.tipo}</p>
                  </div>
                </div>
                {(canEditEquip || canDelete) && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEditEquip && <button onClick={() => { setEditing(eq); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>}
                    {canDelete && <button onClick={() => handleDelete(eq.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-300 mb-1">Cliente: {getClienteNome(eq.cliente_id)}</p>
              {eq.numero_serie && <p className="text-xs text-slate-500">S/N: {eq.numero_serie}</p>}
              {eq.imei && <p className="text-xs text-slate-500">IMEI: {eq.imei}</p>}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">Nenhum equipamento encontrado</div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Equipamento' : 'Novo Equipamento'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Cliente *</label>
            <select value={editing.cliente_id || ''} onChange={(e) => setEditing({ ...editing, cliente_id: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Selecione um cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo *</label>
            <div className="flex gap-2">
              <select value={editing.tipo || ''} onChange={(e) => setEditing({ ...editing, tipo: e.target.value })} className="flex-1 px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="">Selecione</option>
                {tipos.map(t => <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>)}
              </select>
              <button type="button" onClick={openTipoNew} title="Novo Tipo" className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
              {editing.tipo && (
                <>
                  <button type="button" onClick={openTipoEdit} title="Editar Tipo" className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={handleTipoDelete} title="Excluir Tipo" className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Marca</label>
            <input type="text" value={editing.marca || ''} onChange={(e) => setEditing({ ...editing, marca: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Modelo</label>
            <input type="text" value={editing.modelo || ''} onChange={(e) => setEditing({ ...editing, modelo: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Numero de Serie</label>
            <input type="text" value={editing.numero_serie || ''} onChange={(e) => setEditing({ ...editing, numero_serie: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">IMEI</label>
            <input type="text" value={editing.imei || ''} onChange={(e) => setEditing({ ...editing, imei: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Cor</label>
            <input type="text" value={editing.cor || ''} onChange={(e) => setEditing({ ...editing, cor: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Condicao de Entrada</label>
            <textarea value={editing.condicao_entrada || ''} onChange={(e) => setEditing({ ...editing, condicao_entrada: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-16 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Acessorios</label>
            <input type="text" value={editing.acessorios || ''} onChange={(e) => setEditing({ ...editing, acessorios: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Observacoes</label>
            <input type="text" value={editing.observacoes || ''} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={loading || !editing.cliente_id} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={tipoModalOpen} onClose={() => setTipoModalOpen(false)} title={editingTipo.id ? 'Editar Tipo' : 'Novo Tipo'} size="sm">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome do Tipo *</label>
          <input type="text" value={editingTipo.nome || ''} onChange={(e) => setEditingTipo({ ...editingTipo, nome: e.target.value })} placeholder="Ex: smartphone, tablet..." className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setTipoModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleTipoSave} disabled={tipoLoading || !editingTipo.nome?.trim()} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50">
            {tipoLoading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
