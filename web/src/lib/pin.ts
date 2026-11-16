import { MAX_PDF_BYTES, mockPin, pinUrl } from './config';
import { sha256Hex } from './hash';

/** Matches the frozen /api/pin contract: POST multipart PDF or JSON body → { cid }. 400 for anything else. */
async function readCid(r: Response): Promise<string> {
  let body: { cid?: string; error?: string } = {};
  try {
    body = await r.json();
  } catch {
    /* non-JSON error page */
  }
  if (!r.ok) throw new Error(`Pinning failed (${r.status}): ${body.error ?? r.statusText}`);
  if (!body.cid) throw new Error('Pinning failed: no cid in response');
  return body.cid;
}

export function checkPdf(file: File): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files are allowed';
  if (file.size > MAX_PDF_BYTES) return `PDF is ${(file.size / 1048576).toFixed(1)} MB; the limit is 5 MB`;
  return null;
}

/** Fake CID derived from content, so the same file → same fake CID (good for demos). */
async function mockCid(bytes: Uint8Array): Promise<string> {
  await new Promise((r) => setTimeout(r, 300));
  return 'bafkmock' + (await sha256Hex(bytes)).slice(2, 46);
}

export const mockFiles = new Map<string, Blob>(); // cid → content, so mock verify can "download" it (this tab only)
const MOCK_JSON_KEY = 'credchain-mock-json';
function rememberJson(cid: string, json: string) {
  try {
    const m = JSON.parse(localStorage.getItem(MOCK_JSON_KEY) || '{}');
    m[cid] = json;
    localStorage.setItem(MOCK_JSON_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
export function mockJson(cid: string): string | null {
  try {
    return JSON.parse(localStorage.getItem(MOCK_JSON_KEY) || '{}')[cid] ?? null;
  } catch {
    return null;
  }
}

export async function pinPdf(file: File): Promise<string> {
  const err = checkPdf(file);
  if (err) throw new Error(err);
  if (mockPin) {
    const cid = await mockCid(new Uint8Array(await file.arrayBuffer()));
    mockFiles.set(cid, file);
    return cid;
  }
  const fd = new FormData();
  fd.append('file', file, file.name);
  return readCid(await fetch(pinUrl, { method: 'POST', body: fd }));
}

export async function pinJson(json: string): Promise<string> {
  if (mockPin) {
    const cid = await mockCid(new TextEncoder().encode(json));
    mockFiles.set(cid, new Blob([json], { type: 'application/json' }));
    rememberJson(cid, json);
    return cid;
  }
  return readCid(await fetch(pinUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json }));
}
