import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { getSuppliers, getNonConformities, getSupplierNCs } from '@/lib/supplierStore';
import { getSupplierOverallStatus, getExpiredItems } from '@/lib/expiryUtils';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/local/client';
import { Tables } from '@/integrations/local/types';
import { cn } from '@/lib/utils';
import { Supplier, NonConformity } from '@/lib/types';

type Contract = Tables<'contracts'>;

export default function DashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allNCs, setAllNCs] = useState<NonConformity[]>([]);
  const [ncCounts, setNcCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [suppData, ncData, { data: contractData }] = await Promise.all([
        getSuppliers(),
        getNonConformities(),
        supabase.from('contracts').select('*'),
      ]);
      setSuppliers(suppData);
      setAllNCs(ncData);
      if (contractData) setContracts(contractData);

      // Load NC counts
      const counts: Record<string, number> = {};
      await Promise.all(suppData.map(async (s) => {
        const ncs = await getSupplierNCs(s.id);
        counts[s.id] = ncs.length;
      }));
      setNcCounts(counts);
      setLoading(false);
    };
    load();
  }, []);

  const activeSuppliers = suppliers.filter(s => s.active);
  const inactiveSuppliers = suppliers.filter(s => !s.active);
  const suppliersWithExpired = suppliers.filter(s => s.active && getExpiredItems(s).length > 0);
  const suppliersExpiring = suppliers.filter(s => s.active && getSupplierOverallStatus(s) === 'expiring');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const recentNCs = allNCs.filter(nc => new Date(nc.createdAt) >= twelveMonthsAgo);

  const riskData = [
    { name: 'Risk 1', value: activeSuppliers.filter(s => s.riskCategory === 1).length, color: 'hsl(142, 71%, 45%)' },
    { name: 'Risk 2', value: activeSuppliers.filter(s => s.riskCategory === 2).length, color: 'hsl(38, 92%, 50%)' },
    { name: 'Risk 3', value: activeSuppliers.filter(s => s.riskCategory === 3).length, color: 'hsl(0, 84%, 60%)' },
  ];

  const complianceData = [
    { name: 'Compliant', value: activeSuppliers.filter(s => getSupplierOverallStatus(s) === 'valid').length, color: 'hsl(142, 71%, 45%)' },
    { name: 'Expiring', value: suppliersExpiring.length, color: 'hsl(38, 92%, 50%)' },
    { name: 'Expired', value: suppliersWithExpired.length, color: 'hsl(0, 84%, 60%)' },
  ];

  const ncByResult: Record<string, number> = {};
  recentNCs.forEach(nc => { ncByResult[nc.result] = (ncByResult[nc.result] || 0) + 1; });
  const ncResultData = Object.entries(ncByResult).map(([name, value]) => ({ name, value }));

  const topNCSuppliers = activeSuppliers
    .map(s => ({ supplier: s, count: ncCounts[s.id] || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const contractStats = useMemo(() => {
    const active = contracts.filter(c => c.status === 'Active').length;
    const expiring = contracts.filter(c => c.status === 'Expiring Soon').length;
    const expired = contracts.filter(c => c.status === 'Expired').length;
    return { total: contracts.length, active, expiring, expired };
  }, [contracts]);

  const contractPieData = [
    { name: 'Active', value: contractStats.active, color: 'hsl(142, 71%, 45%)' },
    { name: 'Expiring', value: contractStats.expiring, color: 'hsl(38, 92%, 50%)' },
    { name: 'Expired', value: contractStats.expired, color: 'hsl(0, 84%, 60%)' },
  ];

  const kpiCards = [
    { label: 'Active Suppliers', value: activeSuppliers.length, icon: Users, accent: 'text-primary' },
    { label: 'Certificates Expiring', value: suppliersExpiring.length, icon: Clock, accent: 'text-warning' },
    { label: 'Expired Certificates', value: suppliersWithExpired.length, icon: AlertTriangle, accent: 'text-expired' },
    { label: 'Non-Conformities (12m)', value: recentNCs.length, icon: AlertTriangle, accent: 'text-warning' },
    { label: 'Active Contracts', value: contractStats.active, icon: CheckCircle2, accent: 'text-success' },
    { label: 'Expiring Contracts', value: contractStats.expiring, icon: Clock, accent: 'text-warning' },
    { label: 'Expired Contracts', value: contractStats.expired, icon: AlertTriangle, accent: 'text-expired' },
  ];

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
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of supplier compliance and contract performance</p>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {kpiCards.map(kpi => (
            <div key={kpi.label} className="apple-card p-4 flex flex-col min-h-[100px]">
              <div className="flex items-start justify-between">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={cn('h-4 w-4 shrink-0', kpi.accent)} />
              </div>
              <p className="text-2xl font-bold tracking-tight mt-auto">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="apple-section">
            <h3 className="font-semibold mb-4">Certification Status Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={complianceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4}>
                  {complianceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {complianceData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="apple-section">
            <h3 className="font-semibold mb-4">Contract Status Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={contractPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4}>
                  {contractPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {contractPieData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="apple-section">
            <h3 className="font-semibold mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4}>
                  {riskData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {riskData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="apple-section">
            <h3 className="font-semibold mb-4">Suppliers Requiring Attention</h3>
            {suppliersWithExpired.length > 0 ? (
              <div className="space-y-3">
                {suppliersWithExpired.slice(0, 6).map(s => {
                  const expired = getExpiredItems(s);
                  return (
                    <Link to={`/suppliers/${s.id}`} key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-expired/10 text-expired flex items-center justify-center text-xs font-semibold">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{expired.length} expired item{expired.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <StatusBadge status="expired" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">All suppliers are compliant ✓</p>
            )}
          </div>
        </div>

        <div className="apple-section">
          <h3 className="font-semibold mb-4">Non-Conformities by Result</h3>
          {ncResultData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ncResultData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(213 100% 45%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">No non-conformities recorded</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
