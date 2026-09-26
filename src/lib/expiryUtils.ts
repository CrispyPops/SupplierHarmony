import { ExpiryStatus, Supplier, INSURANCE_LABELS, CERTIFICATION_LABELS } from './types';

export function getExpiryStatus(dateStr: string | null, notApplicable: boolean): ExpiryStatus {
  if (notApplicable || dateStr === null) return 'na';
  const expiry = new Date(dateStr);
  const now = new Date();
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  if (expiry < now) return 'expired';
  if (expiry <= thirtyDays) return 'expiring';
  return 'valid';
}

export function getStatusLabel(status: ExpiryStatus): string {
  switch (status) {
    case 'valid': return 'Valid';
    case 'expiring': return 'Expiring Soon';
    case 'expired': return 'Expired';
    case 'na': return 'N/A';
  }
}

export function getExpiredItems(supplier: Supplier): string[] {
  const expired: string[] = [];

  for (const [key, entry] of Object.entries(supplier.insurances)) {
    const status = getExpiryStatus(entry.expiryDate, entry.notApplicable);
    if (status === 'expired') {
      expired.push(INSURANCE_LABELS[key as keyof typeof INSURANCE_LABELS]);
    }
  }

  for (const [key, entry] of Object.entries(supplier.certifications)) {
    const status = getExpiryStatus(entry.expiryDate, entry.notApplicable);
    if (status === 'expired') {
      expired.push(CERTIFICATION_LABELS[key as keyof typeof CERTIFICATION_LABELS]);
    }
  }

  return expired;
}

export function hasExpiredItems(supplier: Supplier): boolean {
  return getExpiredItems(supplier).length > 0;
}

export function getSupplierOverallStatus(supplier: Supplier): ExpiryStatus {
  if (!supplier.active) return 'na';
  
  let hasExpiring = false;

  for (const entry of Object.values(supplier.insurances)) {
    const s = getExpiryStatus(entry.expiryDate, entry.notApplicable);
    if (s === 'expired') return 'expired';
    if (s === 'expiring') hasExpiring = true;
  }
  for (const entry of Object.values(supplier.certifications)) {
    const s = getExpiryStatus(entry.expiryDate, entry.notApplicable);
    if (s === 'expired') return 'expired';
    if (s === 'expiring') hasExpiring = true;
  }

  return hasExpiring ? 'expiring' : 'valid';
}
