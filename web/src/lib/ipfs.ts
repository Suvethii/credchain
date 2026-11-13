export const GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

/** ipfs://<cid>/path → <cid>/path. Accepts bare CIDs and full gateway URLs too. */
export function ipfsPath(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) return uri.slice(7).replace(/^ipfs\//, '');
  const m = uri.match(/\/ipfs\/(.+)$/);
  if (m) return m[1];
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})/.test(uri)) return uri;
  return null;
}

export function gatewayUrl(uri: string, i = 0): string {
  const p = ipfsPath(uri);
  if (p === null) return uri; // already http(s)
  return GATEWAYS[Math.min(i, GATEWAYS.length - 1)] + p;
}

/** Try each gateway in order, with a per-gateway timeout. */
export async function fetchIpfs(uri: string, timeoutMs = 8000): Promise<Response> {
  if (uri.startsWith('mock://')) throw new Error('mock uri'); // handled by mock layer
  const p = ipfsPath(uri);
  const urls = p === null ? [uri] : GATEWAYS.map((g) => g + p);
  let lastErr: unknown;
  for (const url of urls) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (r.ok) return r;
      lastErr = new Error(`${url} → HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('all IPFS gateways failed');
}
