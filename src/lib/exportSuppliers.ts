import * as XLSX from 'xlsx';
import { Supplier, INSURANCE_LABELS, CERTIFICATION_LABELS } from './types';

export function exportSuppliersToExcel(suppliers: Supplier[], ncCounts: Record<string, number>) {
  const rows = suppliers.map(s => {
    const ncCount = ncCounts[s.id] || 0;
    const row: Record<string, string | number> = {
      'Supplier Name': s.name,
      'Email': s.email,
      'Risk Category': s.riskCategory,
      'Status': s.active ? 'Active' : 'Inactive',
    };

    for (const [key, label] of Object.entries(INSURANCE_LABELS)) {
      const ins = s.insurances[key as keyof typeof s.insurances];
      row[`${label} - Coverage (£)`] = ins.notApplicable ? 'N/A' : (ins.coverageAmount ?? '');
      row[`${label} - Expiry`] = ins.notApplicable ? 'N/A' : (ins.expiryDate ?? '');
    }

    for (const [key, label] of Object.entries(CERTIFICATION_LABELS)) {
      const cert = s.certifications[key as keyof typeof s.certifications];
      row[`${label} - Expiry`] = cert.notApplicable ? 'N/A' : (cert.expiryDate ?? '');
    }

    row['Non-Conformities (12 months)'] = ncCount;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length + 2, ...rows.map(r => String(r[key] ?? '').length + 2))
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
  XLSX.writeFile(wb, `Suppliers_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
