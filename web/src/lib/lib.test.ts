import { describe, expect, it } from 'vitest';
import { parseRecipientsCsv } from './csv';
import { friendlyError } from './errors';
import { sameHash, sha256Hex } from './hash';
import { gatewayUrl, ipfsPath } from './ipfs';
import { serializeMetadata, validateMetadata } from './metadata';
import { dateToExpiry, expiryError } from './time';

describe('sha256', () => {
  it('matches the known SHA-256 of "abc" (FIPS 180-2 test vector)', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('empty input', async () => {
    expect(await sha256Hex(new Uint8Array())).toBe('0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('one changed byte → different hash (tamper detection)', async () => {
    const a = await sha256Hex(new TextEncoder().encode('certificate v1'));
    const b = await sha256Hex(new TextEncoder().encode('certificate v2'));
    expect(sameHash(a, b)).toBe(false);
    expect(sameHash(a, a.toUpperCase().replace('0X', '0x'))).toBe(true);
  });
});

describe('metadata', () => {
  const m = { name: 'C', description: 'd', recipientName: 'A', course: 'X', grade: '', issuerName: 'I', issuedDate: '2026-11-20', documentUri: '', documentSha256: ('0x' + 'a'.repeat(64)) as `0x${string}` };
  it('serialises with fixed key order regardless of input order', () => {
    const shuffled = Object.fromEntries(Object.entries(m).reverse()) as typeof m;
    expect(serializeMetadata(shuffled)).toBe(serializeMetadata(m));
    expect(Object.keys(JSON.parse(serializeMetadata(m)))[0]).toBe('name');
  });
  it('rejects missing fields', () => {
    expect(validateMetadata({ ...m, recipientName: '' })).toContain('recipientName is required');
    expect(validateMetadata({ ...m, issuedDate: '20/11/2026' })).toContain('issuedDate must be YYYY-MM-DD');
    expect(validateMetadata(m)).toEqual([]);
  });
});

describe('csv', () => {
  it('parses valid rows and flags bad ones', () => {
    const r = parseRecipientsCsv(
      'Address,RecipientName,grade\n' +
        '0x70997970c51812dc3a010c7d01b50e0d17dc79c8,A. Perera,A\n' +
        'not-an-address,B,\n' +
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8,Dup,\n' +
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,,\n',
    );
    expect(r.fileErrors).toEqual([]);
    expect(r.rows).toHaveLength(4);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].address).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'); // checksummed
    expect(r.rows[1].errors[0]).toMatch(/not a valid address/);
    expect(r.rows[2].errors).toContain('duplicate address in this file');
    expect(r.rows[3].errors).toContain('recipientName is empty');
  });
  it('rejects more than 50 rows and missing columns', () => {
    const many = 'address,recipientName\n' + Array.from({ length: 51 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')},N${i}`).join('\n');
    expect(parseRecipientsCsv(many).fileErrors.join()).toMatch(/limit is 50/);
    expect(parseRecipientsCsv('wallet,name\n0x1,a').fileErrors).toContain('Missing "address" column');
  });
});

describe('time', () => {
  it('empty date = never expires', () => {
    expect(dateToExpiry('')).toBe(0n);
    expect(expiryError(0n)).toBeNull();
  });
  it('past expiry is rejected, future accepted', () => {
    expect(expiryError(dateToExpiry('2020-01-01'))).not.toBeNull();
    expect(expiryError(dateToExpiry('2099-01-01'))).toBeNull();
  });
});

describe('ipfs', () => {
  it('handles ipfs://, gateway URLs and bare CIDs', () => {
    expect(ipfsPath('ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
    expect(ipfsPath('https://ipfs.io/ipfs/Qm123/x.json')).toBe('Qm123/x.json');
    expect(gatewayUrl('ipfs://abc', 1)).toBe('https://ipfs.io/ipfs/abc');
    expect(gatewayUrl('https://example.com/a.json')).toBe('https://example.com/a.json');
  });
});

describe('errors', () => {
  it('maps contract error names to friendly text', () => {
    expect(friendlyError(new Error('Contract reverted: Soulbound'))).toMatch(/soulbound/i);
    expect(friendlyError(new Error('Contract reverted: AlreadyRevoked'))).toMatch(/already revoked/);
  });
});
