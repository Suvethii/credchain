import { readFileSync } from 'node:fs';
import { decodeErrorResult, decodeFunctionResult, encodeErrorResult, encodeFunctionResult, keccak256, toBytes, type Abi } from 'viem';
import { describe, expect, it } from 'vitest';
import dep from '../abi/CredChain.json';

const abi = dep.abi as Abi;
const fns = new Set((abi as unknown as { type: string; name?: string }[]).filter((x) => x.type === 'function').map((x) => x.name));
const events = new Set((abi as unknown as { type: string; name?: string }[]).filter((x) => x.type === 'event').map((x) => x.name));

describe('real MiniCredChain ABI vs frontend', () => {
  it('has every function / event realApi uses', () => {
    const src = readFileSync('src/lib/realApi.ts', 'utf8');
    const used = [...src.matchAll(/(?:read|write)(?:<[^>]*>)?\('(\w+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(8);
    for (const f of used) expect(fns, `function ${f}`).toContain(f);
    for (const e of ['IssuerAdded', 'IssuerRemoved', 'CredentialIssued', 'CredentialRevoked']) expect(events).toContain(e);
  });

  it('verify() decodes to a named struct with revokeReason (what realApi reads)', () => {
    const value = {
      status: 2, issuer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', issuerName: 'Example Institute',
      holder: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', docHash: ('0x' + 'ab'.repeat(32)) as `0x${string}`, uri: 'ipfs://x',
      issuedAt: 1700000000n, expiresAt: 0n, issuerStillApproved: true, revokeReason: 'wrong grade',
    } as const;
    const data = encodeFunctionResult({ abi, functionName: 'verify', result: value } as never);
    const r = decodeFunctionResult({ abi, functionName: 'verify', data } as never) as typeof value;
    expect(r.status).toBe(2);
    expect(r.revokeReason).toBe('wrong grade');
    expect(r.issuedAt).toBe(1700000000n);
  });

  it('TokenNotFound / NotAllowedToRevoke decode by name', () => {
    for (const [errorName, args] of [['TokenNotFound', [5n]], ['NotAllowedToRevoke', []], ['AlreadyRevoked', [1n]]] as const) {
      const data = encodeErrorResult({ abi, errorName, args } as never);
      expect(decodeErrorResult({ abi, data }).errorName).toBe(errorName);
    }
  });

  it('ISSUER_ROLE constant matches keccak256("ISSUER_ROLE")', () => {
    expect(keccak256(toBytes('ISSUER_ROLE'))).toBe('0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122');
  });
});
