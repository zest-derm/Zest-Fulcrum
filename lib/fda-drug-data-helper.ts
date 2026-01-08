/**
 * FDA Drug Data Helper
 *
 * Provides easy access to FDA drug label data fetched via openFDA API
 * Data is updated quarterly using scripts/update-fda-data.ts
 */

import fdaDataJson from './fda-drug-data.json';

export interface FDADrugData {
  brand: string;
  generic: string;
  fdaIndications?: string[];
  contraindications?: string[];
  blackBoxWarnings?: string[];
  warnings?: string[];
  adverseReactions?: string[];
  dosageInfo?: string[];
  lastUpdated: string;
  fdaSource: 'openfda' | 'manual';
}

// Cache the parsed FDA data
const fdaDataMap = new Map<string, FDADrugData>();

// Initialize the map (brand name → data)
(fdaDataJson as FDADrugData[]).forEach(drug => {
  fdaDataMap.set(drug.brand.toLowerCase(), drug);
  fdaDataMap.set(drug.generic.toLowerCase(), drug);
});

/**
 * Get FDA data for a drug by brand or generic name
 */
export function getFDAData(drugName: string): FDADrugData | null {
  return fdaDataMap.get(drugName.toLowerCase()) || null;
}

/**
 * Get FDA-approved indications for a drug
 */
export function getFDAIndications(drugName: string): string[] {
  const data = getFDAData(drugName);
  return data?.fdaIndications || [];
}

/**
 * Get contraindications for a drug
 */
export function getContraindications(drugName: string): string[] {
  const data = getFDAData(drugName);
  return data?.contraindications || [];
}

/**
 * Get black box warnings for a drug
 */
export function getBlackBoxWarnings(drugName: string): string[] {
  const data = getFDAData(drugName);
  return data?.blackBoxWarnings || [];
}

/**
 * Check if drug has a specific black box warning (case-insensitive search)
 */
export function hasBlackBoxWarning(drugName: string, searchTerm: string): boolean {
  const warnings = getBlackBoxWarnings(drugName);
  const searchLower = searchTerm.toLowerCase();
  return warnings.some(warning => warning.toLowerCase().includes(searchLower));
}

/**
 * Check if drug is FDA-approved for a specific indication
 */
export function isApprovedForIndication(drugName: string, indication: string): boolean {
  const indications = getFDAIndications(drugName);
  const indicationLower = indication.toLowerCase();
  return indications.some(ind => ind.toLowerCase().includes(indicationLower));
}

/**
 * Get all drugs with FDA data
 */
export function getAllFDADrugs(): FDADrugData[] {
  return Array.from(fdaDataMap.values());
}

/**
 * Get data freshness (days since last update)
 */
export function getDataAge(drugName: string): number | null {
  const data = getFDAData(drugName);
  if (!data) return null;

  const lastUpdated = new Date(data.lastUpdated);
  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if data needs refresh (older than 90 days)
 */
export function needsRefresh(): boolean {
  const drugs = getAllFDADrugs();
  if (drugs.length === 0) return true;

  const oldestDataAge = Math.max(...drugs.map(d => {
    const lastUpdated = new Date(d.lastUpdated);
    const now = new Date();
    return now.getTime() - lastUpdated.getTime();
  }));

  const daysOld = oldestDataAge / (1000 * 60 * 60 * 24);
  return daysOld > 90;
}
