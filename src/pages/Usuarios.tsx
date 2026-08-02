import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import { Profile, PermissoesRecursos, Recurso, Acao } from '../types';
import { Plus, Search, CreditCard as Edit2, Shield, ShieldCheck, Eye, CheckSquare, Square, KeyRound, Settings, User } from 'lucide-react';

const RECURSOS: { key: Recurso; label: string; acoes: Acao[] }[] = [
  { key: 'dashboard', label: 'Dashboard', acoes: ['ver'] },
  { key: 'ordens', label: 'Ordens de Servico', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'clientes', label: 'Clientes', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'equipamentos', label: 'Equipamentos', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'tecnicos', label: 'Tecnicos', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'produtos', label: 'Produtos', acoes: ['ver', 'criar', 'editar', 'excluir'] },
  { key: 'relatorios', label: 'Relatorios', acoes: ['ver'] },
];

const DEFAULT_PERMISSOES: PermissoesRecursos = {
  dashboard: { ver: true },
  ordens: { ver: true, criar: true, editar: true, excluir: true },
  clientes: { ver: true, criar: true, editar: true, excluir: true },
  equipamentos: { ver: true, criar: true, editar: true, excluir: true },
  tecnicos: { ver: true, criar: true, editar: true, excluir: true },
  produtos: { ver: true, criar: true, editar: true, excluir: true },
  relatorios: { ver: true },
};

