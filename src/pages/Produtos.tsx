import { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { useOfflineData } from '../hooks/useOfflineData';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import Modal from '../components/ui/Modal';
import { Produto } from '../types';
import { Plus, Search, CreditCard as Edit2, Trash2, Package, AlertTriangle } from 'lucide-react';

const emptyProduto: Partial<Produto> = {
  nome: '', descricao: '', codigo: '', quantidade_estoque: 0,
  preco_custo: 0, preco_venda: 0, categoria: ''
};

export default function Produtos() {
  const { data: produtos, reload, create, update, remove } = useOfflineData<Produto>({ table: 'produtos', order: 'nome', ascending: true });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Produto>>(emptyProduto);
  const [loading, setLoading] = useState(false);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('produtos', 'criar');
  const canEditProduto = hasPermission('produtos', 'editar');
  const canDelete = hasPermission('produtos', 'excluir');
  const canEdit = canEditProduto || canDelete;
  const { showToast } = useToast();

  useRealtimeSync(useCallback(() => { reload(); }, [reload]));

  const handleSave = async () => {
    setLoading(true);
    const payload = { ...editing, atualizado_em: new Date().toISOString() };
    if (editing.id) {
      await update(editing.id, payload);
      showToast('Produto atualizado');
    } else {
      await create({ ...payload, criado_em: new Date().toISOString() });
      showToast('Produto cadastrado');
    }
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    await remove(id);
    showToast('Produto excluido');
  };

  const filtered = produtos.filter(p =>
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    p.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Produtos</h1>
          <p className="text-slate-400 text-sm mt-1">{produtos.length} produto(s)</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditing(emptyProduto); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="text" placeholder="Buscar por nome, codigo ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Produto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Codigo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Categoria</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Estoque</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Preco Venda</th>
              {canEdit && <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Acoes</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhum produto encontrado</td></tr>
            ) : (
              filtered.map((produto) => (
                <tr key={produto.id} className="border-b border-slate-700/30 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                        <Package className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{produto.nome}</p>
                        {produto.descricao && <p className="text-xs text-slate-500 truncate max-w-[200px]">{produto.descricao}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-300 font-mono">{produto.codigo || '-'}</td>
                  <td className="px-6 py-3 text-sm text-slate-300">{produto.categoria || '-'}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {produto.quantidade_estoque <= 5 && produto.quantidade_estoque > 0 && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className={`text-sm font-medium ${produto.quantidade_estoque === 0 ? 'text-red-400' : produto.quantidade_estoque <= 5 ? 'text-amber-400' : 'text-white'}`}>
                        {produto.quantidade_estoque}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-emerald-400 font-medium">{formatCurrency(produto.preco_venda)}</td>
                  {canEdit && (
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {canEditProduto && <button onClick={() => { setEditing(produto); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>}
                        {canDelete && <button onClick={() => handleDelete(produto.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Editar Produto' : 'Novo Produto'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input type="text" value={editing.nome || ''} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descricao</label>
            <textarea value={editing.descricao || ''} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-16 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Codigo</label>
            <input type="text" value={editing.codigo || ''} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoria</label>
            <input type="text" value={editing.categoria || ''} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Ex: Tela, Bateria, Placa" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Quantidade em Estoque</label>
            <input type="number" value={editing.quantidade_estoque || 0} onChange={(e) => setEditing({ ...editing, quantidade_estoque: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" min="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Preco de Custo (R$)</label>
            <input type="number" value={editing.preco_custo || 0} onChange={(e) => setEditing({ ...editing, preco_custo: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" min="0" step="0.01" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Preco de Venda (R$)</label>
            <input type="number" value={editing.preco_venda || 0} onChange={(e) => setEditing({ ...editing, preco_venda: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" min="0" step="0.01" />
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
