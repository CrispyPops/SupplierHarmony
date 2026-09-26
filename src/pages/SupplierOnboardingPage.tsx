import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Paperclip, Download, X, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/local/client';
import {
  Supplier, InsuranceEntry, CertificationEntry, AttachedFile,
  INSURANCE_LABELS, CERTIFICATION_LABELS, TermsAndConditions
} from '@/lib/types';

function FileAttachment({ attachedFile, onUpload, onRemove }: {
  attachedFile?: AttachedFile | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (attachedFile) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <Paperclip className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs truncate max-w-[200px]">{attachedFile.name}</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); }} />
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 rounded-lg" onClick={() => inputRef.current?.click()}>
        <Paperclip className="h-3 w-3" /> Attach File
      </Button>
    </div>
  );
}

async function uploadFile(onboardingToken: string, category: string, key: string, file: File): Promise<AttachedFile | null> {
  const ext = file.name.split('.').pop() || 'bin';
  const { data: signed, error: signErr } = await supabase.functions.invoke('supplier-onboarding', {
    body: { action: 'upload_url', token: onboardingToken, data: { category, key, ext } },
  });
  if (signErr || !signed?.path || !signed?.token) {
    toast({ title: 'Upload failed', description: 'Could not prepare the upload.', variant: 'destructive' });
    return null;
  }
  const { error } = await supabase.storage
    .from('supplier-documents')
    .uploadToSignedUrl(signed.path, signed.token, file);
  if (error) {
    toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
    return null;
  }
  return { name: file.name, path: signed.path, uploadedAt: new Date().toISOString() };
}

export default function SupplierOnboardingPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'submitted'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [supplierName, setSuppliierName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [insurances, setInsurances] = useState<Supplier['insurances'] | null>(null);
  const [certifications, setCertifications] = useState<Supplier['certifications'] | null>(null);
  const [termsAndConditions, setTermsAndConditions] = useState<TermsAndConditions>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No onboarding token provided');
      return;
    }
    const validate = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('supplier-onboarding', {
          body: { action: 'validate', token },
        });
        if (error || data?.error) {
          setStatus('error');
          setErrorMsg(data?.error || 'Invalid link');
          return;
        }
        const s = data.supplier;
        setSuppliierName(s.name);
        setSupplierId(s.id);
        setInsurances(s.insurances);
        setCertifications(s.certifications);
        setTermsAndConditions(s.terms_and_conditions || {});
        setStatus('ready');
      } catch {
        setStatus('error');
        setErrorMsg('Failed to validate link');
      }
    };
    validate();
  }, [token]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-onboarding', {
        body: {
          action: 'submit',
          token,
          data: { insurances, certifications, termsAndConditions },
        },
      });
      if (error || data?.error) {
        toast({ title: 'Error', description: data?.error || 'Submission failed', variant: 'destructive' });
      } else {
        setStatus('submitted');
      }
    } catch {
      toast({ title: 'Error', description: 'Submission failed', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const updateInsurance = (key: keyof Supplier['insurances'], field: string, value: any) => {
    setInsurances(prev => prev ? {
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
        ...(field === 'notApplicable' && value ? { coverageAmount: null, expiryDate: null, attachedFile: null } : {}),
      },
    } : prev);
  };

  const updateCertification = (key: keyof Supplier['certifications'], field: string, value: any) => {
    setCertifications(prev => prev ? {
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
        ...(field === 'notApplicable' && value ? { expiryDate: null, attachedFile: null } : {}),
      },
    } : prev);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster />
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster />
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <h1 className="text-2xl font-bold text-destructive">Link Invalid</h1>
          <p className="text-muted-foreground">{errorMsg}</p>
          <p className="text-sm text-muted-foreground">Please contact your procurement team for a new link.</p>
        </div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster />
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
          <h1 className="text-2xl font-bold">Thank You!</h1>
          <p className="text-muted-foreground">Your information has been submitted successfully. You may now close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Onboarding</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome <span className="font-medium text-foreground">{supplierName}</span>. Please review and update your certificates, insurance details, and terms & conditions below.
          </p>
        </div>

        {/* Terms & Conditions */}
        <div className="border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Terms & Conditions</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL Link</Label>
              <Input
                placeholder="https://example.com/terms"
                value={termsAndConditions?.url || ''}
                onChange={e => setTermsAndConditions(p => ({ ...p, url: e.target.value || null }))}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>File Attachment</Label>
              <FileAttachment
                attachedFile={termsAndConditions?.attachedFile}
                onUpload={async (file) => {
                  const attached = await uploadFile(token!, 'terms', 'tc', file);
                  if (attached) {
                    setTermsAndConditions(p => ({ ...p, attachedFile: attached }));
                    toast({ title: 'T&C file attached' });
                  }
                }}
                onRemove={() => setTermsAndConditions(p => ({ ...p, attachedFile: null }))}
              />
            </div>
          </div>
        </div>

        {/* Insurances */}
        {insurances && (
          <div className="border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Insurance Coverage</h2>
            <div className="grid gap-4">
              {(Object.keys(insurances) as Array<keyof Supplier['insurances']>).map(key => {
                const entry = insurances[key];
                return (
                  <div key={key} className={cn('p-4 rounded-xl border border-border/50', entry.notApplicable && 'opacity-60')}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{INSURANCE_LABELS[key]}</span>
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
                          onUpload={async (file) => {
                            const attached = await uploadFile(token!, 'insurance', key, file);
                            if (attached) {
                              updateInsurance(key, 'attachedFile', attached);
                              toast({ title: 'File attached' });
                            }
                          }}
                          onRemove={() => updateInsurance(key, 'attachedFile', null)}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certifications */}
        {certifications && (
          <div className="border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Standards & Certifications</h2>
            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(certifications) as Array<keyof Supplier['certifications']>).map(key => {
                const entry = certifications[key];
                return (
                  <div key={key} className={cn('p-4 rounded-xl border border-border/50', entry.notApplicable && 'opacity-60')}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{CERTIFICATION_LABELS[key]}</span>
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
                          onUpload={async (file) => {
                            const attached = await uploadFile(token!, 'certification', key, file);
                            if (attached) {
                              updateCertification(key, 'attachedFile', attached);
                              toast({ title: 'File attached' });
                            }
                          }}
                          onRemove={() => updateCertification(key, 'attachedFile', null)}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end pb-8">
          <Button size="lg" className="rounded-full px-8" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Information
          </Button>
        </div>
      </div>
    </div>
  );
}
