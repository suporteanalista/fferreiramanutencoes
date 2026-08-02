import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, Recurso, Acao } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string, permissao: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isVendedor: boolean;
  canEdit: boolean;
  hasPermission: (recurso: Recurso, acao: Acao) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, nome: string, permissao: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome, permissao } }
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isAdmin = profile?.permissao === 'administrador';
  const isVendedor = profile?.permissao === 'vendedor' || profile?.permissao === 'operador';
  const canEdit = isAdmin || isVendedor;

  const hasPermission = useCallback((recurso: Recurso, acao: Acao): boolean => {
    if (!profile) return false;
    if (profile.permissao === 'administrador') return true;
    if (profile.permissao === 'visualizador') return acao === 'ver';
    const recursos = profile.permissoes_recursos;
    if (!recursos) return true;
    const recursoPerms = recursos[recurso];
    if (!recursoPerms) return false;
    return recursoPerms[acao] ?? false;
  }, [profile]);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, isAdmin, isVendedor, canEdit, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