type EditTab = 'geral' | 'permissoes';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>('geral');
  const [editing, setEditing] = useState<Partial<Profile> | null>(null);
  const [editingPermissoes, setEditingPermissoes] = useState<PermissoesRecursos>(DEFAULT_PERMISSOES);
  const [editingPassword, setEditingPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', nome: '', permissao: 'operador' });
  const [showNew, setShowNew] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { loadUsuarios(); }, []);

  const loadUsuarios = async () => {
    const { data } = await supabase.from('profiles').select('*').order('nome');
    setUsuarios(data || []);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setLoading(true);
    const permissao = editing.permissao;
    const updateData: Record<string, unknown> = { permissao, ativo: editing.ativo };
    if (permissao === 'operador' || permissao === 'vendedor') {
      updateData.permissoes_recursos = editingPermissoes;
    }
    const { error } = await supabase.from('profiles').update(updateData).eq('id', editing.id);
    if (error) {
      showToast(error.message, 'error');
      setLoading(false);
      return;
    }

    if (editingPassword.trim().length > 0) {
      if (editingPassword.length < 6) {
        showToast('A senha deve ter no minimo 6 caracteres', 'error');
        setLoading(false);
        return;
      }
      const { data: fnData, error: fnError } = await supabase.functions.invoke('change-user-password', {
        body: { user_id: editing.id, new_password: editingPassword },
      });
      if (fnError || (fnData && fnData.error)) {
        showToast(fnData?.error || fnError?.message || 'Erro ao alterar senha', 'error');
        setLoading(false);
        return;
      }
      showToast('Usuario e senha atualizados');
    } else {
      showToast('Usuario atualizado');
    }

    setLoading(false);
    setModalOpen(false);
    setEditingPassword('');
    loadUsuarios();
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.nome) {
      showToast('Preencha nome, email e senha', 'error');
      return;
    }
    if (newUser.password.length < 6) {
      showToast('A senha deve ter no minimo 6 caracteres', 'error');
      return;
    }
    setLoading(true);
    const permissao = newUser.permissao;

    // Preserve the admin's current session so creating a new user
    // does not log the admin out (signUp starts a new session).
    const { data: adminSession } = await supabase.auth.getSession();

    const userMetadata: Record<string, unknown> = {
      nome: newUser.nome,
      permissao,
    };
    if (permissao === 'operador' || permissao === 'vendedor') {
      userMetadata.permissoes_recursos = DEFAULT_PERMISSOES;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: { data: userMetadata },
    });

    if (signUpError) {
      showToast(signUpError.message || 'Erro ao criar usuario', 'error');
      setLoading(false);
      return;
    }

    // Restore the admin session that was replaced by signUp.
    if (adminSession?.session) {
      await supabase.auth.setSession({
        access_token: adminSession.session.access_token,
        refresh_token: adminSession.session.refresh_token,
      });
    }

    showToast('Usuario criado! Configure as permissoes agora.');
    setShowNew(false);
    setNewUser({ email: '', password: '', nome: '', permissao: 'operador' });
    setLoading(false);

    await loadUsuarios();
    if (signUpData?.user?.id) {
      const { data: created } = await supabase.from('profiles').select('*').eq('id', signUpData.user.id).maybeSingle();
      if (created) {
        openEditModal(created, 'permissoes');
      }
    }
  };

  const openEditModal = (usuario: Profile, tab: EditTab = 'geral') => {
    setEditing(usuario);
    setEditingPermissoes(usuario.permissoes_recursos || DEFAULT_PERMISSOES);
    setEditingPassword('');
    setEditTab(tab);
    setModalOpen(true);
  };

  const togglePermissao = (
    permissoes: PermissoesRecursos,
    setPermissoes: (p: PermissoesRecursos) => void,
    recurso: Recurso,
    acao: Acao
  ) => {
    const current = permissoes[recurso]?.[acao] ?? false;
    setPermissoes({
      ...permissoes,
      [recurso]: { ...permissoes[recurso], [acao]: !current },
    });
  };

  const setAllPermissoes = (setPermissoes: (p: PermissoesRecursos) => void, value: boolean) => {
    const newPerms: PermissoesRecursos = {};
    for (const r of RECURSOS) {
      const acoes: Partial<Record<Acao, boolean>> = {};
      for (const a of r.acoes) {
        acoes[a] = value;
      }
      newPerms[r.key] = acoes;
    }
    setPermissoes(newPerms);
  };

  const countActivePermissions = (perms?: PermissoesRecursos): number => {
    if (!perms) return 0;
    let count = 0;
    for (const r of RECURSOS) {
      for (const a of r.acoes) {
        if (perms[r.key]?.[a]) count++;
      }
    }
    return count;
  };

  const totalPermissions = RECURSOS.reduce((sum, r) => sum + r.acoes.length, 0);

  const permissaoIcons: Record<string, typeof ShieldCheck> = { administrador: ShieldCheck, operador: Shield, vendedor: Shield, visualizador: Eye };
  const permissaoColors: Record<string, string> = {
    administrador: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    operador: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    vendedor: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    visualizador: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  const permissaoLabels: Record<string, string> = {
    administrador: 'Administrador',
    operador: 'Operador',
    vendedor: 'Operador',
    visualizador: 'Visualizador',
  };

  const filtered = usuarios.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const renderPermissoesGrid = (
    permissoes: PermissoesRecursos,
    setPermissoes: (p: PermissoesRecursos) => void,
    permissao: string
  ) => {
    if (permissao === 'administrador') {
      return (
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <p className="text-sm text-emerald-300 font-medium">Administrador tem acesso total a todos os recursos do sistema.</p>
          </div>
        </div>
      );
    }
    if (permissao === 'visualizador') {
      return (
        <div className="p-4 bg-slate-500/5 border border-slate-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-slate-400" />
            <p className="text-sm text-slate-300 font-medium">Visualizador possui acesso somente leitura em todos os recursos.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Defina quais acoes o usuario pode realizar em cada recurso do sistema.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAllPermissoes(setPermissoes, true)}
              className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors"
            >
              Marcar Todos
            </button>
            <button
              type="button"
              onClick={() => setAllPermissoes(setPermissoes, false)}
              className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
            >
              Desmarcar Todos
            </button>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg overflow-hidden">
          <div className="grid grid-cols-5 gap-0 border-b border-slate-700/50 bg-slate-900/50">
            <div className="px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Recurso</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Ver</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Criar</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Editar</div>
            <div className="px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Excluir</div>
          </div>
          {RECURSOS.map((recurso) => (
            <div key={recurso.key} className="grid grid-cols-5 gap-0 border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20 transition-colors">
              <div className="px-3 py-3 text-sm text-white font-medium flex items-center">{recurso.label}</div>
              {(['ver', 'criar', 'editar', 'excluir'] as Acao[]).map((acao) => {
                const available = recurso.acoes.includes(acao);
                const checked = available && (permissoes[recurso.key]?.[acao] ?? false);
                return (
                  <div key={acao} className="px-3 py-3 flex items-center justify-center">
                    {available ? (
                      <button
                        type="button"
                        onClick={() => togglePermissao(permissoes, setPermissoes, recurso.key, acao)}
                        className={`w-5 h-5 rounded transition-all ${
                          checked
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        {checked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </button>
                    ) : (
                      <span className="w-5 h-5 text-slate-800 flex items-center justify-center">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="text-xs text-slate-500 text-right">
          {countActivePermissions(permissoes)} de {totalPermissions} permissoes ativas
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-slate-400 text-sm mt-1">Gerenciamento de acessos e permissoes</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all shadow-lg shadow-emerald-500/20">
          <Plus className="w-4 h-4" /> Novo Usuario
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="search" autoComplete="off" placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((usuario) => {
          const Icon = permissaoIcons[usuario.permissao] || Eye;
          const activeCount = countActivePermissions(usuario.permissoes_recursos);
          const showPermCount = usuario.permissao === 'operador' || usuario.permissao === 'vendedor';
          return (
            <div key={usuario.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-emerald-500/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-white/10 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{usuario.nome?.charAt(0) || usuario.email.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{usuario.nome || 'Sem nome'}</h3>
                    <p className="text-xs text-slate-400">{usuario.email}</p>
                  </div>
                </div>
                <button onClick={() => openEditModal(usuario)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${permissaoColors[usuario.permissao]}`}>
                  <Icon className="w-3 h-3" /> {permissaoLabels[usuario.permissao] || usuario.permissao}
                </span>
                <div className="flex items-center gap-2">
                  {showPermCount && (
                    <span className="text-xs text-slate-500">{activeCount}/{totalPermissions}</span>
                  )}
                  <span className={`text-xs ${usuario.ativo ? 'text-emerald-400' : 'text-red-400'}`}>
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal with Tabs */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); loadUsuarios(); }} title="Gerenciar Usuario">
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-white/10 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">{editing.nome?.charAt(0) || editing.email?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div>
                <p className="text-white font-medium">{editing.nome}</p>
                <p className="text-xs text-slate-400">{editing.email}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
              <button
                onClick={() => setEditTab('geral')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  editTab === 'geral'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                Dados Gerais
              </button>
              <button
                onClick={() => setEditTab('permissoes')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  editTab === 'permissoes'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                Permissoes
              </button>
            </div>

            {/* Tab: Dados Gerais */}
            {editTab === 'geral' && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nivel de Acesso</label>
                  <select
                    value={editing.permissao === 'vendedor' ? 'operador' : editing.permissao}
                    onChange={(e) => setEditing({ ...editing, permissao: e.target.value as Profile['permissao'] })}
                    className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="administrador">Administrador - Acesso total</option>
                    <option value="operador">Operador - Acesso configuravel</option>
                    <option value="visualizador">Visualizador - Somente leitura</option>
                  </select>
                  {(editing.permissao === 'operador' || editing.permissao === 'vendedor') && (
                    <p className="text-xs text-slate-500 mt-1.5">Para configurar acesso individual por recurso, acesse a aba "Permissoes".</p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editing.ativo ?? true} onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                  <span className="text-sm text-slate-300">Usuario ativo</span>
                </div>

                <div className="pt-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    Alterar Senha
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={editingPassword}
                    onChange={(e) => setEditingPassword(e.target.value)}
                    placeholder="Deixe vazio para manter a senha atual"
                    className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    minLength={6}
                  />
                  <p className="text-xs text-slate-500 mt-1">Minimo 6 caracteres. Preencha apenas se deseja alterar.</p>
                </div>
              </div>
            )}

            {/* Tab: Permissoes */}
            {editTab === 'permissoes' && (
              <div className="pt-2">
                {renderPermissoesGrid(
                  editingPermissoes,
                  setEditingPermissoes,
                  editing.permissao === 'vendedor' ? 'operador' : editing.permissao || ''
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/50">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleUpdate} disabled={loading} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg disabled:opacity-50 hover:from-emerald-600 hover:to-sky-600 transition-all">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create User Modal (basic info only) */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Novo Usuario">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input type="text" value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
            <input type="email" autoComplete="off" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha *</label>
            <input type="password" autoComplete="new-password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nivel de Acesso</label>
            <select
              value={newUser.permissao}
              onChange={(e) => setNewUser({ ...newUser, permissao: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="administrador">Administrador - Acesso total</option>
              <option value="operador">Operador - Acesso configuravel</option>
              <option value="visualizador">Visualizador - Somente leitura</option>
            </select>
          </div>

          {(newUser.permissao === 'operador' || newUser.permissao === 'vendedor') && (
            <div className="p-3 bg-sky-500/5 border border-sky-500/20 rounded-lg">
              <p className="text-xs text-sky-300">Apos criar o usuario, voce podera configurar as permissoes individuais por recurso.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/50">
            <button onClick={() => setShowNew(false)} className="px-4 py-2.5 text-slate-300 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleCreateUser} disabled={loading || !newUser.email || !newUser.password || !newUser.nome} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-medium rounded-lg disabled:opacity-50 hover:from-emerald-600 hover:to-sky-600 transition-all">
              {loading ? 'Criando...' : 'Criar Usuario'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
