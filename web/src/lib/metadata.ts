// The UI works with the flat CredentialMetadata type. What goes to IPFS (and through Dev A's /api/pin
// validator) is Dev A's nested schema from credchain/lib/metadata.ts:
//   { name, description, image?, credential: { recipientName, credentialTitle, issuerName,
//     issueDate, expiryDate?, grade?, documentUri, documentHash } }
// toWire / fromWire convert between the two.
import type { CredentialMetadata } from './types';
type Hex = `0x${string}`;

export interface WireMetadata {
  name: string;
  description: string;
  image?: string;
  credential: {
    recipientName: string;
    credentialTitle: string;
    issuerName: string;
    issueDate: string;
    expiryDate?: string;
    grade?: string;
    documentUri: string;
    documentHash: string;
  };
}

const s = (v: unknown) => (v ?? '').toString().trim();

/** Trim every field; fill a default description (Dev A's API requires one). */
export function buildMetadata(m: CredentialMetadata): CredentialMetadata {
  const out: CredentialMetadata = {
    name: s(m.name),
    description: s(m.description) || `Credential issued by ${s(m.issuerName)} on CredChain.`,
    recipientName: s(m.recipientName),
    course: s(m.course),
    grade: s(m.grade),
    issuerName: s(m.issuerName),
    issuedDate: s(m.issuedDate),
    documentUri: s(m.documentUri),
    documentSha256: s(m.documentSha256).toLowerCase() as Hex,
  };
  if (s(m.expiryDate)) out.expiryDate = s(m.expiryDate);
  return out;
}

/** Flat UI type → Dev A's nested schema. Fixed key order → same bytes every time → stable SHA-256. */
export function toWire(flat: CredentialMetadata): WireMetadata {
  const m = buildMetadata(flat);
  const credential: WireMetadata['credential'] = {
    recipientName: m.recipientName,
    credentialTitle: m.course,
    issuerName: m.issuerName,
    issueDate: m.issuedDate,
    documentUri: m.documentUri,
    documentHash: m.documentSha256,
  };
  if (m.expiryDate) credential.expiryDate = m.expiryDate;
  if (m.grade) credential.grade = m.grade;
  return { name: m.name, description: m.description, credential };
}

/** Accepts Dev A's nested schema (and the old flat one); returns null if it is neither. */
export function fromWire(x: unknown): CredentialMetadata | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const c = o.credential as Record<string, unknown> | undefined;
  const flat: CredentialMetadata =
    c && typeof c === 'object'
      ? {
          name: s(o.name),
          description: s(o.description),
          recipientName: s(c.recipientName),
          course: s(c.credentialTitle),
          grade: s(c.grade),
          issuerName: s(c.issuerName),
          issuedDate: s(c.issueDate),
          expiryDate: s(c.expiryDate) || undefined,
          documentUri: s(c.documentUri),
          documentSha256: s(c.documentHash) as Hex,
        }
      : (o as unknown as CredentialMetadata);
  return validateMetadata(flat).length === 0 ? flat : null;
}

export function serializeMetadata(m: CredentialMetadata): string {
  return JSON.stringify(toWire(m));
}

export function validateMetadata(m: Partial<CredentialMetadata>): string[] {
  const errs: string[] = [];
  for (const k of ['name', 'recipientName', 'course', 'issuerName', 'issuedDate'] as const)
    if (!m[k] || !String(m[k]).trim()) errs.push(`${k} is required`);
  if (m.issuedDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.issuedDate)) errs.push('issuedDate must be YYYY-MM-DD');
  if (m.expiryDate && m.issuedDate && m.expiryDate <= m.issuedDate) errs.push('expiryDate must be after issuedDate');
  if (m.documentSha256 && !/^0x[0-9a-fA-F]{64}$/.test(m.documentSha256)) errs.push('documentSha256 must be 0x + 64 hex');
  return errs;
}

export function isMetadata(x: unknown): x is CredentialMetadata {
  return fromWire(x) !== null;
}
