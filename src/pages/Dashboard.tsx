import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAll, fetchWithRelations } from '../lib/dataService';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { ClipboardList, Users, Package, UserCog, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface Stats {
  totalOS: number;
  osAbertas: number;
  osAndamento: number;
  osConcluidas: number;
  totalClientes: number;
  totalProdutos: number;
  totalTecnicos: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalOS: 0, osAbertas: 0, osAndamento: 0, osConcluidas: 0, totalClientes: 0, totalProdutos: 0, totalTecnicos: 0 });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    const [osData, clientesData, produtosData, tecnicosData, recentData] = await Promise.all([
      fetchAll('ordens_servico'),
      fetchAll('clientes'),
      fetchAll('produtos'),
      fetchAll('tecnicos'),
      fetchWithRelations('ordens_servico', '*, cliente:clientes(nome), tecnico:tecnicos(nome)', { order: 'criado_em', ascending: false, limit: 5 }),
    ]);

    setStats({
      totalOS: osData.length,
      osAbertas: osData.filter((o: any) => o.status === 'aberta').length,
      osAndamento: osData.filter((o: any) => o.status === 'em_andamento' || o.status === 'aguardando_peca').length,
      osConcluidas: osData.filter((o: any) => o.status === 'concluida' || o.status === 'entregue').length,
      totalClientes: clientesData.length,
      totalProdutos: produtosData.length,
      totalTecnicos: tecnicosData.length,
    });
    setRecentOS(recentData || []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeSync(useCallback(() => { loadData(); }, [loadData]));

  const statCards = [
    { label: 'OS Abertas', value: stats.osAbertas, icon: AlertTriangle, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10' },
    { label: 'Em Andamento', value: stats.osAndamento, icon: Clock, color: 'from-sky-500 to-blue-500', bg: 'bg-sky-500/10' },
    { label: 'Concluidas', value: stats.osConcluidas, icon: CheckCircle, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-500/10' },
    { label: 'Total OS', value: stats.totalOS, icon: ClipboardList, color: 'from-slate-400 to-slate-500', bg: 'bg-slate-500/10' },
    { label: 'Clientes', value: stats.totalClientes, icon: Users, color: 'from-cyan-500 to-teal-500', bg: 'bg-cyan-500/10' },
    { label: 'Produtos e Serviços', value: stats.totalProdutos, icon: Package, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-500/10' },
    { label: 'Tecnicos', value: stats.totalTecnicos, icon: UserCog, color: 'from-teal-500 to-emerald-500', bg: 'bg-teal-500/10' },
  ];

  const statusLabels: Record<string, string> = {
    aberta: 'Aberta',
    em_andamento: 'Em Andamento',
    aguardando_peca: 'Aguard. Peca',
    concluida: 'Concluida',
    entregue: 'Entregue'
  };

  const statusColors: Record<string, string> = {
    aberta: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    em_andamento: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    aguardando_peca: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    concluida: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    entregue: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Visao geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${card.bg} border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-slate-400 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">Ultimas Ordens de Servico</h2>
          <button
            onClick={() => navigate('/ordens')}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Ver todas
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">OS</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tecnico</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Data</th>
              </tr>
            </thead>
            <tbody>
              {recentOS.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma ordem de servico encontrada
                  </td>
                </tr>
              ) : (
                recentOS.map((os) => (
                  <tr key={os.id} className="border-b border-slate-700/30 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate('/ordens')}>
                    <td className="px-6 py-3 text-sm font-mono text-white">#{os.numero_os}</td>
                    <td className="px-6 py-3 text-sm text-slate-300">{os.cliente?.nome || '-'}</td>
                    <td className="px-6 py-3 text-sm text-slate-300">{os.tecnico?.nome || '-'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[os.status]}`}>
                        {statusLabels[os.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-400">
                      {new Date(os.data_entrada).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
