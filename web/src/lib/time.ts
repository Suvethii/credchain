/** <input type="date"> value (YYYY-MM-DD) → unix seconds at 23:59:59 local time. '' → 0n (never expires). */
export function dateToExpiry(date: string): bigint {
  if (!date) return 0n;
  const [y, m, d] = date.split('-').map(Number);
  const ms = new Date(y, m - 1, d, 23, 59, 59).getTime();
  if (Number.isNaN(ms)) throw new Error('bad date');
  return BigInt(Math.floor(ms / 1000));
}

export function expiryError(expiresAt: bigint, nowSec = BigInt(Math.floor(Date.now() / 1000))): string | null {
  if (expiresAt === 0n) return null;
  return expiresAt > nowSec ? null : 'Expiry must be in the future (or empty = never)';
}

export function fmtTime(sec: bigint): string {
  if (sec === 0n) return 'Never';
  return new Date(Number(sec) * 1000).toLocaleString();
}

export function fmtDate(sec: bigint): string {
  if (sec === 0n) return 'Never';
  return new Date(Number(sec) * 1000).toLocaleDateString();
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
