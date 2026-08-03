import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-[#0B1120] via-[#1E3A8A] to-[#3B82F6]">
      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/[0.06] border border-white/10 rounded-[1.75rem] p-7 sm:p-11 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6),0_8px_24px_-8px_rgba(30,58,138,0.4)]">
          <div className="flex flex-col items-center mb-9">
            <div className="mb-6">
              <img
                src="/Logomarca_FF_Manutencoes_-_1254x1254.png"
                alt="FF Manutencoes - Ar Condicionado e Maquina de Lavar"
                className="w-full h-auto object-contain mx-auto drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                style={{ maxWidth: '260px' }}
                loading="eager"
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80 mb-2">Bem-vindo</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">SAC Ordem de Servico</h1>
            <p className="text-slate-300 text-sm mt-1.5">sua ordem de servico completa nas nuvens</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400/50 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)] transition-all duration-200"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400/50 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)] transition-all duration-200 pr-12"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[#1E3A8A] via-[#3B82F6] to-[#0EA5E9] text-white font-semibold rounded-2xl shadow-lg shadow-blue-900/40 hover:shadow-xl hover:shadow-blue-500/40 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:translate-y-0 disabled:active:scale-100"
            >
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
