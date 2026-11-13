import { useState, type DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShareBox } from '../components/ShareBox';
import { CheckLine, ErrorBox, Spinner, StatusBadge } from '../components/ui';
import { useMetadata } from '../hooks/useMetadata';
import { parseTokenId, useVerify } from '../hooks/useVerify';
import { explorerAddr } from '../lib/config';
import { sameHash, sha256File } from '../lib/hash';
import { gatewayUrl } from '../lib/ipfs';
import { fmtTime } from '../lib/time';
import type { VerifyResult } from '../lib/types';

function Lookup() {
  const [id, setId] = useState('');
  const nav = useNavigate();
  return (
    <div className="card mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-semibold">Verify a credential</h1>
      <p className="text-sm text-slate-600">Enter the token ID from the verify link or QR code.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (id.trim()) nav(`/verify/${id.trim()}`); }}>
        <input className="input" inputMode="numeric" placeholder="Token ID, e.g. 1" value={id} onChange={(e) => setId(e.target.value)} />
        <button className="btn">Verify</button>
      </form>
    </div>
  );
}

function PdfDrop({ v }: { v: VerifyResult }) {
  const [res, setRes] = useState<{ name: string; hash: string; match: boolean } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [over, setOver] = useState(false);
  const check = async (f?: File | null) => {
    if (!f) return;
    setErr(null);
    try {
      const hash = await sha256File(f);
      setRes({ name: f.name, hash, match: sameHash(hash, v.docHash) });
    } catch (e) {
      setErr(e);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    check(e.dataTransfer.files?.[0]);
  };
  return (
    <div className="space-y-2">
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-5 text-center text-sm ${over ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'}`}
      >
        <span className="font-medium">Drop the original PDF here, or tap to choose</span>
        <span className="text-xs text-slate-500">Hashed in your browser (SHA-256). The file is never uploaded.</span>
        <input type="file" accept="application/pdf,application/json,.pdf,.json" className="hidden" data-testid="pdf-input" onChange={(e) => check(e.target.files?.[0])} />
      </label>
      <ErrorBox error={err} title="Could not read file" />
      {res ? (
        <CheckLine
          ok={res.match}
          label={res.match ? 'Document matches the on-chain hash' : 'MISMATCH: this document is not the one that was issued'}
          detail={<span className="mono">{res.name}: {res.hash}</span>}
        />
      ) : (
        <CheckLine ok={null} label="Document check: not done yet" detail="Optional. Drop the PDF you were given to confirm it was not edited." />
      )}
    </div>
  );
}

function Result({ v }: { v: VerifyResult }) {
  const meta = useMetadata(v.uri);
  if (v.status === 'NotFound')
    return (
      <div className="card text-center" data-testid="notfound">
        <StatusBadge status="NotFound" big />
        <p className="mt-3 text-sm text-slate-600">No credential #{v.tokenId.toString()} exists on this contract. Check the link or ask the holder.</p>
      </div>
    );
  const banner = { Valid: 'border-green-300 bg-green-50', Revoked: 'border-red-300 bg-red-50', Expired: 'border-amber-300 bg-amber-50' }[v.status];
  return (
    <div className="space-y-4">
      <div className={`card border-2 ${banner}`}>
        <div className="flex flex-col items-center gap-2 text-center">
          <StatusBadge status={v.status} big />
          <h1 className="text-xl font-semibold">{meta.data?.name ?? `Credential #${v.tokenId}`}</h1>
          {meta.data && <p className="text-sm text-slate-700">{meta.data.recipientName} · {meta.data.course}{meta.data.grade ? ` · ${meta.data.grade}` : ''}</p>}
          {v.status === 'Revoked' && <p className="text-sm text-red-800" data-testid="revoke-reason"><b>Reason:</b> {v.revokeReason || '(none given)'}</p>}
          {v.status === 'Expired' && <p className="text-sm text-amber-800">Expired on {fmtTime(v.expiresAt)}</p>}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Checks</h2>
        <CheckLine ok={v.status === 'Valid'} label={`1. On-chain status: ${v.status}`} detail={v.status === 'Revoked' ? v.revokeReason : undefined} />
        <CheckLine
          ok={v.issuerStillApproved}
          label={v.issuerStillApproved ? `2. Issuer is still approved: ${v.issuerName}` : `2. Issuer is NO LONGER approved: ${v.issuerName || v.issuer}`}
          detail={v.issuerStillApproved ? undefined : 'The credential was valid when issued; the admin has since removed this issuer.'}
        />
        <PdfDrop v={v} />
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">Details</h2>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">Token ID</dt><dd>#{v.tokenId.toString()} <span className="text-xs text-slate-500">(soulbound, non-transferable)</span></dd>
          <dt className="text-slate-500">Issuer</dt>
          <dd>{v.issuerName} <a className="mono block text-indigo-600 underline" href={explorerAddr(v.issuer)} target="_blank" rel="noreferrer">{v.issuer}</a></dd>
          <dt className="text-slate-500">Holder</dt><dd className="mono">{v.holder}</dd>
          <dt className="text-slate-500">Issued</dt><dd>{fmtTime(v.issuedAt)}</dd>
          <dt className="text-slate-500">Expires</dt><dd>{fmtTime(v.expiresAt)}</dd>
          <dt className="text-slate-500">Document hash</dt><dd className="mono">{v.docHash}</dd>
          <dt className="text-slate-500">Files</dt>
          <dd className="space-x-3">
            {meta.data?.documentUri && <a className="text-indigo-600 underline" href={gatewayUrl(meta.data.documentUri)} target="_blank" rel="noreferrer">PDF</a>}
            {v.uri && !v.uri.startsWith('mock://') && <a className="text-indigo-600 underline" href={gatewayUrl(v.uri)} target="_blank" rel="noreferrer">Metadata JSON</a>}
            {meta.isLoading && <span className="text-xs text-slate-500">loading metadata…</span>}
            {meta.isError && <span className="text-xs text-amber-700">metadata unavailable from IPFS gateways</span>}
          </dd>
        </dl>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Share</h2>
        <ShareBox tokenId={v.tokenId} />
      </div>
    </div>
  );
}

export function VerifyPage() {
  const { id } = useParams();
  const q = useVerify(id);
  if (!id) return <Lookup />;
  if (parseTokenId(id) === null) return <div className="card text-center text-sm">“{id}” is not a valid token ID. <a className="text-indigo-600 underline" href="/verify">Try again</a></div>;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {q.isLoading && <Spinner label="Reading the blockchain…" />}
      <ErrorBox error={q.error} title="Could not read the contract" />
      {q.data && <Result v={q.data} />}
      {q.data && <button className="btn-secondary w-full" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? 'Refreshing…' : 'Refresh status'}</button>}
    </div>
  );
}
