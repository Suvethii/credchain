import type { Hex } from 'viem';

/** SHA-256 of bytes → 0x-prefixed 64 hex chars (fits bytes32). Uses Web Crypto, no backend. */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<Hex> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return ('0x' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')) as Hex;
}

export async function sha256File(file: Blob): Promise<Hex> {
  return sha256Hex(await file.arrayBuffer());
}

export const sameHash = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
