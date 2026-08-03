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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#0EA5E9]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-sky-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-3xl p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] shadow-blue-950/50">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-5">
              <img
                src="/Logomarca_FF_Manutencoes_-_1254x1254.png"
                alt="FF Manutencoes - Ar Condicionado e Maquina de Lavar"
                className="w-full h-auto object-contain"
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
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 focus:shadow-lg focus:shadow-sky-500/10 transition-all duration-200"
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
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 focus:shadow-lg focus:shadow-sky-500/10 transition-all duration-200 pr-12"
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
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
            >
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
