export interface AttachedFile {
  name: string;
  path: string; // storage path in supplier-documents bucket
  uploadedAt: string;
}

export interface InsuranceEntry {
  coverageAmount: number | null; // null = N/A
  expiryDate: string | null; // ISO date string, null = N/A
  notApplicable: boolean;
  attachedFile?: AttachedFile | null;
}

export interface CertificationEntry {
  expiryDate: string | null; // ISO date string, null = N/A
  notApplicable: boolean;
  attachedFile?: AttachedFile | null;
}

export interface TermsAndConditions {
  url?: string | null;
  attachedFile?: AttachedFile | null;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  riskCategory: 1 | 2 | 3;
  active: boolean;
  createdAt: string;
  termsAndConditions?: TermsAndConditions;

  insurances: {
    employersLiability: InsuranceEntry;
    publicLiability: InsuranceEntry;
    productLiability: InsuranceEntry;
    professionalIndemnity: InsuranceEntry;
  };

  certifications: {
    iso9001: CertificationEntry;
    iso14001: CertificationEntry;
    iso45001: CertificationEntry;
    iso27001: CertificationEntry;
    atex: CertificationEntry;
    achillesUVDB: CertificationEntry;
    achillesFPAL: CertificationEntry;
  };
}

export interface NonConformity {
  id: string;
  supplierId: string;
  purchaseOrderNumber: string;
  projectNumber: string;
  valueOfGoodsAffected: number;
  result: string;
  description: string;
  createdAt: string;
}

export type ExpiryStatus = 'valid' | 'expiring' | 'expired' | 'na';

export const INSURANCE_LABELS: Record<keyof Supplier['insurances'], string> = {
  employersLiability: "Employers' Liability",
  publicLiability: 'Public Liability',
  productLiability: 'Product Liability',
  professionalIndemnity: 'Professional Indemnity',
};

export const CERTIFICATION_LABELS: Record<keyof Supplier['certifications'], string> = {
  iso9001: 'ISO 9001',
  iso14001: 'ISO 14001',
  iso45001: 'ISO 45001',
  iso27001: 'ISO 27001',
  atex: 'ATEX',
  achillesUVDB: 'Achilles UVDB',
  achillesFPAL: 'Achilles FPAL',
};
