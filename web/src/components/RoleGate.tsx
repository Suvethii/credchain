import type { ReactNode } from 'react';
import { useRoles } from '../hooks/useRoles';
import { useWallet } from '../hooks/useWallet';
import { ErrorBox, Spinner } from './ui';

/** Hides a page from wallets without the role. UI only: the contract enforces the real rule. */
export function RoleGate({ role, children }: { role: 'admin' | 'issuer'; children: ReactNode }) {
  const w = useWallet();
  const r = useRoles();
  if (!w.isConnected) return <div className="card text-center text-sm">Connect your wallet to continue.</div>;
  if (w.wrongNetwork) return <div className="card text-center text-sm">Switch to the right network first (banner above).</div>;
  if (r.isLoading) return <Spinner label="Checking your role…" />;
  if (r.error) return <ErrorBox error={r.error} title="Could not read your role" />;
  const ok = role === 'admin' ? r.isAdmin : r.isIssuer;
  if (!ok)
    return (
      <div className="card text-center" data-testid="no-role">
        <h2 className="font-semibold">Not authorised</h2>
        <p className="mt-1 text-sm text-slate-600">
          {role === 'admin' ? 'Only the CredChain admin can manage issuers.' : 'This wallet is not an approved issuer. Ask the admin to add it.'}
        </p>
      </div>
    );
  return <>{children}</>;
}
