import { supabase } from '@/integrations/local/client';
import { Supplier, NonConformity } from './types';

// Convert DB row to Supplier type
function rowToSupplier(row: any): Supplier {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    riskCategory: row.risk_category as 1 | 2 | 3,
    active: row.active,
    createdAt: row.created_at,
    insurances: row.insurances || {},
    certifications: row.certifications || {},
    termsAndConditions: row.terms_and_conditions || {},
  };
}

function supplierToRow(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    risk_category: s.riskCategory,
    active: s.active,
    created_at: s.createdAt,
    insurances: s.insurances as any,
    certifications: s.certifications as any,
    terms_and_conditions: (s.termsAndConditions || {}) as any,
  };
}

function rowToNC(row: any): NonConformity {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    purchaseOrderNumber: row.purchase_order_number,
    projectNumber: row.project_number,
    valueOfGoodsAffected: Number(row.value_of_goods_affected),
    result: row.result,
    description: row.description,
    createdAt: row.created_at,
  };
}

// ---- Suppliers ----

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) { console.error('getSuppliers error:', error); return []; }
  return (data || []).map(rowToSupplier);
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
  if (error || !data) return undefined;
  return rowToSupplier(data);
}

export async function addSupplier(supplier: Supplier): Promise<void> {
  const { error } = await supabase.from('suppliers').insert(supplierToRow(supplier));
  if (error) { console.error('addSupplier error:', error); throw error; }
}

export async function updateSupplier(supplier: Supplier): Promise<void> {
  const { error } = await supabase.from('suppliers').update(supplierToRow(supplier)).eq('id', supplier.id);
  if (error) { console.error('updateSupplier error:', error); throw error; }
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) { console.error('deleteSupplier error:', error); throw error; }
}

// ---- Non-Conformities ----

export async function getNonConformities(): Promise<NonConformity[]> {
  const { data, error } = await supabase.from('non_conformities').select('*');
  if (error) { console.error('getNonConformities error:', error); return []; }
  return (data || []).map(rowToNC);
}

export async function addNonConformity(nc: NonConformity): Promise<void> {
  const { error } = await supabase.from('non_conformities').insert({
    id: nc.id,
    supplier_id: nc.supplierId,
    purchase_order_number: nc.purchaseOrderNumber,
    project_number: nc.projectNumber,
    value_of_goods_affected: nc.valueOfGoodsAffected,
    result: nc.result,
    description: nc.description,
    created_at: nc.createdAt,
  });
  if (error) { console.error('addNonConformity error:', error); throw error; }
}

export async function getSupplierNCs(supplierId: string): Promise<NonConformity[]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const { data, error } = await supabase
    .from('non_conformities')
    .select('*')
    .eq('supplier_id', supplierId)
    .gte('created_at', twelveMonthsAgo.toISOString().slice(0, 10));
  if (error) { console.error('getSupplierNCs error:', error); return []; }
  return (data || []).map(rowToNC);
}

// ---- Settings ----

export async function getInternalEmail(): Promise<string> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'internal_email').maybeSingle();
  return data?.value || 'compliance@company.com';
}

export async function setInternalEmail(email: string): Promise<void> {
  await supabase.from('app_settings').upsert({ key: 'internal_email', value: email });
}
