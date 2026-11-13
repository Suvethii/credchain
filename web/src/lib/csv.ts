import Papa from 'papaparse';
import { getAddress, isAddress, type Address } from 'viem';
import { MAX_BATCH } from './config';

export interface CsvRow {
  line: number; // 1-based line in the file (header = 1)
  address: Address | null;
  recipientName: string;
  grade: string;
  errors: string[];
}

export interface CsvResult {
  rows: CsvRow[];
  fileErrors: string[];
  valid: CsvRow[];
}

/**
 * CSV columns (header row required, case-insensitive): address, recipientName, grade (optional).
 * Everything else (course, issuer, dates) comes from the shared template in the form.
 */
export function parseRecipientsCsv(text: string): CsvResult {
  const fileErrors: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const fields = parsed.meta.fields ?? [];
  if (!fields.includes('address')) fileErrors.push('Missing "address" column');
  if (!fields.includes('recipientname')) fileErrors.push('Missing "recipientName" column');
  for (const err of parsed.errors) fileErrors.push(`Line ${(err.row ?? 0) + 2}: ${err.message}`);

  const seen = new Set<string>();
  const rows: CsvRow[] = parsed.data.map((r, i) => {
    const errors: string[] = [];
    const raw = (r.address ?? '').trim();
    let address: Address | null = null;
    if (!raw) errors.push('address is empty');
    else if (!isAddress(raw, { strict: false })) errors.push(`"${raw}" is not a valid address`);
    else {
      address = getAddress(raw);
      if (address === '0x0000000000000000000000000000000000000000') errors.push('zero address');
      if (seen.has(address)) errors.push('duplicate address in this file');
      seen.add(address);
    }
    const recipientName = (r.recipientname ?? '').trim();
    if (!recipientName) errors.push('recipientName is empty');
    return { line: i + 2, address, recipientName, grade: (r.grade ?? '').trim(), errors };
  });

  if (rows.length === 0 && fileErrors.length === 0) fileErrors.push('No data rows');
  if (rows.length > MAX_BATCH) fileErrors.push(`${rows.length} rows: the limit is ${MAX_BATCH} per batch`);
  return { rows, fileErrors, valid: rows.filter((r) => r.errors.length === 0) };
}

export const CSV_TEMPLATE = 'address,recipientName,grade\n0x70997970C51812dc3A010C7d01b50e0d17dc79C8,A. Perera,Distinction\n';
