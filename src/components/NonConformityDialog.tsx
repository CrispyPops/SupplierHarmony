import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addNonConformity } from '@/lib/supplierStore';
import { Supplier, NonConformity } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  onSubmitted?: () => void;
}

export function NonConformityDialog({ open, onOpenChange, supplier, onSubmitted }: Props) {
  const [form, setForm] = useState({
    purchaseOrderNumber: '',
    projectNumber: '',
    valueOfGoodsAffected: '',
    result: '',
    description: '',
  });

  const handleSubmit = async () => {
    if (!form.purchaseOrderNumber || !form.projectNumber || !form.result) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    const nc: NonConformity = {
      id: crypto.randomUUID(),
      supplierId: supplier.id,
      purchaseOrderNumber: form.purchaseOrderNumber,
      projectNumber: form.projectNumber,
      valueOfGoodsAffected: Number(form.valueOfGoodsAffected) || 0,
      result: form.result,
      description: form.description,
      createdAt: new Date().toISOString(),
    };

    try {
      await addNonConformity(nc);

      // Open mailto for NC report
      const subject = encodeURIComponent(`Non-Conformity Report - PO ${nc.purchaseOrderNumber}`);
      const body = encodeURIComponent(
        `Dear ${supplier.name},\n\nA non-conformity has been raised against your supply:\n\nPurchase Order: ${nc.purchaseOrderNumber}\nProject Number: ${nc.projectNumber}\nValue of Goods Affected: £${nc.valueOfGoodsAffected.toLocaleString()}\nResult: ${nc.result}\n\nDetails:\n${nc.description}\n\nPlease respond at your earliest convenience.\n\nKind regards`
      );
      window.open(`mailto:${supplier.email}?subject=${subject}&body=${body}`);

      toast({ title: 'Non-conformity reported' });
      setForm({ purchaseOrderNumber: '', projectNumber: '', valueOfGoodsAffected: '', result: '', description: '' });
      onOpenChange(false);
      onSubmitted?.();
    } catch (err: any) {
      toast({ title: 'Error saving non-conformity', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Report Non-Conformity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Order Number *</Label>
              <Input value={form.purchaseOrderNumber} onChange={e => setForm(p => ({ ...p, purchaseOrderNumber: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>Project Number *</Label>
              <Input value={form.projectNumber} onChange={e => setForm(p => ({ ...p, projectNumber: e.target.value }))} className="rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Value of Goods Affected (£)</Label>
              <Input type="number" value={form.valueOfGoodsAffected} onChange={e => setForm(p => ({ ...p, valueOfGoodsAffected: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>Result *</Label>
              <Select value={form.result} onValueChange={v => setForm(p => ({ ...p, result: v }))}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rework">Rework</SelectItem>
                  <SelectItem value="Return">Return</SelectItem>
                  <SelectItem value="Scrap">Scrap</SelectItem>
                  <SelectItem value="Accept on Concession">Accept on Concession</SelectItem>
                  <SelectItem value="Credit Note">Credit Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="rounded-lg" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="rounded-full" onClick={handleSubmit}>Submit & Send Report</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
