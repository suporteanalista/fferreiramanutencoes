import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { fetchAll, fetchWithRelations } from '../lib/dataService';
import { saveOffline, onSyncStatusChange } from '../lib/syncEngine';
import { getAllLocal } from '../lib/offlineDB';
import { generateOSPdf } from '../lib/osPdf';
import { printOS } from '../lib/osPrint';
import Modal from '../components/ui/Modal';
import { OrdemServico, Produto, OsProduto, OsServico, Cliente, Equipamento, Tecnico } from '../types';
import {
  Plus, Search, Clock, AlertTriangle, CheckCircle, Truck,
  ChevronRight, ChevronLeft, Package, Trash2, DollarSign, Pencil, X,
  FileText, Printer, Calendar, Wrench
} from 'lucide-react';

interface TipoEquipamento {
  id: string;
  nome: string;
}

type ViewMode = 'kanban' | 'list';

const statusConfig = {
  aberta: { label: 'Aberta', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: AlertTriangle, headerColor: 'border-amber-500' },
  em_andamento: { label: 'Em Andamento', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30', icon: Clock, headerColor: 'border-sky-500' },
  aguardando_peca: { label: 'Aguard. Peca', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', icon: Package, headerColor: 'border-orange-500' },
  concluida: { label: 'Concluida', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle, headerColor: 'border-emerald-500' },
  entregue: { label: 'Entregue', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30', icon: Truck, headerColor: 'border-slate-500' },
};

const prioridadeColors: Record<string, string> = {
  baixa: 'bg-slate-500/20 text-slate-400',
  normal: 'bg-sky-500/20 text-sky-400',
  alta: 'bg-amber-500/20 text-amber-400',
  urgente: 'bg-red-500/20 text-red-400',
};

export default function OrdensServico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [equipamentos, setEquipamentos] = useState<{ id: string; cliente_id: string; marca: string; modelo: string; tipo: string }[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nome: string }[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OrdemServico | null>(null);
  const [editing, setEditing] = useState<Partial<OrdemServico>>({});
  const [osProdutos, setOsProdutos] = useState<Partial<OsProduto>[]>([]);
  const [osServicos, setOsServicos] = useState<Partial<OsServico>[]>([]);
  const [novoServico, setNovoServico] = useState({ descricao: '', quantidade: 1, preco_unitario: 0 });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState<Partial<Equipamento>>({});
  const [equipLoading, setEquipLoading] = useState(false);
  const [tipos, setTipos] = useState<TipoEquipamento[]>([]);
  const [tipoModalOpen, setTipoModalOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<Partial<TipoEquipamento>>({});
  const [tipoLoading, setTipoLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [swipeState, setSwipeState] = useState<{ osId: string; offsetX: number; direction: 'left' | 'right' | null } | null>(null);
  const touchRef = useRef<{ startX: number; startY: number; osId: string; status: string; locked: boolean } | null>(null);
  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente>>({});
  const [clienteLoading, setClienteLoading] = useState(false);
  const [tecnicoModalOpen, setTecnicoModalOpen] = useState(false);
  const [editingTecnico, setEditingTecnico] = useState<Partial<Tecnico>>({});
  const [tecnicoLoading, setTecnicoLoading] = useState(false);
  const [produtoModalOpen, setProdutoModalOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Partial<Produto>>({});
  const [produtoLoading, setProdutoLoading] = useState(false);
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission('ordens', 'criar');
  const canEdit = hasPermission('ordens', 'editar');
  const canDelete = hasPermission('ordens', 'excluir');
  const { showToast } = useToast();

  useEffect(() => { loadAll(); loadTipos(); }, []);

  useEffect(() => {
    return onSyncStatusChange((status) => {
      if (status === 'idle') loadAll();
    });
  }, []);

  const loadTipos = async () => {
    const { data } = await supabase.from('tipos_equipamento').select('id, nome').order('nome');
    setTipos(data || []);
  };

  const loadAll = useCallback(async () => {
    const [osData, clData, eqData, tcData, prData] = await Promise.all([
      fetchWithRelations('ordens_servico', '*, cliente:clientes(nome, celular), equipamento:equipamentos(marca, modelo, tipo), tecnico:tecnicos(nome)', { order: 'criado_em', ascending: false }),
      fetchAll('clientes', { select: 'id, nome', order: 'nome' }),
      fetchAll('equipamentos', { select: 'id, cliente_id, marca, modelo, tipo', order: 'marca' }),
      fetchAll('tecnicos', { order: 'nome', filters: { ativo: true } }),
      fetchAll('produtos', { order: 'nome' }),
    ]);
    setOrdens(osData || []);
    setClientes((clData || []).map((c: any) => ({ id: c.id, nome: c.nome })));
    setEquipamentos((eqData || []).map((e: any) => ({ id: e.id, cliente_id: e.cliente_id, marca: e.marca || '', modelo: e.modelo || '', tipo: e.tipo || '' })));
    setTecnicos((tcData || []).map((t: any) => ({ id: t.id, nome: t.nome })));
    setProdutos(prData || []);
  }, []);

  useRealtimeSync(useCallback(() => { loadAll(); }, [loadAll]));

  const openNew = () => {
    setEditing({ status: 'aberta', prioridade: 'normal', defeito_relatado: '', valor_servico: 0, criado_por: user?.id, data_revisao_futura: null } as any);
    setOsProdutos([]);
    setOsServicos([]);
    setNovoServico({ descricao: '', quantidade: 1, preco_unitario: 0 });
    setStep(1);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const produtosTotal = osProdutos.reduce((sum, p) => sum + (p.preco_total || 0), 0);
      const servicosTotal = osServicos.reduce((sum, s) => sum + (s.preco_total || 0), 0);
      const payload: any = { ...editing, valor_servico: servicosTotal, valor_total: servicosTotal + produtosTotal, atualizado_em: new Date().toISOString() };
      delete payload.cliente;
      delete payload.equipamento;
      delete payload.tecnico;
      delete payload.os_produtos;
      delete payload.os_servicos;

      if (editing.id) {
        if (navigator.onLine) {
          await supabase.from('os_produtos').delete().eq('ordem_servico_id', editing.id);
          await supabase.from('os_servicos').delete().eq('ordem_servico_id', editing.id);
        }
        const clienteObj = clientes.find(c => c.id === payload.cliente_id);
        const equipObj = equipamentos.find(e => e.id === payload.equipamento_id);
        const tecnicoObj = tecnicos.find(t => t.id === payload.tecnico_id);
        setOrdens(prev => prev.map(o => o.id === editing.id ? { ...o, ...payload, cliente: clienteObj ? { nome: clienteObj.nome } : o.cliente, equipamento: equipObj || o.equipamento, tecnico: tecnicoObj ? { nome: tecnicoObj.nome } : o.tecnico } : o));
        await saveOffline('ordens_servico', payload, 'update');
        for (const p of osProdutos) {
          const prodRecord = { ...p, id: p.id || crypto.randomUUID(), ordem_servico_id: editing.id };
          await saveOffline('os_produtos', prodRecord, 'create');
        }
        for (const s of osServicos) {
          const svcRecord = { ...s, id: s.id || crypto.randomUUID(), ordem_servico_id: editing.id };
          await saveOffline('os_servicos', svcRecord, 'create');
        }
        showToast('OS atualizada');
      } else {
        const newId = crypto.randomUUID();
        payload.id = newId;
        payload.data_entrada = payload.data_entrada || new Date().toISOString();
        payload.criado_em = new Date().toISOString();
        const clienteObj = clientes.find(c => c.id === payload.cliente_id);
        const equipObj = equipamentos.find(e => e.id === payload.equipamento_id);
        const tecnicoObj = tecnicos.find(t => t.id === payload.tecnico_id);
        setOrdens(prev => [{ ...payload, cliente: clienteObj ? { nome: clienteObj.nome } : null, equipamento: equipObj || null, tecnico: tecnicoObj ? { nome: tecnicoObj.nome } : null, os_produtos: [], os_servicos: [] } as any, ...prev]);
        await saveOffline('ordens_servico', payload, 'create');
        for (const p of osProdutos) {
          const prodRecord = { ...p, id: crypto.randomUUID(), ordem_servico_id: newId };
          await saveOffline('os_produtos', prodRecord, 'create');
        }
        for (const s of osServicos) {
          const svcRecord = { ...s, id: crypto.randomUUID(), ordem_servico_id: newId };
          await saveOffline('os_servicos', svcRecord, 'create');
        }
        showToast('OS criada com sucesso');
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      console.error('Erro ao salvar OS:', err);
      showToast('Erro ao salvar OS. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (osId: string, newStatus: string) => {
    const existingOS = ordens.find(o => o.id === osId);
    if (!existingOS) return;
    setOrdens(prev => prev.map(o => o.id === osId ? { ...o, status: newStatus as any } : o));
    const updateData: any = { ...existingOS, status: newStatus, atualizado_em: new Date().toISOString() };
    delete updateData.cliente;
    delete updateData.equipamento;
    delete updateData.tecnico;
    delete updateData.os_produtos;
    delete updateData.os_servicos;
    if (newStatus === 'concluida') updateData.data_conclusao = new Date().toISOString();
    await saveOffline('ordens_servico', updateData, 'update');
    loadAll();
    showToast('Status atualizado');
  };

  const deleteOS = async (osId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ordem de servico? Esta acao nao pode ser desfeita.')) return;
    const { error } = await supabase.from('ordens_servico').delete().eq('id', osId);
    if (error) { showToast('Erro ao excluir OS'); return; }
    setDetailModal(false);
    loadAll();
    showToast('Ordem de servico excluida');
  };

  const openDetail = async (os: OrdemServico) => {
    let prods: any[] = [];
    let svcs: any[] = [];
    if (navigator.onLine) {
      const [prodRes, svcRes] = await Promise.all([
        supabase.from('os_produtos').select('*, produto:produtos(nome)').eq('ordem_servico_id', os.id),
        supabase.from('os_servicos').select('*').eq('ordem_servico_id', os.id),
      ]);
      prods = prodRes.data || [];
      svcs = svcRes.data || [];
    }
    setSelectedOS({ ...os, os_produtos: prods, os_servicos: svcs });
    setDetailModal(true);
  };

  const openEdit = (os: OrdemServico) => {
    setEditing(os);
    setOsProdutos(os.os_produtos || []);
    setOsServicos(os.os_servicos || []);
    setNovoServico({ descricao: '', quantidade: 1, preco_unitario: 0 });
    setStep(1);
    setModalOpen(true);
    setDetailModal(false);
  };

  const addProdutoToOS = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    setOsProdutos([...osProdutos, { produto_id: produtoId, quantidade: 1, preco_unitario: produto.preco_venda, preco_total: produto.preco_venda }]);
  };

  const updateOsProdutoQty = (index: number, qty: number) => {
    const updated = [...osProdutos];
    updated[index] = { ...updated[index], quantidade: qty, preco_total: qty * (updated[index].preco_unitario || 0) };
    setOsProdutos(updated);
  };

  const removeOsProduto = (index: number) => {
    setOsProdutos(osProdutos.filter((_, i) => i !== index));
  };

  const addServicoToOS = () => {
    if (!novoServico.descricao.trim()) return;
    const total = novoServico.quantidade * novoServico.preco_unitario;
    setOsServicos([...osServicos, { descricao: novoServico.descricao, quantidade: novoServico.quantidade, preco_unitario: novoServico.preco_unitario, preco_total: total }]);
    setNovoServico({ descricao: '', quantidade: 1, preco_unitario: 0 });
  };

  const updateOsServicoQty = (index: number, qty: number) => {
    const updated = [...osServicos];
    updated[index] = { ...updated[index], quantidade: qty, preco_total: qty * (updated[index].preco_unitario || 0) };
    setOsServicos(updated);
  };

  const removeOsServico = (index: number) => {
    setOsServicos(osServicos.filter((_, i) => i !== index));
  };

  const clienteEquipamentos = equipamentos.filter(e => e.cliente_id === editing.cliente_id);

  const openEquipNew = () => {
    setEditingEquip({ cliente_id: editing.cliente_id || '', tipo: '', marca: '', modelo: '', numero_serie: '', imei: '', cor: '', condicao_entrada: '', acessorios: '', observacoes: '' });
    setEquipModalOpen(true);
  };

  const openEquipEdit = () => {
    const equip = equipamentos.find(e => e.id === editing.equipamento_id);
    if (equip) {
      setEditingEquip(equip);
      setEquipModalOpen(true);
    }
  };

  const handleEquipSave = async () => {
    if (!editingEquip.cliente_id) return;
    setEquipLoading(true);
    const payload: any = { ...editingEquip };
    delete payload.cliente;

    if (editingEquip.id) {
      setEquipamentos(prev => prev.map(e => e.id === editingEquip.id ? { ...e, ...payload } : e));
      setEquipModalOpen(false);
      await saveOffline('equipamentos', payload, 'update');
      showToast('Equipamento atualizado');
    } else {
      const newId = crypto.randomUUID();
      payload.id = newId;
      payload.criado_em = new Date().toISOString();
      setEquipamentos(prev => [...prev, { id: newId, cliente_id: payload.cliente_id, marca: payload.marca || '', modelo: payload.modelo || '', tipo: payload.tipo || '' }]);
      setEditing({ ...editing, equipamento_id: newId });
      setEquipModalOpen(false);
      await saveOffline('equipamentos', payload, 'create');
      showToast('Equipamento cadastrado');
    }
    setEquipLoading(false);
    loadAll();
  };

  const openTipoNew = () => {
    setEditingTipo({ nome: '' });
    setTipoModalOpen(true);
  };

  const openTipoEdit = () => {
    const tipo = tipos.find(t => t.nome === editingEquip.tipo);
    if (tipo) {
      setEditingTipo(tipo);
      setTipoModalOpen(true);
    }
  };

  const handleTipoSave = async () => {
    if (!editingTipo.nome?.trim()) return;
    setTipoLoading(true);
    if (editingTipo.id) {
      await supabase.from('tipos_equipamento').update({ nome: editingTipo.nome.trim().toLowerCase() }).eq('id', editingTipo.id);
      showToast('Tipo atualizado');
    } else {
      await supabase.from('tipos_equipamento').insert({ nome: editingTipo.nome.trim().toLowerCase() });
      setEditingEquip({ ...editingEquip, tipo: editingTipo.nome.trim().toLowerCase() });
      showToast('Tipo cadastrado');
    }
    setTipoLoading(false);
    setTipoModalOpen(false);
    loadTipos();
  };

  const handleTipoDelete = async () => {
    if (!editingEquip.tipo) return;
    const tipo = tipos.find(t => t.nome === editingEquip.tipo);
    if (!tipo) return;
    if (!confirm(`Excluir o tipo "${tipo.nome}"?`)) return;
    await supabase.from('tipos_equipamento').delete().eq('id', tipo.id);
    setEditingEquip({ ...editingEquip, tipo: '' });
    showToast('Tipo excluido');
    loadTipos();
  };

  const openClienteNew = () => {
    setEditingCliente({ nome: '', cpf_cnpj: '', telefone: '', celular: '', email: '', endereco: '', bairro: '', cidade: '', estado: '', cep: '', observacoes: '' });
    setClienteModalOpen(true);
  };

  const handleClienteSave = async () => {
    if (!editingCliente.nome?.trim()) return;
    setClienteLoading(true);
    const newId = crypto.randomUUID();
    const payload = { ...editingCliente, id: newId, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() };
    setClientes(prev => [...prev, { id: newId, nome: editingCliente.nome || '' }]);
    setEditing({ ...editing, cliente_id: newId, equipamento_id: null });
    setClienteModalOpen(false);
    await saveOffline('clientes', payload, 'create');
    setClienteLoading(false);
    showToast('Cliente cadastrado');
    loadAll();
  };

  const openTecnicoNew = () => {
    setEditingTecnico({ nome: '', especialidade: '', telefone: '', email: '', ativo: true });
    setTecnicoModalOpen(true);
  };

  const handleTecnicoSave = async () => {
    if (!editingTecnico.nome?.trim()) return;
    setTecnicoLoading(true);
    const newId = crypto.randomUUID();
    const payload = { ...editingTecnico, id: newId, ativo: true, criado_em: new Date().toISOString() };
    setTecnicos(prev => [...prev, { id: newId, nome: editingTecnico.nome || '' }]);
    setEditing({ ...editing, tecnico_id: newId });
    setTecnicoModalOpen(false);
    await saveOffline('tecnicos', payload, 'create');
    setTecnicoLoading(false);
    showToast('Tecnico cadastrado');
    loadAll();
  };

  const openProdutoNew = () => {
    setEditingProduto({ nome: '', descricao: '', codigo: '', categoria: '', preco_custo: 0, preco_venda: 0, quantidade_estoque: 1, tipo_item: 'produto', ativo: true });
    setProdutoModalOpen(true);
  };

  const handleProdutoSave = async () => {
    if (!editingProduto.nome?.trim()) return;
    setProdutoLoading(true);
    const newId = crypto.randomUUID();
    const payload = { ...editingProduto, id: newId, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() };
    if (editingProduto.tipo_item === 'servico') { payload.quantidade_estoque = 0; payload.preco_custo = 0; }
    setProdutos(prev => [...prev, { ...payload } as Produto]);
    setProdutoModalOpen(false);
    await saveOffline('produtos', payload, 'create');
    setProdutoLoading(false);
    showToast('Item cadastrado');
    loadAll();
  };

  const statusOrder = ['aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'entregue'];

  const getAdjacentStatus = (currentStatus: string, direction: 'left' | 'right'): string | null => {
    const idx = statusOrder.indexOf(currentStatus);
    if (direction === 'right' && idx < statusOrder.length - 1) return statusOrder[idx + 1];
    if (direction === 'left' && idx > 0) return statusOrder[idx - 1];
    return null;
  };

  const handleDragStart = (e: React.DragEvent, osId: string) => {
    setDraggingId(osId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', osId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const osId = e.dataTransfer.getData('text/plain');
    const os = ordens.find(o => o.id === osId);
    if (os && os.status !== targetStatus && canEdit) {
      updateStatus(osId, targetStatus);
    }
    setDraggingId(null);
    setDragOverStatus(null);
  };

  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent, osId: string, status: string) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, osId, status, locked: false };
    setSwipeState(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    if (!touchRef.current.locked && Math.abs(deltaY) > Math.abs(deltaX)) {
      touchRef.current = null;
      setSwipeState(null);
      return;
    }
    touchRef.current.locked = true;
    e.preventDefault();

    const direction: 'left' | 'right' | null = deltaX > 20 ? 'right' : deltaX < -20 ? 'left' : null;
    setSwipeState({ osId: touchRef.current.osId, offsetX: deltaX, direction });
  };

  const handleTouchEnd = () => {
    if (!touchRef.current || !swipeState) {
      touchRef.current = null;
      setSwipeState(null);
      return;
    }
    const { osId, status } = touchRef.current;
    const { offsetX, direction } = swipeState;

    if (Math.abs(offsetX) >= SWIPE_THRESHOLD && direction && canEdit) {
      const newStatus = getAdjacentStatus(status, direction);
      if (newStatus) {
        updateStatus(osId, newStatus);
      }
    }
    touchRef.current = null;
    setSwipeState(null);
  };

  const filtered = ordens.filter(o =>
    String(o.numero_os).includes(search) ||
    (o.cliente as any)?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    (o.tecnico as any)?.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ordens de Servico</h1>
          <p className="text-slate-400 text-sm mt-1">{ordens.length} ordem(ns) total</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${viewMode === 'kanban' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>Kanban</button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>Lista</button>
          </div>
          {canCreate && (
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all shadow-lg shadow-emerald-500/20">
              <Plus className="w-4 h-4" /> Nova OS
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="text" placeholder="Buscar por numero da OS, cliente ou tecnico..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
      </div>

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(Object.entries(statusConfig) as [string, any][]).map(([status, config]) => {
            const StatusIcon = config.icon;
            const columnOrdens = filtered.filter(o => o.status === status);
            const isDropTarget = dragOverStatus === status && draggingId !== null;
            return (
              <div
                key={status}
                className={`min-w-[280px] flex-1 rounded-xl transition-all duration-200 ${isDropTarget ? 'ring-2 ring-emerald-500/50 bg-emerald-500/5' : ''}`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className={`border-t-2 ${config.headerColor} bg-slate-800/30 rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-white">{config.label}</span>
                  </div>
                  <span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{columnOrdens.length}</span>
                </div>
                <div className="space-y-3 pt-3 min-h-[200px]">
                  {columnOrdens.map((os) => {
                    const isDragging = draggingId === os.id;
                    const isSwiping = swipeState?.osId === os.id;
                    const swipeOffset = isSwiping ? swipeState.offsetX : 0;
                    const swipeDirection = isSwiping ? swipeState.direction : null;
                    const isSwipeReady = isSwiping && Math.abs(swipeOffset) >= SWIPE_THRESHOLD;
                    const nextSwipeStatus = swipeDirection ? getAdjacentStatus(status, swipeDirection) : null;
                    return (
                      <div
                        key={os.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, os.id)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => canEdit && handleTouchStart(e, os.id, status)}
                        onTouchMove={(e) => handleTouchMove(e)}
                        onTouchEnd={handleTouchEnd}
                        onClick={() => !isSwiping && openDetail(os)}
                        className={`relative bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 transition-all cursor-pointer group select-none ${isDragging ? 'opacity-40 scale-95' : 'hover:border-slate-600'} ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        style={isSwiping ? { transform: `translateX(${swipeOffset * 0.4}px)`, transition: 'none' } : undefined}
                      >
                        {isSwiping && swipeDirection && nextSwipeStatus && (
                          <div className={`absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none transition-opacity ${isSwipeReady ? 'opacity-100' : 'opacity-50'}`}>
                            <div className={`absolute inset-0 rounded-xl ${isSwipeReady ? 'bg-emerald-500/10 border-2 border-emerald-500/40' : 'bg-white/5 border border-white/10'}`} />
                            <div className="relative flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                              {swipeDirection === 'left' && <ChevronLeft className="w-3.5 h-3.5" />}
                              <span>{statusConfig[nextSwipeStatus as keyof typeof statusConfig]?.label}</span>
                              {swipeDirection === 'right' && <ChevronRight className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono font-bold text-white">#{os.numero_os}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioridadeColors[os.prioridade]}`}>{os.prioridade}</span>
                        </div>
                        <p className="text-sm text-slate-300 font-medium mb-1">{(os.cliente as any)?.nome || '-'}</p>
                        {os.defeito_relatado && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{os.defeito_relatado}</p>}
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{(os.tecnico as any)?.nome || 'Sem tecnico'}</span>
                          <span>{new Date(os.data_entrada).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async (e) => { e.stopPropagation(); const configs = await getAllLocal('configuracoes'); await generateOSPdf(os, configs[0] || null); showToast('PDF gerado'); }}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                              title="Exportar PDF"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async (e) => { e.stopPropagation(); const configs = await getAllLocal('configuracoes'); printOS(os, configs[0] || null); }}
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                              title="Imprimir"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {canEdit && status !== 'entregue' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); const nextStatus = { aberta: 'em_andamento', em_andamento: 'concluida', aguardando_peca: 'em_andamento', concluida: 'entregue' } as Record<string, string>; if (nextStatus[status]) updateStatus(os.id, nextStatus[status]); }}
                              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                            >
                              Avancar <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">OS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tecnico</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Prioridade</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Data</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhuma OS encontrada</td></tr>
              ) : (
                filtered.map((os) => (
                  <tr key={os.id} onClick={() => openDetail(os)} className="border-b border-slate-700/30 hover:bg-white/5 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-sm font-mono font-bold text-white">#{os.numero_os}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{(os.cliente as any)?.nome || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{(os.tecnico as any)?.nome || '-'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig[os.status].color}`}>{statusConfig[os.status].label}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioridadeColors[os.prioridade]}`}>{os.prioridade}</span></td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-400">{formatCurrency(os.valor_total)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(os.data_entrada).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={async (e) => { e.stopPropagation(); const configs = await getAllLocal('configuracoes'); await generateOSPdf(os, configs[0] || null); showToast('PDF gerado'); }}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Exportar PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async (e) => { e.stopPropagation(); const configs = await getAllLocal('configuracoes'); printOS(os, configs[0] || null); }}
                          className="p-1.5 text-slate-400 hover:bg-slate-500/10 rounded-lg transition-colors"
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={detailModal} onClose={() => setDetailModal(false)} title={selectedOS ? `OS #${selectedOS.numero_os}` : ''} size="xl">
        {selectedOS && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Status</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig[selectedOS.status].color}`}>{statusConfig[selectedOS.status].label}</span>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Prioridade</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioridadeColors[selectedOS.prioridade]}`}>{selectedOS.prioridade}</span>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Entrada</p>
                <p className="text-sm text-white">{new Date(selectedOS.data_entrada).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Valor Total</p>
                <p className="text-sm text-emerald-400 font-semibold">{formatCurrency(selectedOS.valor_total)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Cliente</p>
                <p className="text-sm text-white">{(selectedOS.cliente as any)?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Tecnico</p>
                <p className="text-sm text-white">{(selectedOS.tecnico as any)?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Equipamento</p>
                <p className="text-sm text-white">{selectedOS.equipamento ? `${(selectedOS.equipamento as any).marca} ${(selectedOS.equipamento as any).modelo}` : '-'}</p>
              </div>
              {selectedOS.data_previsao && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Previsao</p>
                  <p className="text-sm text-white">{new Date(selectedOS.data_previsao).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
            </div>

            {selectedOS.defeito_relatado && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Defeito Relatado</p>
                <p className="text-sm text-slate-300 bg-slate-700/30 rounded-lg p-3">{selectedOS.defeito_relatado}</p>
              </div>
            )}

            {selectedOS.laudo_tecnico && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Laudo Tecnico</p>
                <p className="text-sm text-slate-300 bg-slate-700/30 rounded-lg p-3">{selectedOS.laudo_tecnico}</p>
              </div>
            )}

            {selectedOS.os_servicos && selectedOS.os_servicos.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Servicos Executados</p>
                <div className="bg-slate-700/30 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-600/50"><th className="px-3 py-2 text-left text-xs text-slate-400">Servico</th><th className="px-3 py-2 text-right text-xs text-slate-400">Qtd</th><th className="px-3 py-2 text-right text-xs text-slate-400">Total</th></tr></thead>
                    <tbody>
                      {selectedOS.os_servicos.map((s, i) => (
                        <tr key={i} className="border-b border-slate-600/30"><td className="px-3 py-2 text-sm text-white">{s.descricao}</td><td className="px-3 py-2 text-sm text-right text-slate-300">{s.quantidade}</td><td className="px-3 py-2 text-sm text-right text-emerald-400">{formatCurrency(s.preco_total)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedOS.os_produtos && selectedOS.os_produtos.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Produtos/Pecas</p>
                <div className="bg-slate-700/30 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-600/50"><th className="px-3 py-2 text-left text-xs text-slate-400">Produto</th><th className="px-3 py-2 text-right text-xs text-slate-400">Qtd</th><th className="px-3 py-2 text-right text-xs text-slate-400">Total</th></tr></thead>
                    <tbody>
                      {selectedOS.os_produtos.map((p, i) => (
                        <tr key={i} className="border-b border-slate-600/30"><td className="px-3 py-2 text-sm text-white">{(p.produto as any)?.nome || '-'}</td><td className="px-3 py-2 text-sm text-right text-slate-300">{p.quantidade}</td><td className="px-3 py-2 text-sm text-right text-emerald-400">{formatCurrency(p.preco_total)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => { const configs = await getAllLocal('configuracoes'); await generateOSPdf(selectedOS, configs[0] || null); showToast('PDF gerado'); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all text-sm font-medium"
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>
                <button
                  onClick={async () => { const configs = await getAllLocal('configuracoes'); printOS(selectedOS, configs[0] || null); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-500/10 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-500/20 transition-all text-sm font-medium"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <button onClick={() => openEdit(selectedOS)} className="px-4 py-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-lg hover:bg-sky-500/20 transition-all text-sm font-medium">Editar OS</button>
                    {selectedOS.status !== 'entregue' && (
                      <button onClick={() => { const next = { aberta: 'em_andamento', em_andamento: 'concluida', aguardando_peca: 'em_andamento', concluida: 'entregue' } as Record<string, string>; if (next[selectedOS.status]) { updateStatus(selectedOS.id, next[selectedOS.status]); setDetailModal(false); } }} className="px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-all text-sm font-medium">
                        Avancar Status
                      </button>
                    )}
                  </>
                )}
                {canDelete && (
                  <button onClick={() => deleteOS(selectedOS.id)} className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all text-sm font-medium">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal - Wizard */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? `Editar OS #${editing.numero_os || ''}` : 'Nova Ordem de Servico'} size="xl">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step >= s ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{s}</div>
                {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
              </div>
            ))}
          </div>
          <div className="flex mt-2">
            <span className={`text-xs flex-1 text-center ${step >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>Dados</span>
            <span className={`text-xs flex-1 text-center ${step >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>Serviço</span>
            <span className={`text-xs flex-1 text-center ${step >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>Produtos e Serviços</span>
          </div>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Cliente *</label>
              <div className="flex gap-2">
                <select value={editing.cliente_id || ''} onChange={(e) => setEditing({ ...editing, cliente_id: e.target.value, equipamento_id: null })} className="flex-1 px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option value="">Selecione</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button
                  type="button"
                  onClick={openClienteNew}
                  title="Novo Cliente"
                  className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Equipamento</label>
              <div className="flex gap-2">
                <select value={editing.equipamento_id || ''} onChange={(e) => setEditing({ ...editing, equipamento_id: e.target.value || null })} className="flex-1 px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option value="">Selecione</option>
                  {clienteEquipamentos.map(e => <option key={e.id} value={e.id}>{e.marca} {e.modelo} ({e.tipo})</option>)}
                </select>
                <button
                  type="button"
                  onClick={openEquipNew}
                  disabled={!editing.cliente_id}
                  title="Novo Equipamento"
                  className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {editing.equipamento_id && (
                  <button
                    type="button"
                    onClick={openEquipEdit}
                    title="Editar Equipamento"
                    className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tecnico</label>
              <div className="flex gap-2">
                <select value={editing.tecnico_id || ''} onChange={(e) => setEditing({ ...editing, tecnico_id: e.target.value || null })} className="flex-1 px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option value="">Selecione</option>
                  {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <button
                  type="button"
                  onClick={openTecnicoNew}
                  title="Novo Tecnico"
                  className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Prioridade</label>
              <select value={editing.prioridade || 'normal'} onChange={(e) => setEditing({ ...editing, prioridade: e.target.value as any })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            {editing.id && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Status</label>
                <select value={editing.status || 'aberta'} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option value="aberta">Aberta</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="aguardando_peca">Aguardando Peca</option>
                  <option value="concluida">Concluida</option>
                  <option value="entregue">Entregue</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Previsao de Entrega</label>
              <input type="date" value={editing.data_previsao ? editing.data_previsao.substring(0, 10) : ''} onChange={(e) => setEditing({ ...editing, data_previsao: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Defeito Relatado *</label>
              <textarea value={editing.defeito_relatado || ''} onChange={(e) => setEditing({ ...editing, defeito_relatado: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-24 resize-none" placeholder="Descreva o defeito relatado pelo cliente..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Laudo Tecnico</label>
              <textarea value={editing.laudo_tecnico || ''} onChange={(e) => setEditing({ ...editing, laudo_tecnico: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-24 resize-none" placeholder="Diagnostico tecnico..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Servicos Executados</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={novoServico.descricao} onChange={(e) => setNovoServico({ ...novoServico, descricao: e.target.value })} className="flex-1 px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" placeholder="Descricao do servico..." />
                <input type="number" value={novoServico.quantidade} onChange={(e) => setNovoServico({ ...novoServico, quantidade: parseInt(e.target.value) || 1 })} className="w-16 px-2 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm text-center" min="1" title="Quantidade" />
                <input type="number" value={novoServico.preco_unitario} onChange={(e) => setNovoServico({ ...novoServico, preco_unitario: parseFloat(e.target.value) || 0 })} className="w-28 px-2 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" min="0" step="0.01" placeholder="Valor R$" />
                <button type="button" onClick={addServicoToOS} disabled={!novoServico.descricao.trim()} className="flex items-center justify-center w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all disabled:opacity-50" title="Adicionar servico">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {osServicos.length > 0 && (
                <div className="bg-slate-700/30 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-600/50"><th className="px-3 py-2 text-left text-xs text-slate-400">Servico</th><th className="px-3 py-2 text-center text-xs text-slate-400 w-16">Qtd</th><th className="px-3 py-2 text-right text-xs text-slate-400 w-24">Valor</th><th className="px-3 py-2 text-right text-xs text-slate-400 w-24">Total</th><th className="w-10"></th></tr></thead>
                    <tbody>
                      {osServicos.map((s, i) => (
                        <tr key={i} className="border-b border-slate-600/30">
                          <td className="px-3 py-2 text-sm text-white">{s.descricao}</td>
                          <td className="px-3 py-2 text-center"><input type="number" value={s.quantidade || 1} onChange={(e) => updateOsServicoQty(i, parseInt(e.target.value) || 1)} className="w-14 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-center text-sm" min="1" /></td>
                          <td className="px-3 py-2 text-sm text-right text-slate-300">{formatCurrency(s.preco_unitario || 0)}</td>
                          <td className="px-3 py-2 text-sm text-right text-emerald-400">{formatCurrency(s.preco_total || 0)}</td>
                          <td className="px-3 py-2"><button onClick={() => removeOsServico(i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {osServicos.length > 0 && (
                <div className="flex justify-end mt-2">
                  <span className="text-sm text-slate-400">Subtotal Servicos: <span className="text-emerald-400 font-semibold">{formatCurrency(osServicos.reduce((s, sv) => s + (sv.preco_total || 0), 0))}</span></span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Observacoes Gerais</label>
                <input type="text" value={editing.observacoes || ''} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nota Tecnica</label>
                <input type="text" value={editing.servico_executado || ''} onChange={(e) => setEditing({ ...editing, servico_executado: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Informacoes adicionais..." />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Adicionar Produto ou Serviço</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select onChange={(e) => { if (e.target.value) { addProdutoToOS(e.target.value); e.target.value = ''; } }} className="flex-1 w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[44px]">
                  <option value="">Selecione um item</option>
                  <optgroup label="Produtos">
                    {produtos.filter(p => p.tipo_item !== 'servico').map(p => <option key={p.id} value={p.id}>{p.nome} - {formatCurrency(p.preco_venda)} (estoque: {p.quantidade_estoque})</option>)}
                  </optgroup>
                  <optgroup label="Serviços">
                    {produtos.filter(p => p.tipo_item === 'servico').map(p => <option key={p.id} value={p.id}>{p.nome} - {formatCurrency(p.preco_venda)}</option>)}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={openProdutoNew}
                  className="flex items-center justify-center w-full sm:w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all flex-shrink-0"
                  title="Cadastrar novo item"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {osProdutos.length > 0 && (
              <div className="bg-slate-700/30 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead><tr className="border-b border-slate-600/50"><th className="px-3 py-2 text-left text-xs text-slate-400">Item</th><th className="px-3 py-2 text-center text-xs text-slate-400 w-20">Qtd</th><th className="px-3 py-2 text-right text-xs text-slate-400">Total</th><th className="w-10"></th></tr></thead>
                  <tbody>
                    {osProdutos.map((p, i) => {
                      const prod = produtos.find(pr => pr.id === p.produto_id);
                      const isServico = prod?.tipo_item === 'servico';
                      return (
                        <tr key={i} className="border-b border-slate-600/30">
                          <td className="px-3 py-2 text-sm text-white">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${isServico ? 'bg-sky-500/15 text-sky-400' : 'bg-rose-500/15 text-rose-400'}`}>{isServico ? 'Serviço' : 'Produto'}</span>
                              <span>{prod?.nome || '-'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center"><input type="number" value={p.quantidade || 1} onChange={(e) => updateOsProdutoQty(i, parseInt(e.target.value) || 1)} className="w-16 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-center text-sm" min="1" /></td>
                          <td className="px-3 py-2 text-sm text-right text-emerald-400">{formatCurrency(p.preco_total || 0)}</td>
                          <td className="px-3 py-2"><button onClick={() => removeOsProduto(i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-400" /><span className="text-sm text-slate-300">Valor Total da OS:</span></div>
              <span className="text-lg font-bold text-emerald-400">{formatCurrency(osServicos.reduce((s, sv) => s + (sv.preco_total || 0), 0) + osProdutos.reduce((s, p) => s + (p.preco_total || 0), 0))}</span>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                Agendamento de Revisao Futura
              </label>
              <input
                type="date"
                value={editing.data_revisao_futura ? new Date(editing.data_revisao_futura).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditing({ ...editing, data_revisao_futura: e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : null })}
                className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              <p className="text-xs text-slate-400 mt-1.5">Proxima manutencao preventiva (opcional)</p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-slate-700">
          <button onClick={() => step > 1 ? setStep(step - 1) : setModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors min-h-[44px]">
            {step > 1 ? 'Voltar' : 'Cancelar'}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={step === 1 && !editing.cliente_id} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg disabled:opacity-50 min-h-[44px]">
              Próximo
            </button>
          ) : (
            <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg disabled:opacity-50 min-h-[44px]">
              {loading ? 'Salvando...' : editing.id ? 'Atualizar OS' : 'Criar OS'}
            </button>
          )}
        </div>
      </Modal>

      <Modal isOpen={equipModalOpen} onClose={() => setEquipModalOpen(false)} title={editingEquip.id ? 'Editar Equipamento' : 'Novo Equipamento'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo *</label>
            <div className="flex gap-2">
              <select value={editingEquip.tipo || ''} onChange={(e) => setEditingEquip({ ...editingEquip, tipo: e.target.value })} className="flex-1 px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="">Selecione</option>
                {tipos.map(t => <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>)}
              </select>
              <button type="button" onClick={openTipoNew} title="Novo Tipo" className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
              {editingEquip.tipo && (
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
            <input type="text" value={editingEquip.marca || ''} onChange={(e) => setEditingEquip({ ...editingEquip, marca: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Modelo</label>
            <input type="text" value={editingEquip.modelo || ''} onChange={(e) => setEditingEquip({ ...editingEquip, modelo: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Numero de Serie</label>
            <input type="text" value={editingEquip.numero_serie || ''} onChange={(e) => setEditingEquip({ ...editingEquip, numero_serie: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">IMEI</label>
            <input type="text" value={editingEquip.imei || ''} onChange={(e) => setEditingEquip({ ...editingEquip, imei: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Cor</label>
            <input type="text" value={editingEquip.cor || ''} onChange={(e) => setEditingEquip({ ...editingEquip, cor: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Condicao de Entrada</label>
            <textarea value={editingEquip.condicao_entrada || ''} onChange={(e) => setEditingEquip({ ...editingEquip, condicao_entrada: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-16 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Acessorios</label>
            <input type="text" value={editingEquip.acessorios || ''} onChange={(e) => setEditingEquip({ ...editingEquip, acessorios: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Observacoes</label>
            <input type="text" value={editingEquip.observacoes || ''} onChange={(e) => setEditingEquip({ ...editingEquip, observacoes: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setEquipModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleEquipSave} disabled={equipLoading || !editingEquip.tipo} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50">
            {equipLoading ? 'Salvando...' : editingEquip.id ? 'Atualizar' : 'Cadastrar'}
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

      <Modal isOpen={clienteModalOpen} onClose={() => setClienteModalOpen(false)} title="Novo Cliente" size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input type="text" value={editingCliente.nome || ''} onChange={(e) => setEditingCliente({ ...editingCliente, nome: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">CPF/CNPJ</label>
            <input type="text" value={editingCliente.cpf_cnpj || ''} onChange={(e) => setEditingCliente({ ...editingCliente, cpf_cnpj: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Celular</label>
            <input type="text" value={editingCliente.celular || ''} onChange={(e) => setEditingCliente({ ...editingCliente, celular: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefone</label>
            <input type="text" value={editingCliente.telefone || ''} onChange={(e) => setEditingCliente({ ...editingCliente, telefone: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
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
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Cidade</label>
            <input type="text" value={editingCliente.cidade || ''} onChange={(e) => setEditingCliente({ ...editingCliente, cidade: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Estado</label>
            <input type="text" value={editingCliente.estado || ''} onChange={(e) => setEditingCliente({ ...editingCliente, estado: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" maxLength={2} placeholder="UF" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setClienteModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleClienteSave} disabled={clienteLoading || !editingCliente.nome?.trim()} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50">
            {clienteLoading ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={tecnicoModalOpen} onClose={() => setTecnicoModalOpen(false)} title="Novo Tecnico" size="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input type="text" value={editingTecnico.nome || ''} onChange={(e) => setEditingTecnico({ ...editingTecnico, nome: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Nome do tecnico" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Especialidade</label>
            <input type="text" value={editingTecnico.especialidade || ''} onChange={(e) => setEditingTecnico({ ...editingTecnico, especialidade: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Ex: ar-condicionado, celular..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefone</label>
            <input type="text" value={editingTecnico.telefone || ''} onChange={(e) => setEditingTecnico({ ...editingTecnico, telefone: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input type="email" value={editingTecnico.email || ''} onChange={(e) => setEditingTecnico({ ...editingTecnico, email: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setTecnicoModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleTecnicoSave} disabled={tecnicoLoading || !editingTecnico.nome?.trim()} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50">
            {tecnicoLoading ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={produtoModalOpen} onClose={() => setProdutoModalOpen(false)} title="Novo Item" size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo do Item *</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingProduto({ ...editingProduto, tipo_item: 'produto' })} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all min-h-[44px] ${editingProduto.tipo_item === 'servico' ? 'bg-slate-700/50 border-slate-600 text-slate-400' : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'}`}>
                <Package className="w-4 h-4" /> Produto
              </button>
              <button type="button" onClick={() => setEditingProduto({ ...editingProduto, tipo_item: 'servico', quantidade_estoque: 0, preco_custo: 0 })} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all min-h-[44px] ${editingProduto.tipo_item === 'servico' ? 'bg-sky-500/15 border-sky-500/50 text-sky-400' : 'bg-slate-700/50 border-slate-600 text-slate-400'}`}>
                <Wrench className="w-4 h-4" /> Serviço
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input type="text" value={editingProduto.nome || ''} onChange={(e) => setEditingProduto({ ...editingProduto, nome: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Nome do item" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Código</label>
            <input type="text" value={editingProduto.codigo || ''} onChange={(e) => setEditingProduto({ ...editingProduto, codigo: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Código interno" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoria</label>
            <input type="text" value={editingProduto.categoria || ''} onChange={(e) => setEditingProduto({ ...editingProduto, categoria: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Ex: Peças, Acessórios..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Preço de Venda (R$) *</label>
            <input type="number" value={editingProduto.preco_venda || 0} onChange={(e) => setEditingProduto({ ...editingProduto, preco_venda: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" min="0" step="0.01" />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={editingProduto.ativo !== false} onChange={(e) => setEditingProduto({ ...editingProduto, ativo: e.target.checked })} className="w-5 h-5 rounded accent-emerald-500" />
              <span className="text-sm font-medium text-slate-300">Ativo</span>
            </label>
          </div>
          {editingProduto.tipo_item !== 'servico' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Preço de Custo (R$)</label>
                <input type="number" value={editingProduto.preco_custo || 0} onChange={(e) => setEditingProduto({ ...editingProduto, preco_custo: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Quantidade em Estoque</label>
                <input type="number" value={editingProduto.quantidade_estoque || 0} onChange={(e) => setEditingProduto({ ...editingProduto, quantidade_estoque: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" min="0" />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descrição</label>
            <input type="text" value={editingProduto.descricao || ''} onChange={(e) => setEditingProduto({ ...editingProduto, descricao: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Descrição opcional" />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
          <button onClick={() => setProdutoModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors min-h-[44px]">Cancelar</button>
          <button onClick={handleProdutoSave} disabled={produtoLoading || !editingProduto.nome?.trim()} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all disabled:opacity-50 min-h-[44px]">
            {produtoLoading ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
