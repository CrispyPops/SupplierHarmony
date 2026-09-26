import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, Shield, Eye, Copy, Mail, KeyRound, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/local/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

type AppRole = 'admin' | 'editor' | 'viewer';

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  role: AppRole;
}

export default function UsersPage() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('viewer');
  const [inviting, setInviting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetTempPassword, setResetTempPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await supabase.functions.invoke('admin-users', {
      body: { action: 'list' },
    });

    if (res.error) {
      toast.error('Failed to load users');
      return;
    }
    setUsers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    const res = await supabase.functions.invoke('admin-users', {
      body: { action: 'invite', email: inviteEmail.trim(), role: inviteRole },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || 'Failed to invite user');
    } else {
      toast.success(`Invited ${inviteEmail}`);
      setTempPassword(res.data.user.tempPassword);
      fetchUsers();
    }
    setInviting(false);
  };

  const handleUpdateRole = async (userId: string, newRole: AppRole) => {
    const res = await supabase.functions.invoke('admin-users', {
      body: { action: 'update_role', user_id: userId, role: newRole },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || 'Failed to update role');
    } else {
      toast.success('Role updated');
      fetchUsers();
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;

    const res = await supabase.functions.invoke('admin-users', {
      body: { action: 'delete', user_id: userId },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || 'Failed to delete user');
    } else {
      toast.success(`Deleted ${email}`);
      fetchUsers();
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setResetting(true);

    const res = await supabase.functions.invoke('admin-users', {
      body: { action: 'reset_password', user_id: resetUser.id },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || 'Failed to reset password');
    } else {
      setResetTempPassword(res.data.tempPassword);
      toast.success('Password reset successfully');
    }
    setResetting(false);
  };

  const roleIcon = (r: AppRole) => {
    if (r === 'admin') return <Shield className="h-3 w-3" />;
    if (r === 'editor') return <Pencil className="h-3 w-3" />;
    return <Eye className="h-3 w-3" />;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground text-sm mt-1">{users.length} users</p>
          </div>

          <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
            setInviteDialogOpen(open);
            if (!open) { setTempPassword(null); setInviteEmail(''); }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <UserPlus className="h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
              </DialogHeader>
              {tempPassword ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    User created successfully. Share these temporary credentials — they should change their password after first login.
                  </p>
                  <div className="bg-secondary rounded-xl p-4 space-y-2">
                    <p className="text-sm"><span className="font-medium">Email:</span> {inviteEmail || 'Sent'}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm"><span className="font-medium">Temp Password:</span> <code className="bg-muted px-2 py-0.5 rounded text-xs">{tempPassword}</code></p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(tempPassword);
                          toast.success('Copied to clipboard');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      className="rounded-full gap-2"
                      onClick={() => {
                        const email = inviteEmail || '';
                        const subject = encodeURIComponent('Your Supplier Management System Account');
                        const body = encodeURIComponent(
                          `Hello,\n\nYou have been invited to the Supplier Management System.\n\nPlease use the following credentials to log in:\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nLogin URL: ${window.location.origin}\n\nPlease change your password after your first login.\n\nBest regards`
                        );
                        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                      }}
                    >
                      <Mail className="h-4 w-4" />
                      Send Credentials via Email
                    </Button>
                    <DialogClose asChild>
                      <Button variant="outline" className="rounded-full">Done</Button>
                    </DialogClose>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" className="rounded-full">Cancel</Button>
                    </DialogClose>
                    <Button className="rounded-full" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                      {inviting ? 'Inviting…' : 'Create & Invite'}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Reset Password Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={(open) => {
          setResetDialogOpen(open);
          if (!open) { setResetUser(null); setResetTempPassword(null); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            {resetTempPassword ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Password has been reset for <strong>{resetUser?.email}</strong>. Share the new temporary password.
                </p>
                <div className="bg-secondary rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm"><span className="font-medium">New Password:</span> <code className="bg-muted px-2 py-0.5 rounded text-xs">{resetTempPassword}</code></p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(resetTempPassword);
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="rounded-full gap-2"
                    onClick={() => {
                      const email = resetUser?.email || '';
                      const subject = encodeURIComponent('Your Password Has Been Reset');
                      const body = encodeURIComponent(
                        `Hello,\n\nYour password for the Supplier Management System has been reset.\n\nNew Temporary Password: ${resetTempPassword}\n\nLogin URL: ${window.location.origin}\n\nPlease change your password after logging in.\n\nBest regards`
                      );
                      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    Send New Password via Email
                  </Button>
                  <DialogClose asChild>
                    <Button variant="outline" className="rounded-full">Done</Button>
                  </DialogClose>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will generate a new temporary password for <strong>{resetUser?.email}</strong>. They will need to use this new password to log in.
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="rounded-full">Cancel</Button>
                  </DialogClose>
                  <Button className="rounded-full" onClick={handleResetPassword} disabled={resetting}>
                    {resetting ? 'Resetting…' : 'Reset Password'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Users</CardTitle>
            <CardDescription>Manage access and roles for the supplier management system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        {u.id === user?.id ? (
                          <Badge variant="default" className="gap-1">
                            {roleIcon(u.role)} {u.role}
                          </Badge>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleUpdateRole(u.id, v as AppRole)}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">
                                <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> Viewer</span>
                              </SelectItem>
                              <SelectItem value="editor">
                                <span className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Editor</span>
                              </SelectItem>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> Admin</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.id !== user?.id && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => { setResetUser(u); setResetDialogOpen(true); }}
                              title="Reset password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(u.id, u.email!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}