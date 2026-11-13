import {
  getPublicClient,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions';
import { BaseError, ContractFunctionRevertedError, keccak256, parseEventLogs, toBytes, type Address, type Hex } from 'viem';
import type { CredChainApi, IssuedItem, IssuerInfo, TxResult } from './api';
import { abi, contractAddress, deployBlock, targetChain } from './config';
import { STATUS, type VerifyResult } from './types';
import { wagmiConfig } from './wagmi';

export const ISSUER_ROLE = keccak256(toBytes('ISSUER_ROLE'));
export const DEFAULT_ADMIN_ROLE = ('0x' + '00'.repeat(32)) as Hex;

const base = { address: contractAddress, abi, chainId: targetChain.id } as const;

async function read<T>(functionName: string, args: unknown[] = []): Promise<T> {
  return (await readContract(wagmiConfig, { ...base, functionName, args } as never)) as T;
}

/** simulate first → revert reason shows BEFORE the wallet pops up; then send and wait 1 confirmation. */
async function write(functionName: string, args: unknown[]): Promise<TxResult> {
  const { request } = await simulateContract(wagmiConfig, { ...base, functionName, args } as never);
  const hash = await writeContract(wagmiConfig, request as never);
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: targetChain.id });
  if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
  const logs = parseEventLogs({ abi, logs: receipt.logs, eventName: 'CredentialIssued' }) as unknown as {
    args: { tokenId: bigint };
  }[];
  return { hash, tokenIds: logs.map((l) => l.args.tokenId) };
}

/**
 * eth_getLogs with block-range chunking (free RPC tiers cap the range). Walks backwards from head
 * to deployBlock, shrinks the chunk on "range too large" errors, stops after maxBlocks.
 */
async function scanLogs(eventName: string, argsFilter?: Record<string, unknown>, maxBlocks = 200_000n) {
  const client = getPublicClient(wagmiConfig, { chainId: targetChain.id });
  if (!client) throw new Error('no RPC client');
  const head = await client.getBlockNumber();
  const floor = deployBlock > 0n ? deployBlock : head > maxBlocks ? head - maxBlocks : 0n;
  const event = (abi as readonly { type: string; name?: string }[]).find((x) => x.type === 'event' && x.name === eventName);
  let chunk = 10_000n;
  let to = head;
  const out: { args: Record<string, unknown>; blockNumber: bigint }[] = [];
  let tries = 0;
  while (to >= floor && tries < 200) {
    tries++;
    const from = to - chunk + 1n > floor ? to - chunk + 1n : floor;
    try {
      const logs = await client.getLogs({ address: contractAddress, event: event as never, args: argsFilter as never, fromBlock: from, toBlock: to });
      out.push(...(logs as unknown as typeof out));
      if (from === floor) break;
      to = from - 1n;
    } catch (e) {
      if (chunk <= 10n) throw e;
      chunk = chunk / 5n; // range too large / timeout → smaller window, bounded retries via `tries`
    }
  }
  return out.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address;
const notFound = (tokenId: bigint): VerifyResult => ({
  tokenId, status: 'NotFound', issuer: ZERO_ADDR, issuerName: '', holder: ZERO_ADDR, docHash: ('0x' + '00'.repeat(32)) as Hex,
  uri: '', issuedAt: 0n, expiresAt: 0n, issuerStillApproved: false, revokeReason: '',
});
function isNotFound(e: unknown): boolean {
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = rev?.data?.errorName;
    return name === 'TokenNotFound' || name === 'ERC721NonexistentToken';
  }
  return false;
}

export const realApi: CredChainApi = {
  async verify(tokenId) {
    // MiniCredChain.verify returns ONE struct (VerifyResult) incl. revokeReason.
    let r: {
      status: number; issuer: Address; issuerName: string; holder: Address; docHash: Hex; uri: string;
      issuedAt: bigint; expiresAt: bigint; issuerStillApproved: boolean; revokeReason: string;
    };
    try {
      r = await read('verify', [tokenId]);
    } catch (e) {
      // Unknown id may revert instead of returning status 0 → show NotFound, not an error.
      if (isNotFound(e)) return notFound(tokenId);
      throw e;
    }
    const v: VerifyResult = {
      tokenId,
      status: STATUS[r.status] ?? 'NotFound',
      issuer: r.issuer,
      issuerName: r.issuerName,
      holder: r.holder,
      docHash: r.docHash,
      uri: r.uri,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
      issuerStillApproved: r.issuerStillApproved,
      revokeReason: r.revokeReason,
    };
    return v;
  },
  tokensOf: (holder) => read<bigint[]>('tokensOf', [holder]).then((x) => [...x]),
  isAdmin: (a) => read<boolean>('hasRole', [DEFAULT_ADMIN_ROLE, a]),
  isIssuer: (a) => read<boolean>('hasRole', [ISSUER_ROLE, a]),
  issuerName: (a) => read<string>('issuerName', [a]),
  async listIssuers() {
    const [added, removed] = await Promise.all([scanLogs('IssuerAdded'), scanLogs('IssuerRemoved')]);
    const map = new Map<string, IssuerInfo & { block: bigint }>();
    for (const l of added) {
      const a = l.args.account as Address;
      map.set(a, { account: a, name: l.args.name as string, active: true, block: l.blockNumber });
    }
    for (const l of removed) {
      const cur = map.get(l.args.account as Address);
      if (cur && l.blockNumber >= cur.block) cur.active = false;
    }
    // Truth is the role, not the log replay (handles re-adds in the same block).
    const list = [...map.values()];
    const roles = await Promise.all(list.map((i) => realApi.isIssuer(i.account)));
    return list.map((i, k) => ({ account: i.account, name: i.name, active: roles[k] }));
  },
  async issuedBy(issuer) {
    const logs = await scanLogs('CredentialIssued', { issuer });
    return logs.map((l): IssuedItem => ({ tokenId: l.args.tokenId as bigint, to: l.args.to as Address, docHash: l.args.docHash as Hex }));
  },
  addIssuer: (account, name) => write('addIssuer', [account, name]),
  removeIssuer: (account) => write('removeIssuer', [account]),
  issue: (i) => write('issue', [i.to, i.uri, i.docHash, i.expiresAt]),
  batchIssue: (to, uri, docHash, expiresAt) => write('batchIssue', [to, uri, docHash, expiresAt]),
  revoke: (tokenId, reason) => write('revoke', [tokenId, reason]),
  tryTransfer: (from, to, tokenId) => write('transferFrom', [from, to, tokenId]),
};
