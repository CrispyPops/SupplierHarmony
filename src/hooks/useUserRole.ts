import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/local/client';
import { useAuth } from './useAuth';
export function useUserRole() {
  const { user } = useAuth(); const [role, setRole] = useState<'admin'|'editor'|'viewer'|null>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{ if(!user){setRole(null);setLoading(false);return;} supabase.from('user_roles').select('role').eq('user_id',user.id).maybeSingle().then(({data}:any)=>{setRole(data?.role ?? 'viewer');setLoading(false);}); },[user]);
  return { role, isAdmin: role==='admin', loading };
}
