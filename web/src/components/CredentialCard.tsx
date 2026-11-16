import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMetadata } from '../hooks/useMetadata';
import { fmtDate, shortAddr } from '../lib/time';
import type { VerifyResult } from '../lib/types';
import { StatusBadge } from './ui';

export function CredentialCard({ v, children }: { v: VerifyResult; children?: ReactNode }) {
  const meta = useMetadata(v.uri);
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">#{v.tokenId.toString()}</div>
          <h3 className="truncate text-base font-semibold">{meta.data?.name ?? (meta.isLoading ? 'Loading…' : 'Credential')}</h3>
          <div className="truncate text-sm text-slate-600">{meta.data?.course}</div>
        </div>
        <StatusBadge status={v.status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-slate-500">Issuer</dt>
        <dd className="truncate">{v.issuerName || shortAddr(v.issuer)}</dd>
        <dt className="text-slate-500">Issued</dt>
        <dd>{fmtDate(v.issuedAt)}</dd>
        <dt className="text-slate-500">Expires</dt>
        <dd>{fmtDate(v.expiresAt)}</dd>
      </dl>
      {meta.isError && <p className="text-xs text-amber-700">Metadata unavailable (IPFS). On-chain data above is still authoritative.</p>}
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" to={`/verify/${v.tokenId.toString()}`}>Verify page</Link>
        {children}
      </div>
    </div>
  );
}
