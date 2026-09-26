import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, AlertTriangle, Trash2, Save, Paperclip, Download, X, ExternalLink, Send, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { AppLayout } from '@/components/AppLayout';
import { NonConformityDialog } from '@/components/NonConformityDialog';
import { getSupplier, updateSupplier, addSupplier, deleteSupplier, getSupplierNCs, getInternalEmail } from '@/lib/supplierStore';
import { getExpiryStatus, getExpiredItems } from '@/lib/expiryUtils';
import { Supplier, NonConformity, INSURANCE_LABELS, CERTIFICATION_LABELS, InsuranceEntry, CertificationEntry, AttachedFile, TermsAndConditions } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/local/client';

function createEmptySupplier(): Supplier {
  const entry = (): InsuranceEntry => ({ coverageAmount: null, expiryDate: null, notApplicable: true });
  const cert = (): CertificationEntry => ({ expiryDate: null, notApplicable: true });
  return {
    id: crypto.randomUUID(), name: '', email: '', riskCategory: 1, active: true,
    createdAt: new Date().toISOString(),
    insurances: { employersLiability: entry(), publicLiability: entry(), productLiability: entry(), professionalIndemnity: entry() },
    certifications: { iso9001: cert(), iso14001: cert(), iso45001: cert(), iso27001: cert(), atex: cert(), achillesUVDB: cert(), achillesFPAL: cert() },
  };
}

