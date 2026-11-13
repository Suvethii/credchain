// metadata.ts: builds, checks and fingerprints CredChain certificate details.
// Works in the browser and in Node 18+ (uses the built-in Web Crypto API).
//
// DRAFT schema based on the CredChain plan. Adjust to METADATA_SCHEMA.md when the team agrees it.
// Privacy: everything here is uploaded to IPFS, which is PUBLIC and PERMANENT.
// Keep personal data to a minimum and use only test data during development.

export type Hex32 = `0x${string}`;

// The certificate details (follows the common NFT metadata format, plus a "credential" section)
export interface CredentialMetadata {
  name: string;                 // e.g. "Certificate of Completion: Web Basics"
  description: string;
  image?: string;               // optional picture of the certificate (ipfs://...)
  credential: {
    recipientName: string;      // e.g. "Test Student"
    credentialTitle: string;    // e.g. "Web Basics"
    issuerName: string;         // e.g. "Raxwo Practice Institute"
    issueDate: string;          // "YYYY-MM-DD"
    expiryDate?: string;        // "YYYY-MM-DD", optional
    grade?: string;             // optional
    documentUri: string;        // ipfs://<cid of the PDF>
    documentHash: Hex32;        // SHA-256 of the PDF, 0x + 64 hex characters
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const HASH_RE = /^0x[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Fingerprint ----------

/** SHA-256 of a file's bytes, as 0x + 64 lowercase hex characters (the format the contract stores). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<Hex32> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

/** True if this file is exactly the one that was issued (its fingerprint matches the one on-chain). */
export async function pdfMatchesHash(pdf: ArrayBuffer | Uint8Array, onChainHash: string): Promise<boolean> {
  return (await sha256Hex(pdf)) === onChainHash.toLowerCase();
}

// ---------- Build ----------

export interface BuildInput {
  recipientName: string;
  credentialTitle: string;
  issuerName: string;
  issueDate: string;
  expiryDate?: string;
  grade?: string;
  documentUri: string;
  documentHash: Hex32;
  image?: string;
}

/** Turns the issuer's form fields into the metadata JSON that gets uploaded to IPFS. */
export function buildMetadata(input: BuildInput): CredentialMetadata {
  const trim = (s?: string) => (s === undefined ? undefined : s.trim());
  const meta: CredentialMetadata = {
    name: `${input.credentialTitle.trim()}: ${input.recipientName.trim()}`,
    description: `Credential issued by ${input.issuerName.trim()} on CredChain.`,
    credential: {
      recipientName: input.recipientName.trim(),
      credentialTitle: input.credentialTitle.trim(),
      issuerName: input.issuerName.trim(),
      issueDate: input.issueDate.trim(),
      documentUri: input.documentUri.trim(),
      documentHash: input.documentHash.toLowerCase() as Hex32,
    },
  };
  if (input.image) meta.image = input.image.trim();
  if (input.expiryDate) meta.credential.expiryDate = trim(input.expiryDate);
  if (input.grade) meta.credential.grade = trim(input.grade);
  return meta;
}

// ---------- Validate ----------

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Checks the metadata before upload. Returns every problem found, in plain words. */
export function validateMetadata(meta: unknown): ValidationResult {
  const errors: string[] = [];
  const m = meta as Partial<CredentialMetadata> | null;

  if (!m || typeof m !== "object") return { ok: false, errors: ["Metadata must be an object"] };
  if (!m.name || typeof m.name !== "string") errors.push("name is required");
  if (!m.description || typeof m.description !== "string") errors.push("description is required");

  const c = m.credential;
  if (!c || typeof c !== "object") {
    errors.push("credential section is required");
    return { ok: false, errors };
  }

  for (const field of ["recipientName", "credentialTitle", "issuerName"] as const) {
    const v = c[field];
    if (typeof v !== "string" || v.trim() === "") errors.push(`credential.${field} is required`);
    else if (v.length > 120) errors.push(`credential.${field} is too long (max 120 characters)`);
  }

  if (typeof c.issueDate !== "string" || !isRealDate(c.issueDate)) {
    errors.push("credential.issueDate must be a real date in YYYY-MM-DD format");
  }
  if (c.expiryDate !== undefined) {
    if (typeof c.expiryDate !== "string" || !isRealDate(c.expiryDate)) {
      errors.push("credential.expiryDate must be a real date in YYYY-MM-DD format");
    } else if (typeof c.issueDate === "string" && isRealDate(c.issueDate) && c.expiryDate <= c.issueDate) {
      errors.push("credential.expiryDate must be after issueDate");
    }
  }

  if (typeof c.documentUri !== "string" || !c.documentUri.startsWith("ipfs://") || c.documentUri.length <= 7) {
    errors.push("credential.documentUri must start with ipfs://");
  }
  if (typeof c.documentHash !== "string" || !HASH_RE.test(c.documentHash)) {
    errors.push("credential.documentHash must be 0x followed by 64 lowercase hex characters (SHA-256)");
  }
  if (m.image !== undefined && (typeof m.image !== "string" || !m.image.startsWith("ipfs://"))) {
    errors.push("image must start with ipfs://");
  }

  return { ok: errors.length === 0, errors };
}

/** Converts a YYYY-MM-DD expiry date into the contract's expiresAt (seconds, end of that day UTC). 0 = never. */
export function expiryToTimestamp(expiryDate?: string): bigint {
  if (!expiryDate) return 0n;
  if (!isRealDate(expiryDate)) throw new Error("expiryDate must be YYYY-MM-DD");
  return BigInt(Math.floor(new Date(`${expiryDate}T23:59:59Z`).getTime() / 1000));
}

// ---------- IPFS gateway fallback (Day 3) ----------

/** Public IPFS gateways, tried in this order. If one is slow or down, the next is used. */
export const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

/** Turns ipfs://<cid>/path into one https link per gateway. */
export function gatewayUrls(uri: string, gateways: string[] = IPFS_GATEWAYS): string[] {
  if (!uri.startsWith("ipfs://") || uri.length <= 7) throw new Error("Not an ipfs:// link");
  const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
  return gateways.map((g) => g + path);
}

/**
 * Downloads an ipfs:// file, trying each gateway in turn (each with a time limit).
 * Returns the first successful response, or throws if every gateway fails.
 */
export async function fetchFromIpfs(
  uri: string,
  opts: { gateways?: string[]; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const doFetch = opts.fetchImpl ?? fetch;
  const errors: string[] = [];
  for (const url of gatewayUrls(uri, opts.gateways)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    try {
      const res = await doFetch(url, { signal: ctrl.signal });
      if (res.ok) return res;
      errors.push(`${url}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${url}: ${(e as Error).name === "AbortError" ? "timed out" : "failed"}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("All IPFS gateways failed: " + errors.join("; "));
}
