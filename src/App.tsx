import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Equipamentos from './pages/Equipamentos';
import Tecnicos from './pages/Tecnicos';
import Produtos from './pages/Produtos';
import OrdensServico from './pages/OrdensServico';
import Relatorios from './pages/Relatorios';
import RelatorioRevisoes from './pages/RelatorioRevisoes';
import Usuarios from './pages/Usuarios';
import Backup from './pages/Backup';
import Configuracoes from './pages/Configuracoes';
import { Recurso } from './types';
import { initConnectivityListeners, startPeriodicSync, initialSync, stopPeriodicSync } from './lib/syncEngine';
import { seedFromBackup } from './lib/seedData';
import { importBackupOnce } from './utils/importBackup';

function PrivateRoute({ children, adminOnly = false, recurso }: { children: React.ReactNode; adminOnly?: boolean; recurso?: Recurso }) {
  const { user, profile, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && profile?.permissao !== 'administrador') return <Navigate to="/" replace />;
  if (recurso && !hasPermission(recurso, 'ver')) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

function SyncInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      initConnectivityListeners();
      importBackupOnce().finally(() => {
        seedFromBackup().then(() => {
          initialSync();
          startPeriodicSync(30000);
        });
      });
    }
    return () => { stopPeriodicSync(); };
  }, [user]);

  return null;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute recurso="dashboard"><Dashboard /></PrivateRoute>} />
      <Route path="/ordens" element={<PrivateRoute recurso="ordens"><OrdensServico /></PrivateRoute>} />
      <Route path="/clientes" element={<PrivateRoute recurso="clientes"><Clientes /></PrivateRoute>} />
      <Route path="/equipamentos" element={<PrivateRoute recurso="equipamentos"><Equipamentos /></PrivateRoute>} />
      <Route path="/tecnicos" element={<PrivateRoute recurso="tecnicos"><Tecnicos /></PrivateRoute>} />
      <Route path="/produtos" element={<PrivateRoute recurso="produtos"><Produtos /></PrivateRoute>} />
      <Route path="/relatorios" element={<PrivateRoute recurso="relatorios"><Relatorios /></PrivateRoute>} />
      <Route path="/relatorios/revisoes" element={<PrivateRoute recurso="relatorios"><RelatorioRevisoes /></PrivateRoute>} />
      <Route path="/usuarios" element={<PrivateRoute adminOnly><Usuarios /></PrivateRoute>} />
      <Route path="/backup" element={<PrivateRoute adminOnly><Backup /></PrivateRoute>} />
      <Route path="/configuracoes" element={<PrivateRoute adminOnly><Configuracoes /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SyncInitializer />
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
