// In-browser fake of CredChain.sol with the SAME rules (roles, soulbound, expiry, revoke).
// Lets Dev B build and demo every page before Sepolia + /api/pin are live.
import { getAddress, type Address, type Hex } from 'viem';
import type { CredChainApi, IssueInput, IssuerInfo, TxResult } from '../lib/api';
import type { VerifyResult } from '../lib/types';

export const MOCK_ACCOUNTS = {
  admin: getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
  issuer: getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'),
  issuer2: getAddress('0x90F79bf6EB2c4f870365E785982E1f101E93b906'),
  student: getAddress('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'),
} as const;

interface Cred {
  issuer: Address;
  holder: Address;
  issuedAt: number;
  expiresAt: number;
  docHash: Hex;
  uri: string;
  revoked: boolean;
  revokeReason: string;
}

interface State {
  nextId: number;
  admin: Address;
  issuers: Record<string, { name: string; active: boolean }>;
  creds: Record<string, Cred>;
  held: Record<string, number[]>;
}

const KEY = 'credchain-mock-v1';
const now = () => Math.floor(Date.now() / 1000);
const fakeHash = (): Hex => ('0x' + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')) as Hex;

function seed(): State {
  const t = now();
  const s: State = {
    nextId: 1,
    admin: MOCK_ACCOUNTS.admin,
    issuers: {
      [MOCK_ACCOUNTS.issuer]: { name: 'Example Institute', active: true },
      [MOCK_ACCOUNTS.issuer2]: { name: 'Old Training Co', active: false },
    },
    creds: {},
    held: {},
  };
  const add = (c: Omit<Cred, 'holder'>, holder: Address) => {
    const id = s.nextId++;
    s.creds[id] = { ...c, holder };
    (s.held[holder] ??= []).push(id);
  };
  const h = '0x' + 'ab'.repeat(32);
  add({ issuer: MOCK_ACCOUNTS.issuer, issuedAt: t - 86400 * 30, expiresAt: 0, docHash: h as Hex, uri: 'mock://seed-1', revoked: false, revokeReason: '' }, MOCK_ACCOUNTS.student);
  add({ issuer: MOCK_ACCOUNTS.issuer, issuedAt: t - 86400 * 20, expiresAt: 0, docHash: fakeHash(), uri: 'mock://seed-2', revoked: true, revokeReason: 'Issued with the wrong grade' }, MOCK_ACCOUNTS.student);
  add({ issuer: MOCK_ACCOUNTS.issuer, issuedAt: t - 86400 * 400, expiresAt: t - 86400, docHash: fakeHash(), uri: 'mock://seed-3', revoked: false, revokeReason: '' }, MOCK_ACCOUNTS.student);
  add({ issuer: MOCK_ACCOUNTS.issuer2, issuedAt: t - 86400 * 90, expiresAt: 0, docHash: fakeHash(), uri: 'mock://seed-4', revoked: false, revokeReason: '' }, MOCK_ACCOUNTS.student);
  return s;
}

let mem: State | null = null;
function load(): State {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (mem = JSON.parse(raw) as State);
  } catch {
    /* storage blocked → in-memory only */
  }
  return (mem = seed());
}
function save(s: State) {
  mem = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export function resetMock() {
  mem = seed();
  save(mem);
}

// The mock "wallet": which account is connected.
let current: Address = MOCK_ACCOUNTS.admin;
export const setMockAccount = (a: Address) => (current = a);
export const getMockAccount = () => current;

const delay = () => new Promise((r) => setTimeout(r, 250));
const tx = (tokenIds: bigint[] = []): TxResult => ({ hash: fakeHash(), tokenIds });
const revert = (name: string) => {
  throw new Error(`Contract reverted: ${name}`);
};
const isIssuer = (s: State, a: Address) => !!s.issuers[a]?.active;
const ZERO = '0x0000000000000000000000000000000000000000';

function mintOne(s: State, i: IssueInput): bigint {
  if (i.to.toLowerCase() === ZERO) revert('ZeroAddress');
  if (i.expiresAt !== 0n && Number(i.expiresAt) <= now()) revert('InvalidExpiry');
  const id = s.nextId++;
  const holder = getAddress(i.to);
  s.creds[id] = { issuer: current, holder, issuedAt: now(), expiresAt: Number(i.expiresAt), docHash: i.docHash, uri: i.uri, revoked: false, revokeReason: '' };
  (s.held[holder] ??= []).push(id);
  return BigInt(id);
}

export const mockApi: CredChainApi = {
  async verify(tokenId) {
    await delay();
    const s = load();
    const c = s.creds[tokenId.toString()];
    const empty: VerifyResult = { tokenId, status: 'NotFound', issuer: ZERO, issuerName: '', holder: ZERO, docHash: ('0x' + '00'.repeat(32)) as Hex, uri: '', issuedAt: 0n, expiresAt: 0n, issuerStillApproved: false, revokeReason: '' };
    if (!c) return empty;
    const status = c.revoked ? 'Revoked' : c.expiresAt !== 0 && c.expiresAt <= now() ? 'Expired' : 'Valid';
    return { tokenId, status, issuer: c.issuer, issuerName: s.issuers[c.issuer]?.name ?? '', holder: c.holder, docHash: c.docHash, uri: c.uri, issuedAt: BigInt(c.issuedAt), expiresAt: BigInt(c.expiresAt), issuerStillApproved: isIssuer(s, c.issuer), revokeReason: c.revokeReason };
  },
  async tokensOf(holder) {
    await delay();
    return (load().held[getAddress(holder)] ?? []).map(BigInt);
  },
  async isAdmin(a) {
    return load().admin === getAddress(a);
  },
  async isIssuer(a) {
    return isIssuer(load(), getAddress(a));
  },
  async issuerName(a) {
    return load().issuers[getAddress(a)]?.name ?? '';
  },
  async listIssuers() {
    await delay();
    return Object.entries(load().issuers).map(([account, v]): IssuerInfo => ({ account: account as Address, name: v.name, active: v.active }));
  },
  async issuedBy(issuer) {
    await delay();
    const s = load();
    return Object.entries(s.creds)
      .filter(([, c]) => c.issuer === getAddress(issuer))
      .map(([id, c]) => ({ tokenId: BigInt(id), to: c.holder, docHash: c.docHash }));
  },
  async addIssuer(account, name) {
    await delay();
    const s = load();
    if (s.admin !== current) revert('AccessControlUnauthorizedAccount');
    if (!name.trim()) revert('EmptyName');
    if (account.toLowerCase() === ZERO) revert('ZeroAddress');
    s.issuers[getAddress(account)] = { name, active: true };
    save(s);
    return tx();
  },
  async removeIssuer(account) {
    await delay();
    const s = load();
    if (s.admin !== current) revert('AccessControlUnauthorizedAccount');
    const i = s.issuers[getAddress(account)];
    if (i) i.active = false;
    save(s);
    return tx();
  },
  async issue(i) {
    await delay();
    const s = load();
    if (!isIssuer(s, current)) revert('AccessControlUnauthorizedAccount');
    const id = mintOne(s, i);
    save(s);
    return tx([id]);
  },
  async batchIssue(to, uri, docHash, expiresAt) {
    await delay();
    const s = load();
    if (!isIssuer(s, current)) revert('AccessControlUnauthorizedAccount');
    if (to.length !== uri.length || to.length !== docHash.length) revert('LengthMismatch');
    if (to.length === 0) revert('EmptyBatch');
    if (to.length > 50) revert('BatchTooLarge');
    const copy: State = JSON.parse(JSON.stringify(s)); // all-or-nothing like a real tx
    const ids = to.map((t, k) => mintOne(copy, { to: t, uri: uri[k], docHash: docHash[k], expiresAt }));
    save(copy);
    return tx(ids);
  },
  async revoke(tokenId, reason) {
    await delay();
    const s = load();
    const c = s.creds[tokenId.toString()];
    if (!c) revert('TokenNotFound');
    if (!reason.trim()) revert('ReasonRequired');
    if (c.revoked) revert('AlreadyRevoked');
    if (c.issuer !== current && s.admin !== current) revert('NotAllowedToRevoke');
    c.revoked = true;
    c.revokeReason = reason;
    save(s);
    return tx();
  },
  async tryTransfer() {
    await delay();
    return revert('Soulbound');
  },
};