async function uploadFile(supplierId: string, category: string, key: string, file: File): Promise<AttachedFile | null> {
  const ext = file.name.split('.').pop();
  const path = `${supplierId}/${category}/${key}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('supplier-documents').upload(path, file);
  if (error) {
    toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    return null;
  }
  return { name: file.name, path, uploadedAt: new Date().toISOString() };
}

async function downloadFile(attachedFile: AttachedFile) {
  const { data, error } = await supabase.storage.from('supplier-documents').download(attachedFile.path);
  if (error || !data) {
    toast({ title: 'Download failed', variant: 'destructive' });
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachedFile.name;
  a.click();
  URL.revokeObjectURL(url);
}

async function removeFile(path: string) {
  await supabase.storage.from('supplier-documents').remove([path]);
}

function FileAttachment({ attachedFile, onUpload, onRemove, canEdit }: {
  attachedFile?: AttachedFile | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (attachedFile) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <Paperclip className="h-3 w-3 text-muted-foreground" />
        <button onClick={() => downloadFile(attachedFile)} className="text-xs text-primary hover:underline truncate max-w-[200px]">
          {attachedFile.name}
        </button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => downloadFile(attachedFile)}>
          <Download className="h-3 w-3" />
        </Button>
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  if (!canEdit) return null;

  return (
    <div className="mt-2">
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); }} />
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 rounded-lg" onClick={() => inputRef.current?.click()}>
        <Paperclip className="h-3 w-3" /> Attach File
      </Button>
    </div>
  );
}

export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { role } = useUserRole();
  const canEdit = role === 'admin' || role === 'editor';

  const [supplier, setSupplier] = useState<Supplier>(createEmptySupplier());
  const [loading, setLoading] = useState(!isNew);
  const [ncDialogOpen, setNcDialogOpen] = useState(false);
  const [ncs, setNcs] = useState<NonConformity[]>([]);
  const expiredItems = getExpiredItems(supplier);

  useEffect(() => {
    if (isNew) return;
    const load = async () => {
      const found = await getSupplier(id!);
      if (found) setSupplier({ ...found });
      const supplierNcs = await getSupplierNCs(id!);
      setNcs(supplierNcs);
      setLoading(false);
    };
    load();
  }, [id, isNew]);

  const reloadNCs = async () => {
    const supplierNcs = await getSupplierNCs(supplier.id);
    setNcs(supplierNcs);
  };

  const handleSave = async () => {
    if (!supplier.name.trim() || !supplier.email.trim()) {
      toast({ title: 'Please fill in name and email', variant: 'destructive' });
      return;
    }
    try {
      if (isNew) {
        await addSupplier(supplier);
        toast({ title: 'Supplier created' });
        navigate(`/suppliers/${supplier.id}`);
      } else {
        await updateSupplier(supplier);
        toast({ title: 'Supplier updated' });
      }
    } catch (err: any) {
      toast({ title: 'Error saving supplier', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      await deleteSupplier(supplier.id);
      toast({ title: 'Supplier deleted' });
      navigate('/suppliers');
    }
  };

  const handleSendOnboardingLink = async () => {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);
      const { data, error } = await supabase.from('onboarding_tokens').insert({
        supplier_id: supplier.id,
        expires_at: expiresAt.toISOString(),
      }).select('token').single();
      if (error || !data) throw new Error(error?.message || 'Failed to create link');
      const link = `${window.location.origin}/onboarding?token=${data.token}`;
      await navigator.clipboard.writeText(link);
      
      const subject = encodeURIComponent(`Supplier Onboarding - ${supplier.name}`);
      const body = encodeURIComponent(
        `Dear ${supplier.name},\n\nPlease use the following link to submit your certificates, insurance details, and terms & conditions:\n\n${link}\n\nThis link will expire in 48 hours.\n\nKind regards`
      );
      window.open(`mailto:${supplier.email}?subject=${subject}&body=${body}`);
      toast({ title: 'Local onboarding link created', description: 'This portable build stores onboarding locally on this PC; external suppliers cannot access it until the future network version is enabled.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendExpiryEmail = async () => {
    const internalEmail = await getInternalEmail();
    const items = expiredItems.join(', ');
    const subject = encodeURIComponent(`Expired certificates/insurances - ${supplier.name}`);
    const body = encodeURIComponent(
      `Dear ${supplier.name},\n\nWe are writing to inform you that the following insurance certificates and/or standards have expired:\n\n${items}\n\nPlease send updated certificates to ${internalEmail} at your earliest convenience.\n\nKind regards`
    );
    window.open(`mailto:${supplier.email}?subject=${subject}&body=${body}`);
  };

  const updateInsurance = (key: keyof Supplier['insurances'], field: string, value: any) => {
    setSupplier(prev => ({
      ...prev,
      insurances: {
        ...prev.insurances,
        [key]: {
          ...prev.insurances[key],
          [field]: value,
          ...(field === 'notApplicable' && value ? { coverageAmount: null, expiryDate: null, attachedFile: null } : {}),
        },
      },
    }));
  };

  const updateCertification = (key: keyof Supplier['certifications'], field: string, value: any) => {
    setSupplier(prev => ({
      ...prev,
      certifications: {
        ...prev.certifications,
        [key]: {
          ...prev.certifications[key],
          [field]: value,
          ...(field === 'notApplicable' && value ? { expiryDate: null, attachedFile: null } : {}),
        },
      },
    }));
  };

  const handleInsuranceUpload = async (key: keyof Supplier['insurances'], file: File) => {
    const attached = await uploadFile(supplier.id, 'insurance', key, file);
    if (attached) {
      updateInsurance(key, 'attachedFile', attached);
      toast({ title: 'File attached' });
    }
  };

  const handleInsuranceRemove = async (key: keyof Supplier['insurances']) => {
    const existing = supplier.insurances[key].attachedFile;
    if (existing) await removeFile(existing.path);
    updateInsurance(key, 'attachedFile', null);
  };

  const handleCertUpload = async (key: keyof Supplier['certifications'], file: File) => {
    const attached = await uploadFile(supplier.id, 'certification', key, file);
    if (attached) {
      updateCertification(key, 'attachedFile', attached);
      toast({ title: 'File attached' });
    }
  };

  const handleCertRemove = async (key: keyof Supplier['certifications']) => {
    const existing = supplier.certifications[key].attachedFile;
    if (existing) await removeFile(existing.path);
    updateCertification(key, 'attachedFile', null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/suppliers')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'New Supplier' : supplier.name}</h1>
              {!isNew && <p className="text-sm text-muted-foreground">{supplier.email}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && canEdit && (
              <Button variant="outline" className="rounded-full gap-2" onClick={handleSendOnboardingLink}>
                <Send className="h-4 w-4" />
                Send Onboarding Link
              </Button>
            )}
            {!isNew && expiredItems.length > 0 && (
              <Button variant="destructive" className="rounded-full gap-2" onClick={handleSendExpiryEmail}>
                <Mail className="h-4 w-4" />
                Send Expiry Notification
              </Button>
            )}
            <Button className="rounded-full gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" />
              {isNew ? 'Create Supplier' : 'Save Changes'}
            </Button>
            {!isNew && (
              <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="apple-section space-y-4">
          <h2 className="text-lg font-semibold">General Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input value={supplier.name} onChange={e => setSupplier(p => ({ ...p, name: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={supplier.email} onChange={e => setSupplier(p => ({ ...p, email: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>Risk Category</Label>
              <Select value={String(supplier.riskCategory)} onValueChange={v => setSupplier(p => ({ ...p, riskCategory: Number(v) as 1 | 2 | 3 }))}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Risk 1 - Low</SelectItem>
                  <SelectItem value="2">Risk 2 - Medium</SelectItem>
                  <SelectItem value="3">Risk 3 - High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-3 pt-2">
                <Switch checked={supplier.active} onCheckedChange={v => setSupplier(p => ({ ...p, active: v }))} />
                <span className="text-sm">{supplier.active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="apple-section space-y-4">
          <h2 className="text-lg font-semibold">Terms & Conditions</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL Link</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/terms"
                  value={supplier.termsAndConditions?.url || ''}
                  onChange={e => setSupplier(p => ({ ...p, termsAndConditions: { ...p.termsAndConditions, url: e.target.value || null } }))}
                  className="rounded-lg"
                />
                {supplier.termsAndConditions?.url && (
                  <Button variant="outline" size="icon" className="shrink-0 rounded-lg" asChild>
                    <a href={supplier.termsAndConditions.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>File Attachment</Label>
              <FileAttachment
                attachedFile={supplier.termsAndConditions?.attachedFile}
                onUpload={async (file) => {
                  const attached = await uploadFile(supplier.id, 'terms', 'tc', file);
                  if (attached) {
                    setSupplier(p => ({ ...p, termsAndConditions: { ...p.termsAndConditions, attachedFile: attached } }));
                    toast({ title: 'T&C file attached' });
                  }
                }}
                onRemove={async () => {
                  const existing = supplier.termsAndConditions?.attachedFile;
                  if (existing) await removeFile(existing.path);
                  setSupplier(p => ({ ...p, termsAndConditions: { ...p.termsAndConditions, attachedFile: null } }));
                }}
                canEdit={canEdit}
              />
            </div>
          </div>
        </div>

        {/* Insurances */}
        <div className="apple-section space-y-4">
          <h2 className="text-lg font-semibold">Insurance Coverage</h2>
          <div className="grid gap-4">
            {(Object.keys(supplier.insurances) as Array<keyof Supplier['insurances']>).map(key => {
              const entry = supplier.insurances[key];
              const status = getExpiryStatus(entry.expiryDate, entry.notApplicable);
              return (
                <div key={key} className={cn('p-4 rounded-xl border border-border/50', entry.notApplicable && 'opacity-60')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{INSURANCE_LABELS[key]}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">N/A</span>
                      <Switch checked={entry.notApplicable} onCheckedChange={v => updateInsurance(key, 'notApplicable', v)} />
                    </div>
                  </div>
                  {!entry.notApplicable && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Coverage Amount (£)</Label>
                          <Input type="number" value={entry.coverageAmount ?? ''} onChange={e => updateInsurance(key, 'coverageAmount', e.target.value ? Number(e.target.value) : null)} className="rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Expiry Date</Label>
                          <Input type="date" value={entry.expiryDate ?? ''} onChange={e => updateInsurance(key, 'expiryDate', e.target.value || null)} className="rounded-lg" />
                        </div>
                      </div>
                      <FileAttachment
                        attachedFile={entry.attachedFile}
                        onUpload={file => handleInsuranceUpload(key, file)}
                        onRemove={() => handleInsuranceRemove(key)}
                        canEdit={canEdit}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Certifications */}
        <div className="apple-section space-y-4">
          <h2 className="text-lg font-semibold">Standards & Certifications</h2>
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(supplier.certifications) as Array<keyof Supplier['certifications']>).map(key => {
              const entry = supplier.certifications[key];
              const status = getExpiryStatus(entry.expiryDate, entry.notApplicable);
              return (
                <div key={key} className={cn('p-4 rounded-xl border border-border/50', entry.notApplicable && 'opacity-60')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{CERTIFICATION_LABELS[key]}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">N/A</span>
                      <Switch checked={entry.notApplicable} onCheckedChange={v => updateCertification(key, 'notApplicable', v)} />
                    </div>
                  </div>
                  {!entry.notApplicable && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Expiry Date</Label>
                        <Input type="date" value={entry.expiryDate ?? ''} onChange={e => updateCertification(key, 'expiryDate', e.target.value || null)} className="rounded-lg" />
                      </div>
                      <FileAttachment
                        attachedFile={entry.attachedFile}
                        onUpload={file => handleCertUpload(key, file)}
                        onRemove={() => handleCertRemove(key)}
                        canEdit={canEdit}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Non-Conformities */}
        {!isNew && (
          <div className="apple-section space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Non-Conformities</h2>
                <p className="text-sm text-muted-foreground">{ncs.length} raised in the past 12 months</p>
              </div>
              <Button variant="outline" className="rounded-full gap-2" onClick={() => setNcDialogOpen(true)}>
                <AlertTriangle className="h-4 w-4" />
                Report Non-Conformity
              </Button>
            </div>
            {ncs.length > 0 && (
              <div className="grid gap-3">
                {ncs.map(nc => (
                  <div key={nc.id} className="p-4 rounded-xl border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">PO: {nc.purchaseOrderNumber}</span>
                      <span className="text-xs text-muted-foreground">{new Date(nc.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Project</span>
                        <p className="font-medium">{nc.projectNumber}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Value Affected</span>
                        <p className="font-medium">£{nc.valueOfGoodsAffected.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Result</span>
                        <p className="font-medium">{nc.result}</p>
                      </div>
                    </div>
                    {nc.description && <p className="text-sm text-muted-foreground mt-2">{nc.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <NonConformityDialog open={ncDialogOpen} onOpenChange={setNcDialogOpen} supplier={supplier} onSubmitted={reloadNCs} />
      </div>
    </AppLayout>
  );
}
