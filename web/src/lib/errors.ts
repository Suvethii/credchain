import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

const FRIENDLY: Record<string, string> = {
  Soulbound: 'This credential is soulbound: it cannot be transferred or burned.',
  ZeroAddress: 'Recipient address cannot be the zero address.',
  InvalidExpiry: 'Expiry must be empty or in the future.',
  LengthMismatch: 'Batch arrays have different lengths.',
  BatchTooLarge: 'Batch is larger than 50 credentials.',
  AlreadyRevoked: 'This credential is already revoked.',
  NotAllowedToRevoke: 'Only the issuer who issued this credential, or the admin, can revoke it.',
  ReasonRequired: 'A revoke reason is required.',
  EmptyName: 'Issuer display name cannot be empty.',
  EmptyBatch: 'The batch is empty.',
  TokenNotFound: 'No credential with this token ID.',
  AccessControlBadConfirmation: 'Role confirmation does not match your wallet.',
  ERC721NonexistentToken: 'No credential with this token ID.',
  AccessControlUnauthorizedAccount: 'Your wallet does not have the role needed for this action.',
};

/** Turn any wagmi/viem/fetch error into one short sentence for the UI. */
export function friendlyError(e: unknown): string {
  if (!e) return '';
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return 'You rejected the request in your wallet.';
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = rev?.data?.errorName ?? rev?.reason;
    if (name) return FRIENDLY[name] ?? `Contract reverted: ${name}`;
    if (/insufficient funds/i.test(e.message)) return 'Not enough Sepolia ETH for gas.';
    if (/chain mismatch|does not match the target chain/i.test(e.message)) return 'Wrong network: switch your wallet to the right chain.';
    return e.shortMessage || e.message;
  }
  if (e instanceof Error) {
    const named = Object.keys(FRIENDLY).find((k) => e.message.includes(k));
    return named ? FRIENDLY[named] : e.message;
  }
  return String(e);
}
