import type { Address, Hex } from 'viem';
import type { VerifyResult } from './types';

export interface IssueInput {
  to: Address;
  uri: string;
  docHash: Hex;
  expiresAt: bigint;
}

export interface TxResult {
  hash: Hex;
  tokenIds: bigint[];
}

export interface IssuerInfo {
  account: Address;
  name: string;
  active: boolean;
}

export interface IssuedItem {
  tokenId: bigint;
  to: Address;
  docHash: Hex;
}

/** Everything the pages need from the chain. Real = wagmi; mock = in-browser store. */
export interface CredChainApi {
  verify(tokenId: bigint): Promise<VerifyResult>;
  tokensOf(holder: Address): Promise<bigint[]>;
  isAdmin(a: Address): Promise<boolean>;
  isIssuer(a: Address): Promise<boolean>;
  issuerName(a: Address): Promise<string>;
  listIssuers(): Promise<IssuerInfo[]>;
  issuedBy(issuer: Address): Promise<IssuedItem[]>;
  addIssuer(account: Address, name: string): Promise<TxResult>;
  removeIssuer(account: Address): Promise<TxResult>;
  issue(i: IssueInput): Promise<TxResult>;
  batchIssue(to: Address[], uri: string[], docHash: Hex[], expiresAt: bigint): Promise<TxResult>;
  revoke(tokenId: bigint, reason: string): Promise<TxResult>;
  /** Only for the demo: shows the soulbound revert. */
  tryTransfer(from: Address, to: Address, tokenId: bigint): Promise<TxResult>;
}
