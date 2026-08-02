import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Recurso } from '../../types';
import {
  Wrench, Users, UserCog, Monitor, Package, ClipboardList,
  BarChart3, Database, Settings, LogOut, Home, X, Calendar
} from 'lucide-react';

const menuItems: { path: string; label: string; icon: typeof Home; recurso?: Recurso; adminOnly?: boolean }[] = [
  { path: '/', label: 'Dashboard', icon: Home, recurso: 'dashboard' },
  { path: '/ordens', label: 'Ordens de Servico', icon: ClipboardList, recurso: 'ordens' },
  { path: '/clientes', label: 'Clientes', icon: Users, recurso: 'clientes' },
  { path: '/equipamentos', label: 'Equipamentos', icon: Monitor, recurso: 'equipamentos' },
  { path: '/tecnicos', label: 'Tecnicos', icon: UserCog, recurso: 'tecnicos' },
  { path: '/produtos', label: 'Produtos', icon: Package, recurso: 'produtos' },
  { path: '/relatorios', label: 'Relatorios', icon: BarChart3, recurso: 'relatorios' },
  { path: '/relatorios/revisoes', label: 'Revisoes Futuras', icon: Calendar, recurso: 'relatorios' },
  { path: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  { path: '/backup', label: 'Backup', icon: Database, adminOnly: true },
  { path: '/configuracoes', label: 'Configuracoes', icon: Settings, adminOnly: true },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, hasPermission } = useAuth();

  const filteredItems = menuItems.filter(item => {
    if (!profile) return false;
    if (item.adminOnly) return profile.permissao === 'administrador';
    if (item.recurso) return hasPermission(item.recurso, 'ver');
    return true;
  });

  const permissaoLabel = profile?.permissao === 'vendedor' ? 'operador' : profile?.permissao;

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-700/50 flex flex-col transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-sky-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-white font-bold text-sm">SAC Ordem de Servico</span>
            <span className="text-slate-400 text-xs">sua ordem de servico nas nuvens</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <button
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-700/50">
        {profile && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm text-white font-medium truncate">{profile.nome || profile.email}</p>
            <p className="text-xs text-slate-400 capitalize">{permissaoLabel}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Sair"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
