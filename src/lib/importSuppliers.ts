import * as XLSX from 'xlsx';
import { Supplier, INSURANCE_LABELS, CERTIFICATION_LABELS } from './types';

const insKeys = Object.keys(INSURANCE_LABELS) as (keyof Supplier['insurances'])[];
const certKeys = Object.keys(CERTIFICATION_LABELS) as (keyof Supplier['certifications'])[];

function parseDate(val: unknown): string | null {
  if (!val || val === 'N/A' || val === '') return null;
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseCoverage(val: unknown): number | null {
  if (!val || val === 'N/A' || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export function parseImportedSuppliers(file: File): Promise<{ suppliers: Supplier[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        const suppliers: Supplier[] = [];
        const errors: string[] = [];

        rows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const name = String(row['Supplier Name'] ?? '').trim();
          if (!name) { errors.push(`Row ${rowNum}: Missing supplier name`); return; }

          const email = String(row['Email'] ?? '').trim();
          const riskRaw = Number(row['Risk Category'] ?? 1);
          const riskCategory = ([1, 2, 3].includes(riskRaw) ? riskRaw : 1) as 1 | 2 | 3;
          const statusRaw = String(row['Status'] ?? 'Active').trim().toLowerCase();
          const active = statusRaw !== 'inactive';

          const insurances = {} as Supplier['insurances'];
          for (const key of insKeys) {
            const label = INSURANCE_LABELS[key];
            const covVal = row[`${label} - Coverage (£)`];
            const expVal = row[`${label} - Expiry`];
            const na = covVal === 'N/A' || expVal === 'N/A';
            insurances[key] = {
              coverageAmount: na ? null : parseCoverage(covVal),
              expiryDate: na ? null : parseDate(expVal),
              notApplicable: na,
            };
          }

          const certifications = {} as Supplier['certifications'];
          for (const key of certKeys) {
            const label = CERTIFICATION_LABELS[key];
            const expVal = row[`${label} - Expiry`];
            const na = expVal === 'N/A';
            certifications[key] = {
              expiryDate: na ? null : parseDate(expVal),
              notApplicable: na,
            };
          }

          suppliers.push({
            id: crypto.randomUUID(),
            name,
            email,
            riskCategory,
            active,
            createdAt: new Date().toISOString().slice(0, 10),
            insurances,
            certifications,
          });
        });

        resolve({ suppliers, errors });
      } catch {
        resolve({ suppliers: [], errors: ['Failed to parse the Excel file. Please check the format.'] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
