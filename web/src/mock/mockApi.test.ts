import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_ACCOUNTS, mockApi, resetMock, setMockAccount } from './mockApi';

const H = ('0x' + '11'.repeat(32)) as `0x${string}`;

describe('mock contract keeps the same rules as CredChain.sol', () => {
  beforeEach(() => { resetMock(); setMockAccount(MOCK_ACCOUNTS.admin); });

  it('seed covers all 4 verifier states', async () => {
    expect((await mockApi.verify(1n)).status).toBe('Valid');
    expect((await mockApi.verify(2n)).status).toBe('Revoked');
    expect((await mockApi.verify(3n)).status).toBe('Expired');
    expect((await mockApi.verify(999n)).status).toBe('NotFound');
    expect((await mockApi.verify(4n)).issuerStillApproved).toBe(false);
  });

  it('non-issuer cannot issue; issuer can; holder lists it', async () => {
    await expect(mockApi.issue({ to: MOCK_ACCOUNTS.student, uri: 'x', docHash: H, expiresAt: 0n })).rejects.toThrow(/AccessControl/);
    setMockAccount(MOCK_ACCOUNTS.issuer);
    const r = await mockApi.issue({ to: MOCK_ACCOUNTS.student, uri: 'x', docHash: H, expiresAt: 0n });
    expect(r.tokenIds).toEqual([5n]);
    expect(await mockApi.tokensOf(MOCK_ACCOUNTS.student)).toContain(5n);
  });

  it('revoke: only issuer/admin, no double revoke, Revoked wins over Valid', async () => {
    setMockAccount(MOCK_ACCOUNTS.student);
    await expect(mockApi.revoke(1n, 'x')).rejects.toThrow(/NotAllowedToRevoke/);
    setMockAccount(MOCK_ACCOUNTS.issuer);
    await mockApi.revoke(1n, 'wrong grade');
    const v = await mockApi.verify(1n);
    expect(v.status).toBe('Revoked');
    expect(v.revokeReason).toBe('wrong grade');
    await expect(mockApi.revoke(1n, 'again')).rejects.toThrow(/AlreadyRevoked/);
  });

  it('batch is all-or-nothing and capped at 50', async () => {
    setMockAccount(MOCK_ACCOUNTS.issuer);
    const zero = '0x0000000000000000000000000000000000000000';
    await expect(mockApi.batchIssue([MOCK_ACCOUNTS.student, zero], ['a', 'b'], [H, H], 0n)).rejects.toThrow(/ZeroAddress/);
    expect(await mockApi.tokensOf(MOCK_ACCOUNTS.student)).toHaveLength(4); // nothing minted
    const big = Array(51).fill(MOCK_ACCOUNTS.student);
    await expect(mockApi.batchIssue(big, big.map(() => 'u'), big.map(() => H), 0n)).rejects.toThrow(/BatchTooLarge/);
    const ok = await mockApi.batchIssue([MOCK_ACCOUNTS.student, MOCK_ACCOUNTS.issuer2], ['a', 'b'], [H, H], 0n);
    expect(ok.tokenIds).toEqual([5n, 6n]);
  });

  it('transfer always reverts Soulbound; removed issuer keeps old credentials', async () => {
    await expect(mockApi.tryTransfer(MOCK_ACCOUNTS.student, MOCK_ACCOUNTS.admin, 1n)).rejects.toThrow(/Soulbound/);
    await mockApi.removeIssuer(MOCK_ACCOUNTS.issuer);
    const v = await mockApi.verify(1n);
    expect(v.status).toBe('Valid');
    expect(v.issuerStillApproved).toBe(false);
  });
});
