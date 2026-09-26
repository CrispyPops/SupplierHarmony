import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { FileText, Plus, Search, Trash2, Paperclip, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/local/client';
import { getSuppliers } from '@/lib/supplierStore';
import { Tables, Enums } from '@/integrations/local/types';
import { Constants } from '@/integrations/local/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Contract = Tables<'contracts'>;
type ContractFile = Tables<'contract_files'>;
type ContractHistory = Tables<'contract_history'>;
type ContractType = Enums<'contract_type'>;
type ContractStatus = Enums<'contract_status'>;

const CONTRACT_TYPES = Constants.public.Enums.contract_type;

function computeStatus(expirationDate: string): ContractStatus {
  const today = new Date();
  const exp = parseISO(expirationDate);
  if (isBefore(exp, today)) return 'Expired';
  if (isBefore(exp, addDays(today, 30))) return 'Expiring Soon';
  return 'Active';
}

function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const config = {
    'Active': { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle2 },
    'Expiring Soon': { bg: 'bg-warning/10', text: 'text-warning', icon: Clock },
    'Expired': { bg: 'bg-expired/10', text: 'text-expired', icon: AlertCircle },
  }[status];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.text)}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ContractStatus>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailFiles, setDetailFiles] = useState<ContractFile[]>([]);
  const [detailHistory, setDetailHistory] = useState<ContractHistory[]>([]);
  const { role } = useUserRole();
  const { user } = useAuth();
  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  const [suppliers, setSuppliers] = useState<import('@/lib/types').Supplier[]>([]);

  useEffect(() => {
    getSuppliers().then(setSuppliers);
  }, []);

  // New contract form
  const [newContract, setNewContract] = useState({
    supplierId: '',
    type: 'IT Services' as ContractType,
    startDate: '',
    expirationDate: '',
  });

  const fetchContracts = async () => {
    const { data } = await supabase.from('contracts').select('*').order('created_at', { ascending: false });
    if (data) setContracts(data);
    setLoading(false);
  };

  useEffect(() => { fetchContracts(); }, []);

  const filtered = useMemo(() => {
    return contracts.filter(c => {
      if (search && !c.supplier_name.toLowerCase().includes(search.toLowerCase()) && !c.type.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      return true;
    });
  }, [contracts, search, filterStatus]);

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find(s => s.id === newContract.supplierId);
    if (!supplier) { toast.error('Please select a supplier'); return; }

    const status = computeStatus(newContract.expirationDate);

    const { error } = await supabase.from('contracts').insert({
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      type: newContract.type,
      start_date: newContract.startDate,
      expiration_date: newContract.expirationDate,
      status,
    });

    if (error) { toast.error('Failed to create contract'); return; }

    // Add history
    const { data: inserted } = await supabase.from('contracts').select('id').order('created_at', { ascending: false }).limit(1).single();
    if (inserted && user) {
      await supabase.from('contract_history').insert({
        contract_id: inserted.id,
        change_type: 'Created',
        new_value: `Contract (${newContract.type}) created for ${supplier.name}`,
        changed_by: user.id,
      });
    }

    toast.success('Contract created');
    setIsAddOpen(false);
    setNewContract({ supplierId: '', type: 'IT Services', startDate: '', expirationDate: '' });
    fetchContracts();
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Contract deleted');
    fetchContracts();
  };

  const openDetail = async (contract: Contract) => {
    setSelectedContract(contract);
    const [files, history] = await Promise.all([
      supabase.from('contract_files').select('*').eq('contract_id', contract.id).order('uploaded_at', { ascending: false }),
      supabase.from('contract_history').select('*').eq('contract_id', contract.id).order('created_at', { ascending: false }),
    ]);
    setDetailFiles(files.data || []);
    setDetailHistory(history.data || []);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedContract || !user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const filePath = `${selectedContract.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('contract-files').upload(filePath, file);
    if (uploadError) { toast.error('Upload failed'); return; }

    // Mark previous files as not current
    await supabase.from('contract_files').update({ is_current: false }).eq('contract_id', selectedContract.id).eq('is_current', true);

    await supabase.from('contract_files').insert({
      contract_id: selectedContract.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      is_current: true,
    });

    await supabase.from('contract_history').insert({
      contract_id: selectedContract.id,
      change_type: 'File Attached',
      new_value: `Attached: ${file.name}`,
      changed_by: user.id,
    });

    toast.success('File uploaded');
    openDetail(selectedContract);
    e.target.value = '';
  };

  const handleDownloadFile = async (cf: ContractFile) => {
    const { data } = await supabase.storage.from('contract-files').download(cf.file_path);
    if (!data) { toast.error('Download failed'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = cf.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = async (cf: ContractFile) => {
    if (!selectedContract || !user) return;
    await supabase.from('contract_files').update({ is_current: false }).eq('contract_id', selectedContract.id).eq('is_current', true);
    await supabase.from('contract_files').update({ is_current: true }).eq('id', cf.id);
    await supabase.from('contract_history').insert({
      contract_id: selectedContract.id,
      change_type: 'File Attached',
      new_value: `Restored version: ${cf.file_name}`,
      changed_by: user.id,
    });
    toast.success('File version restored');
    openDetail(selectedContract);
  };

  const currentFile = detailFiles.find(f => f.is_current);
  const archivedFiles = detailFiles.filter(f => !f.is_current);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
            <p className="text-muted-foreground text-sm mt-1">{contracts.length} total contracts</p>
          </div>
          {canEdit && (
            <Button className="rounded-full gap-2" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Contract
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contracts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full bg-secondary border-0" />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'Active', 'Expiring Soon', 'Expired'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  filterStatus === s ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Contract List */}
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Supplier</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Start Date</th>
                  <th className="px-6 py-4 font-semibold">Expiration</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">No contracts found</td></tr>
                ) : filtered.map(contract => (
                  <tr key={contract.id} className="hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => openDetail(contract)}>
                    <td className="px-6 py-4 font-medium">{contract.supplier_name}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-secondary px-2 py-1 rounded-md text-muted-foreground font-medium">{contract.type}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{format(parseISO(contract.start_date), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{format(parseISO(contract.expiration_date), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4"><ContractStatusBadge status={contract.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openDetail(contract)} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="View Details">
                          <Search className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(contract.id)} className="text-muted-foreground hover:text-expired transition-colors p-1" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Contract Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddContract} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Supplier</label>
              <Select value={newContract.supplierId} onValueChange={v => setNewContract(p => ({ ...p, supplierId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.filter(s => s.active).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Contract Type</label>
              <Select value={newContract.type} onValueChange={v => setNewContract(p => ({ ...p, type: v as ContractType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                <Input type="date" required value={newContract.startDate} onChange={e => setNewContract(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Expiration Date</label>
                <Input type="date" required value={newContract.expirationDate} onChange={e => setNewContract(p => ({ ...p, expirationDate: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit">Create Contract</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contract Detail Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={(open) => { if (!open) setSelectedContract(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedContract && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  {selectedContract.supplier_name} — {selectedContract.type}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="details">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Details & Files</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">Audit Log</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-6 mt-4">
                  {/* Contract Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="apple-card p-4">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <ContractStatusBadge status={selectedContract.status} />
                    </div>
                    <div className="apple-card p-4">
                      <p className="text-xs text-muted-foreground mb-1">Type</p>
                      <p className="text-sm font-medium">{selectedContract.type}</p>
                    </div>
                    <div className="apple-card p-4">
                      <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                      <p className="text-sm font-medium">{format(parseISO(selectedContract.start_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="apple-card p-4">
                      <p className="text-xs text-muted-foreground mb-1">Expiration Date</p>
                      <p className="text-sm font-medium">{format(parseISO(selectedContract.expiration_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>

                  {/* Files */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm">Attachments</h4>
                      {canEdit && (
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" onChange={handleFileUpload} />
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                            <Paperclip className="h-3 w-3" />
                            Upload File
                          </span>
                        </label>
                      )}
                    </div>
                    {currentFile && (
                      <div className="apple-card p-3 flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{currentFile.file_name}</p>
                            <p className="text-xs text-muted-foreground">Current version · {(currentFile.file_size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(currentFile)}>Download</Button>
                      </div>
                    )}
                    {archivedFiles.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-xs text-muted-foreground font-medium">Archived Versions</p>
                        {archivedFiles.map(f => (
                          <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs">{f.file_name}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleDownloadFile(f)}>Download</Button>
                              {canEdit && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleRestoreFile(f)}>Restore</Button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!currentFile && archivedFiles.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No files attached yet</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                  {detailHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No history entries</p>
                  ) : (
                    <div className="space-y-3">
                      {detailHistory.map(h => (
                        <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{h.change_type}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{h.new_value}</p>
                            {h.previous_value && (
                              <p className="text-xs text-muted-foreground">Previously: {h.previous_value}</p>
                            )}
                            <p className="text-xs text-muted-foreground/60 mt-1">{format(parseISO(h.created_at), 'MMM d, yyyy HH:mm')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
