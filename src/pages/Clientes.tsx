import { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { useOfflineData } from '../hooks/useOfflineData';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import Modal from '../components/ui/Modal';
import { Cliente } from '../types';
import { Plus, Search, CreditCard as Edit2, Trash2, Phone, Mail } from 'lucide-react';

const emptyCliente: Partial<Cliente> = {
  nome: '', cpf_cnpj: '', telefone: '', celular: '', email: '',
  endereco: '', bairro: '', cidade: '', estado: '', cep: '', observacoes: ''
};

export default function Clientes() {
  const { data: clientes, reload, create, update, remove } = useOfflineData<Cliente>({ table: 'clientes', order: 'nome', ascending: true });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente>>(emptyCliente);
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('clientes', 'criar');
  const canEditCliente = hasPermission('clientes', 'editar');
  const canDelete = hasPermission('clientes', 'excluir');
  const { showToast } = useToast();

  useRealtimeSync(useCallback(() => { reload(); }, [reload]));

  const handleSave = async () => {
    setLoading(true);
    if (editingCliente.id) {
      await update(editingCliente.id, { ...editingCliente, atualizado_em: new Date().toISOString() });
      showToast('Cliente atualizado com sucesso');
    } else {
      await create({ ...editingCliente, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
      showToast('Cliente cadastrado com sucesso');
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    await remove(id);
    showToast('Cliente excluido');
  };

  const filtered = clientes.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf_cnpj?.includes(search) ||
    c.celular?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-slate-400 text-sm mt-1">{clientes.length} cliente(s) cadastrado(s)</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingCliente(emptyCliente); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Novo Cliente
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome, CPF/CNPJ ou celular..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cliente) => (
          <div key={cliente.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-emerald-500/30 transition-all group">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-white text-lg leading-tight">{cliente.nome}</h3>
              {(canEditCliente || canDelete) && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEditCliente && (
                    <button onClick={() => { setEditingCliente(cliente); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(cliente.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {cliente.cpf_cnpj && <p className="text-sm text-slate-400 mb-2">CPF/CNPJ: {cliente.cpf_cnpj}</p>}
            <div className="space-y-1.5">
              {cliente.celular && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> {cliente.celular}
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-500" /> {cliente.email}
                </div>
              )}
            </div>
            {cliente.cidade && (
              <p className="text-xs text-slate-500 mt-3">{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            {search ? 'Nenhum cliente encontrado para essa busca' : 'Nenhum cliente cadastrado'}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingCliente.id ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input type="text" value={editingCliente.nome || ''} onChange={(e) => setEditingCliente({ ...editingCliente, nome: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">CPF/CNPJ</label>
            <input type="text" value={editingCliente.cpf_cnpj || ''} onChange={(e) => setEditingCliente({ ...editingCliente, cpf_cnpj: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefone</label>
            <input type="text" value={editingCliente.telefone || ''} onChange={(e) => setEditingCliente({ ...editingCliente, telefone: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Celular</label>
            <input type="text" value={editingCliente.celular || ''} onChange={(e) => setEditingCliente({ ...editingCliente, celular: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input type="email" value={editingCliente.email || ''} onChange={(e) => setEditingCliente({ ...editingCliente, email: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Endereco</label>
            <input type="text" value={editingCliente.endereco || ''} onChange={(e) => setEditingCliente({ ...editingCliente, endereco: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Bairro</label>
            <input type="text" value={editingCliente.bairro || ''} onChange={(e) => setEditingCliente({ ...editingCliente, bairro: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Cidade</label>
            <input type="text" value={editingCliente.cidade || ''} onChange={(e) => setEditingCliente({ ...editingCliente, cidade: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Estado</label>
            <input type="text" value={editingCliente.estado || ''} onChange={(e) => setEditingCliente({ ...editingCliente, estado: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">CEP</label>
            <input type="text" value={editingCliente.cep || ''} onChange={(e) => setEditingCliente({ ...editingCliente, cep: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Observacoes</label>
            <textarea value={editingCliente.observacoes || ''} onChange={(e) => setEditingCliente({ ...editingCliente, observacoes: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-20 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={loading || !editingCliente.nome} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
