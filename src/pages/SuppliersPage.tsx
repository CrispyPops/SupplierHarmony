import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ChevronRight, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
import { AppLayout } from '@/components/AppLayout';
import { getSuppliers, addSupplier, getSupplierNCs } from '@/lib/supplierStore';
import { getSupplierOverallStatus, getExpiredItems } from '@/lib/expiryUtils';
import { exportSuppliersToExcel } from '@/lib/exportSuppliers';
import { parseImportedSuppliers } from '@/lib/importSuppliers';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Supplier } from '@/lib/types';

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterRisk, setFilterRisk] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ncCounts, setNcCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAdmin, role } = useUserRole();
  const canEdit = role === 'admin' || role === 'editor';

  const loadData = async () => {
    setLoading(true);
    const data = await getSuppliers();
    setSuppliers(data);
    // Load NC counts for each supplier
    const counts: Record<string, number> = {};
    await Promise.all(data.map(async (s) => {
      const ncs = await getSupplierNCs(s.id);
      counts[s.id] = ncs.length;
    }));
    setNcCounts(counts);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus === 'active' && !s.active) return false;
      if (filterStatus === 'inactive' && s.active) return false;
      if (filterRisk && s.riskCategory !== filterRisk) return false;
      return true;
    });
  }, [suppliers, search, filterStatus, filterRisk]);

  const riskColors: Record<number, string> = {
    1: 'bg-success/10 text-success',
    2: 'bg-warning/10 text-warning',
    3: 'bg-expired/10 text-expired',
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-muted-foreground text-sm mt-1">{suppliers.length} total suppliers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full gap-2" onClick={() => exportSuppliersToExcel(filtered, ncCounts)}>
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
            {canEdit && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const { suppliers: imported, errors } = await parseImportedSuppliers(file);
                    if (errors.length) errors.forEach(err => toast.error(err));
                    if (imported.length) {
                      for (const s of imported) {
                        await addSupplier(s);
                      }
                      await loadData();
                      toast.success(`Imported ${imported.length} supplier(s)`);
                    }
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" className="rounded-full gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Import Excel
                </Button>
              </>
            )}
            <Link to="/suppliers/new">
              <Button className="rounded-full gap-2">
                <Plus className="h-4 w-4" />
                Add Supplier
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-full bg-secondary border-0"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'active', 'inactive'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize',
                  filterStatus === s ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[null, 1, 2, 3].map(r => (
              <button
                key={r ?? 'all'}
                onClick={() => setFilterRisk(r)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  filterRisk === r ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {r === null ? 'All Risk' : `Risk ${r}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {filtered.map(supplier => {
            const status = getSupplierOverallStatus(supplier);
            const expiredItems = getExpiredItems(supplier);
            const ncCount = ncCounts[supplier.id] || 0;

            return (
              <Link
                to={`/suppliers/${supplier.id}`}
                key={supplier.id}
                className="apple-card p-5 flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
                    supplier.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {supplier.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{supplier.name}</h3>
                      {!supplier.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{supplier.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', riskColors[supplier.riskCategory])}>
                    Risk {supplier.riskCategory}
                  </span>
                  <StatusBadge status={status} />
                  {expiredItems.length > 0 && (
                    <span className="text-xs text-expired font-medium">{expiredItems.length} expired</span>
                  )}
                  {ncCount > 0 && (
                    <span className="text-xs text-warning font-medium">{ncCount} NC</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No suppliers found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
