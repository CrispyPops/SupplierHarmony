import { useRef, useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getInternalEmail, setInternalEmail } from '@/lib/supplierStore';
import { createBackup, restoreBackup, getAppDataPath } from '@/lib/localDb';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user, changePassword } = useAuth();
  const [email, setEmail] = useState(''); const [loading, setLoading] = useState(true);
  const [currentPassword,setCurrentPassword]=useState(''); const [newPassword,setNewPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState('');
  const [dataPath,setDataPath]=useState(''); const [busy,setBusy]=useState(false); const restoreRef=useRef<HTMLInputElement>(null);
  useEffect(() => { Promise.all([getInternalEmail(),getAppDataPath()]).then(([e,p])=>{setEmail(e);setDataPath(p);setLoading(false);}); }, []);
  const handleSave = async () => { await setInternalEmail(email); toast({ title:'Settings saved' }); };
  const handlePassword = async () => { if(newPassword.length<8){toast({title:'Password too short',description:'Use at least 8 characters.',variant:'destructive'});return;} if(newPassword!==confirmPassword){toast({title:'Passwords do not match',variant:'destructive'});return;} const {error}=await changePassword(currentPassword,newPassword); if(error) toast({title:'Password change failed',description:error.message,variant:'destructive'}); else {setCurrentPassword('');setNewPassword('');setConfirmPassword('');toast({title:'Password changed'});} };
  const handleBackup = async () => { setBusy(true); try { const path=await createBackup(); toast({title:'Backup created',description:path}); } catch(e:any){toast({title:'Backup failed',description:String(e),variant:'destructive'});} finally{setBusy(false);} };
  const handleRestore = async (file: File) => { if(!confirm('Restore this backup? Current data will be overwritten.')) return; setBusy(true); try { const bytes=new Uint8Array(await file.arrayBuffer()); let s=''; bytes.forEach(b=>s+=String.fromCharCode(b)); await restoreBackup(btoa(s)); toast({title:'Backup restored',description:'Please close and reopen Supplier Harmony.'}); } catch(e:any){toast({title:'Restore failed',description:String(e),variant:'destructive'});} finally{setBusy(false);} };
  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div></AppLayout>;
  return <AppLayout><div className="max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-muted-foreground text-sm mt-1">Configure system preferences and local application data</p></div>
    <div className="apple-section space-y-4"><h2 className="text-lg font-semibold">Internal Email Address</h2><p className="text-sm text-muted-foreground">This email will appear in expiry notifications sent to suppliers.</p><div className="space-y-2"><Label>Email Address</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="rounded-lg" /></div><Button className="rounded-full" onClick={handleSave}>Save Settings</Button></div>
    <div className="apple-section space-y-4"><h2 className="text-lg font-semibold">Change Password</h2><p className="text-sm text-muted-foreground">The initial administrator password should be changed before production use.</p><div className="grid gap-3"><Input type="password" placeholder="Current password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} /><Input type="password" placeholder="New password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /><Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></div><Button className="rounded-full" onClick={handlePassword}>Change Password</Button></div>
    <div className="apple-section space-y-4"><h2 className="text-lg font-semibold">Backup & Restore</h2><p className="text-sm text-muted-foreground">Backups include the SQLite database and local supplier/contract documents.</p><div className="flex flex-wrap gap-2"><Button className="rounded-full" disabled={busy} onClick={handleBackup}>Create Backup</Button><input ref={restoreRef} type="file" accept=".zip" className="hidden" onChange={e=>e.target.files?.[0]&&handleRestore(e.target.files[0])}/><Button variant="outline" className="rounded-full" disabled={busy} onClick={()=>restoreRef.current?.click()}>Restore Backup</Button></div><p className="text-xs text-muted-foreground break-all">Local data: {dataPath}</p></div>
    <div className="text-xs text-muted-foreground">Signed in as {user?.email}</div>
  </div></AppLayout>;
}
