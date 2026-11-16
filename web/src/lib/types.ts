import type { Address, Hex } from 'viem';

/** Same order as the Solidity enum: NotFound=0, Valid=1, Revoked=2, Expired=3 */
export const STATUS = ['NotFound', 'Valid', 'Revoked', 'Expired'] as const;
export type Status = (typeof STATUS)[number];

export interface VerifyResult {
  tokenId: bigint;
  status: Status;
  issuer: Address;
  issuerName: string;
  holder: Address;
  docHash: Hex;
  uri: string;
  issuedAt: bigint; // unix seconds
  expiresAt: bigint; // 0 = never
  issuerStillApproved: boolean;
  revokeReason: string;
}

/** METADATA_SCHEMA.md (frozen Day 1). Key order matters: we hash the exact JSON bytes. */
export interface CredentialMetadata {
  name: string;
  description: string;
  recipientName: string;
  course: string;
  grade: string;
  issuerName: string;
  issuedDate: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD, optional
  documentUri: string; // ipfs://<cid> ('' in batch mode without a PDF)
  documentSha256: Hex;
}
