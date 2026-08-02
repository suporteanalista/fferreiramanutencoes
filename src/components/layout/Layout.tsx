import { ReactNode, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import SyncIndicator from '../ui/SyncIndicator';

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 min-w-0">
        <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden lg:block" />
          <SyncIndicator />
        </div>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
