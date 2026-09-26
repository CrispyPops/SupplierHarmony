import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/local/client';

export interface LocalUser { id: string; email: string; must_change_password?: boolean; role?: string }
export interface LocalSession { access_token: string; user: LocalUser }
interface AuthContextType { session: LocalSession | null; user: LocalUser | null; loading: boolean; signIn: (email: string, password: string) => Promise<{ error: Error | null }>; signOut: () => Promise<void>; changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>; }
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const sub = supabase.auth.onAuthStateChange((_event, next) => { if (!mounted) return; setSession(next); setUser(next?.user ?? null); setLoading(false); });
    supabase.auth.getSession().then(({ data: { session: next } }) => { if (!mounted) return; setSession(next); setUser(next?.user ?? null); setLoading(false); });
    return () => { mounted = false; sub.data.subscription.unsubscribe(); };
  }, []);
  const signIn = async (email: string, password: string) => { const { error } = await supabase.auth.signInWithPassword({ email, password }); return { error: error as Error | null }; };
  const signOut = async () => { await supabase.auth.signOut(); };
  const changePassword = async (currentPassword: string, newPassword: string) => { if (!user) return { error: new Error('Not signed in') }; return supabase.auth.changePassword(user.id, currentPassword, newPassword); };
  return <AuthContext.Provider value={{ session, user, loading, signIn, signOut, changePassword }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context; }
